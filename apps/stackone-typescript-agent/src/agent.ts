/**
 * StackOne AI Agent Example - Using Vercel AI SDK
 *
 * This agent dynamically creates tools from StackOne's MCP endpoint,
 * allowing Claude to call them directly (not via meta-tool).
 */

import "dotenv/config";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText, CoreMessage, CoreTool } from "ai";
import { z } from "zod";
import * as readline from "readline";

// StackOne MCP configuration
const STACKONE_API_KEY = process.env.STACKONE_API_KEY || "";
const MCP_ENDPOINT = "https://api.stackone.com/mcp";

// Conversation history
const conversationHistory: CoreMessage[] = [];
const MAX_HISTORY_TURNS = 10;
const MAX_TOOL_RESULT_LENGTH = 24000;

interface LinkedAccount {
  id: string;
  provider: string;
  status: string;
}

/**
 * Key under which a tool is exposed to the model (and used for registry/API).
 * Format: "provider_accountId_toolName", using underscores as separators.
 * Intended to be compatible with Anthropic tool name requirements (^[a-zA-Z0-9_-]{1,128}$),
 * assuming the provider, accountId, and toolName components themselves are valid.
 */
type ToolKey = string;

/**
 * Build the tool key for a given account and MCP tool by joining components with underscores.
 * Does not modify or sanitize the individual components.
 */
function buildToolKey(provider: string, accountId: string, toolName: string): ToolKey {
  return `${provider}_${accountId}_${toolName}`;
}

/**
 * JSON Schema type definition for MCP tool parameters
 */
interface JsonSchema {
  type?: string | string[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: (string | number | boolean | null)[];
  description?: string;
  default?: unknown;
  // Additional JSON Schema fields we might encounter
  oneOf?: JsonSchema[];
  anyOf?: JsonSchema[];
  allOf?: JsonSchema[];
  $ref?: string;
}

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: JsonSchema;
}

/**
 * Convert JSON Schema to Zod schema
 * Handles common types and falls back to z.unknown() for unsupported cases
 */
function jsonSchemaToZod(schema: JsonSchema | undefined): z.ZodTypeAny {
  if (!schema) {
    return z.record(z.unknown());
  }

  // Handle enum first (can appear with or without type)
  if (schema.enum && schema.enum.length > 0) {
    const enumValues = schema.enum.filter((v): v is string => typeof v === "string");
    if (enumValues.length > 0 && enumValues.length === schema.enum.length) {
      const zodEnum = z.enum(enumValues as [string, ...string[]]);
      return schema.description ? zodEnum.describe(schema.description) : zodEnum;
    }
    // For mixed enums, use union of literals (including null entries)
    const literals = schema.enum.map((v) =>
      v === null ? z.literal(null) : z.literal(v as string | number | boolean),
    );
    if (literals.length === 1) {
      const singleLiteral = literals[0];
      return schema.description
        ? singleLiteral.describe(schema.description)
        : singleLiteral;
    }
    const zodUnion = z.union(literals as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]]);
    return schema.description ? zodUnion.describe(schema.description) : zodUnion;
  }

  // Handle type-based conversion
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;

  switch (type) {
    case "string": {
      const zodString = z.string();
      return schema.description ? zodString.describe(schema.description) : zodString;
    }

    case "number":
    case "integer": {
      const zodNumber = z.number();
      return schema.description ? zodNumber.describe(schema.description) : zodNumber;
    }

    case "boolean": {
      const zodBoolean = z.boolean();
      return schema.description ? zodBoolean.describe(schema.description) : zodBoolean;
    }

    case "null": {
      const zodNull = z.null();
      return schema.description ? zodNull.describe(schema.description) : zodNull;
    }

    case "array": {
      const itemSchema = jsonSchemaToZod(schema.items);
      const zodArray = z.array(itemSchema);
      return schema.description ? zodArray.describe(schema.description) : zodArray;
    }

    case "object": {
      return jsonSchemaObjectToZod(schema);
    }

    default: {
      // Fallback: if properties exist, treat as object
      if (schema.properties) {
        return jsonSchemaObjectToZod(schema);
      }
      // Unknown type - use permissive schema
      const zodUnknown = z.record(z.unknown());
      return schema.description ? zodUnknown.describe(schema.description) : zodUnknown;
    }
  }
}

/**
 * Convert JSON Schema object type to Zod object schema
 */
function jsonSchemaObjectToZod(schema: JsonSchema): z.ZodTypeAny {
  if (!schema.properties) {
    const zodRecord = z.record(z.unknown());
    return schema.description ? zodRecord.describe(schema.description) : zodRecord;
  }

  const required = new Set(schema.required || []);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, propSchema] of Object.entries(schema.properties)) {
    let zodProp = jsonSchemaToZod(propSchema);

    // Make non-required fields optional
    if (!required.has(key)) {
      zodProp = zodProp.optional();
    }

    shape[key] = zodProp;
  }

  // Use passthrough to allow additional properties (common in MCP tools)
  const zodObject = z.object(shape).passthrough();
  return schema.description ? zodObject.describe(schema.description) : zodObject;
}

/**
 * Fetch all linked accounts from StackOne
 */
async function getLinkedAccounts(): Promise<LinkedAccount[]> {
  const response = await fetch("https://api.stackone.com/accounts", {
    headers: {
      Authorization: `Basic ${Buffer.from(STACKONE_API_KEY + ":").toString("base64")}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch accounts: ${response.status}`);
  }

  return response.json();
}

/**
 * Make an MCP request to StackOne
 */
async function mcpRequest(
  method: string,
  params: Record<string, unknown> = {},
  accountId: string
): Promise<unknown> {
  const response = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(STACKONE_API_KEY + ":").toString("base64")}`,
      "x-account-id": accountId,
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: `req-${method}-${Date.now()}`,
      method,
      params,
    }),
  });

  if (!response.ok) {
    throw new Error(`MCP request failed: ${response.status}`);
  }

  return response.json();
}

/** Single tool entry in the registry (accountId + raw MCP tool name). */
interface ToolRegistryEntry {
  accountId: string;
  rawName: string;
}

/**
 * Registry of tools exposed to the model. Encapsulates lookup by ToolKey
 * and MCP invocation (accountId + raw tool name).
 */
interface ToolRegistry {
  register(toolKey: ToolKey, accountId: string, rawName: string): void;
  getAccountId(toolKey: ToolKey): string | undefined;
  getRawName(toolKey: ToolKey): string | undefined;
  callTool(toolKey: ToolKey, args: Record<string, unknown>): Promise<unknown>;
}

function createToolRegistry(): ToolRegistry {
  const entries = new Map<ToolKey, ToolRegistryEntry>();

  return {
    register(toolKey, accountId, rawName) {
      entries.set(toolKey, { accountId, rawName });
    },

    getAccountId(toolKey) {
      return entries.get(toolKey)?.accountId;
    },

    getRawName(toolKey) {
      return entries.get(toolKey)?.rawName ?? toolKey;
    },

    async callTool(toolKey, args) {
      const entry = entries.get(toolKey);
      if (!entry) {
        throw new Error(`Unknown tool: ${toolKey}`);
      }
      const result = (await mcpRequest(
        "tools/call",
        { name: entry.rawName, arguments: args },
        entry.accountId
      )) as { result?: unknown };
      return result.result ?? result;
    },
  };
}

/**
 * Convert MCP tools to Vercel AI SDK tools
 * @param mcpTool - The underlying MCP tool definition
 * @param toolKey - Single key for registry, tools object, and API (format: provider_accountId_toolName)
 * @param registry - Registry used to invoke the tool (lookup + MCP call)
 */
function createVercelTool(mcpTool: McpTool, toolKey: ToolKey, registry: ToolRegistry): CoreTool {
  // Convert JSON Schema to Zod, or use permissive fallback
  const parameters = jsonSchemaToZod(mcpTool.inputSchema);

  return {
    description: mcpTool.description || `Call the ${toolKey} tool`,
    parameters,
    execute: async (args: Record<string, unknown>) => {
      console.log(`🔧 Calling: ${toolKey}`);

      try {
        const result = await registry.callTool(toolKey, args);
        const resultStr = JSON.stringify(result, null, 2);

        // Truncate large results
        if (resultStr.length > MAX_TOOL_RESULT_LENGTH) {
          console.log(`  ⚠ Truncated (${resultStr.length} chars)`);
          return {
            success: true,
            data: resultStr.slice(0, MAX_TOOL_RESULT_LENGTH),
            truncated: true,
            note: "Result truncated. Request more specific data if needed.",
          };
        }

        return { success: true, data: result };
      } catch (error) {
        console.log(`  ❌ Error: ${error}`);
        return { success: false, error: String(error) };
      }
    },
  };
}

interface FetchToolsResult {
  tools: Record<string, CoreTool>;
  providerCounts: Record<string, number>;
}

/**
 * Register a single MCP tool in the registry and tools record.
 * Tool key uses underscores only (API-safe); same key used everywhere.
 */
function registerTool(
  account: LinkedAccount,
  mcpTool: McpTool,
  registry: ToolRegistry,
  tools: Record<string, CoreTool>
): void {
  const toolKey = buildToolKey(account.provider, account.id, mcpTool.name);
  registry.register(toolKey, account.id, mcpTool.name);
  tools[toolKey] = createVercelTool(mcpTool, toolKey, registry);
}

/**
 * Fetch tools from all linked accounts and create Vercel tools
 */
async function fetchAndCreateTools(): Promise<FetchToolsResult> {
  console.log("Fetching linked accounts...");
  const accounts = await getLinkedAccounts();

  const registry = createToolRegistry();
  const tools: Record<string, CoreTool> = {};
  const providerCounts: Record<string, number> = {};

  for (const account of accounts) {
    if (account.status !== "active") {
      console.log(`  Skipping ${account.provider} (status: ${account.status})`);
      continue;
    }

    console.log(`Fetching tools from ${account.provider}...`);

    try {
      const result = (await mcpRequest("tools/list", {}, account.id)) as {
        result?: { tools?: McpTool[] };
      };
      const mcpTools = result.result?.tools || [];

      for (const mcpTool of mcpTools) {
        registerTool(account, mcpTool, registry, tools);
      }

      providerCounts[account.provider] =
        (providerCounts[account.provider] || 0) + mcpTools.length;
      console.log(`  Found ${mcpTools.length} tools`);
    } catch (error) {
      console.warn(`  Warning: Could not fetch from ${account.provider}: ${error}`);
    }
  }

  const total = Object.keys(tools).length;
  console.log(`\nTotal: ${total} tools from ${Object.keys(providerCounts).length} providers`);

  return { tools, providerCounts };
}

/**
 * Build system prompt dynamically based on available providers
 */
function buildSystemPrompt(providerCounts: Record<string, number>): string {
  const providers = Object.entries(providerCounts);
  
  // Build capabilities list from actual providers
  const capabilities = providers
    .map(([provider, count]) => `- **${provider}**: ${count} tools available`)
    .join('\n');

  // Base prompt
  let prompt = `You are a helpful assistant with access to StackOne's unified API tools.
You can directly call tools for the user's connected services.

Connected providers:
${capabilities}

Tool names follow the pattern: provider_accountId_action (e.g., gmail_abc123_gmail_list_messages, googledrive_xyz789_drive_list_files). Use the exact tool names listed in your available tools.
Use tool names and descriptions to understand their capabilities.
You have conversation history - you can reference previous results.
Always complete multi-step tasks fully.`;

  // Add provider-specific tips only if those providers are connected
  const providerNames = providers.map(([name]) => name.toLowerCase());

  if (providerNames.some(p => p.includes('gmail'))) {
    prompt += `

Gmail tips:
- Reading attachments: Use gmail_get_message first, then gmail_get_attachment with the attachmentId
- Sending emails: Use gmail_send_message (requires RFC 2822 format) or create a draft first`;
  }

  if (providerNames.some(p => p.includes('drive'))) {
    prompt += `

Google Drive tips:
- Most tools use nested parameters: { "query": {...} } or { "path": { "id": "..." } }`;
  }

  return prompt;
}

/**
 * Run the agent with conversation history
 */
async function runAgent(
  userMessage: string,
  tools: Record<string, CoreTool>,
  systemPrompt: string
): Promise<string> {
  console.log(`\n📝 User: ${userMessage}\n`);

  // Add to history
  conversationHistory.push({ role: "user", content: userMessage });

  try {
    const { text, toolCalls, messages: responseMessages } = await generateText({
      model: anthropic("claude-sonnet-4-20250514"),
      system: systemPrompt,
      messages: conversationHistory,
      tools,
      maxSteps: 15, // Allow more steps for multi-tool workflows
    });

    // Log tool summary
    if (toolCalls && toolCalls.length > 0) {
      const toolNames = toolCalls.map((t) => t.toolName);
      const uniqueTools = [...new Set(toolNames)];
      console.log(`\n📊 Tools used: ${uniqueTools.join(", ")} (${toolCalls.length} calls)`);
    }

    // Persist full response (assistant + tool calls + tool results) so follow-ups can reference prior results
    if (responseMessages && responseMessages.length > 0) {
      for (const msg of responseMessages) {
        conversationHistory.push(msg as CoreMessage);
      }
    } else {
      // Fallback: SDK may not return messages in some versions
      conversationHistory.push({ role: "assistant", content: text });
    }

    // Trim history if needed
    while (conversationHistory.length > MAX_HISTORY_TURNS * 2) {
      conversationHistory.shift();
    }

    console.log(`\n🤖 Assistant: ${text}\n`);
    return text;
  } catch (error) {
    console.error("Agent error:", error);
    throw error;
  }
}

/**
 * Interactive CLI mode
 */
async function interactiveMode(
  tools: Record<string, CoreTool>,
  providerCounts: Record<string, number>,
  systemPrompt: string
): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║           StackOne AI Agent (TypeScript)                 ║");
  console.log("╠══════════════════════════════════════════════════════════╣");
  console.log("║  Direct tool access - no meta-tool overhead!             ║");
  console.log("║  Commands: 'quit' to exit, '/clear' to reset history     ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");

  // Show provider summary from actual data
  const summary = Object.entries(providerCounts)
    .map(([provider, count]) => `${count} ${provider}`)
    .join(", ");
  console.log(`Tools: ${summary}\n`);

  // Show dynamic examples based on connected providers
  const providerNames = Object.keys(providerCounts).map(p => p.toLowerCase());
  console.log("Examples:");
  if (providerNames.some(p => p.includes('gmail'))) {
    console.log("  • List my recent emails");
    console.log("  • Read my last email and reply saying I'll get back to them");
  }
  if (providerNames.some(p => p.includes('ashby'))) {
    console.log("  • Show open jobs in Ashby");
  }
  if (providerNames.some(p => p.includes('drive'))) {
    console.log("  • List files in my Drive");
  }
  if (providerNames.some(p => p.includes('slack'))) {
    console.log("  • Send a message to #general channel");
  }
  if (providerNames.some(p => p.includes('salesforce') || p.includes('hubspot'))) {
    console.log("  • List my recent contacts");
  }
  // Fallback generic example if no specific providers matched
  if (!providerNames.some(p => ['gmail', 'ashby', 'drive', 'slack', 'salesforce', 'hubspot'].some(known => p.includes(known)))) {
    console.log("  • List available data");
    console.log("  • Show me what you can do");
  }
  console.log("");

  const askQuestion = (): void => {
    rl.question("You: ", async (input) => {
      const trimmed = input.trim();

      if (["quit", "exit", "q"].includes(trimmed.toLowerCase())) {
        console.log("Goodbye!");
        rl.close();
        return;
      }

      if (trimmed.toLowerCase() === "/clear") {
        conversationHistory.length = 0;
        console.log("History cleared.\n");
        askQuestion();
        return;
      }

      if (!trimmed) {
        askQuestion();
        return;
      }

      try {
        await runAgent(trimmed, tools, systemPrompt);
      } catch (error) {
        console.error("Error:", error);
      }

      askQuestion();
    });
  };

  askQuestion();
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  if (!STACKONE_API_KEY) {
    console.error("Error: STACKONE_API_KEY not set");
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("Error: ANTHROPIC_API_KEY not set");
    process.exit(1);
  }

  // Fetch and create tools
  const result = await fetchAndCreateTools().catch((error): never => {
    console.error("Failed to fetch tools:", error);
    return process.exit(1);
  });

  const { tools, providerCounts } = result;

  if (Object.keys(tools).length === 0) {
    console.error("No tools available. Check your StackOne configuration.");
    process.exit(1);
  }

  // Build system prompt based on actual connected providers
  const systemPrompt = buildSystemPrompt(providerCounts);

  await interactiveMode(tools, providerCounts, systemPrompt);
}

main().catch(console.error);

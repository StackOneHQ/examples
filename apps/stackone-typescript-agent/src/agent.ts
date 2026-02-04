/**
 * StackOne AI Agent - Vercel AI SDK + StackOne Toolset SDK
 */

import "dotenv/config";
import { anthropic } from "@ai-sdk/anthropic";
import { generateText, stepCountIs, type ToolSet } from "ai";
import { StackOneToolSet } from "@stackone/ai";
import * as readline from "readline";

const STACKONE_ACCOUNT_ID = process.env.STACKONE_ACCOUNT_ID ?? "";
const STACKONE_BASE_URL = process.env.STACKONE_BASE_URL ?? "https://api.stackone.com";
const TOOL_FILTER = process.env.STACKONE_TOOL_FILTER ?? "*";
const MODEL = process.env.MODEL ?? "claude-sonnet-4-20250514";
const MAX_HISTORY_TURNS = 10;

type Message = { role: "user" | "assistant"; content: string };
const conversationHistory: Message[] = [];

const SYSTEM_PROMPT = `You are a helpful assistant with access to StackOne tools.
Use the available tools to help the user with their requests.
You have conversation history - you can reference previous results.
Always complete multi-step tasks fully.`;

// ANSI color codes
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
};

function formatError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("401") || message.includes("Unauthorized")) {
    return "Authentication failed. Check your API keys.";
  }
  if (message.includes("rate") || message.includes("429")) {
    return "Rate limited. Please wait a moment and try again.";
  }
  if (message.includes("timeout") || message.includes("ETIMEDOUT")) {
    return "Request timed out. Please try again.";
  }
  if (message.includes("network") || message.includes("ENOTFOUND")) {
    return "Network error. Check your internet connection.";
  }
  return message;
}

function trimHistory(messages: Message[], maxTurns: number): void {
  if (messages.length <= 0 || maxTurns <= 0) return;
  let userCount = 0;
  let startIndex = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      userCount++;
      if (userCount >= maxTurns) {
        startIndex = i;
        break;
      }
    }
  }
  if (startIndex > 0) {
    messages.splice(0, startIndex);
  }
}

async function loadTools(): Promise<ToolSet> {
  const toolset = new StackOneToolSet({
    baseUrl: STACKONE_BASE_URL,
    accountId: STACKONE_ACCOUNT_ID,
  });

  const actions = TOOL_FILTER !== "*" ? [TOOL_FILTER] : undefined;
  const tools = await toolset.fetchTools({ actions });
  // Type assertion needed due to SDK schema type variance
  return tools.toAISDK() as unknown as ToolSet;
}

async function runAgent(userMessage: string, tools: ToolSet): Promise<string> {
  const result = await generateText({
    model: anthropic(MODEL),
    system: SYSTEM_PROMPT,
    messages: [...conversationHistory, { role: "user" as const, content: userMessage }],
    tools,
    stopWhen: stepCountIs(15),
  });

  const { text } = result;
  conversationHistory.push({ role: "user", content: userMessage });
  conversationHistory.push({ role: "assistant", content: text });
  trimHistory(conversationHistory, MAX_HISTORY_TURNS);
  return text;
}

function printBanner(toolCount: number): void {
  const { cyan, bright, reset, dim, yellow } = colors;

  console.log(`
${cyan}${bright}  ┌─────────────────────────────────────────┐
  │                                         │
  │   ${yellow}◆${cyan}  StackOne AI Agent                  │
  │                                         │
  └─────────────────────────────────────────┘${reset}

${dim}  Powered by Vercel AI SDK + StackOne Toolset${reset}
${dim}  Model: ${reset}${MODEL}
${dim}  Tools: ${reset}${toolCount} loaded

${bright}  Commands${reset}
${dim}  ────────────────────────────────────────${reset}
  ${yellow}quit${reset}, ${yellow}exit${reset}, ${yellow}q${reset}    Exit the agent
  ${yellow}/clear${reset}           Clear conversation history

${cyan}  ────────────────────────────────────────${reset}
`);
}

async function interactiveMode(tools: ToolSet): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const isInteractive = process.stdin.isTTY;
  const { green, magenta, reset, bright, dim, yellow } = colors;

  if (isInteractive) {
    printBanner(Object.keys(tools).length);
  }

  if (!isInteractive) {
    const lines: string[] = [];
    for await (const line of rl) {
      lines.push(line);
    }
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !["quit", "exit", "q"].includes(trimmed.toLowerCase())) {
        try {
          const response = await runAgent(trimmed, tools);
          console.log(response);
        } catch (error) {
          console.error(`Error: ${formatError(error)}`);
        }
      }
    }
    return;
  }

  const askQuestion = (): void => {
    rl.question(`${green}${bright}  You ${reset}${dim}>${reset} `, async (input) => {
      const trimmed = input.trim();

      if (["quit", "exit", "q"].includes(trimmed.toLowerCase())) {
        console.log(`\n${dim}  Goodbye!${reset}\n`);
        rl.close();
        return;
      }

      if (trimmed.toLowerCase() === "/clear") {
        conversationHistory.length = 0;
        console.log(`${dim}  History cleared.${reset}\n`);
        askQuestion();
        return;
      }

      if (!trimmed) {
        askQuestion();
        return;
      }

      try {
        console.log();
        const response = await runAgent(trimmed, tools);
        console.log(`${magenta}${bright}  Assistant ${reset}${dim}>${reset} ${response}\n`);
      } catch (error) {
        console.error(`${yellow}  Error: ${formatError(error)}${reset}\n`);
      }

      askQuestion();
    });
  };

  rl.on("close", () => {
    console.log(`\n${dim}  Goodbye!${reset}\n`);
    process.exit(0);
  });

  askQuestion();
}

async function main(): Promise<void> {
  const { yellow, reset, dim } = colors;

  if (!process.env.STACKONE_API_KEY) {
    console.error(`${yellow}Error:${reset} STACKONE_API_KEY not set`);
    process.exit(1);
  }

  if (!STACKONE_ACCOUNT_ID) {
    console.error(`${yellow}Error:${reset} STACKONE_ACCOUNT_ID not set`);
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(`${yellow}Error:${reset} ANTHROPIC_API_KEY not set`);
    process.exit(1);
  }

  console.log(`\n${dim}  Loading tools...${reset}`);
  const tools = await loadTools();

  if (Object.keys(tools).length === 0) {
    console.error(`${yellow}Error:${reset} No tools available. Check STACKONE_ACCOUNT_ID and STACKONE_TOOL_FILTER.`);
    process.exit(1);
  }

  await interactiveMode(tools);
}

main().catch(console.error);

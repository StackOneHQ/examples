import { tool } from 'ai'
import { StackOneToolSet, type JsonObject } from '@stackone/ai'
import { z } from 'zod'
import { createAzureOpenAILLM } from '@/lib/llamaindex/config'
import { logger } from '@/utils/logger'

export interface DocumentContextItem {
  name: string
  remote_document_id: string | null
  mime_type: string
  url: string | null
}

// Set DEBUG_STACKONE_UTILITY_TOOLS=1 (or DEBUG_STACKONE_META_TOOLS=1) to log underlying HTTP request/response for StackOne API calls
const DEBUG_SDK = process.env.DEBUG_STACKONE_UTILITY_TOOLS === '1' || process.env.DEBUG_STACKONE_UTILITY_TOOLS === 'true' || process.env.DEBUG_STACKONE_META_TOOLS === '1' || process.env.DEBUG_STACKONE_META_TOOLS === 'true'
const MAX_LOG_BODY = 2000

function redactAuth(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj
  const o = obj as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(o)) {
    if (k.toLowerCase() === 'authorization' || k.toLowerCase() === 'cookie') out[k] = '[REDACTED]'
    else if (v && typeof v === 'object' && !Array.isArray(v)) out[k] = redactAuth(v)
    else out[k] = v
  }
  return out
}

function installFetchDebug() {
  if (!DEBUG_SDK || typeof globalThis.fetch !== 'function') return
  const orig = globalThis.fetch
  if ((orig as unknown as { __stackoneDebug?: boolean }).__stackoneDebug) return
  const wrapped = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.includes('stackone') && !url.includes('api.stackone')) {
      return orig(input, init)
    }
    const method = init?.method ?? 'GET'
    const bodyRaw = typeof init?.body === 'string' ? init.body : undefined
    let bodyObj: unknown
    try {
      bodyObj = bodyRaw ? redactAuth(JSON.parse(bodyRaw)) : undefined
    } catch {
      bodyObj = bodyRaw ? bodyRaw.slice(0, 200) : undefined
    }
    logger.log('[StackOne tools] HTTP request:', {
      url,
      method,
      body: bodyObj !== undefined ? (typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj)).slice(0, MAX_LOG_BODY) : undefined
    })
    const response = await orig(input, init)
    const clone = response.clone()
    let responseBody: string | undefined
    try {
      responseBody = await clone.text()
    } catch {
      responseBody = undefined
    }
    logger.log('[StackOne tools] HTTP response:', {
      url: url.slice(0, 80),
      status: response.status,
      body: responseBody ? responseBody.slice(0, MAX_LOG_BODY) : undefined
    })
    return response
  }
  ;(wrapped as unknown as { __stackoneDebug: boolean }).__stackoneDebug = true
  globalThis.fetch = wrapped as typeof fetch
}

installFetchDebug()

export interface UtilityToolsSearchResult {
  name: string
  description: string
  score: number
}

/** Exclude feedback and other non-action tools from search results so we never execute them for user requests. */
function isActionableTool(name: string): boolean {
  const n = name.toLowerCase()
  return n !== 'tool_feedback' && !n.includes('feedback')
}

/**
 * Whether a tool benefits from LLM-generated params (e.g. documentId).
 * Derived from the tool schema when available (path.documentId or path.spreadsheetId); otherwise fallback by name.
 */
export function toolNeedsDocumentParams(
  toolName: string,
  parameters?: Record<string, unknown> | null
): boolean {
  if (parameters?.properties && typeof parameters.properties === 'object') {
    const path = (parameters.properties as Record<string, unknown>).path
    if (path && typeof path === 'object' && path !== null) {
      const pathProps = (path as Record<string, unknown>).properties
      if (pathProps && typeof pathProps === 'object') {
        if ('documentId' in pathProps || 'spreadsheetId' in pathProps) return true
      }
    }
  }
  const n = toolName.toLowerCase()
  return (
    n.includes('googledocs_update_document') ||
    n.includes('googledocs_get_document') ||
    n.includes('googlesheets_update_values') ||
    n.includes('googlesheets_get_spreadsheet') ||
    n.includes('googlesheets_batch_update') ||
    n.includes('googlesheets_append_values') ||
    n.includes('googlesheets_clear_values') ||
    n.includes('googlesheets_get_values') ||
    n.includes('googlesheets_batch_get_values')
  )
}

const TOOL_PARAMS_SYSTEM_BASE = `You generate JSON parameters for a provider API tool. You are given full context: the current user message, conversation history, available documents, the tool schema, and (when present) the current turn's tool calls and results. Use all of this to infer the correct parameter values—e.g. for update/replace tools, infer what to match and what to replace from the conversation and any document content in the context. Output only valid JSON, no markdown or explanation. Match the parameter structure exactly as shown in the tool schema.`

/**
 * Get a specific tool's schema/parameters from StackOne.
 */
async function getToolSchema(accountIds: string[], toolName: string): Promise<{ description?: string; parameters?: Record<string, unknown> } | null> {
  try {
    const tools = await getToolsForAccounts(accountIds)
    const allTools = typeof tools.toArray === 'function' ? tools.toArray() : []
    const tool = allTools.find((t: { name: string }) => t.name === toolName)
    if (tool) {
      return {
        description: (tool as { description?: string }).description,
        parameters: (tool as { parameters?: unknown }).parameters as Record<string, unknown> | undefined,
      }
    }
    return null
  } catch (error) {
    logger.error('[StackOne tools] Failed to get tool schema:', error)
    return null
  }
}

/**
 * Use the LLM to generate tool parameters dynamically based on the tool's schema from StackOne.
 * @unused Legacy function from old agent-loop implementation. Not used by current ToolLoopAgent-based agent.
 */
export async function generateToolParamsWithLLM(
  userMessage: string,
  documentContext: DocumentContextItem[],
  toolName: string,
  accountIds: string[],
  conversationContext?: string,
  accumulatedContext?: string,
  currentTurnMessages?: Array<{ role: string; content: unknown }>
): Promise<Record<string, unknown>> {
  // Get the tool's schema from StackOne
  const toolSchema = await getToolSchema(accountIds, toolName)
  
  const docList = documentContext
    .map((d) => `${d.name} | remote_document_id: ${d.remote_document_id ?? 'n/a'} | mime_type: ${d.mime_type}`)
    .join('\n')
  
  const contextParts: string[] = []
  if (conversationContext) {
    contextParts.push(`Conversation so far:\n${conversationContext}`)
  }
  if (currentTurnMessages && currentTurnMessages.length > 0) {
    const turnSummary = currentTurnMessages
      .map((m) => {
        if (m.role === 'assistant' && typeof m.content === 'object') {
          const content = m.content as Array<{ type?: string; toolName?: string; input?: unknown; output?: unknown }>
          const toolCalls = content.filter((c) => c.type === 'tool-call')
          if (toolCalls.length) {
            return toolCalls.map((t) => `Tool call: ${t.toolName}\nInput: ${JSON.stringify(t.input)}\nOutput: ${typeof t.output === 'object' ? JSON.stringify(t.output).slice(0, 2000) : t.output}`).join('\n')
          }
        }
        if (m.role === 'tool' && typeof m.content === 'object') {
          const content = m.content as Array<{ toolName?: string; output?: unknown }>
          return content.map((t) => `Tool result (${t.toolName}): ${typeof t.output === 'object' ? JSON.stringify(t.output).slice(0, 3000) : t.output}`).join('\n')
        }
        return null
      })
      .filter(Boolean)
      .join('\n\n')
    if (turnSummary) {
      contextParts.push(`Current turn (tool calls and results):\n${turnSummary}`)
    }
  }
  if (accumulatedContext) {
    contextParts.push(`Additional context (e.g. document content from previous tools):\n${accumulatedContext}`)
  }
  
  // Build dynamic prompt based on tool schema
  let schemaInfo = ''
  if (toolSchema) {
    schemaInfo = `\n\nTool Description: ${toolSchema.description || 'No description available'}\n`
    if (toolSchema.parameters) {
      schemaInfo += `Tool Parameters Schema:\n${JSON.stringify(toolSchema.parameters, null, 2)}\n`
    }
  } else {
    schemaInfo = `\n\nNote: Tool schema not available. Generate parameters based on the tool name and standard patterns.`
  }
  
  const userPrompt = `Tool: ${toolName}${schemaInfo}\n\nCurrent user message: ${userMessage}${
    contextParts.length > 0 ? `\n\n${contextParts.join('\n\n')}` : ''
  }\n\nAvailable Documents:\n${docList}\n\nUsing the tool schema and all context above, generate the JSON parameters for this tool. Output only valid JSON:`

  const llm = createAzureOpenAILLM()
  const stream = await llm.chat({
    messages: [
      { role: 'user', content: TOOL_PARAMS_SYSTEM_BASE },
      { role: 'user', content: userPrompt },
    ],
    stream: true,
  })
  let text = ''
  for await (const chunk of stream) {
    if (chunk.delta) text += chunk.delta
  }
  const trimmed = text.trim()
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/)
  const jsonStr = jsonMatch ? jsonMatch[0] : trimmed
  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>
    logger.log('[StackOne tools] LLM generated params:', { toolName, keys: Object.keys(parsed), params: JSON.stringify(parsed).slice(0, 500) })
    return parsed
  } catch (e) {
    logger.error('[StackOne tools] Failed to parse LLM params as JSON:', jsonStr.slice(0, 300), e)
    return {}
  }
}

export interface UtilityToolsResult {
  tools: UtilityToolsSearchResult[]
  executed?: unknown
  error?: string
}

/**
 * Fetch StackOne tools for the given account IDs.
 * The SDK returns only tools available for those accounts (filtering is server-side).
 */
async function getToolsForAccounts(accountIds: string[]) {
  if (!process.env.STACKONE_API_KEY) {
    console.error('[StackOne tools] STACKONE_API_KEY is not configured')
    throw new Error('STACKONE_API_KEY is not configured')
  }

  const baseUrl = process.env.STACKONE_BASE_URL ?? 'https://api.stackone.com'
  console.log('[StackOne tools] fetchTools starting', { accountCount: accountIds.length, baseUrl })
  const toolset = new StackOneToolSet({ baseUrl })
  const tools = await toolset.fetchTools({ accountIds })

  const accountIdsForLog = accountIds.map((id) => id.slice(0, 12) + '...')
  const toolCount = tools.toArray().length
  console.log('[StackOne tools] fetchTools result:', { accountIdsForLog, toolCount })

  return tools
}

/**
 * Get StackOne utility tools (stackone_search + stackone_execute) in AI SDK format.
 * Uses @stackone/ai 2.4+ API: getSearchTool().search() for discovery,
 * fetchTools() + execute for execution. Keeps the search/execute pattern
 * to avoid flooding the model's context with all available tools.
 */
export async function getStackOneUtilityToolsForAISDK(accountIds: string[]) {
  if (accountIds.length === 0) return {}
  try {
    if (!process.env.STACKONE_API_KEY) {
      console.error('[StackOne tools] STACKONE_API_KEY is not configured')
      return {}
    }

    const baseUrl = process.env.STACKONE_BASE_URL ?? 'https://api.stackone.com'
    const toolset = new StackOneToolSet({
      baseUrl,
      search: { method: 'local' },
    })
    toolset.setAccounts(accountIds)
    const searchTool = toolset.getSearchTool({ search: 'local' })

    console.log('[StackOne tools] getStackOneUtilityToolsForAISDK: toolset created with 2.5.0 API, local search mode')

    const toolSearchAISDK = tool({
      description: 'Use when the user wants to perform an action on their connected apps or documents (e.g. update a doc, list files, send something) and you need to find which provider tool can do it. Do not use for questions that only need reading document content—use getInformationFromRAG for that.',
      inputSchema: z.object({
        query: z.string().describe('Natural language query describing what tools you need'),
      }),
      execute: async (args) => {
        const queryPreview = typeof args?.query === 'string' ? args.query.slice(0, 100) + (args.query.length > 100 ? '...' : '') : ''
        console.log('[StackOne tools] stackone_search called (local):', { query: queryPreview })
        try {
          const foundTools = await searchTool.search(args.query, { accountIds, topK: 10 })
          const toolsList = foundTools.toArray().map((t: { name: string; description?: string; parameters?: unknown }) => ({
            name: t.name,
            description: (t as { description?: string }).description,
            parameters: (t as { parameters?: unknown }).parameters,
          }))
          console.log('[StackOne tools] stackone_search result:', { toolCount: toolsList.length, tools: toolsList.map((t: { name: string }) => t.name) })

          const firstTool = toolsList[0]
          return {
            tools: toolsList,
            instruction: toolsList.length > 0
              ? `You MUST call stackone_execute next with BOTH toolName AND params. Read the "parameters" schema above carefully and populate ALL required fields. Example for googledocs_update_document: { "toolName": "googledocs_update_document", "params": { "path": { "documentId": "<remote_document_id>" }, "body": { "requests": [{ "replaceAllText": { "containsText": { "text": "<old text>", "matchCase": true }, "replaceText": "<new text>" } }] } } }. Do NOT call stackone_execute without params.`
              : 'No matching tools found.',
          }
        } catch (error) {
          console.error('[StackOne tools] stackone_search error:', error instanceof Error ? error.message : error)
          return { error: error instanceof Error ? error.message : String(error) }
        }
      },
    })

    const toolExecuteAISDK = tool({
      description: 'Execute a provider tool found via stackone_search. You MUST use the EXACT full tool name and provide ALL required parameters from the schema returned by stackone_search. The params object must match the schema structure exactly (e.g. { "path": { "documentId": "..." }, "body": { "requests": [...] } }).',
      inputSchema: z.object({
        toolName: z.string().describe('The EXACT full tool name from stackone_search results (e.g. "googledocs_update_document")'),
        params: z.record(z.string(), z.unknown()).describe('REQUIRED: The parameters object matching the tool schema from stackone_search. Must include all required fields (e.g. path.documentId, body.requests for document updates).'),
      }),
      execute: async (args) => {
        const toolName = typeof args?.toolName === 'string' ? args.toolName : '<unknown>'
        const params = (args?.params && typeof args.params === 'object' ? args.params : {}) as Record<string, unknown>
        console.log('[StackOne tools] stackone_execute called:', { toolName, paramKeys: Object.keys(params) })
        try {
          const tools = await toolset.fetchTools({ actions: [toolName], accountIds })
          const availableNames = tools.toArray().map((t: { name: string }) => t.name)
          const targetTool = tools.getTool(toolName)
          if (!targetTool) {
            console.error('[StackOne tools] stackone_execute: tool not found:', toolName, 'available:', availableNames)
            return { error: `Tool "${toolName}" not found. Available tools: ${availableNames.join(', ')}. Use the exact name from stackone_search results.` }
          }
          const result = await targetTool.execute(params as JsonObject)
          console.log('[StackOne tools] stackone_execute result:', { toolName, success: true })
          return result
        } catch (error) {
          console.error('[StackOne tools] stackone_execute error:', { toolName, error: error instanceof Error ? error.message : String(error) })
          return { error: error instanceof Error ? error.message : String(error) }
        }
      },
    })

    return {
      stackone_search: toolSearchAISDK,
      stackone_execute: toolExecuteAISDK,
    }
  } catch (error) {
    console.error('[StackOne tools] Failed to get utility tools for AI SDK:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return {}
  }
}

/**
 * Get all StackOne tools in AI SDK format for direct tool calling (no search/execute).
 * Uses @stackone/ai's toAISDK() to convert all provider actions to executable AI SDK tools.
 * Best for small tool sets (<15 tools) where search overhead isn't needed.
 */
export async function getDirectToolsForAISDK(accountIds: string[]): Promise<Record<string, unknown>> {
  if (accountIds.length === 0) return {}
  try {
    console.log('[StackOne tools] getDirectToolsForAISDK: fetching tools...')
    const tools = await getToolsForAccounts(accountIds)
    const actionableTools = tools.filter((t: { name: string }) => isActionableTool(t.name))
    const toolNames = actionableTools.toArray().map((t: { name: string }) => t.name)
    console.log('[StackOne tools] getDirectToolsForAISDK: converting to AI SDK format', { toolCount: toolNames.length, tools: toolNames })
    const aiSdkTools = await actionableTools.toAISDK({ executable: true })
    console.log('[StackOne tools] getDirectToolsForAISDK: ready', { toolCount: Object.keys(aiSdkTools).length })
    return aiSdkTools as Record<string, unknown>
  } catch (error) {
    console.error('[StackOne tools] getDirectToolsForAISDK error:', error instanceof Error ? { message: error.message, stack: error.stack } : error)
    return {}
  }
}

/**
 * Get actionable StackOne tool instances (from fetchTools) for direct use with the AI SDK.
 * Use when attaching all provider tools directly; for discover-then-execute use getStackOneUtilityToolsForAISDK instead.
 */
export async function getStackOneToolInstances(accountIds: string[]) {
  if (accountIds.length === 0) return []
  try {
    const tools = await getToolsForAccounts(accountIds)
    const allTools = typeof tools.toArray === 'function' ? tools.toArray() : []
    return allTools.filter((t: { name: string }) => isActionableTool(t.name))
  } catch (error) {
    logger.error('[StackOne tools] Failed to get StackOne tool instances:', error)
    return []
  }
}

/**
 * Get all available tools for the given account IDs and format them for LLM function calling.
 * Returns an array of tool definitions that can be used with LLM function calling.
 * @deprecated Prefer getStackOneToolInstances + tool.toAISDK() so schema comes directly from StackOne.
 * @unused Legacy function from old agent-loop implementation. Not used by current ToolLoopAgent-based agent.
 */
export async function getAvailableToolsForLLM(accountIds: string[]): Promise<Array<{
  name: string
  description: string
  parameters?: Record<string, unknown>
}>> {
  if (accountIds.length === 0) return []
  try {
    const tools = await getToolsForAccounts(accountIds)
    const allTools = typeof tools.toArray === 'function' ? tools.toArray() : []
    const actionableTools = allTools.filter((t: { name: string }) => isActionableTool(t.name))
    
    // Format tools for LLM function calling
    return actionableTools.map((tool: { name: string; description?: string; parameters?: unknown }) => ({
      name: tool.name,
      description: tool.description || `Execute ${tool.name}`,
      parameters: tool.parameters as Record<string, unknown> | undefined,
    }))
  } catch (error) {
    logger.error('[StackOne tools] Failed to get tools for LLM:', error)
    return []
  }
}

/**
 * Build an enriched query for stackone_search when we have document context (names, remote IDs, mime types, URLs).
 */
function buildSearchQueryWithDocumentContext(
  userMessage: string,
  documentContext: DocumentContextItem[]
): string {
  if (documentContext.length === 0) return userMessage
  const docLines = documentContext.map(
    (d) =>
      `${d.name} | remote_document_id: ${d.remote_document_id ?? 'n/a'} | mime_type: ${d.mime_type} | url: ${d.url ?? 'n/a'}`
  )
  return `${userMessage}\n\nRelevant documents the user may be referring to (use remote_document_id for provider APIs like googledocs_update_document):\n${docLines.join('\n')}`
}

/**
 * Search for tools matching a natural language query using stackone_search.
 * Tools are scoped to the given account IDs (StackOne returns only tools for those accounts).
 * Optionally pass documentContext to enrich the query and use a lower minScore so update-style messages match.
 * @unused Legacy function from old agent-loop implementation. Not used by current ToolLoopAgent-based agent.
 */
export async function searchFileTools(
  accountIds: string[],
  query: string,
  options: { limit?: number; minScore?: number; documentContext?: DocumentContextItem[] } = {}
): Promise<UtilityToolsSearchResult[]> {
  const { limit = 5, minScore: optionMinScore, documentContext } = options
  const minScore = optionMinScore ?? (documentContext?.length ? 0.25 : 0.35)
  const searchQuery = documentContext?.length ? buildSearchQueryWithDocumentContext(query, documentContext) : query
  if (accountIds.length === 0) return []
  try {
    const tools = await getToolsForAccounts(accountIds)
    const utilityTools = await tools.utilityTools()
    const searchTool = utilityTools.getTool('stackone_search')
    if (!searchTool) {
      logger.warn('[StackOne tools] stackone_search not available')
      return []
    }
    const queryPreview = searchQuery.slice(0, 120) + (searchQuery.length > 120 ? '...' : '')
    logger.log('[StackOne tools] stackone_search called:', { query: queryPreview, limit, minScore })
    const result = (await searchTool.execute({
      query: searchQuery,
      limit,
      minScore,
    })) as { tools?: UtilityToolsSearchResult[]; [key: string]: unknown }
    const rawList = result.tools ?? []
    const list = rawList.filter(t => isActionableTool(t.name))
    logger.log('[StackOne tools] stackone_search result:', { toolCount: list.length, tools: list.map(t => t.name) })
    return list
  } catch (error) {
    logger.error('[StackOne tools] search failed:', error)
    return []
  }
}

/**
 * Execute a StackOne tool by name (e.g. from searchFileTools result).
 * Pass only params the tool expects; we default to {} to avoid GET-with-body issues.
 * @unused Legacy function from old agent-loop implementation. Not used by current ToolLoopAgent-based agent.
 */
export async function executeStackOneTool(
  accountIds: string[],
  toolName: string,
  params: Record<string, unknown> = {},
  documentContext?: DocumentContextItem[]
): Promise<{ data?: unknown; error?: string }> {
  logger.log('[StackOne tools] stackone_execute called:', { toolName, paramKeys: Object.keys(params || {}) })
  if (accountIds.length === 0) {
    return { error: 'No account IDs provided' }
  }
  try {
    // Determine which account(s) to use
    let accountIdsToUse = accountIds
    
    // If we have multiple accounts, find which one(s) have access to the tool
    if (accountIds.length > 1) {
      // Check each account to see which one has the tool available
      let accountWithTool: string | null = null
      for (const accountId of accountIds) {
        try {
          const tools = await getToolsForAccounts([accountId])
          const allTools = typeof tools.toArray === 'function' ? tools.toArray() : []
          const hasTool = allTools.some((t: { name: string }) => t.name === toolName)
          if (hasTool) {
            accountWithTool = accountId
            break
          }
        } catch {
          // continue to next account
        }
      }
      if (accountWithTool) {
        accountIdsToUse = [accountWithTool]
      } else {
        accountIdsToUse = accountIds
      }
    }

    const tools = await getToolsForAccounts(accountIdsToUse)
    const utilityTools = await tools.utilityTools()
    const executeTool = utilityTools.getTool('stackone_execute')
    if (!executeTool) {
      return { error: 'stackone_execute not available' }
    }
    
    // Verify the tool is available before executing
    const allTools = typeof tools.toArray === 'function' ? tools.toArray() : []
    const toolAvailable = allTools.some((t: { name: string }) => t.name === toolName)
    if (!toolAvailable) {
      return { error: `Tool ${toolName} not found in available tools for the selected account(s)` }
    }
    
    // StackOne SDK should handle accountIds from fetchTools, but some tools may need explicit accountId
    // Try passing accountId in params if we have a single account
    const executeParams: Record<string, unknown> = {
      toolName,
      params: params as JsonObject,
    }
    
    // For single account, try passing accountId explicitly
    if (accountIdsToUse.length === 1) {
      executeParams.accountId = accountIdsToUse[0]
    }
    
    const data = await executeTool.execute(executeParams as JsonObject)
    logger.log('[StackOne tools] stackone_execute result:', { toolName, success: true })
    return { data }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Tool execution failed'
    logger.log('[StackOne tools] stackone_execute result:', { toolName, success: false, error: message })
    return { error: message }
  }
}

/**
 * Discover and run a single file-related action for the user's message.
 * Uses fetchTools({ accountIds }) so StackOne returns only tools for the agent's connected accounts.
 * When documentContext is provided, the search query is enriched and a lower minScore is used;
 * if the chosen tool needs document params (e.g. googledocs_update_document), an LLM generates params from the message and document context.
 * @unused Legacy function from old agent-loop implementation. Not used by current ToolLoopAgent-based agent.
 */
export interface ToolActionResult {
  toolName: string
  toolDescription?: string
  params: Record<string, unknown>
  result: unknown
  error?: string
}

export async function runFileActionForMessage(
  accountIds: string[],
  userMessage: string,
  options: {
    documentContext?: DocumentContextItem[]
    conversationContext?: string
  } = {}
): Promise<ToolActionResult | null> {
  const { documentContext = [], conversationContext } = options
  if (accountIds.length === 0) return null
  logger.log('[StackOne tools] Searching tools for message...', { documentContextCount: documentContext.length })
  const minScoreThreshold = documentContext.length ? 0.25 : 0.35
  const tools = await searchFileTools(accountIds, userMessage, {
    limit: 5,
    minScore: minScoreThreshold,
    documentContext: documentContext.length ? documentContext : undefined,
  })
  if (tools.length === 0) {
    logger.log('[StackOne tools] No tools matched the message')
    return null
  }
  const chosen = tools[0]
  if (chosen.score < minScoreThreshold) {
    logger.log('[StackOne tools] Best match score too low:', chosen.score, 'threshold:', minScoreThreshold)
    return null
  }
  const hasDocIds = documentContext.some((d) => d.remote_document_id)
  const needsParams = toolNeedsDocumentParams(chosen.name) && hasDocIds
  let params: Record<string, unknown> = {}
  if (needsParams) {
    try {
      params = await generateToolParamsWithLLM(userMessage, documentContext, chosen.name, accountIds, conversationContext)
    } catch (err) {
      logger.error('[StackOne tools] LLM param generation failed:', err)
    }
  }
  logger.log('[StackOne tools] Executing tool:', chosen.name, Object.keys(params).length ? { paramsKeys: Object.keys(params) } : {})
  const result = await executeStackOneTool(accountIds, chosen.name, params, documentContext)
  if (result.error) {
    return {
      toolName: chosen.name,
      toolDescription: chosen.description,
      params,
      result: null,
      error: result.error,
    }
  }
  return {
    toolName: chosen.name,
    toolDescription: chosen.description,
    params,
    result: result.data,
  }
}

// Ensure 'ai' is loaded so @stackone/ai's toAISDK() dynamic import('ai') resolves (e.g. in monorepos)
import 'ai'
import { ToolLoopAgent, tool, stepCountIs } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { RAGService, type DocumentChunk } from '@/lib/llamaindex/rag-service'
import { getStackOneUtilityToolsForAISDK, type DocumentContextItem } from '@/lib/stackone/meta-tools'
import { logger } from '@/utils/logger'

const DEBUG_TOOLS =
  process.env.DEBUG_TOOLS === '1' ||
  process.env.DEBUG_TOOLS === 'true' ||
  process.env.DEBUG === '1' ||
  process.env.DEBUG_CHAT === '1'
function debugToolPayload(label: string, payload: unknown, maxLen = 1500) {
  if (!DEBUG_TOOLS) return
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 0)
  const out = raw.length > maxLen ? raw.slice(0, maxLen) + '...[truncated]' : raw
  logger.log(`[Agent stream] ${label}`, out)
}

export interface VercelAgentResult {
  type: 'content' | 'tool_call' | 'tool_result' | 'sources' | 'done' | 'error' | 'status'
  content?: string
  toolName?: string
  toolDescription?: string
  toolParams?: Record<string, unknown>
  toolResult?: unknown
  toolError?: string
  sources?: DocumentChunk[]
  confidence?: number
  error?: string
  status?: string
}

/**
 * Agent implementation using Vercel AI SDK ToolLoopAgent.
 * RAG via getInformationFromRAG tool; StackOne actions via tool_search + tool_execute.
 */
export async function* runVercelAgent(
  userMessage: string,
  options: {
    documentIds: string[]
    accountIds: string[]
    documentContext: DocumentContextItem[]
    userId: string
    messageHistory: Array<{ role: 'user' | 'assistant'; content: string }>
    maxTurns?: number
  }
): AsyncGenerator<VercelAgentResult, void, unknown> {
  const { documentIds, accountIds, documentContext, userId, messageHistory, maxTurns = 10 } = options
  const ragService = new RAGService()

  // StackOne action tools: fetched via MCP, converted to AI SDK format with toAISDK()
  console.log('[Agent] Loading action tools', { accountIds: accountIds.length, hasApiKey: !!process.env.STACKONE_API_KEY })
  if (accountIds.length === 0) {
    console.warn(
      '[Agent] No StackOne account IDs for this agent — action tools are disabled. Link integrations to the agent (with a connected StackOne account) and ensure STACKONE_API_KEY is set.'
    )
  }

  const aiSdkUtilityTools = accountIds.length > 0 ? await getStackOneUtilityToolsForAISDK(accountIds) : {}

  const hasActionTools = Object.keys(aiSdkUtilityTools).length > 0
  const actionToolNames = Object.keys(aiSdkUtilityTools)
  console.log('[Agent] Action tools result', { hasActionTools, toolCount: actionToolNames.length, tools: actionToolNames.slice(0, 10) })
  if (accountIds.length > 0 && !hasActionTools) {
    console.error(
      '[Agent] StackOne action tools failed to load. Check STACKONE_API_KEY, STACKONE_BASE_URL, and server logs from getStackOneUtilityToolsForAISDK.'
    )
  }

  const actionToolList = hasActionTools
    ? actionToolNames.map((name) => `**${name}**`).join(', ')
    : ''

  const systemPromptWithActions = `You are a helpful AI assistant with access to tools for searching documents and performing actions on connected apps.

**getInformationFromRAG** – Use when the user asks a question about their documents, when you need to read or search document content, or when you need a document identifier (remote_document_id) or current content to perform an action.

**Action tools** – You also have access to these provider action tools: ${actionToolList}. Use them when the user wants to perform an action on their connected apps or documents (e.g. update a doc, list files, send something). Each tool has its own parameters — use document ids (e.g. remote_document_id from RAG or Available Documents) where the tool expects them.

Respond in natural language. After using tools, summarize outcomes for the user. If a tool returns an error, report it clearly and suggest what the user can check or try.`

  const systemPromptRagOnly = `You are a helpful AI assistant with access to **getInformationFromRAG** only (search/read indexed documents). You do **not** have tools to update Google Docs, Drive, or other live apps in this session.

**getInformationFromRAG** – Use when the user asks about their documents, needs content or quotes, or needs a remote_document_id from indexed material.

If the user asks to update, edit, or change a live document in a connected app, explain clearly that realtime actions require this agent to have StackOne integrations linked (with an active connection) and STACKONE_API_KEY configured on the server; you can still help using retrieved document content where applicable.

Respond in natural language. If a tool returns an error, report it clearly.`

  const systemPrompt = hasActionTools ? systemPromptWithActions : systemPromptRagOnly

  // Add document context to system prompt if available
  let enhancedSystemPrompt = systemPrompt
  if (documentContext.length > 0) {
    const docList = documentContext
      .map((d) => `${d.name} | remote_document_id: ${d.remote_document_id ?? 'n/a'} | mime_type: ${d.mime_type}`)
      .join('\n')
    enhancedSystemPrompt += `\n\nAvailable Documents:\n${docList}`
  }

  // Define RAG tool - plain async so only the final return is sent as tool result (no yields)
  const ragToolParameters = z.object({
    question: z.string().describe('The question or query to search for in the documents'),
  })
  
  const ragTool = tool({
    description: `Search and read the user's indexed documents. Returns an answer, sources (with document_name, remote_document_id, mime_type, content excerpt), and confidence. Use when: the user asks a question about their documents; you need to find or quote content from their documents; or you need a document identifier (remote_document_id) or current content to perform another action (e.g. with tool_execute). Do not use when: the request does not involve the user's documents; you already have the needed content or remote_document_id from earlier in the conversation or from Available Documents; or the user is only asking to perform an action (e.g. "update the doc") and you need to discover the right tool first—use tool_search for that, and call this only if you need document content or an id to fill the tool's parameters.`,
    inputSchema: ragToolParameters,
    execute: async ({ question }) => {
      let ragContent = ''
      let ragSources: DocumentChunk[] = []
      let ragConfidence = 0
      
      for await (const chunk of ragService.queryStream(
        question,
        documentIds,
        userId,
        messageHistory
      )) {
        if (chunk.type === 'content' && chunk.content) {
          ragContent += chunk.content
        } else if (chunk.type === 'sources' && chunk.sources) {
          ragSources = chunk.sources
        } else if (chunk.type === 'done') {
          ragConfidence = chunk.confidence ?? 0
        } else if (chunk.type === 'error') {
          return { error: chunk.error || 'RAG retrieval failed' }
        }
      }
      
      return {
        answer: ragContent || 'No relevant information found in the documents.',
        sources: ragSources.map(s => ({
          document_name: s.metadata.document_name,
          remote_document_id: s.metadata.remote_document_id,
          mime_type: s.metadata.mime_type,
          content: s.content.slice(0, 500),
        })),
        confidence: ragConfidence,
      }
    },
  })

  const allTools = {
    getInformationFromRAG: ragTool,
    ...aiSdkUtilityTools,
  }
  
  // Build messages for Vercel AI SDK
  const messages: Array<{ role: 'user' | 'assistant'; content: string }> = []
  
  // Add conversation history
  messageHistory.forEach(msg => {
    messages.push({ role: msg.role, content: msg.content })
  })
  
  // Add current user message
  messages.push({ role: 'user', content: userMessage })
  
  yield { type: 'status', status: 'Analyzing your question and planning the best approach...' }

  const agent = new ToolLoopAgent({
    model: openai(process.env.OPENAI_CHAT_MODEL || 'gpt-4o'),
    instructions: enhancedSystemPrompt,
    tools: allTools,
    stopWhen: stepCountIs(maxTurns),
  })

  const result = await agent.stream({ messages })

  // Stream content and handle tool calls/results
  let sources: DocumentChunk[] = []
  let confidence = 0
  let lastRagAnswer: string | undefined
  let contentYielded = false
  let toolResultsExecuted: Array<{ toolName: string; result?: unknown }> = []
  
  try {
    // Process full stream for all events (text-delta, tool calls, tool results)
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        // Text delta - yield as content (AI SDK v6: type is 'text-delta', property is 'text')
        contentYielded = true
        yield { type: 'content', content: part.text }
      } else if (part.type === 'tool-call') {
        debugToolPayload(`tool-call ${part.toolName} input`, (part as { input?: unknown }).input)
        const toolCallInput = (part as { input?: unknown }).input as Record<string, unknown> | undefined
        // Yield tool_call event so UI can show pill immediately
        yield {
          type: 'tool_call',
          toolName: part.toolName,
          toolParams: toolCallInput,
        }
        // Also yield status for backward compatibility
        if (part.toolName === 'getInformationFromRAG') {
          yield { type: 'status', status: 'Searching through your documents to find relevant information...' }
        } else {
          const toolDisplayName = part.toolName
            .replace(/googledocs_/g, 'Google Docs: ')
            .replace(/googlesheets_/g, 'Google Sheets: ')
            .replace(/unified_documents_/g, '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase())
          yield { type: 'status', status: `Executing ${toolDisplayName}...` }
        }
      } else if (part.type === 'tool-result') {
        const toolPart = part as { toolName: string; input?: unknown; output?: unknown }
        debugToolPayload(`tool-result ${toolPart.toolName} input`, toolPart.input)
        debugToolPayload(`tool-result ${toolPart.toolName} output`, toolPart.output)
        // Handle RAG tool result specially to extract sources
        if (part.toolName === 'getInformationFromRAG' && part.output && typeof part.output === 'object') {
          const ragResult = part.output as { answer?: string; sources?: Array<{ document_name: string; remote_document_id?: string; mime_type?: string; content: string }>; confidence?: number }
          if (ragResult.answer) lastRagAnswer = ragResult.answer
          if (ragResult.sources) {
            sources = ragResult.sources.map(s => ({
              id: '',
              content: s.content,
              metadata: {
                document_id: '',
                document_name: s.document_name,
                chunk_index: 0,
                remote_document_id: s.remote_document_id,
                mime_type: s.mime_type,
              },
            }))
            yield { type: 'sources', sources }
          }
          confidence = ragResult.confidence ?? 0
          // Also yield tool_result so UI can show the RAG result in the pill
          toolResultsExecuted.push({ toolName: part.toolName, result: part.output })
          yield {
            type: 'tool_result',
            toolName: part.toolName,
            toolParams: part.input as Record<string, unknown>,
            toolResult: part.output,
          }
        } else {
          // Meta or other tool result
          toolResultsExecuted.push({ toolName: part.toolName, result: part.output })
          yield {
            type: 'tool_result',
            toolName: part.toolName,
            toolParams: part.input as Record<string, unknown>,
            toolResult: part.output,
          }
        }
      } else if (part.type === 'finish') {
        // Multi-step agent: 'finish' is emitted after each step. Keep consuming; final done is yielded when stream ends.
      } else if (part.type === 'error') {
        yield { type: 'error', error: part.error instanceof Error ? part.error.message : 'Unknown error occurred' }
        break
      }
    }

    // Stream ended — yield final done and optional fallback content
    if (!contentYielded) {
      if (lastRagAnswer?.trim()) {
        yield { type: 'content', content: lastRagAnswer.trim() }
      } else if (toolResultsExecuted.length > 0) {
        const lastTool = toolResultsExecuted[toolResultsExecuted.length - 1]
        const displayName = lastTool.toolName.replace(/_/g, ' ')
        yield { type: 'content', content: `I've completed the ${displayName} operation.` }
      }
    }
    yield { type: 'done', sources, confidence }
  } catch (error) {
    logger.error('[Vercel Agent] Error during streaming:', error)
    yield { type: 'error', error: error instanceof Error ? error.message : 'Unknown error occurred' }
  }
}

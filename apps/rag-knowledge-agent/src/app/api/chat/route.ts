import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { requireUser } from '@/lib/auth-server'
import { runVercelAgent } from '@/lib/chat/vercel-agent'
import { logger } from '@/utils/logger'


export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const requestData = await request.json()
    const { message, agentId, isEdit } = requestData
    let { threadId } = requestData

    logger.log('Chat API - Request data:', { message, agentId, threadId, userId: user.id })

    if (!message || !agentId) {
      logger.log('Chat API - Missing required fields:', { message: !!message, agentId: !!agentId })
      return NextResponse.json({ error: 'Message and agent ID are required' }, { status: 400 })
    }

    const agent = await queryOne<{ id: string; integration_ids: string[] }>(
      `SELECT id, integration_ids FROM agents WHERE id = $1 AND user_id = $2`,
      [agentId, user.id]
    )
    logger.log('Chat API - Agent query result:', { agent })
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const integrationIds = (agent.integration_ids ?? []) as string[]
    if (threadId) {
      const thread = await queryOne<{ id: string }>(
        `SELECT id FROM threads WHERE id = $1 AND agent_id = $2 AND user_id = $3 AND status = 'active'`,
        [threadId, agentId, user.id]
      )
      if (!thread) {
        logger.log('Chat API - Thread not found, proceeding without threadId')
        threadId = null
      }
    }

    const integrations = integrationIds.length > 0
      ? await query<{ id: string; stackone_account_id: string }>(
          `SELECT id, stackone_account_id FROM integrations WHERE id = ANY($1::uuid[])`,
          [integrationIds]
        )
      : []

    const agentDocs = await query<{ document_id: string }>(
      `SELECT document_id FROM agent_documents WHERE agent_id = $1`,
      [agentId]
    )
    const documentIds = agentDocs.map((r) => r.document_id)

    const documentContext =
      documentIds.length > 0
        ? await query<{ name: string; remote_document_id: string | null; mime_type: string; url: string | null }>(
            `SELECT d.name, d.remote_document_id, d.mime_type, d.url
             FROM documents d
             INNER JOIN agent_documents ad ON ad.document_id = d.id
             WHERE ad.agent_id = $1`,
            [agentId]
          )
        : []

    const encoder = new TextEncoder()
    let streamClosed = false
    const safeEnqueue = (controller: ReadableStreamDefaultController<Uint8Array>, data: Uint8Array) => {
      if (streamClosed) return
      try {
        controller.enqueue(data)
      } catch (err) {
        const msg = (err as Error)?.message ?? ''
        if (msg.includes('closed') || msg.includes('ERR_INVALID_STATE')) streamClosed = true
      }
    }
    const safeClose = (controller: ReadableStreamDefaultController<Uint8Array>) => {
      if (streamClosed) return
      streamClosed = true
      try {
        controller.close()
      } catch {
        // Controller may already be closed (e.g. client disconnected)
      }
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Fetch history before inserting current message so we don't duplicate it in the agent
          let messageHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
          if (threadId) {
            const historyMessages = await query<{ role: string; content: string; metadata?: unknown }>(
              `SELECT role, content, metadata FROM chat_messages
               WHERE agent_id = $1 AND thread_id = $2 AND user_id = $3
               ORDER BY created_at ASC LIMIT 50`,
              [agentId, threadId, user.id]
            )
            messageHistory = historyMessages.map((msg) => {
              let content = msg.content
              // For assistant messages, append tool summary from metadata if present (for model context, but not shown in UI)
              if (msg.role === 'assistant' && msg.metadata && typeof msg.metadata === 'object') {
                const metadata = msg.metadata as { toolSummary?: string }
                if (metadata.toolSummary) {
                  content = `${content}\n\n[This turn I used: ${metadata.toolSummary}.]`
                }
              }
              return {
                role: msg.role as 'user' | 'assistant',
                content,
              }
            })
            logger.log(`Chat API - Fetched ${messageHistory.length} messages from thread history`)
          }

          if (threadId && !isEdit) {
            try {
              await query(
                `INSERT INTO chat_messages (agent_id, thread_id, user_id, role, content, metadata)
                 VALUES ($1, $2, $3, 'user', $4, '{}')`,
                [agentId, threadId, user.id, message]
              )
            } catch (userMessageError) {
              logger.error('Error saving user message:', userMessageError)
            }
          } else if (isEdit) {
            logger.log('Skipping user message save - this is an edit operation')
          } else {
            logger.log('Skipping user message save - no thread context')
          }

          const accountIds = integrations
            .map((i) => i.stackone_account_id)
            .filter((id): id is string => Boolean(id))

          console.log('[Chat API] Starting agent loop', {
            integrationIdsFromAgent: integrationIds.length,
            integrationsFound: integrations.length,
            accountIds: accountIds.length,
            accountIdPreviews: accountIds.map(id => id.slice(0, 12) + '...'),
            documentIds: documentIds.length,
            documentContext: documentContext.length,
            hasStackOneApiKey: !!process.env.STACKONE_API_KEY,
          })

          let fullResponse = ''
          let sources: unknown[] = []
          let confidence = 0
          let toolResults: Array<{
            toolName: string
            toolDescription?: string
            params: Record<string, unknown>
            result?: unknown
            error?: string
          }> = []

          // Run Vercel AI SDK agent
          // Get max turns from environment variable, default to 10
          const maxTurns = process.env.AGENT_MAX_TURNS 
            ? parseInt(process.env.AGENT_MAX_TURNS, 10) 
            : 10

          for await (const result of runVercelAgent(message, {
            documentIds,
            accountIds,
            documentContext,
            userId: user.id,
            messageHistory,
            maxTurns,
          })) {
            if (result.type === 'content' && result.content) {
              fullResponse += result.content
              const data = JSON.stringify({ type: 'content', content: result.content })
              safeEnqueue(controller, encoder.encode(`data: ${data}\n\n`))
            } else if (result.type === 'tool_call') {
              const toolCallData = JSON.stringify({
                type: 'tool_call',
                toolName: result.toolName,
                params: result.toolParams,
              })
              safeEnqueue(controller, encoder.encode(`data: ${toolCallData}\n\n`))
            } else if (result.type === 'tool_result') {
              toolResults.push({
                toolName: result.toolName || 'unknown',
                toolDescription: result.toolDescription,
                params: result.toolParams || {},
                result: result.toolResult,
                error: result.toolError,
              })
              const toolResultData = JSON.stringify({
                type: 'tool_result',
                toolName: result.toolName,
                toolDescription: result.toolDescription,
                params: result.toolParams,
                result: result.toolResult,
                error: result.toolError,
              })
              safeEnqueue(controller, encoder.encode(`data: ${toolResultData}\n\n`))
            } else if (result.type === 'sources' && result.sources) {
              sources = result.sources
              if (result.sources.length > 0) {
                const sourcesData = JSON.stringify({ type: 'sources', sources: result.sources })
                safeEnqueue(controller, encoder.encode(`data: ${sourcesData}\n\n`))
              }
            } else if (result.type === 'done') {
              confidence = result.confidence ?? 0

              if (threadId) {
                try {
                  const metadata: Record<string, unknown> = { sources, confidence }
                  if (toolResults.length > 0) {
                    metadata.toolResults = toolResults
                    // Include tool context in metadata (not content) so next turn the model can see what was done
                    // This avoids redundant RAG/tool_search while keeping user-facing content clean
                    const parts = toolResults.map((t) => t.toolName + (t.error ? ' (error)' : ''))
                    const searchResult = toolResults.find((t) => t.toolName === 'tool_search' && t.result && typeof t.result === 'object')
                    const toolsFromSearch = searchResult?.result && typeof searchResult.result === 'object' && 'tools' in searchResult.result
                      ? (searchResult.result as { tools?: Array<{ name: string }> }).tools?.map((x) => x.name).join(', ')
                      : null
                    metadata.toolSummary = `${parts.join(', ')}${toolsFromSearch ? ` (tool_search returned: ${toolsFromSearch})` : ''}`
                  }
                  // Save only the clean user-facing content (no tool summary brackets)
                  const contentToSave = fullResponse.trim()
                  await query(
                    `INSERT INTO chat_messages (agent_id, thread_id, user_id, role, content, metadata)
                     VALUES ($1, $2, $3, 'assistant', $4, $5::jsonb)`,
                    [agentId, threadId, user.id, contentToSave, JSON.stringify(metadata)]
                  )
                } catch (assistantMessageError) {
                  logger.error('Error saving assistant message:', assistantMessageError)
                }
              } else {
                logger.log('Skipping assistant message save - no thread context')
              }

              const doneData = JSON.stringify({ type: 'done', sources, confidence })
              safeEnqueue(controller, encoder.encode(`data: ${doneData}\n\n`))
              break
            } else if (result.type === 'status' && result.status) {
              const statusData = JSON.stringify({ type: 'status', status: result.status })
              safeEnqueue(controller, encoder.encode(`data: ${statusData}\n\n`))
            } else if (result.type === 'error') {
              const errorData = JSON.stringify({
                type: 'error',
                error: result.error ?? 'Unknown error occurred',
              })
              safeEnqueue(controller, encoder.encode(`data: ${errorData}\n\n`))
              break
            }
          }

          logger.log('Chat API - Agent loop finished', { responseLength: fullResponse.length, toolResultsCount: toolResults.length })
          safeClose(controller)
        } catch (error) {
          logger.error('Error in streaming chat:', error)
          if (!streamClosed) {
            const errorData = JSON.stringify({ type: 'error', error: 'Failed to process message' })
            safeEnqueue(controller, encoder.encode(`data: ${errorData}\n\n`))
          }
          safeClose(controller)
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-store',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error in chat API:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser()
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const threadId = searchParams.get('threadId')

    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 })
    }

    const agent = await queryOne<{ id: string }>(
      `SELECT id FROM agents WHERE id = $1 AND user_id = $2`,
      [agentId, user.id]
    )
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    if (threadId) {
      const thread = await queryOne(
        `SELECT id FROM threads WHERE id = $1 AND agent_id = $2 AND user_id = $3 AND status = 'active'`,
        [threadId, agentId, user.id]
      )
      if (!thread) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
      }
    }

    const messages = threadId
      ? await query(
          `SELECT * FROM chat_messages WHERE agent_id = $1 AND user_id = $2 AND thread_id = $3 ORDER BY created_at ASC`,
          [agentId, user.id, threadId]
        )
      : await query(
          `SELECT * FROM chat_messages WHERE agent_id = $1 AND user_id = $2 AND thread_id IS NULL ORDER BY created_at ASC`,
          [agentId, user.id]
        )

    return NextResponse.json({ messages })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error fetching chat messages:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { RAGService } from '@/lib/llamaindex/rag-service'
import { logger } from '@/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const requestData = await request.json()
    const { message, agentId, isEdit } = requestData
    let { threadId } = requestData

    logger.log('Chat API - Request data:', { message, agentId, threadId, userId: user.id })

    if (!message || !agentId) {
      logger.log('Chat API - Missing required fields:', { message: !!message, agentId: !!agentId })
      return NextResponse.json({ error: 'Message and agent ID are required' }, { status: 400 })
    }

    // Get agent details
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single()

    logger.log('Chat API - Agent query result:', { agent, agentError })

    if (agentError || !agent) {
      logger.log('Chat API - Agent not found:', { agentError, agent })
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // If threadId is provided, verify it belongs to the agent and user
    if (threadId) {
      logger.log('Chat API - Validating thread:', { threadId, agentId, userId: user.id })
      const { data: thread, error: threadError } = await supabase
        .from('threads')
        .select('id')
        .eq('id', threadId)
        .eq('agent_id', agentId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      logger.log('Chat API - Thread query result:', { thread, threadError })

      if (threadError || !thread) {
        logger.log('Chat API - Thread not found, proceeding without threadId:', { threadError, thread })
        threadId = null // Clear the invalid threadId
      }
    }

    // Get document IDs associated with integrations attached to agent
    const { data: integrations, error: integrationsError } = await supabase
      .from('integrations')
      .select('id')
      .in('id', agent.integration_ids)

    if (integrationsError) {
      return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 })
    }

    // Get documents associated with this agent through the agent_documents table
    const { data: documents, error: documentIdsError } = await supabase
      .from('agent_documents')
      .select(`
        document_id,
        documents!inner(
          id,
          integration_id
        )
      `)
      .eq('agent_id', agentId)

    if (documentIdsError) {
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }

    // Extract document IDs from the agent_documents relationship
    const documentIds = documents.map(rel => rel.document_id)

    // Create a streaming response
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Save user message to database only if we have a thread and it's not an edit
          if (threadId && !isEdit) {
            const { data: userMessage, error: userMessageError } = await supabase
              .from('chat_messages')
              .insert({
                agent_id: agentId,
                thread_id: threadId,
                user_id: user.id,
                role: 'user',
                content: message,
                metadata: {}
              })
              .select()
              .single()

            if (userMessageError) {
              logger.error('Error saving user message:', userMessageError)
            }
          } else if (isEdit) {
            logger.log('Skipping user message save - this is an edit operation')
          } else {
            logger.log('Skipping user message save - no thread context')
          }

          // Fetch message history for context if we have a thread
          let messageHistory: Array<{ role: 'user' | 'assistant', content: string }> = []
          if (threadId) {
            const { data: historyMessages, error: historyError } = await supabase
              .from('chat_messages')
              .select('role, content')
              .eq('agent_id', agentId)
              .eq('thread_id', threadId)
              .eq('user_id', user.id)
              .order('created_at', { ascending: true })
              .limit(50) // Limit to last 50 messages to provide more context

            if (historyError) {
              logger.error('Error fetching message history:', historyError)
            } else if (historyMessages) {
              messageHistory = historyMessages.map(msg => ({
                role: msg.role as 'user' | 'assistant',
                content: msg.content
              }))
              logger.log(`Chat API - Fetched ${messageHistory.length} messages from thread history`)
            }
          }

          // Initialize RAG service
          const ragService = new RAGService()
          
          // Use streaming query with message history
          let fullResponse = ''
          let sources: any[] = []
          let confidence = 0

          for await (const chunk of ragService.queryStream(message, documentIds, user.id, messageHistory)) {
            if (chunk.type === 'content' && chunk.content) {
              fullResponse += chunk.content
              const data = JSON.stringify({ type: 'content', content: chunk.content })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            } else if (chunk.type === 'sources' && chunk.sources) {
              sources = chunk.sources
              const sourcesData = JSON.stringify({ 
                type: 'sources', 
                sources: chunk.sources 
              })
              controller.enqueue(encoder.encode(`data: ${sourcesData}\n\n`))
            } else if (chunk.type === 'done') {
              confidence = chunk.confidence || 0
              
              // Save assistant message to database only if we have a thread
              if (threadId) {
                const { error: assistantMessageError } = await supabase
                  .from('chat_messages')
                  .insert({
                    agent_id: agentId,
                    thread_id: threadId,
                    user_id: user.id,
                    role: 'assistant',
                    content: fullResponse,
                    metadata: {
                      sources: sources,
                      confidence: confidence
                    }
                  })

                if (assistantMessageError) {
                  logger.error('Error saving assistant message:', assistantMessageError)
                }
              } else {
                logger.log('Skipping assistant message save - no thread context')
              }

              // Send completion signal
              const doneData = JSON.stringify({ 
                type: 'done',
                sources: sources,
                confidence: confidence
              })
              controller.enqueue(encoder.encode(`data: ${doneData}\n\n`))
            } else if (chunk.type === 'error') {
              const errorData = JSON.stringify({ 
                type: 'error', 
                error: chunk.error || 'Unknown error occurred'
              })
              controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
              break
            }
          }
          
          controller.close()
        } catch (error) {
          logger.error('Error in streaming chat:', error)
          const errorData = JSON.stringify({ 
            type: 'error', 
            error: 'Failed to process message' 
          })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    logger.error('Error in chat API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const threadId = searchParams.get('threadId')

    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 })
    }

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // If threadId is provided, verify it belongs to the agent and user
    if (threadId) {
      const { data: thread, error: threadError } = await supabase
        .from('threads')
        .select('id')
        .eq('id', threadId)
        .eq('agent_id', agentId)
        .eq('user_id', user.id)
        .eq('status', 'active')
        .single()

      if (threadError || !thread) {
        return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
      }
    }

    // Get chat messages (optionally filtered by thread)
    let query = supabase
      .from('chat_messages')
      .select('*')
      .eq('agent_id', agentId)
      .eq('user_id', user.id)

    if (threadId) {
      query = query.eq('thread_id', threadId)
    } else {
      query = query.is('thread_id', null)
    }

    const { data: messages, error } = await query.order('created_at', { ascending: true })

    if (error) {
      logger.error('Error fetching messages:', error)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    return NextResponse.json({ messages })

  } catch (error) {
    logger.error('Error fetching chat messages:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

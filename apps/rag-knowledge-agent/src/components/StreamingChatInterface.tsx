'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { Message } from '@llamaindex/chat-ui'
import { 
  ChatSection, 
  ChatMessages, 
  ChatMessage, 
  ChatInput,
  useChatUI 
} from '@llamaindex/chat-ui'
import { Markdown, DocumentEditor, CodeEditor } from '@llamaindex/chat-ui/widgets'
import { Button, Input, Typography, Space, Empty, Drawer, List, Modal } from 'antd'
import {
  RobotOutlined,
  ClearOutlined, 
  MessageOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ArrowUpOutlined,
  CommentOutlined,
  DownOutlined,
  UpOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons'
import type { ChatMessage as DBChatMessage, Thread } from '@/types'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '@/utils/logger'
import styles from './StreamingChatInterface.module.css'
import {
  handleNewChatMouseEnter,
  handleNewChatMouseLeave,
  handleThreadMouseEnter,
  handleThreadMouseLeave,
  handleAgentCardMouseEnter,
  handleAgentCardMouseLeave,
  handleSourcePillMouseEnter,
  handleSourcePillMouseLeave,
  handleSendButtonMouseEnter,
  handleSendButtonMouseLeave,
  handleSaveButtonMouseEnter,
  handleSaveButtonMouseLeave,
  handleCancelButtonMouseEnter,
  handleCancelButtonMouseLeave,
  handleMessageWrapperMouseEnter,
  handleMessageWrapperMouseLeave
} from './streamingChatUtils'

const { Text, Title } = Typography
const { TextArea } = Input

// Create type-asserted components for React 19 compatibility
const TypographyText = Text as any
const TypographyTitle = Title as any
const TypographyTextArea = TextArea as any
const TypographyButton = Button as any
const TypographyInput = Input as any
const TypographySpace = Space as any
const TypographyEmpty = Empty as any
const TypographyList = List as any
const TypographyDrawer = Drawer as any
const TypographyModal = Modal as any
const TypographyPlusOutlined = PlusOutlined as any
const TypographyEditOutlined = EditOutlined as any
const TypographyDeleteOutlined = DeleteOutlined as any
const TypographyArrowUpOutlined = ArrowUpOutlined as any
const TypographyCommentOutlined = CommentOutlined as any
const TypographyMessageOutlined = MessageOutlined as any
const TypographyClearOutlined = ClearOutlined as any
const TypographyDownOutlined = DownOutlined as any
const TypographyUpOutlined = UpOutlined as any
const TypographyCheckCircleOutlined = CheckCircleOutlined as any
const TypographyCloseCircleOutlined = CloseCircleOutlined as any

interface StreamingChatInterfaceProps {
  agentId: string
}

interface ToolResultPillProps {
  toolName?: string
  toolDescription?: string
  params?: Record<string, unknown>
  result?: unknown
  error?: string
  inProgress?: boolean
}

function ToolResultPill({ toolName, toolDescription, params, result, error, inProgress }: ToolResultPillProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const hasError = !!error
  const isInProgress = inProgress === true && result === undefined && !error
  const displayName = toolName || 'Unknown Tool'
  const paramsStr = JSON.stringify(params || {}, null, 2)
  const resultStr = result !== undefined 
    ? (typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result))
    : 'No result'
  
  // Neutral blue palette for tool pills (modern, stylish; red only for errors, amber for in-progress)
  const pillBg = hasError 
    ? 'rgba(239, 68, 68, 0.08)' 
    : isInProgress 
      ? 'rgba(245, 158, 11, 0.08)' 
      : 'rgba(59, 130, 246, 0.06)'
  const pillBorder = hasError 
    ? 'rgba(239, 68, 68, 0.25)' 
    : isInProgress 
      ? 'rgba(245, 158, 11, 0.25)' 
      : 'rgba(59, 130, 246, 0.2)'
  const pillColor = hasError 
    ? 'rgb(185, 28, 28)' 
    : isInProgress 
      ? 'rgb(180, 83, 9)' 
      : 'var(--stackone-gray-700)'
  const pillHoverBg = hasError 
    ? 'rgba(239, 68, 68, 0.12)' 
    : isInProgress 
      ? 'rgba(245, 158, 11, 0.12)' 
      : 'rgba(59, 130, 246, 0.1)'

  return (
    <div style={{ marginBottom: '12px' }}>
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          backgroundColor: pillBg,
          border: `1px solid ${pillBorder}`,
          borderRadius: '8px',
          padding: '8px 12px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease',
          fontFamily: 'var(--font-sans)',
          fontSize: '12px',
          fontWeight: 500,
          color: pillColor
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = pillHoverBg
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = pillBg
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hasError ? (
            <TypographyCloseCircleOutlined style={{ fontSize: '14px' }} />
          ) : isInProgress ? (
            <span className={styles.loadingSpinner} style={{ fontSize: '14px', width: '14px', height: '14px', borderBottom: '2px solid rgb(180, 83, 9)', margin: 0 }} />
          ) : (
            <TypographyCheckCircleOutlined style={{ fontSize: '14px' }} />
          )}
          <span style={{ fontWeight: 600 }}>{displayName}</span>
          {hasError && <span style={{ opacity: 0.7 }}>failed</span>}
          {isInProgress && <span style={{ opacity: 0.7 }}>running...</span>}
        </div>
        {isExpanded ? (
          <TypographyUpOutlined style={{ fontSize: '10px' }} />
        ) : (
          <TypographyDownOutlined style={{ fontSize: '10px' }} />
        )}
      </div>
      {isExpanded && (
        <div style={{
          marginTop: '8px',
          padding: '12px',
          backgroundColor: 'rgba(248, 249, 250, 0.8)',
          borderRadius: '6px',
          fontSize: '11px',
          fontFamily: 'monospace',
          border: '1px solid rgba(240, 240, 240, 0.8)'
        }}>
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--stackone-gray-700)' }}>
              Input:
            </div>
            <pre style={{ 
              margin: 0, 
              padding: '8px', 
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              borderRadius: '4px',
              overflow: 'auto',
              maxHeight: '200px',
              fontSize: '10px',
              lineHeight: '1.4'
            }}>
              {paramsStr}
            </pre>
          </div>
          <div>
            <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--stackone-gray-700)' }}>
              {hasError ? 'Error:' : 'Output:'}
            </div>
            <pre style={{ 
              margin: 0, 
              padding: '8px', 
              backgroundColor: 'rgba(255, 255, 255, 0.8)',
              borderRadius: '4px',
              overflow: 'auto',
              maxHeight: '200px',
              fontSize: '10px',
              lineHeight: '1.4',
              color: hasError ? 'rgba(255, 77, 79, 0.9)' : 'inherit'
            }}>
              {hasError ? error : resultStr}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// Custom chat handler that integrates with our existing logic
class CustomChatHandler {
  private _messages: Message[] = []
  private onMessagesChange: (messages: Message[]) => void
  private onSendMessage: (message: Message) => Promise<void>
  private isStreaming: boolean = false
  private onStreamingChange: (streaming: boolean) => void

  constructor(
    onMessagesChange: (messages: Message[]) => void,
    onSendMessage: (message: Message) => Promise<void>,
    onStreamingChange: (streaming: boolean) => void
  ) {
    this.onMessagesChange = onMessagesChange
    this.onSendMessage = onSendMessage
    this.onStreamingChange = onStreamingChange
  }

  get messages() {
    return this._messages
  }

  get isLoading() {
    return this.isStreaming
  }

  get status() {
    return this.isStreaming ? 'streaming' : 'ready'
  }

  setMessages(messages: Message[]) {
    this._messages = messages
    this.onMessagesChange(messages)
  }

  setStreaming(streaming: boolean) {
    this.isStreaming = streaming
    this.onStreamingChange(streaming)
  }

  async sendMessage(message: Message) {
    await this.onSendMessage(message)
  }

  async regenerate() {
    // Implementation for regenerate if needed
  }

  async stop() {
    // Implementation for stop if needed
  }
}

export function StreamingChatInterface({ agentId }: StreamingChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [isStreaming, setIsStreaming] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [isMobile, setIsMobile] = useState(false)
  const [threads, setThreads] = useState<Thread[]>([])
  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null)
  const [threadsDrawerVisible, setThreadsDrawerVisible] = useState(false)
  const [editingThread, setEditingThread] = useState<Thread | null>(null)
  const [editingThreadTitle, setEditingThreadTitle] = useState('')
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const [threadToAction, setThreadToAction] = useState<Thread | null>(null)
  const [editingMessage, setEditingMessage] = useState<string | null>(null)
  const [editingMessageContent, setEditingMessageContent] = useState<string>('')
  const [editingMessageType, setEditingMessageType] = useState<'document' | 'code' | null>(null)
  const [editingMessageText, setEditingMessageText] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [selectedModel, setSelectedModel] = useState<string>('anthropic/claude-sonnet-4-20250514')
  const [toolMode, setToolMode] = useState<'search' | 'direct'>('search')
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Define handleSendMessage before creating chatHandler
  const handleSendMessage = useCallback(async (msg: Message) => {
    const textPart = msg.parts.find(p => p.type === 'text')
    const content = textPart && 'text' in textPart ? textPart.text : ''
    if (!content.trim() || isStreaming) return
    
    // Clear input immediately after sending
    setInputValue('')

    // Create a new thread if none exists
    let threadId = currentThreadId
    logger.log('Current threadId before processing:', threadId)
    logger.log('Available threads:', threads.map(t => t.id))
    
    // Validate that the currentThreadId actually exists in our threads list
    if (threadId && !threads.find(t => t.id === threadId)) {
      logger.log('Current threadId not found in threads list, clearing it')
      setCurrentThreadId(null)
      threadId = null
    }
    
    if (!threadId) {
      logger.log('Creating new thread...')
      threadId = await createNewThread(content)
      logger.log('Created thread with ID:', threadId)
      if (!threadId) {
        logger.error('Failed to create thread')
        return
      }
    } else {
      logger.log('Using existing threadId:', threadId)
    }

    // Add user message immediately (check for duplicates)
    setMessages(prev => {
      // Check if message already exists to prevent duplicates
      if (prev.some(existingMsg => existingMsg.id === msg.id)) {
        logger.warn('Duplicate message detected, skipping:', msg.id)
        return prev
      }
      return [...prev, msg]
    })
    setIsStreaming(true)
    setStatusMessage('') // Reset status message for new request

    // Note: User message will be saved by the API route, no need to save here

    // Create assistant message placeholder
    const assistantMessageId = uuidv4()
    const assistantMessage: Message = {
      id: assistantMessageId,
      role: 'assistant',
      parts: [{
        type: 'text' as const,
        text: ''
      }]
    }

    setMessages(prev => [...prev, assistantMessage])

    try {
      // Create abort controller for this request
      abortControllerRef.current = new AbortController()

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          agentId: agentId,
          threadId: threadId || null,
          modelId: selectedModel,
          toolMode,
        }),
        signal: abortControllerRef.current.signal
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let sources: Array<{
        id: string
        text?: string
        content?: string
        url?: string
        metadata: Record<string, unknown>
        score?: number
        similarity?: number
      }> = []
      let fullResponse = ''
      let toolCalls: Map<string, {
        toolName: string
        toolDescription?: string
        params: Record<string, unknown>
        result?: unknown
        error?: string
        inProgress: boolean
      }> = new Map()
      let sseBuffer = ''
      let hasReceivedContent = false

      // Flush UI at a fixed interval while streaming so text appears incrementally even if server sends in bursts
      const FLUSH_INTERVAL_MS = 50
      let flushIntervalId: ReturnType<typeof setInterval> | null = null
      const flushToState = () => {
        const parts: Array<{ type: string; [key: string]: unknown }> = []
        // Add all tool calls/results as pills (both in-progress and completed)
        for (const toolCall of toolCalls.values()) {
          parts.push({ type: 'tool-result', ...toolCall })
        }
        parts.push({ type: 'text', text: fullResponse })
        setMessages(prev => prev.map(msg =>
          msg.id === assistantMessageId
            ? {
                ...msg,
                parts: [
                  ...parts,
                  ...(msg.parts.filter(p => p.type === 'data-sources'))
                ]
              }
            : msg
        ))
      }
      const scheduleFlush = () => {
        // Always flush immediately when content arrives
        flushToState()
        // Then set up interval if not already running
        if (flushIntervalId === null) {
          flushIntervalId = setInterval(flushToState, FLUSH_INTERVAL_MS)
        }
      }

      const processSSEEvent = (data: { type: string; [key: string]: unknown }) => {
        if (data.type === 'status') {
          // Update status message for what the agent is currently doing
          setStatusMessage((data.status as string) || 'Processing...')
        } else if (data.type === 'tool_call') {
          // Tool call started - show pill immediately (in progress)
          const toolName = (data.toolName as string) || 'unknown'
          const toolCallId = `${toolName}-${Date.now()}-${Math.random()}` // Unique ID for this call
          toolCalls.set(toolCallId, {
            toolName,
            params: (data.params as Record<string, unknown>) || {},
            inProgress: true,
          })
          logger.log('[StreamingChat] Tool call started:', { toolName, toolCallId })
          flushToState()
        } else if (data.type === 'tool_result') {
          // Tool result received - update existing call or add new one
          const toolName = (data.toolName as string) || 'unknown'
          // Find the most recent in-progress call for this tool, or create new entry
          let toolCallId: string | null = null
          for (const [id, call] of toolCalls.entries()) {
            if (call.toolName === toolName && call.inProgress) {
              toolCallId = id
              break
            }
          }
          if (!toolCallId) {
            toolCallId = `${toolName}-${Date.now()}-${Math.random()}`
          }
          toolCalls.set(toolCallId, {
            toolName,
            toolDescription: data.toolDescription as string | undefined,
            params: (data.params as Record<string, unknown>) || {},
            result: data.result,
            error: data.error as string | undefined,
            inProgress: false,
          })
          logger.log('[StreamingChat] Tool result received:', { toolName, toolCallId, hasResult: !!data.result, totalToolCalls: toolCalls.size })
          flushToState()
        } else if (data.type === 'content') {
          fullResponse += (data.content as string) ?? ''
          // Clear status message when content starts streaming (first chunk)
          if (!hasReceivedContent) {
            hasReceivedContent = true
            setStatusMessage('')
          }
          // Flush immediately on each content chunk
          scheduleFlush()
        } else if (data.type === 'sources') {
          sources = (data.sources || []) as typeof sources
          // Update sources but keep existing content
          setMessages(prev => prev.map(msg =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  parts: [
                    ...Array.from(toolCalls.values()).map(tr => ({ type: 'tool-result' as const, ...tr })),
                    { type: 'text' as const, text: fullResponse },
                    {
                      type: 'data-sources' as const,
                      data: {
                        nodes: sources.map(source => ({
                          id: source.id,
                          text: source.text || source.content,
                          url: source.url || source.metadata?.source_url || `/documents/${source.id}`,
                          metadata: {
                            ...source.metadata,
                            document_name: source.metadata?.document_name || source.metadata?.documentName || `Document ${source.id}`
                          },
                          score: source.score || source.similarity
                        }))
                      }
                    }
                  ]
                }
              : msg
          ))
        } else if (data.type === 'done') {
          // Clear interval and do final flush
          if (flushIntervalId !== null) {
            clearInterval(flushIntervalId)
            flushIntervalId = null
          }
          logger.log('[StreamingChat] Done event received, flushing final state:', { toolCallsCount: toolCalls.size, hasContent: !!fullResponse.trim() })
          flushToState()
          // Only clear status if we have content, otherwise keep it briefly
          if (fullResponse.trim()) {
            setStatusMessage('')
          } else {
            // If no content was generated, clear status after a short delay
            setTimeout(() => setStatusMessage(''), 500)
          }
        } else if (data.type === 'error') {
          throw new Error((data.error as string) || 'Unknown error')
        }
      }

      // Split only at SSE event boundaries (\n\n followed by "data: ") so we don't break on \n\n inside JSON
      const splitSSEEvents = (buf: string): { events: string[]; remainder: string } => {
        const events: string[] = []
        const re = /\n\n(?=data: )/g
        let lastIndex = 0
        let match: RegExpExecArray | null
        while ((match = re.exec(buf)) !== null) {
          events.push(buf.slice(lastIndex, match.index).trim())
          lastIndex = match.index + 2
        }
        const remainder = buf.slice(lastIndex)
        return { events, remainder }
      }

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          sseBuffer += decoder.decode(value, { stream: true })
          const { events, remainder } = splitSSEEvents(sseBuffer)
          sseBuffer = remainder

          for (const event of events) {
            const line = event.split('\n').find(l => l.startsWith('data: '))
            if (!line) continue
            try {
              const data = JSON.parse(line.slice(6)) as { type: string; [key: string]: unknown }
              processSSEEvent(data)
            } catch (parseError) {
              logger.error('Error parsing SSE data:', parseError)
            }
          }
        }
        if (sseBuffer.trim()) {
          const line = sseBuffer.trim().split('\n').find(l => l.startsWith('data: '))
          if (line) {
            try {
              const data = JSON.parse(line.slice(6)) as { type: string; [key: string]: unknown }
              processSSEEvent(data)
            } catch {
              // ignore final partial line
            }
          }
        }
      } finally {
        if (flushIntervalId !== null) {
          clearInterval(flushIntervalId)
          flushIntervalId = null
        }
        reader.releaseLock()
        flushToState()
      }
    } catch (error) {
      logger.error('Error sending message:', error)
      
      // Update assistant message with error, preserving tool result if present
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? {
              ...msg,
              parts: [
                ...(msg.parts.filter(p => p.type === 'tool-result')),
                {
                  type: 'text' as const,
                  text: 'Sorry, I encountered an error while processing your request. Please try again.'
                }
              ]
            }
          : msg
      ))
    } finally {
      setIsStreaming(false)
      setStatusMessage('')
      abortControllerRef.current = null
    }
  }, [agentId, isStreaming, currentThreadId, threads, selectedModel, toolMode])

  // Create custom chat handler
  const chatHandler = useRef(new CustomChatHandler(
    setMessages,
    handleSendMessage,
    setIsStreaming
  )).current

  // Sync chatHandler with current state
  useEffect(() => {
    chatHandler.setMessages(messages)
  }, [messages, chatHandler])

  useEffect(() => {
    chatHandler.setStreaming(isStreaming)
  }, [isStreaming, chatHandler])

  // Load threads and current thread messages on component mount
  useEffect(() => {
    loadThreads()
  }, [agentId])

  // Load messages when thread changes
  useEffect(() => {
    if (currentThreadId) {
      loadChatHistory(currentThreadId)
    } else {
      setMessages([])
      setLoading(false)
    }
  }, [currentThreadId])

  // Load chat history after streaming completes to sync with database
  // Removed automatic reload to prevent page refresh and duplicate messages
  // The streaming response already handles message updates in real-time

  // Check for mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadThreads = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/threads?agentId=${encodeURIComponent(agentId)}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load threads')
      const { threads: threadsData } = await res.json()
      setThreads(threadsData || [])

      if (!currentThreadId && threadsData?.length > 0) {
        setCurrentThreadId(threadsData[0].id)
      }
    } catch (error) {
      logger.error('Error loading threads:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadChatHistory = async (threadId?: string, forceReload = false) => {
    try {
      setLoading(true)
      const url = threadId
        ? `/api/threads/${threadId}/messages`
        : `/api/chat?agentId=${encodeURIComponent(agentId)}`
      const res = await fetch(url, { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load messages')
      const data = await res.json()
      const chatMessages = data.messages ?? []

      // Convert chat messages to LlamaIndex format
      const formattedMessages: Message[] = (chatMessages || []).map((msg: DBChatMessage) => {
        const parts: Array<{ type: string; [key: string]: unknown }> = []
        
        // Add tool result part if present
        // Handle both toolResult (singular) and toolResults (plural) for backward compatibility
        const toolResultsFromMetadata = Array.isArray(msg.metadata?.toolResults) 
          ? msg.metadata.toolResults 
          : (msg.metadata?.toolResult ? [msg.metadata.toolResult] : [])
        for (const toolResult of toolResultsFromMetadata) {
          if (toolResult && typeof toolResult === 'object' && toolResult !== null) {
            parts.push({
              type: 'tool-result',
              ...(toolResult as Record<string, unknown>),
            })
          }
        }
        
        // Add text part
        parts.push({
          type: 'text',
          text: msg.content,
        })
        
        // Add sources part if present
        if (msg.metadata?.sources && msg.metadata.sources.length > 0) {
          parts.push({
            type: 'data-sources',
            data: {
              nodes: msg.metadata.sources.map((source: any) => ({
                id: source.id,
                text: source.text || source.content,
                url: source.url || source.metadata?.source_url || `/documents/${source.id}`,
                metadata: {
                  ...source.metadata,
                  document_name: source.metadata?.document_name || source.metadata?.documentName || `Document ${source.id}`
                },
                score: source.score || source.similarity
              }))
            }
          })
        }
        
        return {
          id: msg.id,
          role: msg.role as 'user' | 'assistant',
          parts,
        }
      })

      // Only overwrite messages if we're not currently streaming or if forceReload is true
      if (forceReload || !isStreaming) {
        setMessages(formattedMessages)
      }
    } catch (error) {
      logger.error('Error loading chat history:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveMessage = async (_message: DBChatMessage) => {
    // Messages are saved by the chat API when streaming; no client-side insert needed.
  }

  const generateThreadName = () => {
    const now = new Date()
    const month = now.toLocaleString('default', { month: 'short' })
    const day = now.getDate()
    const year = now.getFullYear()
    const time = now.toLocaleString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    })
    return `Thread - ${month} ${day}, ${year} ${time}`
  }

  const createNewThread = async (userMessage?: string): Promise<string | null> => {
    try {
      logger.log('createNewThread: Starting thread creation')
      let threadName: string
      if (userMessage && userMessage.trim()) {
        const firstPart = userMessage.trim().substring(0, 50)
        threadName = firstPart.endsWith(' ') ? firstPart.trim() : firstPart
        if (userMessage.length > 50) threadName += '...'
      } else {
        threadName = generateThreadName()
      }
      logger.log('createNewThread: Generated thread name:', threadName)
      const res = await fetch('/api/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, title: threadName }),
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? 'Failed to create thread')
      }
      const { thread } = await res.json()
      logger.log('createNewThread: Thread created successfully:', thread.id)
      setThreads(prev => [thread, ...prev])
      setCurrentThreadId(thread.id)
      return thread.id
    } catch (error) {
      logger.error('Error creating thread:', error)
      return null
    }
  }

  // Wrapper for click handlers that don't have a user message
  const handleCreateNewThread = async () => {
    await createNewThread()
  }

  const updateThread = async (threadId: string, title: string) => {
    try {
      const res = await fetch(`/api/threads/${threadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() }),
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to update thread')

      setThreads(prev => prev.map(thread =>
        thread.id === threadId ? { ...thread, title: title.trim() } : thread
      ))
      setEditingThread(null)
    } catch (error) {
      logger.error('Error updating thread:', error)
    }
  }

  const handleInlineEdit = (thread: Thread) => {
    setEditingThread(thread)
    setEditingThreadTitle(thread.title)
  }

  const handleInlineSave = async () => {
    if (editingThread && editingThreadTitle.trim()) {
      await updateThread(editingThread.id, editingThreadTitle.trim())
      setEditingThread(null)
      setEditingThreadTitle('')
    }
  }

  const handleInlineCancel = () => {
    setEditingThread(null)
    setEditingThreadTitle('')
  }

  const handleDeleteClick = (thread: Thread) => {
    setThreadToAction(thread)
    setDeleteModalVisible(true)
  }

  const handleDeleteConfirm = async () => {
    if (threadToAction) {
      await deleteThread(threadToAction.id)
      setDeleteModalVisible(false)
      setThreadToAction(null)
    }
  }

  const handleEditMessage = (messageId: string, currentText: string, editorType: 'document' | 'code' = 'document') => {
    setEditingMessage(messageId)
    setEditingMessageText(currentText)
    setEditingMessageContent(currentText)
    setEditingMessageType(editorType)
  }

  const handleEditAsDocument = (messageId: string, currentText: string) => {
    handleEditMessage(messageId, currentText, 'document')
  }

  const handleEditAsCode = (messageId: string, currentText: string) => {
    handleEditMessage(messageId, currentText, 'code')
  }

  const handleSaveEdit = async () => {
    const contentToSave = editingMessageText.trim()
    if (!editingMessage || !contentToSave) return

    try {
      // Find the edited message to check if content actually changed
      const editedMessage = messages.find(msg => msg.id === editingMessage)
      if (!editedMessage) return

      const currentContent = editedMessage.parts?.find(p => p.type === 'text' && 'text' in p)?.text || ''
      const newContent = contentToSave.trim()
      
      // If content hasn't changed, just cancel edit
      if (currentContent === newContent) {
        setEditingMessage(null)
        setEditingMessageText('')
        return
      }

      // Find the index of the edited message
      const editedMessageIndex = messages.findIndex(msg => msg.id === editingMessage)
      
      // Remove all messages after the edited message (including the agent response)
      const messagesToKeep = messages.slice(0, editedMessageIndex + 1)
      
      // Update the edited message in the messages to keep
      const updatedMessages = messagesToKeep.map(msg => 
        msg.id === editingMessage 
          ? { 
              ...msg, 
              parts: [{
                type: 'text' as const,
                text: newContent
              }]
            }
          : msg
      )
      
      logger.log('Before update:', messages.length, 'messages')
      logger.log('After update:', updatedMessages.length, 'messages')
      logger.log('Edited message content:', newContent)
      logger.log('Updated messages:', updatedMessages.map(m => ({ id: m.id, role: m.role, text: m.parts.find(p => p.type === 'text' && 'text' in p)?.text?.substring(0, 50) })))
      
      // Set the updated messages (edited user message + no assistant messages)
      setMessages(updatedMessages)
      
      // Update the message in the database via API
      try {
        const patchRes = await fetch(`/api/chat/messages/${editingMessage}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: newContent }),
          credentials: 'include',
        })
        if (!patchRes.ok) logger.warn('Failed to update message in database')
      } catch (e) {
        logger.warn('Error updating message:', e)
      }

      setEditingMessage(null)
      setEditingMessageText('')
      setEditingMessageContent('')

      // Delete the agent response from database if it exists
      if (editedMessageIndex + 1 < messages.length) {
        const agentMessage = messages[editedMessageIndex + 1]
        if (agentMessage.role === 'assistant') {
          try {
            const delRes = await fetch(`/api/chat/messages/${agentMessage.id}`, {
              method: 'DELETE',
              credentials: 'include',
            })
            if (!delRes.ok) logger.error('Error deleting agent message')
          } catch (e) {
            logger.error('Error deleting agent message:', e)
          }
        }
      }

      // Regenerate the agent response using the existing thread
      if (currentThreadId) {
        // Create assistant message placeholder
        const assistantMessageId = uuidv4()
        const assistantMessage: Message = {
          id: assistantMessageId,
          role: 'assistant',
          parts: [{
            type: 'text' as const,
            text: ''
          }]
        }

        setMessages(prev => [...prev, assistantMessage])
        setIsStreaming(true)

        try {
          // Create abort controller for this request
          abortControllerRef.current = new AbortController()

          const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message: newContent,
              agentId,
              threadId: currentThreadId,
              isEdit: true // Flag to indicate this is an edit, not a new message
            }),
            signal: abortControllerRef.current.signal
          })

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
          }

          // Handle streaming response
          const reader = response.body?.getReader()
          if (!reader) {
            throw new Error('No response body')
          }

          let assistantContent = ''
          let sources: Array<{
            id: string
            content?: string
            text?: string
            url?: string
            metadata: Record<string, unknown>
            score?: number
            similarity?: number
          }> = []

          const decoder = new TextDecoder()
          let sseBuffer = ''
          let editFlushScheduled = false
          const editFlushToState = () => {
            editFlushScheduled = false
            setMessages(prev => prev.map(msg =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    parts: [
                      { type: 'text' as const, text: assistantContent },
                      ...(msg.parts.filter(p => p.type === 'data-sources'))
                    ]
                  }
                : msg
            ))
          }
          const editScheduleFlush = () => {
            if (editFlushScheduled) return
            editFlushScheduled = true
            requestAnimationFrame(editFlushToState)
          }
          const splitSSEEventsEdit = (buf: string): { events: string[]; remainder: string } => {
            const events: string[] = []
            const re = /\n\n(?=data: )/g
            let lastIndex = 0
            let match: RegExpExecArray | null
            while ((match = re.exec(buf)) !== null) {
              events.push(buf.slice(lastIndex, match.index).trim())
              lastIndex = match.index + 2
            }
            return { events, remainder: buf.slice(lastIndex) }
          }

          while (true) {
            const { value, done: readerDone } = await reader.read()
            if (readerDone) break

            if (value) {
              sseBuffer += decoder.decode(value, { stream: true })
              const { events, remainder } = splitSSEEventsEdit(sseBuffer)
              sseBuffer = remainder

              for (const event of events) {
                const line = event.split('\n').find(l => l.startsWith('data: '))
                if (!line) continue
                try {
                  const data = JSON.parse(line.slice(6)) as { type: string; content?: string; sources?: typeof sources }
                  if (data.type === 'content') {
                    assistantContent += data.content ?? ''
                    editScheduleFlush()
                  } else if (data.type === 'sources') {
                    sources = data.sources ?? []
                    editFlushToState()
                    setMessages(prev => prev.map(msg =>
                      msg.id === assistantMessageId
                        ? {
                            ...msg,
                            parts: [
                              { type: 'text' as const, text: assistantContent },
                              {
                                type: 'data-sources' as const,
                                data: {
                                  nodes: sources.map(source => ({
                                    id: source.id,
                                    text: source.text || source.content,
                                    url: source.url || source.metadata?.source_url || `/documents/${source.id}`,
                                    metadata: {
                                      ...source.metadata,
                                      document_name: source.metadata?.document_name || source.metadata?.documentName || `Document ${source.id}`
                                    },
                                    score: source.score || source.similarity
                                  }))
                                }
                              }
                            ]
                          }
                        : msg
                    ))
                  }
                } catch (parseError) {
                  logger.warn('Error parsing SSE data:', parseError)
                }
              }
            }
          }
          if (sseBuffer.trim()) {
            const line = sseBuffer.trim().split('\n').find(l => l.startsWith('data: '))
            if (line) {
              try {
                const data = JSON.parse(line.slice(6)) as { type: string; content?: string; sources?: typeof sources }
                if (data.type === 'content') assistantContent += data.content ?? ''
                if (data.type === 'sources') sources = data.sources ?? []
              } catch {
                // ignore final partial
              }
            }
          }
          editFlushToState()
        } catch (error) {
          logger.error('Error generating response:', error)
          // Remove the placeholder message on error
          setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId))
        } finally {
          setIsStreaming(false)
          abortControllerRef.current = null
        }
      }
    } catch (error) {
      logger.error('Error editing message:', error)
      // Reset edit state on error
      setEditingMessage(null)
      setEditingMessageText('')
      setEditingMessageContent('')
      setEditingMessageType(null)
    }
  }

  const handleCancelEdit = () => {
    setEditingMessage(null)
    setEditingMessageText('')
    setEditingMessageContent('')
    setEditingMessageType(null)
  }

  const deleteThread = async (threadId: string) => {
    try {
      const response = await fetch(`/api/threads/${threadId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete thread')
      }

      setThreads(prev => prev.filter(thread => thread.id !== threadId))
      
      // If we deleted the current thread, switch to another one or create new
      if (currentThreadId === threadId) {
        const remainingThreads = threads.filter(thread => thread.id !== threadId)
        if (remainingThreads.length > 0) {
          setCurrentThreadId(remainingThreads[0].id)
        } else {
          setCurrentThreadId(null)
          setMessages([])
        }
      }
    } catch (error) {
      logger.error('Error deleting thread:', error)
    }
  }

  const clearCurrentThread = async () => {
    if (!currentThreadId) return

    try {
      // Delete the entire thread (this will cascade delete all messages)
      const response = await fetch(`/api/threads/${currentThreadId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete thread')
      }

      // Remove thread from local state
      setThreads(prev => prev.filter(thread => thread.id !== currentThreadId))
      
      // Clear current thread and messages
      setCurrentThreadId(null)
      setMessages([])
    } catch (error) {
      logger.error('Error clearing thread:', error)
    }
  }


  const clearChatHistory = async () => {
    try {
      // Delete all threads for this agent (cascades to messages)
      await Promise.all(
        threads.map((t) =>
          fetch(`/api/threads/${t.id}`, { method: 'DELETE', credentials: 'include' })
        )
      )
      setThreads([])
      setCurrentThreadId(null)
      setMessages([])
    } catch (error) {
      logger.error('Error clearing chat history:', error)
    }
  }

  // Cancel ongoing request when component unmounts
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [])

  const currentThread = threads.find(t => t.id === currentThreadId)

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingContent}>
          <div className={styles.loadingSpinner}></div>
          <p className={styles.loadingText}>Loading chat history...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Threads Sidebar */}
      <div className={`${styles.sidebar} ${isMobile ? styles.sidebarMobile : ''} ${isMobile && !threadsDrawerVisible ? styles.sidebarHidden : ''}`}>
        <div className={styles.sidebarHeader}>
          <div>
            <TypographyTitle level={4} className={styles.sidebarTitle}>Conversations</TypographyTitle>
            <TypographyText className={styles.sidebarSubtitle}>{threads.length} active threads</TypographyText>
          </div>
          <TypographyButton 
            type="default" 
            icon={<TypographyPlusOutlined />}
            onClick={handleCreateNewThread}
            size="small"
            className={`stackone-button-primary ${styles.newChatButton}`}
            onMouseEnter={handleNewChatMouseEnter}
            onMouseLeave={handleNewChatMouseLeave}
          >
            New Chat
          </TypographyButton>
        </div>
        
        <div className={styles.sidebarContent}>
          {threads.length === 0 ? (
            <div className={styles.emptyState}>
              <TypographyEmpty 
                description="No threads yet"
                image={TypographyEmpty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          ) : (
            <TypographyList
              dataSource={threads}
              renderItem={(thread) => (
                <TypographyList.Item
                  className={`stackone-card ${styles.threadItem} ${currentThreadId === thread.id ? styles.threadItemActive : ''}`}
                  onMouseEnter={(e) => handleThreadMouseEnter(e, currentThreadId === thread.id)}
                  onMouseLeave={(e) => handleThreadMouseLeave(e, currentThreadId === thread.id)}
                  onClick={() => {
                    if (currentThreadId !== thread.id) {
                      setCurrentThreadId(thread.id)
                      setMessages([]) // Clear messages first
                    }
                  }}
                  actions={editingThread?.id === thread.id ? [
                    <TypographyButton
                      key="save"
                      type="text"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleInlineSave()
                      }}
                      style={{ color: '#52c41a' }}
                    >
                      Save
                    </TypographyButton>,
                    <TypographyButton
                      key="cancel"
                      type="text"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleInlineCancel()
                      }}
                      style={{ color: '#ff4d4f' }}
                    >
                      Cancel
                    </TypographyButton>
                  ] : [
                    <TypographyButton
                      key="edit"
                      type="text"
                      size="small"
                      icon={<TypographyEditOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleInlineEdit(thread)
                      }}
                    />,
                    <TypographyButton
                      key="delete"
                      type="text"
                      size="small"
                      icon={<TypographyDeleteOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteClick(thread)
                      }}
                    />
                  ]}
                >
                  <TypographyList.Item.Meta
                    title={
                      editingThread?.id === thread.id ? (
                        <TypographyInput
                          value={editingThreadTitle}
                          onChange={(e) => setEditingThreadTitle(e.target.value)}
                          onPressEnter={handleInlineSave}
                          onBlur={handleInlineSave}
                          autoFocus
                          size="small"
                          style={{ fontSize: '14px' }}
                        />
                      ) : (
                        <TypographyText 
                          strong={currentThreadId === thread.id}
                          className={`${styles.threadTitle} ${currentThreadId === thread.id ? styles.threadTitleActive : styles.threadTitleInactive}`}
                          onClick={() => handleInlineEdit(thread)}
                        >
                          {thread.title}
                        </TypographyText>
                      )
                    }
                    description={null}
                  />
                </TypographyList.Item>
              )}
            />
          )}
        </div>
      </div>

      {/* Chat Area with LlamaIndex Components */}
      <div className={styles.chatArea}>
        {/* Chat Header */}
        <div className={styles.chatHeader}>
          <div className={styles.chatHeaderLeft}>
            <div className={styles.chatIcon}>
              <TypographyCommentOutlined />
            </div>
            <div>
              <TypographyTitle level={4} className={styles.chatTitle}>
                {currentThread ? currentThread.title : 'AI Assistant'}
              </TypographyTitle>
              <TypographyText className={styles.chatSubtitle}>
                {currentThread ? 'Active conversation' : 'Ready to help'}
              </TypographyText>
            </div>
          </div>
          <TypographySpace>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#707070' }}>
              <span>Tools:</span>
              <div
                onClick={() => setToolMode(toolMode === 'search' ? 'direct' : 'search')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  border: '1px solid #d9d9d9',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 500,
                  backgroundColor: toolMode === 'direct' ? '#f0f9ff' : '#fff',
                  color: toolMode === 'direct' ? '#1d4ed8' : '#707070',
                  userSelect: 'none',
                  transition: 'all 0.15s ease',
                }}
                title={toolMode === 'search' ? 'Search/Execute: Agent discovers tools via search, then executes' : 'Direct: All tools available directly to the agent'}
              >
                {toolMode === 'search' ? '🔍 Search' : '⚡ Direct'}
              </div>
            </div>
            {isMobile && (
              <TypographyButton
                icon={<TypographyMessageOutlined />}
                onClick={() => setThreadsDrawerVisible(true)}
              />
            )}
            {currentThreadId && (
              <TypographyButton
                icon={<TypographyClearOutlined />}
                onClick={clearCurrentThread}
                title="Clear messages"
              />
            )}
          </TypographySpace>
        </div>

        {/* Messages Area */}
        <div className={styles.messagesArea}>
          {!currentThreadId ? (
            // Welcome screen when no thread is selected
            <div className={styles.welcomeScreen}>
              <div className={styles.welcomeContent}>
                <TypographyText className={styles.welcomeTitle}>
                  Hello there!
                </TypographyText>
                <TypographyText className={styles.welcomeSubtitle}>
                  How can I help you today?
                </TypographyText>
              </div>
            </div>
          ) : messages.length === 0 ? (
            <div className={styles.emptyMessages}>
              <TypographyEmpty 
                description="Start a conversation"
                image={TypographyEmpty.PRESENTED_IMAGE_SIMPLE}
              />
            </div>
          ) : (
            <div className={styles.messagesContainer}>
              {messages.map((message, index) => {
                // Find the index of the last user message
                const lastUserMessageIndex = messages.map((msg, idx) => ({ msg, idx }))
                  .filter(({ msg }) => msg.role === 'user')
                  .pop()?.idx ?? -1
                
                const isLatestUserMessage = message.role === 'user' && index === lastUserMessageIndex
                const isEditing = editingMessage === message.id
                
                
                
                return (
                  <div
                    key={message.id}
                    style={{
                      display: 'flex',
                      justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                      alignItems: 'flex-start',
                      gap: '12px',
                      animation: 'fadeInUp 0.3s ease-out',
                      animationDelay: `${index * 0.1}s`,
                      animationFillMode: 'both'
                    }}
                  >
                    <div 
                      style={{
                        width: isEditing ? '100%' : '70%',
                        minWidth: '120px',
                        position: 'relative',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px'
                      }}
                      onMouseEnter={(e) => {
                        const editButton = e.currentTarget.querySelector('.edit-button-hover') as HTMLElement
                        if (editButton) editButton.style.opacity = '1'
                      }}
                      onMouseLeave={(e) => {
                        const editButton = e.currentTarget.querySelector('.edit-button-hover') as HTMLElement
                        if (editButton) editButton.style.opacity = '0.3'
                      }}
                    >
                      {isLatestUserMessage && message.role === 'user' && !isEditing && (
                        <div style={{ 
                          position: 'absolute', 
                          left: '-32px', 
                          top: '8px',
                          zIndex: 10
                        }}>
                          <TypographyButton
                            type="text"
                            size="small"
                            icon={<TypographyEditOutlined />}
                            onClick={() => {
                              const text = message.parts.find(p => p.type === 'text' && 'text' in p)?.text || ''
                              handleEditAsDocument(message.id, text)
                            }}
                            style={{
                              color: 'var(--stackone-gray-400)',
                              padding: '4px',
                              minWidth: 'auto',
                              height: 'auto',
                              opacity: 0.3,
                              transition: 'opacity 0.2s ease'
                            }}
                            className="edit-button-hover"
                          />
                        </div>
                      )}
                      
                      {isEditing ? (
                        <div style={{ 
                          display: 'flex', 
                          flexDirection: 'column', 
                          gap: '12px',
                          width: '100%'
                        }}>
                          {/* Simple Text Editor for User Messages */}
                          <div style={{
                            background: '#f8f9fa',
                            border: '1px solid #e9ecef',
                            borderRadius: '8px',
                            padding: '16px',
                            minHeight: '120px'
                          }}>
                            <TypographyTextArea
                              value={editingMessageText}
                              onChange={(e) => setEditingMessageText(e.target.value)}
                              placeholder="Edit your message..."
                              autoSize={{ minRows: 3, maxRows: 8 }}
                              style={{
                                border: 'none',
                                boxShadow: 'none',
                                fontSize: '14px',
                                resize: 'none',
                                fontFamily: 'var(--font-sans)',
                                color: 'var(--stackone-gray-900)',
                                background: 'transparent',
                                outline: 'none'
                              }}
                            />
                          </div>
                          <div style={{ 
                            display: 'flex', 
                            gap: '8px', 
                            justifyContent: 'flex-end'
                          }}>
                            <TypographyButton
                              size="small"
                              onClick={handleSaveEdit}
                              className="stackone-button-primary"
                              style={{
                                background: '#000000',
                                border: 'none',
                                color: '#ffffff',
                                borderRadius: '8px',
                                fontWeight: 500,
                                fontFamily: 'var(--font-sans)',
                                transition: 'all 0.2s ease',
                                padding: '8px 16px',
                                height: '36px'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-1px)'
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)'
                                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                              }}
                            >
                              Save
                            </TypographyButton>
                            <TypographyButton
                              size="small"
                              onClick={handleCancelEdit}
                              style={{
                                background: 'rgba(255, 255, 255, 0.9)',
                                border: '1px solid rgba(240, 240, 240, 0.8)',
                                color: 'var(--stackone-gray-700)',
                                borderRadius: '8px',
                                fontFamily: 'var(--font-sans)',
                                fontWeight: 500,
                                transition: 'all 0.2s ease',
                                padding: '8px 16px',
                                height: '36px'
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 1)'
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)'
                              }}
                            >
                              Cancel
                            </TypographyButton>
                          </div>
                        </div>
                      ) : message.role === 'user' ? (
                        // User messages - clean black bubble with simple text rendering
                        <div 
                          style={{
                            width: '100%',
                            backgroundColor: '#000000',
                            color: '#ffffff',
                            borderRadius: '8px',
                            padding: '12px 16px',
                            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                            position: 'relative',
                            wordWrap: 'break-word',
                            lineHeight: '1.5',
                            fontFamily: 'var(--font-sans)',
                            fontSize: '14px'
                          }}
                        >
                          {message.parts.find(p => p.type === 'text' && 'text' in p)?.text}
                        </div>
                      ) : (
                        // Assistant messages - use LlamaIndex ChatMessage component
                        <div 
                          className="chat-message-container assistant-message"
                          style={{
                            width: '100%',
                            backgroundColor: 'transparent',
                            color: 'var(--stackone-gray-900)',
                            padding: '12px 0',
                            position: 'relative',
                            wordWrap: 'break-word',
                            lineHeight: '1.5'
                          }}
                        >
                          {/* Tool calls: grouped section, expandable/collapsible (show all tool results) */}
                          {(() => {
                            const toolResultParts = message.parts.filter(p => p.type === 'tool-result') as ToolResultPillProps[]
                            if (toolResultParts.length === 0) return null
                            return (
                              <div style={{ marginBottom: '12px' }}>
                                <details
                                  className={styles.toolCallsGroup}
                                  style={{
                                    border: '1px solid rgba(59, 130, 246, 0.2)',
                                    borderRadius: '8px',
                                    backgroundColor: 'rgba(59, 130, 246, 0.04)',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <summary className={styles.toolCallsSummary}>
                                    <span>
                                      {toolResultParts.length} tool call{toolResultParts.length !== 1 ? 's' : ''}
                                    </span>
                                    <span className={styles.toolCallsSummaryIcon}>
                                      <TypographyDownOutlined style={{ fontSize: '10px', opacity: 0.7 }} />
                                    </span>
                                  </summary>
                                  <div style={{ padding: '8px 12px 12px', borderTop: '1px solid rgba(59, 130, 246, 0.12)' }}>
                                    {toolResultParts.map((toolPart, idx) => (
                                      <ToolResultPill
                                        key={idx}
                                        toolName={toolPart.toolName}
                                        toolDescription={toolPart.toolDescription}
                                        params={toolPart.params}
                                        result={toolPart.result}
                                        error={toolPart.error}
                                      />
                                    ))}
                                  </div>
                                </details>
                              </div>
                            )
                          })()}
                          
                          <div style={{
                            color: 'inherit',
                            fontFamily: 'var(--font-sans)',
                            fontSize: '14px',
                            lineHeight: '1.5'
                          }}>
                            <ChatMessage message={message} isLast={index === messages.length - 1}>
                              <ChatMessage.Content>
                                <ChatMessage.Part.Markdown />
                              </ChatMessage.Content>
                            </ChatMessage>
                          </div>
                          
                          {/* Custom Source Pills for assistant messages (only when there are sources) */}
                          {(message.parts.find(p => p.type === 'data-sources') as { data?: { nodes?: unknown[] } } | undefined)?.data?.nodes?.length ? (
                            <div style={{ 
                              marginTop: '12px',
                              paddingTop: '12px',
                              borderTop: '1px solid rgba(240, 240, 240, 0.8)'
                            }}>
                              <div style={{
                                fontSize: '11px',
                                fontWeight: 600,
                                color: 'var(--stackone-gray-500)',
                                marginBottom: '8px',
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>
                                Sources
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                {(message.parts.find(p => p.type === 'data-sources') as any)?.data?.nodes?.map((source: any, sourceIndex: number) => (
                                  <div
                                    key={sourceIndex}
                                    style={{
                                      backgroundColor: 'rgba(240, 240, 240, 0.8)',
                                      color: 'var(--stackone-gray-700)',
                                      padding: '4px 8px',
                                      borderRadius: '12px',
                                      fontSize: '11px',
                                      fontWeight: 500,
                                      border: 'none',
                                      cursor: 'pointer',
                                      transition: 'all 0.2s ease'
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.backgroundColor = 'rgba(240, 240, 240, 1)'
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.backgroundColor = 'rgba(240, 240, 240, 0.8)'
                                    }}
                                  >
                                    {source.metadata?.document_name || source.metadata?.documentName || source.metadata?.filename || `Document ${source.id}` || `Source ${sourceIndex + 1}`}
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
              
              {isStreaming && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  animation: 'fadeInUp 0.3s ease-out'
                }}>
                  <div style={{
                    maxWidth: '70%',
                    minWidth: '120px',
                    position: 'relative'
                  }}>
                    <div style={{
                      color: 'var(--stackone-gray-900)',
                      padding: '12px 0',
                      position: 'relative',
                      wordWrap: 'break-word',
                      lineHeight: '1.5',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <div style={{
                        display: 'flex',
                        gap: '4px'
                      }}>
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--stackone-gray-400)',
                          animation: 'pulse 1.4s infinite ease-in-out'
                        }} />
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--stackone-gray-400)',
                          animation: 'pulse 1.4s infinite ease-in-out',
                          animationDelay: '0.2s'
                        }} />
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--stackone-gray-400)',
                          animation: 'pulse 1.4s infinite ease-in-out',
                          animationDelay: '0.4s'
                        }} />
                      </div>
                      <span style={{
                        fontSize: '12px',
                        color: 'var(--stackone-gray-500)',
                        fontFamily: 'var(--font-sans)'
                      }}>
                        {statusMessage || 'AI is thinking...'}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div style={{ 
          padding: '24px 32px', 
          borderTop: '1px solid rgba(240, 240, 240, 0.6)',
          backgroundColor: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px)',
          position: 'relative',
          zIndex: 5
        }}>
          {!currentThreadId ? (
            // Enhanced input area for new conversations
            <div style={{
              width: '100%',
              maxWidth: '800px',
              margin: '0 auto',
              position: 'relative'
            }}>
              <div className="stackone-card" style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0',
                padding: '0',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}>
                {/* Model selector row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px 0 24px',
                }}>
                  {/* Provider logo */}
                  <span style={{ lineHeight: 1, flexShrink: 0 }}>
                    {selectedModel.startsWith('anthropic/') ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: 'middle' }}>
                        <path d="M17.304 3.541h-3.483l6.15 16.918h3.483l-6.15-16.918zM6.696 3.541L.546 20.459H4.03l1.263-3.474h6.47l1.263 3.474h3.483L10.36 3.541H6.696zm.838 10.6 2.198-6.046 2.198 6.046H7.534z" fill="#191919"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ verticalAlign: 'middle' }}>
                        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073z" fill="#191919"/>
                      </svg>
                    )}
                  </span>
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={isStreaming}
                    style={{
                      background: 'transparent',
                      border: '1px solid #e5e5e5',
                      fontSize: '12px',
                      color: '#505050',
                      fontWeight: 500,
                      cursor: 'pointer',
                      padding: '3px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    <optgroup label="Anthropic">
                      <option value="anthropic/claude-sonnet-4-20250514">Claude Sonnet 4</option>
                      <option value="anthropic/claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                    </optgroup>
                    <optgroup label="OpenAI">
                      <option value="openai/gpt-4.1-mini">GPT-4.1 Mini</option>
                      <option value="openai/gpt-4.1">GPT-4.1</option>
                      <option value="openai/gpt-4.1-nano">GPT-4.1 Nano</option>
                    </optgroup>
                  </select>
                </div>
                {/* Input row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '12px',
                  padding: '0 12px 12px 24px',
                }}>
                <TypographyTextArea
                  placeholder="Type your message..."
                  autoSize={{ minRows: 2, maxRows: 6 }}
                  disabled={isStreaming}
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  style={{
                    flex: 1,
                    border: 'none',
                    boxShadow: 'none',
                    fontSize: '15px',
                    resize: 'none',
                    padding: '16px 0',
                    fontFamily: 'var(--font-sans)',
                    color: 'var(--stackone-gray-900)',
                    background: 'transparent',
                    outline: 'none'
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      const text = inputValue.trim()
                      if (text) {
                        const newMessage: Message = {
                          id: uuidv4(),
                          role: 'user',
                          parts: [{ type: 'text', text }]
                        }
                        handleSendMessage(newMessage)
                      }
                    }
                  }}
                />
                <TypographyButton
                  type="default"
                  icon={<TypographyArrowUpOutlined />}
                  disabled={isStreaming}
                  loading={isStreaming}
                  onClick={() => {
                    const text = inputValue.trim()
                    if (text) {
                      const newMessage: Message = {
                        id: uuidv4(),
                        role: 'user',
                        parts: [{ type: 'text', text }]
                      }
                      handleSendMessage(newMessage)
                    }
                  }}
                  className="stackone-button-primary"
                  style={{
                    background: '#000000',
                    border: 'none',
                    color: '#ffffff',
                    borderRadius: '8px',
                    width: '44px',
                    height: '44px',
                    minWidth: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isStreaming) {
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                  }}
                />
                </div>{/* end input row */}
              </div>{/* end stackone-card */}
              <div style={{
                textAlign: 'center',
                marginTop: '12px'
              }}>
                <TypographyText style={{
                  color: 'var(--stackone-gray-500)',
                  fontSize: '12px',
                  fontFamily: 'var(--font-sans)'
                }}>
                  Press Enter to send, Shift + Enter for new line
                </TypographyText>
              </div>
            </div>
          ) : (
            // Regular input area for existing threads
            <div className="stackone-card" style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '12px',
              padding: '12px 12px 12px 24px',
              transition: 'all 0.2s ease',
              position: 'relative'
            }}>
              <TypographyTextArea
                placeholder="Type your message..."
                autoSize={{ minRows: 2, maxRows: 6 }}
                disabled={isStreaming}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                style={{
                  flex: 1,
                  border: 'none',
                  boxShadow: 'none',
                  fontSize: '15px',
                  resize: 'none',
                  padding: '16px 0',
                  fontFamily: 'var(--font-sans)',
                  color: 'var(--stackone-gray-900)',
                  background: 'transparent',
                  outline: 'none'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    const text = inputValue.trim()
                    if (text) {
                      const newMessage: Message = {
                        id: uuidv4(),
                        role: 'user',
                        parts: [{ type: 'text', text }]
                      }
                      handleSendMessage(newMessage)
                    }
                  }
                }}
              />
              <TypographyButton
                type="default"
                icon={<TypographyArrowUpOutlined />}
                disabled={isStreaming}
                loading={isStreaming}
                onClick={() => {
                  const text = inputValue.trim()
                  if (text) {
                    const newMessage: Message = {
                      id: uuidv4(),
                      role: 'user',
                      parts: [{ type: 'text', text }]
                    }
                    handleSendMessage(newMessage)
                  }
                }}
                className="stackone-button-primary"
                style={{
                  background: '#000000',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '8px',
                  width: '44px',
                  height: '44px',
                  minWidth: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-sans)',
                  fontWeight: 500,
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isStreaming) {
                    e.currentTarget.style.transform = 'translateY(-1px)'
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)'
                  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Mobile Threads Drawer */}
      {isMobile && (
        <TypographyDrawer
          title="Threads"
          placement="left"
          onClose={() => setThreadsDrawerVisible(false)}
          open={threadsDrawerVisible}
          width={300}
        >
          <div style={{ marginBottom: '16px' }}>
            <TypographyButton 
              type="default" 
              icon={<TypographyPlusOutlined />}
              onClick={() => {
                setThreadsDrawerVisible(false)
                handleCreateNewThread()
              }}
              block
              className="stackone-button-primary"
              style={{
                backgroundColor: '#000000',
                borderColor: '#000000',
                color: '#ffffff',
                borderRadius: '8px',
                fontFamily: 'var(--font-sans)',
                fontWeight: 500
              }}
            >
              New Thread
            </TypographyButton>
          </div>
          <TypographyList
            dataSource={threads}
            renderItem={(thread) => (
              <TypographyList.Item
                className="stackone-card"
                style={{
                  padding: '12px 0',
                  cursor: 'pointer',
                  backgroundColor: currentThreadId === thread.id ? 'var(--stackone-gray-100)' : 'transparent',
                  marginBottom: '4px',
                  transition: 'all 0.2s ease'
                }}
                onClick={() => {
                  if (currentThreadId !== thread.id) {
                    setCurrentThreadId(thread.id)
                    setMessages([]) // Clear messages first
                  }
                  setThreadsDrawerVisible(false)
                }}
              >
                <TypographyList.Item.Meta
                  title={
                    <TypographyText 
                      strong={currentThreadId === thread.id}
                      style={{ 
                        fontSize: '14px',
                        color: currentThreadId === thread.id ? 'var(--stackone-primary)' : 'var(--stackone-gray-900)',
                        fontFamily: 'var(--font-sans)',
                        fontWeight: currentThreadId === thread.id ? 600 : 500
                      }}
                    >
                      {thread.title}
                    </TypographyText>
                  }
                />
              </TypographyList.Item>
            )}
          />
        </TypographyDrawer>
      )}

      {/* Delete Thread Modal */}
      <TypographyModal
        title="Delete Thread"
        open={deleteModalVisible}
        onOk={handleDeleteConfirm}
        onCancel={() => {
          setDeleteModalVisible(false)
          setThreadToAction(null)
        }}
        okText="Delete"
        cancelText="Cancel"
        okButtonProps={{ danger: true }}
      >
        <p>Are you sure you want to delete this thread? This action cannot be undone.</p>
      </TypographyModal>
    </div>
  )
}
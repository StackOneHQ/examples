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
  CommentOutlined
} from '@ant-design/icons'
import { createClient } from '@/lib/supabase/client'
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

interface StreamingChatInterfaceProps {
  agentId: string
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
  const supabase = createClient()
  const abortControllerRef = useRef<AbortController | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Define handleSendMessage before creating chatHandler
  const handleSendMessage = useCallback(async (msg: Message) => {
    const textPart = msg.parts.find(p => p.type === 'text')
    const content = textPart && 'text' in textPart ? textPart.text : ''
    if (!content.trim() || isStreaming) return

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

    // Note: User message will be saved by the API route, no need to save here

    // Get user for saving assistant message
    const { data: { user } } = await supabase.auth.getUser()

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
          threadId: threadId || null
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

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                
                if (data.type === 'content') {
                  fullResponse += data.content
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { 
                          ...msg, 
                          parts: [
                            {
                              type: 'text' as const,
                              text: fullResponse
                            },
                            // Preserve existing sources if they exist
                            ...(msg.parts.filter(p => p.type === 'data-sources'))
                          ]
                        }
                      : msg
                  ))
                } else if (data.type === 'sources') {
                  sources = data.sources || []
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessageId 
                      ? { 
                          ...msg, 
                          parts: [
                            {
                              type: 'text' as const,
                              text: fullResponse
                            },
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
                  // Note: Assistant message will be saved by the API route, no need to save here
                } else if (data.type === 'error') {
                  throw new Error(data.error || 'Unknown error')
                }
              } catch (parseError) {
                logger.error('Error parsing SSE data:', parseError)
              }
            }
          }
        }
      } finally {
        reader.releaseLock()
      }
    } catch (error) {
      logger.error('Error sending message:', error)
      
      // Update assistant message with error
      setMessages(prev => prev.map(msg => 
        msg.id === assistantMessageId 
          ? { 
              ...msg, 
              parts: [{
                type: 'text' as const,
                text: 'Sorry, I encountered an error while processing your request. Please try again.'
              }]
            }
          : msg
      ))
    } finally {
      setIsStreaming(false)
      abortControllerRef.current = null
    }
  }, [agentId, isStreaming, currentThreadId, threads])

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
      const { data: threadsData, error } = await supabase
        .from('threads')
        .select('*')
        .eq('agent_id', agentId)
        .eq('status', 'active')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('updated_at', { ascending: false })

      if (error) throw error
      setThreads(threadsData || [])

      // If no current thread and we have threads, select the most recent one
      if (!currentThreadId && threadsData && threadsData.length > 0) {
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
      const query = supabase
        .from('chat_messages')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: true })

      if (threadId) {
        query.eq('thread_id', threadId)
      }

      const { data: chatMessages, error } = await query

      if (error) throw error

      // Convert chat messages to LlamaIndex format
      const formattedMessages: Message[] = (chatMessages || []).map(msg => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant',
        parts: [
          {
            type: 'text' as const,
            text: msg.content
          },
          ...(msg.metadata?.sources && msg.metadata.sources.length > 0 ? [{
            type: 'data-sources' as const,
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
          }] : [])
        ]
      }))

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

  const saveMessage = async (message: DBChatMessage) => {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert(message)

      if (error) throw error
    } catch (error) {
      logger.error('Error saving message:', error)
    }
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
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Use first part of user message as title, or fallback to timestamp
      let threadName: string
      if (userMessage && userMessage.trim()) {
        // Take first 50 characters and clean up
        const firstPart = userMessage.trim().substring(0, 50)
        threadName = firstPart.endsWith(' ') ? firstPart.trim() : firstPart
        // Add ellipsis if truncated
        if (userMessage.length > 50) {
          threadName += '...'
        }
      } else {
        threadName = generateThreadName()
      }
      
      logger.log('createNewThread: Generated thread name:', threadName)

      const { data: thread, error } = await supabase
        .from('threads')
        .insert({
          agent_id: agentId,
          user_id: user.id,
          title: threadName,
          status: 'active'
        })
        .select()
        .single()

      if (error) {
        logger.error('createNewThread: Database error:', error)
        throw error
      }

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
      const { error } = await supabase
        .from('threads')
        .update({
          title: title.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', threadId)

      if (error) throw error

      setThreads(prev => prev.map(thread => 
        thread.id === threadId 
          ? { ...thread, title: title.trim() }
          : thread
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
      
      // First, check if the message exists in the database
      logger.log('Checking if message exists in database:', editingMessage)
      
      const { data: existingMessage, error: fetchError } = await supabase
        .from('chat_messages')
        .select('id, content, role')
        .eq('id', editingMessage)
        .single()

      logger.log('Message exists check:', { existingMessage, fetchError })

      if (fetchError || !existingMessage) {
        logger.warn('Message not found in database, skipping database update:', editingMessage)
        // Don't throw an error, just continue with local state update
      } else {
        // Update the message in the database
        logger.log('Updating message in database:', {
          messageId: editingMessage,
          newContent: newContent.substring(0, 100) + '...',
          contentLength: newContent.length
        })
        
        const { data, error: updateError } = await supabase
          .from('chat_messages')
          .update({ 
            content: newContent
          })
          .eq('id', editingMessage)
          .select()

        logger.log('Database update result:', { data, error: updateError })

        if (updateError) {
          logger.error('Database update error:', updateError)
          // Don't throw an error, just log it and continue
          logger.warn('Database update failed, but continuing with local state update')
        } else if (!data || data.length === 0) {
          logger.warn('No rows updated - message may have been deleted, but continuing with local state update')
        } else {
          logger.log('Database update successful')
        }
      }

      // Clear edit state immediately
      setEditingMessage(null)
      setEditingMessageText('')
      setEditingMessageContent('')

      // Delete the agent response from database if it exists
      if (editedMessageIndex + 1 < messages.length) {
        const agentMessage = messages[editedMessageIndex + 1]
        if (agentMessage.role === 'assistant') {
          const { error: deleteError } = await supabase
            .from('chat_messages')
            .delete()
            .eq('id', agentMessage.id)
          
          if (deleteError) {
            logger.error('Error deleting agent message:', deleteError)
            // Don't throw here, just log the error as it's not critical
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
            id: string; 
            content?: string; 
            text?: string;
            url?: string;
            metadata: Record<string, unknown>; 
            score?: number;
            similarity?: number;
          }> = []

          const decoder = new TextDecoder()
          let done = false

          while (!done) {
            const { value, done: readerDone } = await reader.read()
            done = readerDone

            if (value) {
              const chunk = decoder.decode(value, { stream: true })
              const lines = chunk.split('\n')

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data = JSON.parse(line.slice(6))
                    
                    if (data.type === 'content') {
                      assistantContent += data.content
                      setMessages(prev => prev.map(msg => 
                        msg.id === assistantMessageId 
                          ? { 
                              ...msg, 
                              parts: [
                                {
                                  type: 'text' as const,
                                  text: assistantContent
                                },
                                // Preserve existing sources if they exist
                                ...(msg.parts.filter(p => p.type === 'data-sources'))
                              ]
                            }
                          : msg
                      ))
                    } else if (data.type === 'sources') {
                      sources = data.sources || []
                      setMessages(prev => prev.map(msg => 
                        msg.id === assistantMessageId 
                          ? { 
                              ...msg, 
                              parts: [
                                {
                                  type: 'text' as const,
                                  text: assistantContent
                                },
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
                      // Note: Assistant message will be saved by the API route, no need to save here
                    }
                  } catch (parseError) {
                    logger.warn('Error parsing SSE data:', parseError)
                  }
                }
              }
            }
          }
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
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('agent_id', agentId)

      if (error) throw error

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
                          
                          {/* Custom Source Pills for assistant messages */}
                          {message.parts.find(p => p.type === 'data-sources') && (
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
                          )}
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
                        AI is thinking...
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
                      const text = e.currentTarget.value.trim()
                      if (text) {
                        const newMessage: Message = {
                          id: uuidv4(),
                          role: 'user',
                          parts: [{ type: 'text', text }]
                        }
                        handleSendMessage(newMessage)
                        e.currentTarget.value = ''
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
                    const textarea = document.querySelector('textarea') as HTMLTextAreaElement
                    if (textarea && textarea.value.trim()) {
                      const text = textarea.value.trim()
                      const newMessage: Message = {
                        id: uuidv4(),
                        role: 'user',
                        parts: [{ type: 'text', text }]
                      }
                      handleSendMessage(newMessage)
                      textarea.value = ''
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
                    const text = e.currentTarget.value.trim()
                    if (text) {
                      const newMessage: Message = {
                        id: uuidv4(),
                        role: 'user',
                        parts: [{ type: 'text', text }]
                      }
                      handleSendMessage(newMessage)
                      e.currentTarget.value = ''
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
                  const textarea = document.querySelector('textarea') as HTMLTextAreaElement
                  if (textarea && textarea.value.trim()) {
                    const text = textarea.value.trim()
                    const newMessage: Message = {
                      id: uuidv4(),
                      role: 'user',
                      parts: [{ type: 'text', text }]
                    }
                    handleSendMessage(newMessage)
                    textarea.value = ''
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
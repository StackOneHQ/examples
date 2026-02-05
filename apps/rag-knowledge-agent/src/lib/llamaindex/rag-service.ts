import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { createAzureOpenAILLM, createAzureOpenAIEmbeddings } from './config'
import { query, queryOne } from '@/lib/db'
import { logger } from '@/utils/logger'

export interface DocumentChunk {
  id: string
  content: string
  metadata: {
    document_id: string
    document_name: string
    chunk_index: number
    source_url?: string
    /** Provider's native document ID (e.g. Google Docs document ID). Use this when calling provider APIs like googledocs_update_document. */
    remote_document_id?: string
    mime_type?: string
  }
  similarity?: number
}


export class RAGService {
  private llm: ReturnType<typeof createAzureOpenAILLM>
  private embeddings: ReturnType<typeof createAzureOpenAIEmbeddings>

  constructor() {
    this.llm = createAzureOpenAILLM()
    this.embeddings = createAzureOpenAIEmbeddings()
  }

  /**
   * Process and ingest documents into the vector store
   * Note: This method is deprecated. Use the new processDocument function that takes a file blob directly.
   */
  async ingestDocuments(_documentIds: string[], _userId: string): Promise<void> {
    logger.warn('ingestDocuments method is deprecated. Use the new processDocument function with file blobs.')
  }

  /**
   * Process a document from a file blob and store its chunks with embeddings.
   */
  async processDocument(fileBlob: Blob, options: {
    documentId: string;
    userId: string;
    agentId: string;
  }): Promise<unknown[]> {
    try {
      const document = await queryOne<{ name: string; mime_type: string; size: number; url: string | null; remote_document_id: string | null }>(
        `SELECT name, mime_type, size, url, remote_document_id FROM documents WHERE id = $1`,
        [options.documentId]
      )
      if (!document) throw new Error('Document not found')

      const text = await fileBlob.text()
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      })
      const chunks = await textSplitter.splitText(text)

      logger.log('Generating embeddings for', chunks.length, 'chunks...')
      const embeddings = await this.embeddings.getTextEmbeddings(chunks)

      const insertedChunks: unknown[] = []
      for (let index = 0; index < chunks.length; index++) {
        const chunk = chunks[index]
        const embedding = embeddings[index]
        const metadata: Record<string, unknown> = {
          document_name: document.name,
          agent_id: options.agentId,
          mime_type: document.mime_type || fileBlob.type || 'text/plain',
          size: document.size || fileBlob.size,
          source_url: document.url,
        }
        if (document.remote_document_id) {
          metadata.remote_document_id = document.remote_document_id
        }
        const embeddingStr = '[' + (embedding as number[]).join(',') + ']'
        await query(
          `INSERT INTO document_chunks (document_id, user_id, content, chunk_index, embedding, metadata)
           VALUES ($1, $2, $3, $4, $5::vector, $6::jsonb)`,
          [options.documentId, options.userId, chunk, index, embeddingStr, JSON.stringify(metadata)]
        )
        insertedChunks.push({ document_id: options.documentId, user_id: options.userId, content: chunk, chunk_index: index, metadata })
      }
      return insertedChunks
    } catch (error) {
      logger.error('Error processing document:', error)
      if (error && typeof error === 'object' && 'status' in error) {
        logger.error('Azure OpenAI Error Details:', {
          status: (error as { status?: number }).status,
          statusText: (error as { statusText?: string }).statusText,
          message: (error as Error).message,
        })
      }
      throw error
    }
  }

  /**
   * Query the RAG system with streaming response
   */
  async *queryStream(
    question: string,
    documentIds: string[],
    _userId: string,
    messageHistory: Array<{ role: 'user' | 'assistant', content: string }> = [],
    extraContext?: string
  ): AsyncGenerator<{
    type: 'content' | 'sources' | 'done' | 'error'
    content?: string
    sources?: DocumentChunk[]
    confidence?: number
    error?: string
  }, void, unknown> {
    logger.log('Querying stream with document IDs:', documentIds)
    try {
      logger.log('RAG - Generating question embedding')
      const questionEmbedding = await this.embeddings.getTextEmbeddings([question])
      logger.log('RAG - Question embedding ready')

      const embeddingStr = '[' + (questionEmbedding[0] as number[]).join(',') + ']'
      const similarChunks = await query<{
        id: string
        document_id: string
        user_id: string
        content: string
        chunk_index: number
        metadata: Record<string, unknown>
        document_name: string
        remote_document_id: string | null
        document_mime_type: string | null
        document_url: string | null
        similarity: number
      }>(
        `SELECT * FROM match_documents($1::vector, 0.7, 20, $2::uuid[])`,
        [embeddingStr, documentIds]
      )

      logger.log('RAG - match_documents returned', similarChunks?.length ?? 0, 'chunks')

      if (!similarChunks || similarChunks.length === 0) {
        if (extraContext?.trim()) {
          logger.log('RAG - No doc chunks but extraContext provided, streaming LLM from context only')
          yield { type: 'sources', sources: [] }
          const conversationMessages: Array<{ role: 'user' | 'assistant', content: string }> = []
          const systemPrompt = `You are a helpful AI assistant that answers questions accurately and comprehensively based on the context provided.

Guidelines:
- Answer questions naturally and conversationally using markdown formatting for readability
- Be accurate and comprehensive - provide complete answers when you have the information
- If you don't have enough information to answer a question, say so clearly
- If a tool or action was executed on behalf of the user, acknowledge it naturally without repeating technical details
- Do not output JSON, tool call formats, or technical implementation details - respond in natural language
- When tool results are provided, use them to answer the user's question directly`

          conversationMessages.push({
            role: 'user',
            content: `${systemPrompt}\n\nContext:\n${extraContext}`
          })
          messageHistory.forEach(msg => {
            conversationMessages.push({ role: msg.role, content: msg.content })
          })
          conversationMessages.push({ role: 'user', content: question })
          const stream = await this.llm.chat({ messages: conversationMessages, stream: true })
          for await (const chunk of stream) {
            if (chunk.delta) {
              const content = chunk.delta
              if (content) yield { type: 'content', content }
            }
          }
          yield { type: 'done', confidence: 0.5 }
          return
        }
        logger.log('RAG - No matching chunks, yielding fallback response')
        yield {
          type: 'content',
          content: "I couldn't find any relevant information in your documents to answer this question."
        }
        yield { type: 'sources', sources: [] }
        yield { type: 'done', confidence: 0.0 }
        return
      }

      const uniqueDocuments = new Map<string, DocumentChunk>()
      similarChunks.forEach((chunk) => {
        const documentName = chunk.document_name || (chunk.metadata?.document_name as string) || `Document ${chunk.document_id}`
        if (!uniqueDocuments.has(documentName)) {
          const metadata: DocumentChunk['metadata'] = {
            document_id: chunk.document_id,
            document_name: documentName,
            chunk_index: chunk.chunk_index,
            source_url: (chunk.document_url ?? chunk.metadata?.source_url) as string ?? undefined,
          }
          if (chunk.remote_document_id) metadata.remote_document_id = chunk.remote_document_id
          if (chunk.document_mime_type) metadata.mime_type = chunk.document_mime_type
          uniqueDocuments.set(documentName, {
            id: chunk.document_id,
            content: chunk.content,
            metadata,
            similarity: chunk.similarity,
          })
        }
      })

      const sources: DocumentChunk[] = Array.from(uniqueDocuments.values())
      logger.log('RAG - Yielding sources, then calling LLM (', sources.length, 'unique docs)')
      yield { type: 'sources', sources }

      const contextParts = similarChunks.map((c) => {
        const name = c.document_name || `Document ${c.document_id}`
        const parts: string[] = [name]
        if (c.remote_document_id) parts.push(`provider document ID: ${c.remote_document_id}`)
        if (c.document_mime_type) parts.push(`mime type: ${c.document_mime_type}`)
        if (c.document_url) parts.push(`url: ${c.document_url}`)
        const docLabel = parts.join(' | ')
        return `[${docLabel}]\n${c.content}`
      })
      const context = contextParts.join('\n\n')
      const conversationMessages: Array<{ role: 'user' | 'assistant', content: string }> = []
      
      // System prompt to guide the agent's behavior
      const systemPrompt = `You are a helpful AI assistant that answers questions accurately and comprehensively based on the context provided.

Guidelines:
- Answer questions naturally and conversationally using markdown formatting for readability
- Be accurate and comprehensive - provide complete answers when you have the information
- If you don't have enough information to answer a question, say so clearly
- If a tool or action was executed on behalf of the user, acknowledge it naturally without repeating technical details
- Do not output JSON, tool call formats, or technical implementation details - respond in natural language
- When tool results are provided, use them to answer the user's question directly`

      let contextBlock = `Context from documents:\n${context}`
      if (extraContext?.trim()) {
        contextBlock += `\n\nTool/Action Results:\n${extraContext}`
      }
      
      conversationMessages.push({
        role: 'user',
        content: `${systemPrompt}\n\n${contextBlock}`
      })
      messageHistory.forEach(msg => {
        conversationMessages.push({ role: msg.role, content: msg.content })
      })
      conversationMessages.push({ role: 'user', content: question })

      const contextPreview = contextBlock.slice(0, 200) + (contextBlock.length > 200 ? '...' : '')
      logger.log('RAG - LLM request:', {
        messageCount: conversationMessages.length,
        contextLength: contextBlock.length,
        question: question.slice(0, 120) + (question.length > 120 ? '...' : ''),
        contextPreview
      })
      const stream = await this.llm.chat({ messages: conversationMessages, stream: true })

      let firstContent = true
      let fullLlmResponse = ''
      let llmChunkCount = 0
      for await (const chunk of stream) {
        if (chunk.delta) {
          const content = chunk.delta
          if (content) {
            llmChunkCount += 1
            fullLlmResponse += content
            if (firstContent) {
              logger.log('RAG - First LLM content chunk received')
              firstContent = false
            }
            yield { type: 'content', content }
          }
        }
      }

      logger.log('RAG - LLM stream finished, yielding done (chunk count:', llmChunkCount, ')')
      logger.log('RAG - LLM response:', fullLlmResponse.slice(0, 500) + (fullLlmResponse.length > 500 ? '...' : ''))
      yield {
        type: 'done',
        confidence: this.calculateConfidence(similarChunks)
      }
    } catch (error) {
      logger.error('Error in streaming query:', error)
      yield {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  private calculateConfidence(similarChunks: { similarity: number }[]): number {
    if (similarChunks.length === 0) return 0.0
    const avgSimilarity = similarChunks.reduce((sum, chunk) => sum + chunk.similarity, 0) / similarChunks.length
    const chunkBonus = Math.min(similarChunks.length * 0.1, 0.3)
    return Math.min(avgSimilarity + chunkBonus, 1.0)
  }

  async deleteDocuments(documentIds: string[]): Promise<void> {
    try {
      if (documentIds.length === 0) return
      await query(
        `DELETE FROM document_chunks WHERE document_id = ANY($1::uuid[])`,
        [documentIds]
      )
    } catch (error) {
      logger.error('Error deleting documents:', error)
      throw error
    }
  }

  async getDocumentStatus(documentIds: string[], userId: string): Promise<unknown[]> {
    try {
      if (documentIds.length === 0) return []
      const rows = await query<{ id: string; name: string; status: string; created_at: string; updated_at: string }>(
        `SELECT id, name, status, created_at, updated_at FROM documents WHERE id = ANY($1::uuid[]) AND user_id = $2`,
        [documentIds, userId]
      )
      return rows ?? []
    } catch (error) {
      logger.error('Error getting document status:', error)
      return []
    }
  }

  async testEmbeddings(): Promise<boolean> {
    try {
      const testEmbeddings = await this.embeddings.getTextEmbeddings(['test'])
      return Boolean(testEmbeddings && testEmbeddings.length > 0)
    } catch (error) {
      logger.error('Error testing embeddings:', error)
      return false
    }
  }
}

export async function processDocument(fileBlob: Blob, options: {
  documentId: string;
  userId: string;
  agentId: string;
}): Promise<unknown[]> {
  const ragService = new RAGService()
  return ragService.processDocument(fileBlob, options)
}

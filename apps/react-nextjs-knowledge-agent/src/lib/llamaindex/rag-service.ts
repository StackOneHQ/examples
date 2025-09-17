import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { createAzureOpenAILLM, createAzureOpenAIEmbeddings } from './config'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/utils/logger'

export interface DocumentChunk {
  id: string
  content: string
  metadata: {
    document_id: string
    document_name: string
    chunk_index: number
    source_url?: string
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
    // This method is no longer used in the new implementation
    // Documents are now processed directly from file blobs in the agent processing flow
  }


  /**
   * Process a document from a file blob and store its chunks with embeddings
   */
  async processDocument(fileBlob: Blob, options: {
    documentId: string;
    userId: string;
    agentId: string;
  }): Promise<unknown[]> {
    try {
      const supabase = await createClient()
      
      // Get the actual document name from the documents table
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('name, mime_type, size, url')
        .eq('id', options.documentId)
        .single()
      
      if (docError) throw docError
      
      // Convert blob to text (in real implementation, you'd handle different file types)
      const text = await fileBlob.text()
      
      // Split content into chunks
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      })
      
      const chunks = await textSplitter.splitText(text)
      
      // Generate embeddings for each chunk
      logger.log('Generating embeddings for', chunks.length, 'chunks...')
      logger.log(chunks)
      const embeddings = await this.embeddings.getTextEmbeddings(chunks)
      
      // Prepare chunk data with embeddings
      const chunkData = chunks.map((chunk, index) => ({
        document_id: options.documentId,
        user_id: options.userId,
        content: chunk,
        chunk_index: index,
        embedding: embeddings[index],
        metadata: {
          document_name: document.name, // Use actual document name from database
          agent_id: options.agentId,
          mime_type: document.mime_type || fileBlob.type || 'text/plain',
          size: document.size || fileBlob.size,
          source_url: document.url,
        },
      }))

      // Store chunks with embeddings in Supabase
      const { data: insertedChunks, error: insertError } = await supabase
        .from('document_chunks')
        .insert(chunkData)
        .select()

      if (insertError) throw insertError

      return insertedChunks || []
    } catch (error) {
      logger.error('Error processing document:', error)
      
      // Log additional details for Azure OpenAI errors
      if (error && typeof error === 'object' && 'status' in error) {
        logger.error('Azure OpenAI Error Details:', {
          status: (error as any).status,
          statusText: (error as any).statusText,
          headers: (error as any).headers,
          message: (error as any).message,
          code: (error as any).code,
          type: (error as any).type
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
    userId: string, 
    messageHistory: Array<{ role: 'user' | 'assistant', content: string }> = []
  ): AsyncGenerator<{
    type: 'content' | 'sources' | 'done' | 'error'
    content?: string
    sources?: DocumentChunk[]
    confidence?: number
    error?: string
  }, void, unknown> {
    logger.log('Querying stream with document IDs:', documentIds)
    try {
      const supabase = await createClient()
      
      // Generate embedding for the question
      const questionEmbedding = await this.embeddings.getTextEmbeddings([question])
      
      // Search for similar chunks using Supabase's vector similarity search
      const { data: similarChunks, error } = await supabase
        .rpc('match_documents', {
          query_embedding: questionEmbedding[0],
          match_threshold: 0.7,
          match_count: 20, // Get more results to filter from
          document_ids: documentIds
        })

      if (error) throw error

      if (similarChunks.length === 0) {
        yield {
          type: 'content',
          content: "I couldn't find any relevant information in your documents to answer this question."
        }
        yield {
          type: 'sources',
          sources: []
        }
        yield {
          type: 'done',
          confidence: 0.0
        }
        return
      }

      // Format sources - deduplicate by document name to show unique files
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uniqueDocuments = new Map<string, any>()
      
      similarChunks.forEach((chunk: any) => {
        // Use document_name from the query result, fallback to metadata, then to document_id
        const documentName = chunk.document_name || chunk.metadata.document_name || `Document ${chunk.document_id}`
        if (!uniqueDocuments.has(documentName)) {
          uniqueDocuments.set(documentName, {
            id: chunk.document_id,
            text: `Referenced from ${documentName}`,
            url: chunk.metadata.source_url || `/documents/${chunk.document_id}`,
            metadata: {
              document_id: chunk.document_id,
              document_name: documentName,
              chunk_index: 0,
              source_url: chunk.metadata.source_url,
            },
            score: chunk.similarity,
          })
        }
      })
      
      const sources: DocumentChunk[] = Array.from(uniqueDocuments.values())

      // Send sources first
      yield {
        type: 'sources',
        sources
      }

      // Create context from similar chunks
      const context = similarChunks
        .map((chunk: Record<string, unknown>) => chunk.content)
        .join('\n\n')

      // Build conversation context with message history
      const conversationMessages: Array<{ role: 'user' | 'assistant', content: string }> = []
      
      // Add system message with document context
      conversationMessages.push({
        role: 'user',
        content: `Based on the following context from the user's documents, please answer questions. If the context doesn't contain enough information to answer a question, say so. Use markdown formatting to make responses more readable.

Context from documents:
${context}`
      })
      
      // Add message history for conversation context
      logger.log(`RAG Service - Including ${messageHistory.length} messages from thread history`)
      messageHistory.forEach(msg => {
        conversationMessages.push({
          role: msg.role,
          content: msg.content
        })
      })
      
      // Add the current question
      conversationMessages.push({
        role: 'user',
        content: question
      })

      // Use streaming chat with full conversation context
      const stream = await this.llm.chat({
        messages: conversationMessages,
        stream: true
      })

      for await (const chunk of stream) {
        if (chunk.delta) {
          const content = chunk.delta
          
          if (content) {
            yield {
              type: 'content',
              content
            }
          }
        }
      }

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

  /**
   * Calculate confidence score for the response
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private calculateConfidence(similarChunks: any[]): number {
    if (similarChunks.length === 0) return 0.0
    
    // Calculate average similarity score
    const avgSimilarity = similarChunks.reduce((sum, chunk) => sum + chunk.similarity, 0) / similarChunks.length
    
    // Boost confidence if we have multiple relevant chunks
    const chunkBonus = Math.min(similarChunks.length * 0.1, 0.3)
    
    return Math.min(avgSimilarity + chunkBonus, 1.0)
  }

  /**
   * Delete documents and their vectors when documents are removed
   */
  async deleteDocuments(documentIds: string[]): Promise<void> {
    try {
      const supabase = await createClient()
      
      // Remove chunks from Supabase (this will also remove embeddings)
      const { error } = await supabase
        .from('document_chunks')
        .delete()
        .in('document_id', documentIds)

      if (error) throw error

    } catch (error) {
      logger.error('Error deleting documents:', error)
      throw error
    }
  }

  /**
   * Get document processing status
   */
  async getDocumentStatus(documentIds: string[], userId: string): Promise<unknown[]> {
    try {
      const supabase = await createClient()
      
      const { data, error } = await supabase
        .from('documents')
        .select('id, name, status, created_at, updated_at')
        .in('id', documentIds)
        .eq('user_id', userId)

      if (error) throw error
      return data || []
    } catch (error) {
      logger.error('Error getting document status:', error)
      return []
    }
  }

  /**
   * Test embeddings functionality for health checks
   */
  async testEmbeddings(): Promise<boolean> {
    try {
      const testEmbeddings = await this.embeddings.getTextEmbeddings(['test'])
      return testEmbeddings && testEmbeddings.length > 0
    } catch (error) {
      logger.error('Error testing embeddings:', error)
      return false
    }
  }
}

// Export a function to process documents
export async function processDocument(fileBlob: Blob, options: {
  documentId: string;
  userId: string;
  agentId: string;
}): Promise<unknown[]> {
  const ragService = new RAGService()
  return ragService.processDocument(fileBlob, options)
}

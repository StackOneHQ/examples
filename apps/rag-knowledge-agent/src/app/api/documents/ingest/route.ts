import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { requireUser } from '@/lib/auth-server'
import { logger } from '@/utils/logger'
import { RAGService } from '@/lib/llamaindex/rag-service'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const { integrationId, documentIds } = await request.json()

    if (!integrationId) {
      return NextResponse.json({ error: 'Integration ID is required' }, { status: 400 })
    }

    const integration = await queryOne<{ id: string }>(
      `SELECT id FROM integrations WHERE id = $1 AND user_id = $2`,
      [integrationId, user.id]
    )
    if (!integration) {
      return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    }

    // Document IDs must be provided since listDocuments is no longer available
    const documentsToProcess = documentIds || []
    
    if (documentsToProcess.length === 0) {
      return NextResponse.json({ 
        error: 'Document IDs are required. Please select specific documents to process.' 
      }, { status: 400 })
    }

    // Initialize RAG service and process documents
    const ragService = new RAGService()
    
    // Process documents asynchronously
    ragService.ingestDocuments(documentsToProcess, user.id)
      .catch(error => {
        logger.error('Error processing documents:', error)
      })

    return NextResponse.json({ 
      success: true, 
      message: `Processing ${documentsToProcess.length} documents`,
      documentIds: documentsToProcess
    })

  } catch (error) {
    logger.error('Error in document ingestion:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser()
    const { searchParams } = new URL(request.url)
    const integrationId = searchParams.get('integrationId')
    const documentIds = searchParams.get('documentIds')?.split(',')

    if (!integrationId && !documentIds) {
      return NextResponse.json({ error: 'Integration ID or document IDs required' }, { status: 400 })
    }

    let sql = `SELECT id, name, status, created_at, updated_at FROM documents WHERE user_id = $1`
    const values: (string | string[])[] = [user.id]
    if (integrationId) {
      values.push(integrationId)
      sql += ` AND integration_id = $${values.length}`
    }
    if (documentIds && documentIds.length > 0) {
      values.push(documentIds)
      sql += ` AND id = ANY($${values.length}::uuid[])`
    }
    sql += ` ORDER BY created_at DESC`

    const documents = await query<{ id: string; name: string; status: string; created_at: string; updated_at: string }>(sql, values)
    return NextResponse.json({ documents })

  } catch (error) {
    logger.error('Error fetching documents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireUser()
    const { fileIds } = await request.json()

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: 'File IDs are required' }, { status: 400 })
    }

    // Initialize RAG service and delete documents
    const ragService = new RAGService()
    await ragService.deleteDocuments(fileIds)

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${fileIds.length} documents from RAG system`
    })

  } catch (error) {
    logger.error('Document deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

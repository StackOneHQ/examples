import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/utils/logger'
import { RAGService } from '@/lib/llamaindex/rag-service'
// Note: listDocuments function has been removed from StackOne API

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { integrationId, documentIds } = await request.json()

    if (!integrationId) {
      return NextResponse.json({ error: 'Integration ID is required' }, { status: 400 })
    }

    // Get integration details
    const { data: integration, error: integrationError } = await supabase
      .from('integrations')
      .select('*')
      .eq('id', integrationId)
      .eq('user_id', user.id)
      .single()

    if (integrationError || !integration) {
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
    const supabase = await createClient()
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const integrationId = searchParams.get('integrationId')
    const documentIds = searchParams.get('documentIds')?.split(',')

    if (!integrationId && !documentIds) {
      return NextResponse.json({ error: 'Integration ID or document IDs required' }, { status: 400 })
    }

    let query = supabase
      .from('documents')
      .select('id, name, status, created_at, updated_at')
      .eq('user_id', user.id)

    if (integrationId) {
      query = query.eq('integration_id', integrationId)
    }

    if (documentIds) {
      query = query.in('id', documentIds)
    }

    const { data: documents, error } = await query

    if (error) {
      logger.error('Error fetching documents:', error)
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 })
    }

    return NextResponse.json({ documents })

  } catch (error) {
    logger.error('Error fetching documents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { fileIds } = await request.json()
    const supabase = await createClient()

    // Get user from auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

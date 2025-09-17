import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { downloadFile, getDocumentContent, getFileMetadata } from '@/lib/stackone/api'
import { processDocument } from '@/lib/llamaindex/rag-service'
import { logger } from '@/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const { agentId, agentIntegrations } = await request.json()
    
    logger.log('Processing agent:', { agentId, agentIntegrations })
    
    if (!agentId || !agentIntegrations) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()
    const apiKey = process.env.STACKONE_API_KEY

    if (!apiKey) {
      return NextResponse.json({ error: 'StackOne API key not configured' }, { status: 500 })
    }

    // Get agent details
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('*')
      .eq('id', agentId)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Get integration details
    const { data: integrations, error: integrationsError } = await supabase
      .from('integrations')
      .select('*')
      .in('id', Object.keys(agentIntegrations))

    if (integrationsError || !integrations) {
      return NextResponse.json({ error: 'Integrations not found' }, { status: 404 })
    }

    const processedFiles: string[] = []
    const errors: string[] = []

    // Process each integration's files
    for (const [integrationId, files] of Object.entries(agentIntegrations)) {
      const integration = integrations.find(i => i.id === integrationId)
      if (!integration) continue

      // Handle both string arrays and object arrays
      const fileIds = Array.isArray(files) 
        ? files.map(file => typeof file === 'string' ? file : file.id)
        : []

      logger.log(`Processing integration ${integrationId} with files:`, fileIds)

      for (const fileId of fileIds) {
        try {
          logger.log(`Processing file ${fileId}...`)
          
          let fileBlob: Blob | null = null
          let fileName = `file_${fileId}`
          let mimeType = 'application/octet-stream'
          let fileSize = 0

          // First, get file metadata to determine proper file name and MIME type
          logger.log(`Getting file metadata for ${fileId}...`)
          const fileMetadata = await getFileMetadata(apiKey, fileId, integration.stackone_account_id)
          
          if (fileMetadata) {
            fileName = fileMetadata.name || `file_${fileId}`
            mimeType = fileMetadata.mime_type
            logger.log(`File metadata: ${fileName} (${mimeType})`)
          } else {
            logger.log(`No metadata available for ${fileId}, using defaults`)
          }

          // Try to get document content first (preferred method)
          logger.log(`Trying to get document content for ${fileId}...`)
          const documentContent = await getDocumentContent(apiKey, fileId, integration.stackone_account_id)
          
          if (documentContent && documentContent.content) {
            logger.log(`Got document content for ${fileId}`)
            // Convert content to blob
            fileBlob = new Blob([documentContent.content], { type: 'text/plain' })
            fileSize = fileBlob.size
            mimeType = 'text/plain'
            fileName = `${fileName}.txt`
          } else {
            // Fallback to downloading file (now with Google Workspace export support)
            logger.log(`Content not available, trying to download file ${fileId}...`)
            try {
              fileBlob = await downloadFile(apiKey, fileId, integration.stackone_account_id)
              fileSize = fileBlob.size
              logger.log(`Downloaded file ${fileId}, size: ${fileSize} bytes`)
              
              // Update MIME type based on the downloaded content if we have metadata
              if (fileMetadata) {
                mimeType = fileMetadata.mime_type
              }
            } catch (downloadError) {
              logger.error(`Both content and download failed for ${fileId}:`, downloadError)
              throw new Error(`Unable to access file ${fileId}: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`)
            }
          }
          
          // Check if document already exists for this integration
          const { data: existingDocument, error: existingDocError } = await supabase
            .from('documents')
            .select('*')
            .eq('integration_id', integrationId)
            .eq('stackone_document_id', fileId)
            .single()

          let document
          if (existingDocument && !existingDocError) {
            // Document already exists, use it
            document = existingDocument
            logger.log(`Using existing document ${document.id} for file ${fileId}`)
          } else {
            // Create new document record
            const { data: newDocument, error: documentError } = await supabase
              .from('documents')
              .insert({
                integration_id: integrationId,
                user_id: agent.user_id,
                stackone_document_id: fileId,
                name: fileName,
                mime_type: mimeType,
                size: fileSize,
                status: 'processing',
                url: fileMetadata?.url
              })
              .select()
              .single()

            if (documentError) {
              logger.error(`Document creation error for file ${fileId}:`, documentError)
              errors.push(`Failed to create document record for file ${fileId}: ${documentError.message}`)
              continue
            }

            document = newDocument
            logger.log(`Created document record ${document.id} for file ${fileId}`)
          }

          // Create agent-document relationship
          const { error: agentDocError } = await supabase
            .from('agent_documents')
            .insert({
              agent_id: agentId,
              document_id: document.id
            })

          if (agentDocError) {
            logger.error(`Agent-document relationship error for file ${fileId}:`, agentDocError)
            errors.push(`Failed to associate document with agent for file ${fileId}: ${agentDocError.message}`)
            continue
          }

          logger.log(`Associated document ${document.id} with agent ${agentId}`)

          // Process document with LlamaIndex
          logger.log(`Processing document ${document.id} with LlamaIndex...`)
          const chunks = await processDocument(fileBlob, {
            documentId: document.id,
            userId: agent.user_id,
            agentId: agentId
          })

          logger.log(`Processed document ${document.id}, created ${chunks.length} chunks`)

          // Update document status
          await supabase
            .from('documents')
            .update({ 
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', document.id)

          processedFiles.push(fileId)
          logger.log(`Successfully processed file ${fileId}`)
        } catch (error) {
          logger.error(`Error processing file ${fileId}:`, error)
          errors.push(`Failed to process file ${fileId}: ${error instanceof Error ? error.message : 'Unknown error'}`)
        }
      }
    }

    // Update agent status based on processing results
    let agentStatus = 'active'
    if (errors.length > 0 && processedFiles.length === 0) {
      // All files failed - mark agent as failed
      agentStatus = 'failed'
    } else if (errors.length > 0 && processedFiles.length > 0) {
      // Some files failed - mark as partially processed
      agentStatus = 'partial'
    }

    const { error: updateError } = await supabase
      .from('agents')
      .update({ 
        status: agentStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', agentId)

    if (updateError) {
      logger.error('Error updating agent status:', updateError)
    }

    // If all files failed, clean up the agent
    if (agentStatus === 'failed') {
      logger.log('All files failed, cleaning up agent...')
      await supabase
        .from('agents')
        .delete()
        .eq('id', agentId)
      
      await supabase
        .from('agent_integrations')
        .delete()
        .eq('agent_id', agentId)
    }

    return NextResponse.json({
      success: errors.length === 0 || processedFiles.length > 0,
      processedFiles,
      errors,
      agentStatus,
      message: errors.length === 0 
        ? `Successfully processed ${processedFiles.length} files`
        : errors.length > 0 && processedFiles.length === 0
        ? `Failed to process any files. Agent has been removed.`
        : `Processed ${processedFiles.length} files with ${errors.length} errors`
    })

  } catch (error) {
    logger.error('Error processing agent:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { requireUser } from '@/lib/auth-server'
import { downloadFile, getDocumentContent, getFileMetadata } from '@/lib/stackone/api'
import { processDocument } from '@/lib/llamaindex/rag-service'
import { computeContentHash } from '@/lib/documents/content-hash'
import { logger } from '@/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const { agentId, agentIntegrations } = await request.json()

    logger.log('Processing agent:', { agentId, agentIntegrations })

    if (!agentId || !agentIntegrations) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const apiKey = process.env.STACKONE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'StackOne API key not configured' }, { status: 500 })
    }

    const agent = await queryOne<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM agents WHERE id = $1 AND user_id = $2`,
      [agentId, user.id]
    )
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const integrationIds = Object.keys(agentIntegrations) as string[]
    const integrations = await query<{ id: string; stackone_account_id: string }>(
      `SELECT id, stackone_account_id FROM integrations WHERE id = ANY($1::uuid[])`,
      [integrationIds]
    )
    if (integrations.length === 0) {
      return NextResponse.json({ error: 'Integrations not found' }, { status: 404 })
    }

    const processedFiles: string[] = []
    const errors: string[] = []

    for (const [integrationId, files] of Object.entries(agentIntegrations)) {
      const integration = integrations.find((i) => i.id === integrationId)
      if (!integration) continue

      const fileIds = Array.isArray(files)
        ? files.map((file: unknown) => (typeof file === 'string' ? file : (file as { id: string }).id))
        : []

      logger.log(`Processing integration ${integrationId} with files:`, fileIds)

      for (const fileId of fileIds) {
        try {
          logger.log(`Processing file ${fileId}...`)

          let fileBlob: Blob | null = null
          let fileName = `file_${fileId}`
          let mimeType = 'application/octet-stream'
          let fileSize = 0

          const fileMetadata = await getFileMetadata(apiKey, fileId, integration.stackone_account_id)
          if (fileMetadata) {
            fileName = fileMetadata.name || `file_${fileId}`
            mimeType = fileMetadata.mime_type
            logger.log(`File metadata: ${fileName} (${mimeType})`)
          } else {
            logger.log(`No metadata available for ${fileId}, using defaults`)
          }

          const documentContent = await getDocumentContent(apiKey, fileId, integration.stackone_account_id)
          if (documentContent?.content) {
            logger.log(`Got document content for ${fileId}`)
            fileBlob = new Blob([documentContent.content], { type: 'text/plain' })
            fileSize = fileBlob.size
            mimeType = 'text/plain'
            fileName = `${fileName}.txt`
          } else {
            logger.log(`Content not available, trying to download file ${fileId}...`)
            try {
              fileBlob = await downloadFile(apiKey, fileId, integration.stackone_account_id)
              fileSize = fileBlob.size
              logger.log(`Downloaded file ${fileId}, size: ${fileSize} bytes`)
              if (fileMetadata) mimeType = fileMetadata.mime_type
            } catch (downloadError) {
              logger.error(`Both content and download failed for ${fileId}:`, downloadError)
              throw new Error(
                `Unable to access file ${fileId}: ${downloadError instanceof Error ? downloadError.message : 'Unknown error'}`
              )
            }
          }

          const existingDocument = await queryOne<{ id: string }>(
            `SELECT id FROM documents WHERE integration_id = $1 AND stackone_document_id = $2`,
            [integrationId, fileId]
          )

          let document: { id: string }
          if (existingDocument) {
            document = existingDocument
            logger.log(`Using existing document ${document.id} for file ${fileId}`)
            if (fileMetadata?.remote_id != null) {
              await query(
                `UPDATE documents SET remote_document_id = $1, updated_at = NOW() WHERE id = $2`,
                [fileMetadata.remote_id, document.id]
              )
            }
          } else {
            const insertResult = await query<{ id: string }>(
              `INSERT INTO documents (integration_id, user_id, stackone_document_id, remote_document_id, name, mime_type, size, status, url)
               VALUES ($1, $2, $3, $4, $5, $6, $7, 'processing', $8)
               RETURNING id`,
              [
                integrationId,
                agent.user_id,
                fileId,
                fileMetadata?.remote_id ?? null,
                fileName,
                mimeType,
                fileSize,
                fileMetadata?.url ?? null,
              ]
            )
            const newDoc = insertResult[0]
            if (!newDoc) {
              logger.error(`Document creation failed for file ${fileId}`)
              errors.push(`Failed to create document record for file ${fileId}`)
              continue
            }
            document = newDoc
            logger.log(`Created document record ${document.id} for file ${fileId}`)
          }

          await query(
            `INSERT INTO agent_documents (agent_id, document_id) VALUES ($1, $2)
             ON CONFLICT (agent_id, document_id) DO NOTHING`,
            [agentId, document.id]
          )
          logger.log(`Associated document ${document.id} with agent ${agentId}`)

          logger.log(`Processing document ${document.id} with LlamaIndex...`)
          const chunks = await processDocument(fileBlob, {
            documentId: document.id,
            userId: agent.user_id,
            agentId,
          })
          logger.log(`Processed document ${document.id}, created ${(chunks ?? []).length} chunks`)

          const contentHash = await computeContentHash(fileBlob)
          await query(
            `UPDATE documents SET status = 'completed', content_hash = $1, updated_at = NOW() WHERE id = $2`,
            [contentHash, document.id]
          )

          processedFiles.push(fileId)
          logger.log(`Successfully processed file ${fileId}`)
        } catch (error) {
          logger.error(`Error processing file ${fileId}:`, error)
          errors.push(
            `Failed to process file ${fileId}: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        }
      }
    }

    const agentStatus =
      errors.length > 0 && processedFiles.length === 0 ? 'inactive' : 'active'
    await query(
      `UPDATE agents SET status = $1, updated_at = NOW() WHERE id = $2`,
      [agentStatus, agentId]
    )

    if (agentStatus === 'inactive') {
      logger.log('All files failed, cleaning up agent...')
      await query(`DELETE FROM agent_integrations WHERE agent_id = $1`, [agentId])
      await query(`DELETE FROM agents WHERE id = $1`, [agentId])
    }

    return NextResponse.json({
      success: errors.length === 0 || processedFiles.length > 0,
      processedFiles,
      errors,
      agentStatus,
      message:
        errors.length === 0
          ? `Successfully processed ${processedFiles.length} files`
          : errors.length > 0 && processedFiles.length === 0
            ? `Failed to process any files. Agent has been removed.`
            : `Processed ${processedFiles.length} files with ${errors.length} errors`,
    })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error processing agent:', err)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

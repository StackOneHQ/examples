import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { query, queryOne } from '@/lib/db'
import { downloadFile, getDocumentContent } from '@/lib/stackone/api'
import { processDocument } from '@/lib/llamaindex/rag-service'
import { computeContentHash } from '@/lib/documents/content-hash'
import { logger } from '@/utils/logger'

interface StackOneWebhookPayload {
  project_id?: string
  event: string
  event_date?: string
  record_type?: string
  record_id?: string | number
  record_remote_id?: string
  sent_at?: string
  account_id?: string
  provider?: string
  origin_owner_id?: string
  origin_owner_name?: string
  origin_username?: string
  setup_information?: Record<string, unknown>
  raw_event?: Record<string, unknown>
  event_data?: Record<string, unknown>
  data?: Record<string, unknown>
  name?: string
  email?: string
  user_id?: string
  document_id?: string
  integration_id?: string
  mime_type?: string
  size?: number
  url?: string
}

function isSignatureValid(signature: string | null, payload: string, secret: string): boolean {
  if (!signature || !secret) return false
  const hash = createHmac('sha256', secret).update(payload).digest('base64url')
  return hash === signature
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const body = JSON.parse(rawBody) as StackOneWebhookPayload

    const event = body.event
    const accountId = body.account_id
    const recordId = body.record_id ?? body.record_remote_id

    // Always log incoming webhook requests (not gated by DEBUG)
    logger.warn('[Webhook] Incoming request', {
      event,
      account_id: accountId,
      record_id: recordId,
      method: request.method,
      url: request.url,
    })

    const secret = process.env.STACKONE_WEBHOOK_SECRET
    if (secret) {
      const signature = request.headers.get('x-stackone-signature')
      if (!isSignatureValid(signature, rawBody, secret)) {
        logger.warn('[Webhook] Signature verification failed', { event, account_id: accountId })
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
      }
    }

    console.log('[Webhook] Event received', {
      event,
      account_id: accountId,
      record_id: recordId,
    })

    if (event.startsWith('documents_files.')) {
      const recordId =
        body.record_id != null
          ? String(body.record_id)
          : body.record_remote_id != null
            ? String(body.record_remote_id)
            : undefined
      if (!accountId || !recordId) {
        logger.warn(`Webhook ${event} skipped: missing account_id or record_id`, {
          account_id: accountId,
          record_id: body.record_id,
          record_remote_id: body.record_remote_id,
        })
      } else {
        switch (event) {
          case 'documents_files.updated':
            await handleDocumentsFileUpdated({ ...body, record_id: recordId })
            break
          case 'documents_files.deleted':
            await handleDocumentsFileDeleted({ ...body, record_id: recordId })
            break
          default:
            console.log(`Unhandled document webhook event: ${event}`)
        }
      }
    } else {
      switch (event) {
        case 'account.created':
          await handleAccountCreated(body)
          break
        case 'account.updated':
          await handleAccountUpdated(body)
          break
        case 'account.deleted':
          await handleAccountDeleted(body)
          break
        default:
          console.log(`Unhandled webhook event: ${event}`)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function handleAccountCreated(body: StackOneWebhookPayload) {
  try {
    const account_id = body.account_id
    const provider = body.provider ?? ''
    const origin_owner_id =
      (body.origin_owner_id as string | undefined) ??
      (body.setup_information?.user_id as string | undefined)
    const origin_owner_name =
      (body.origin_owner_name ?? body.origin_username ?? '') as string

    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM integrations WHERE stackone_account_id = $1`,
      [account_id]
    )

    if (existing) {
      await query(
        `UPDATE integrations SET status = 'active', account_name = $1, updated_at = NOW() WHERE id = $2`,
        [origin_owner_name || 'Connected account', existing.id]
      )
    } else {
      if (!origin_owner_id) {
        logger.warn('account.created: missing origin_owner_id, cannot create integration')
        return
      }
      await query(
        `INSERT INTO integrations (stackone_account_id, provider, account_name, status, user_id)
         VALUES ($1, $2, $3, 'active', $4)`,
        [account_id, provider, origin_owner_name || 'Connected account', origin_owner_id]
      )
    }
  } catch (error) {
    logger.error('Error handling account.created:', error)
  }
}

async function handleAccountUpdated(body: StackOneWebhookPayload) {
  try {
    const account_id = body.account_id
    const origin_owner_name = (body.origin_owner_name ?? body.origin_username) as string | undefined
    await query(
      `UPDATE integrations SET account_name = COALESCE($1, account_name), updated_at = NOW() WHERE stackone_account_id = $2`,
      [origin_owner_name, account_id]
    )
  } catch (error) {
    logger.error('Error handling account.updated:', error)
  }
}

async function handleAccountDeleted(body: StackOneWebhookPayload) {
  try {
    const account_id = body.account_id
    await query(
      `UPDATE integrations SET status = 'inactive', updated_at = NOW() WHERE stackone_account_id = $1`,
      [account_id]
    )
  } catch (error) {
    logger.error('Error handling account.deleted:', error)
  }
}

async function handleDocumentsFileUpdated(body: StackOneWebhookPayload & { record_id: string }) {
  const record_id = body.record_id
  const account_id = body.account_id
  if (!record_id || !account_id) {
    logger.warn('handleDocumentsFileUpdated: missing record_id or account_id', {
      record_id,
      account_id,
    })
    return
  }

  console.log('[Webhook] Processing documents_files.updated', { record_id, account_id })

  try {
    const integration = await queryOne<{ id: string; stackone_account_id: string }>(
      `SELECT id, stackone_account_id FROM integrations WHERE stackone_account_id = $1`,
      [account_id]
    )
    if (!integration) {
      logger.warn(`handleDocumentsFileUpdated: no integration for account_id ${account_id}`)
      return
    }

    const doc = await queryOne<{ id: string; content_hash: string | null }>(
      `SELECT id, content_hash FROM documents WHERE integration_id = $1 AND stackone_document_id = $2`,
      [integration.id, record_id]
    )
    if (!doc) {
      logger.warn(
        `handleDocumentsFileUpdated: no document for integration ${integration.id} stackone_document_id ${record_id}`
      )
      return
    }

    const name = (body.event_data?.name ?? body.name) as string | undefined
    const mime_type = (body.event_data?.mime_type ?? body.mime_type) as string | undefined
    const size = (body.event_data?.size ?? body.size) as number | undefined
    const url = (body.event_data?.url ?? body.url) as string | undefined

    const apiKey = process.env.STACKONE_API_KEY
    if (!apiKey) {
      await query(
        `UPDATE documents SET name = COALESCE($1, name), mime_type = COALESCE($2, mime_type), size = COALESCE($3, size), url = COALESCE($4, url), updated_at = NOW() WHERE id = $5`,
        [name, mime_type, size, url, doc.id]
      )
      return
    }

    let fileBlob: Blob | null = null
    const documentContent = await getDocumentContent(
      apiKey,
      record_id,
      integration.stackone_account_id
    )
    if (documentContent?.content) {
      fileBlob = new Blob([documentContent.content], { type: 'text/plain' })
    }
    if (!fileBlob) {
      try {
        fileBlob = await downloadFile(apiKey, record_id, integration.stackone_account_id)
      } catch (downloadErr) {
        logger.error('Failed to fetch file for hash/ingestion:', downloadErr)
        return
      }
    }

    const newHash = await computeContentHash(fileBlob)
    const storedHash = doc.content_hash ?? null

    if (storedHash !== null && newHash === storedHash) {
      await query(
        `UPDATE documents SET name = COALESCE($1, name), mime_type = COALESCE($2, mime_type), size = COALESCE($3, size), url = COALESCE($4, url), status = 'completed', updated_at = NOW() WHERE id = $5`,
        [name, mime_type, size, url, doc.id]
      )
      console.log('[Webhook] Document content unchanged (hash match); skipped re-indexing', {
        document_id: doc.id,
      })
      return
    }

    await query(
      `UPDATE documents SET name = COALESCE($1, name), mime_type = COALESCE($2, mime_type), size = COALESCE($3, size), url = COALESCE($4, url), status = 'pending', updated_at = NOW() WHERE id = $5`,
      [name, mime_type, size, url, doc.id]
    )

    await query(`DELETE FROM document_chunks WHERE document_id = $1`, [doc.id])

    console.log('[Webhook] Content changed; re-ingesting document', { document_id: doc.id })

    const agentDocs = await query<{ agent_id: string }>(
      `SELECT agent_id FROM agent_documents WHERE document_id = $1`,
      [doc.id]
    )
    if (!agentDocs?.length) {
      await query(
        `UPDATE documents SET status = 'completed', content_hash = $1, updated_at = NOW() WHERE id = $2`,
        [newHash, doc.id]
      )
      console.log(`Document ${doc.id} has no agent links; marked completed without chunks`)
      return
    }

    const agents = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM agents WHERE id = ANY($1::uuid[])`,
      [agentDocs.map((ad) => ad.agent_id)]
    )
    if (!agents?.length) {
      await query(
        `UPDATE documents SET status = 'completed', content_hash = $1, updated_at = NOW() WHERE id = $2`,
        [newHash, doc.id]
      )
      return
    }

    for (const agent of agents) {
      try {
        await processDocument(fileBlob, {
          documentId: doc.id,
          userId: agent.user_id,
          agentId: agent.id,
        })
      } catch (err) {
        logger.error(`Re-ingestion failed for document ${doc.id} agent ${agent.id}:`, err)
      }
    }

    await query(
      `UPDATE documents SET status = 'completed', content_hash = $1, updated_at = NOW() WHERE id = $2`,
      [newHash, doc.id]
    )

    console.log('[Webhook] Re-ingest complete', { document_id: doc.id, agent_count: agents.length })
  } catch (error) {
    logger.error('Error handling documents_files.updated:', error)
  }
}

async function handleDocumentsFileDeleted(body: StackOneWebhookPayload & { record_id: string }) {
  const record_id = body.record_id
  const account_id = body.account_id
  if (!record_id || !account_id) {
    logger.warn('handleDocumentsFileDeleted: missing record_id or account_id', {
      record_id,
      account_id,
    })
    return
  }

  try {
    const integration = await queryOne<{ id: string }>(
      `SELECT id FROM integrations WHERE stackone_account_id = $1`,
      [account_id]
    )
    if (!integration) {
      logger.warn(`handleDocumentsFileDeleted: no integration for account_id ${account_id}`)
      return
    }

    const doc = await queryOne<{ id: string }>(
      `SELECT id FROM documents WHERE integration_id = $1 AND stackone_document_id = $2`,
      [integration.id, record_id]
    )
    if (!doc) {
      logger.warn(
        `handleDocumentsFileDeleted: no document for integration ${integration.id} stackone_document_id ${record_id}`
      )
      return
    }

    await query(`DELETE FROM agent_documents WHERE document_id = $1`, [doc.id])
    await query(`DELETE FROM document_chunks WHERE document_id = $1`, [doc.id])
    await query(`DELETE FROM documents WHERE id = $1`, [doc.id])

    console.log(
      `Deleted document ${doc.id} (stackone_document_id ${record_id}) from documents_files.deleted webhook`
    )
  } catch (error) {
    logger.error('Error handling documents_files.deleted:', error)
  }
}

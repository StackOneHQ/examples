import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { logger } from '@/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createAdminClient() as any

    // Verify webhook signature (you should implement this)
    // const signature = request.headers.get('x-stackone-signature')
    // if (!verifySignature(body, signature)) {
    //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    // }

    const { event, data } = body

    switch (event) {
      case 'account.connected':
        // Handle new account connection
        await handleAccountConnected(data, supabase)
        break
      
      case 'account.disconnected':
        // Handle account disconnection
        await handleAccountDisconnected(data, supabase)
        break
      
      case 'account.status_changed':
        // Handle account status changes (active, inactive, error, etc.)
        await handleAccountStatusChanged(data, supabase)
        break
      
      case 'document.synced':
        // Handle document sync completion
        await handleDocumentSynced(data, supabase)
        break
      
      default:
        logger.log(`Unhandled event: ${event}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleAccountConnected(data: Record<string, unknown>, supabase: any) {
  try {
    const { account_id, provider, name, email, user_id } = data

    // Check if integration already exists
    const { data: existing } = await supabase
      .from('integrations')
      .select('id')
      .eq('stackone_account_id', account_id)
      .single()

    if (existing) {
      // Update existing integration
      await supabase
        .from('integrations')
        .update({
          status: 'active',
          account_name: name,
          account_email: email,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
    } else {
      // Create new integration
      await supabase
        .from('integrations')
        .insert({
          stackone_account_id: account_id,
          provider,
          account_name: name,
          account_email: email,
          status: 'active',
          user_id: user_id
        })
    }
  } catch (error) {
    logger.error('Error handling account connected:', error)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleAccountDisconnected(data: Record<string, unknown>, supabase: any) {
  try {
    const { account_id } = data

    await supabase
      .from('integrations')
      .update({
        status: 'inactive',
        updated_at: new Date().toISOString()
      })
      .eq('stackone_account_id', account_id)
  } catch (error) {
    logger.error('Error handling account disconnected:', error)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleAccountStatusChanged(data: Record<string, unknown>, supabase: any) {
  try {
    const { account_id, status, status_reasons } = data

    // Map StackOne status to our internal status
    let mappedStatus = 'active'
    if (status === 'inactive' || status === 'disconnected') {
      mappedStatus = 'inactive'
    } else if (status === 'error' || status === 'failed') {
      mappedStatus = 'error'
    }

    await supabase
      .from('integrations')
      .update({
        status: mappedStatus,
        updated_at: new Date().toISOString()
      })
      .eq('stackone_account_id', account_id)

    logger.log(`Account ${account_id} status changed to ${mappedStatus}`)
  } catch (error) {
    logger.error('Error handling account status changed:', error)
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleDocumentSynced(data: Record<string, unknown>, supabase: any) {
  try {
    const { document_id, integration_id, name, mime_type, size, url } = data

    // Check if document already exists
    const { data: existing } = await supabase
      .from('documents')
      .select('id')
      .eq('stackone_document_id', document_id)
      .single()

    if (existing) {
      // Update existing document
      await supabase
        .from('documents')
        .update({
          name,
          mime_type,
          size,
          url,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
    } else {
      // Create new document record
      await supabase
        .from('documents')
        .insert({
          stackone_document_id: document_id,
          integration_id,
          name,
          mime_type,
          size,
          url,
          status: 'pending'
        })
    }
  } catch (error) {
    logger.error('Error handling document synced:', error)
  }
}

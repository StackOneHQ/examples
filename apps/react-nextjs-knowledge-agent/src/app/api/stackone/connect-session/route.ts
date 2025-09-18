import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/utils/logger'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { provider, account_id, multiple } = await request.json()

    const STACKONE_API_KEY = process.env.STACKONE_API_KEY
    if (!STACKONE_API_KEY) {
      return NextResponse.json({ error: 'StackOne API key not configured' }, { status: 500 })
    }

    // Prepare headers for StackOne API
    const headers = {
      'Authorization': `Basic ${Buffer.from(STACKONE_API_KEY + ':' + '').toString('base64')}`,
      'Content-Type': 'application/json',
    }

    // Optional metadata to be associated with the connection
    const metadata = { 
      source: 'files-rag-demo',
      user_id: user.id 
    }

    // Prepare payload for StackOne API - derive owner info from authenticated user only
    const payload = {
      expires_in: 1800, // 30 minutes
      multiple: multiple || false,
      origin_owner_id: user.id, // Always use authenticated user ID
      origin_owner_name: user.email || user.id, // Always use authenticated user email/ID
      provider: provider || undefined,
      account_id: account_id || undefined,
      metadata,
    }

    const requestOptions = {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    }

    try {
      const responseWithToken = await fetch(
        'https://api.stackone.com/connect_sessions',
        requestOptions,
      )

      if (!responseWithToken.ok) {
        const errorText = await responseWithToken.text()
        logger.error('StackOne API error:', errorText)
        return NextResponse.json({ error: 'Failed to create connect session' }, { status: 500 })
      }

      const { token } = await responseWithToken.json()
      return NextResponse.json({ token })
    } catch (e) {
      logger.error('Error calling StackOne API:', e)
      return NextResponse.json({ error: 'Error when trying to fetch session' }, { status: 500 })
    }

  } catch (error) {
    logger.error('Error in connect session API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

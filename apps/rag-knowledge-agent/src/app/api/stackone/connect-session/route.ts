import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { logger } from '@/utils/logger'

/** Parse AVAILABLE_INTEGRATION_VERSIONS env (format: googledrive:1.0,googlesheets:1.0) into provider -> version map */
function getIntegrationVersionsByProvider(): Record<string, string> {
  const raw = process.env.AVAILABLE_INTEGRATION_VERSIONS
  if (!raw?.trim()) return {}
  const map: Record<string, string> = {}
  for (const part of raw.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const sep = trimmed.includes(':') ? ':' : '='
    const i = trimmed.indexOf(sep)
    if (i === -1) continue
    const provider = trimmed.slice(0, i).trim().toLowerCase()
    const version = trimmed.slice(i + 1).trim()
    if (provider && version) map[provider] = version
  }
  return map
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const { origin_owner_id, origin_owner_name, provider, account_id, multiple } = await request.json()

    const STACKONE_API_KEY = process.env.STACKONE_API_KEY
    if (!STACKONE_API_KEY) {
      return NextResponse.json({ error: 'StackOne API key not configured' }, { status: 500 })
    }

    const versionsByProvider = getIntegrationVersionsByProvider()
    const providerVersion = provider ? versionsByProvider[provider.trim().toLowerCase()] : undefined

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

    // Send provider; when version is set (AVAILABLE_INTEGRATION_VERSIONS), also send provider_version.
    const payload: Record<string, unknown> = {
      expires_in: 1800, // 30 minutes
      multiple: multiple || false,
      origin_owner_id: origin_owner_id || user.id,
      origin_owner_name: origin_owner_name || user.email || user.id,
      account_id: account_id || undefined,
      metadata,
    }
    if (provider) {
      payload.provider = provider
      if (providerVersion) {
        payload.provider_version = providerVersion
      }
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
        logger.error('StackOne connect_sessions error:', responseWithToken.status, errorText)
        let message = 'Failed to create connect session'
        try {
          const body = JSON.parse(errorText) as { message?: string; statusCode?: number }
          if (typeof body.message === 'string') message = body.message
        } catch {
          // use default message
        }
        return NextResponse.json({ error: message }, { status: 500 })
      }

      const { token } = await responseWithToken.json()
      return NextResponse.json({ token })
    } catch (e) {
      logger.error('Error calling StackOne API:', e)
      return NextResponse.json({ error: 'Error when trying to fetch session' }, { status: 500 })
    }

  } catch (error) {
    if ((error as Error)?.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Please sign in to connect an account' }, { status: 401 })
    }
    logger.error('Error in connect session API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

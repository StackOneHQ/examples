import { getSession } from 'next-auth/react'
import { logger } from '@/utils/logger'

export interface SessionTokenParams {
  origin_owner_id: string
  origin_owner_name: string
  provider?: string
  account_id?: string
  multiple?: boolean
}

export interface SessionTokenResponse {
  token: string
}

/**
 * Retrieves a session token from the StackOne API via our backend.
 * Call from client; backend enforces auth via session cookie.
 */
export const getSessionToken = async (params: SessionTokenParams): Promise<SessionTokenResponse> => {
  try {
    const response = await fetch('/api/stackone/connect-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin_owner_id: params.origin_owner_id,
        origin_owner_name: params.origin_owner_name,
        provider: params.provider ?? undefined,
        account_id: params.account_id ?? undefined,
        multiple: params.multiple ?? false,
      }),
      credentials: 'include',
    })

    if (!response.ok) {
      let message = 'Failed to get connect session token'
      try {
        const body = await response.json().catch(() => ({}))
        const serverMessage = (body as { error?: string })?.error
        if (typeof serverMessage === 'string' && serverMessage) {
          message = serverMessage
        }
      } catch {
        // ignore
      }
      logger.error('Connect session error:', response.status, message)
      throw new Error(message)
    }

    const data = await response.json()
    return { token: data.token }
  } catch (error) {
    logger.error('Error retrieving connect session token:', error)
    throw error
  }
}

/**
 * Convenience: get session token using current user from NextAuth session.
 */
export const getSessionTokenForUser = async (
  provider?: string,
  accountId?: string,
  multiple: boolean = false
): Promise<SessionTokenResponse> => {
  try {
    const session = await getSession()
    const user = session?.user
    if (!user?.id) {
      throw new Error('User not authenticated')
    }

    return getSessionToken({
      origin_owner_id: user.id,
      origin_owner_name: (user.email ?? user.name) || user.id,
      provider,
      account_id: accountId,
      multiple,
    })
  } catch (error) {
    logger.error('Error retrieving session token for user:', error)
    throw error
  }
}

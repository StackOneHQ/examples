import { logger } from '@/utils/logger'

export interface SessionTokenParams {
  provider?: string
  account_id?: string
  multiple?: boolean
}

export interface SessionTokenResponse {
  token: string
}

/**
 * Retrieves a session token from the StackOne API via our backend.
 * The backend sets the account owner to the signed-in user.
 */
export const getSessionToken = async (params: SessionTokenParams): Promise<SessionTokenResponse> => {
  try {
    const response = await fetch('/api/stackone/connect-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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

import { createClient } from '@/lib/supabase/client'
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
 * Retrieves a session token from the StackOne API via our backend
 * This function handles the session token retrieval logic that was previously
 * embedded in the StackOneHub component, following the ATS example pattern
 */
export const getSessionToken = async (params: SessionTokenParams): Promise<SessionTokenResponse> => {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User not authenticated')
    }

    const payload = {
      origin_owner_id: params.origin_owner_id,
      origin_owner_name: params.origin_owner_name,
      provider: params.provider || undefined,
      account_id: params.account_id || undefined,
      multiple: params.multiple || false
    }

    const response = await fetch('/api/stackone/connect-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error('Failed to get connect session token')
    }

    const data = await response.json()
    return { token: data.token }
  } catch (error) {
    logger.error('Error retrieving connect session token:', error)
    throw error
  }
}

/**
 * Convenience function to get session token with user context
 * This automatically uses the current user's information
 */
export const getSessionTokenForUser = async (
  provider?: string,
  accountId?: string,
  multiple: boolean = false
): Promise<SessionTokenResponse> => {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      throw new Error('User not authenticated')
    }

    return getSessionToken({
      origin_owner_id: user.id,
      origin_owner_name: user.email || user.id,
      provider,
      account_id: accountId,
      multiple
    })
  } catch (error) {
    logger.error('Error retrieving session token for user:', error)
    throw error
  }
}

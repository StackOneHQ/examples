'use client'

import { logger } from '@/utils/logger'

interface SessionData {
  token: string
  expiresAt: number
  integrationId: string
  provider: string
  accountId: string
}

class StackOneSessionManager {
  private sessions: Map<string, SessionData> = new Map()
  private refreshPromises: Map<string, Promise<string>> = new Map()

  private getSessionKey(integrationId: string, provider: string, accountId: string): string {
    return `${integrationId}-${provider}-${accountId}`
  }

  private isTokenExpired(sessionData: SessionData): boolean {
    // Refresh token 5 minutes before it expires
    const bufferTime = 5 * 60 * 1000 // 5 minutes in milliseconds
    return Date.now() >= (sessionData.expiresAt - bufferTime)
  }

  private async createNewSession(
    integrationId: string, 
    provider: string, 
    accountId: string, 
    multiple: boolean = true
  ): Promise<string> {
    try {
      const response = await fetch('/api/stackone/connect-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          account_id: accountId,
          multiple
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to create connect session')
      }

      const { token } = await response.json()
      
      // Calculate expiration time (30 minutes from now)
      const expiresAt = Date.now() + (30 * 60 * 1000)
      
      const sessionData: SessionData = {
        token,
        expiresAt,
        integrationId,
        provider,
        accountId
      }

      const sessionKey = this.getSessionKey(integrationId, provider, accountId)
      this.sessions.set(sessionKey, sessionData)
      
      logger.log(`Created new session for ${sessionKey}, expires at ${new Date(expiresAt).toISOString()}`)
      return token
    } catch (error) {
      logger.error('Error creating new session:', error)
      throw error
    }
  }

  async getValidToken(
    integrationId: string, 
    provider: string, 
    accountId: string, 
    multiple: boolean = true
  ): Promise<string> {
    const sessionKey = this.getSessionKey(integrationId, provider, accountId)
    
    // Check if we already have a valid session
    const existingSession = this.sessions.get(sessionKey)
    if (existingSession && !this.isTokenExpired(existingSession)) {
      logger.log(`Using existing valid session for ${sessionKey}`)
      return existingSession.token
    }

    // Check if we're already refreshing this session
    const existingRefreshPromise = this.refreshPromises.get(sessionKey)
    if (existingRefreshPromise) {
      logger.log(`Waiting for existing refresh for ${sessionKey}`)
      return existingRefreshPromise
    }

    // Create a new session
    logger.log(`Creating new session for ${sessionKey}`)
    const refreshPromise = this.createNewSession(integrationId, provider, accountId, multiple)
    this.refreshPromises.set(sessionKey, refreshPromise)

    try {
      const token = await refreshPromise
      this.refreshPromises.delete(sessionKey)
      return token
    } catch (error) {
      this.refreshPromises.delete(sessionKey)
      throw error
    }
  }

  // Clean up expired sessions
  cleanupExpiredSessions(): void {
    const now = Date.now()
    for (const [sessionKey, sessionData] of this.sessions.entries()) {
      if (now >= sessionData.expiresAt) {
        logger.log(`Cleaning up expired session: ${sessionKey}`)
        this.sessions.delete(sessionKey)
      }
    }
  }

  // Clear all sessions (useful for logout)
  clearAllSessions(): void {
    logger.log('Clearing all sessions')
    this.sessions.clear()
    this.refreshPromises.clear()
  }

  // Get session info for debugging
  getSessionInfo(): Record<string, { expiresAt: string; isExpired: boolean }> {
    const info: Record<string, { expiresAt: string; isExpired: boolean }> = {}
    for (const [sessionKey, sessionData] of this.sessions.entries()) {
      info[sessionKey] = {
        expiresAt: new Date(sessionData.expiresAt).toISOString(),
        isExpired: this.isTokenExpired(sessionData)
      }
    }
    return info
  }
}

// Create a singleton instance
export const sessionManager = new StackOneSessionManager()

// Clean up expired sessions every 10 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    sessionManager.cleanupExpiredSessions()
  }, 10 * 60 * 1000) // 10 minutes
}

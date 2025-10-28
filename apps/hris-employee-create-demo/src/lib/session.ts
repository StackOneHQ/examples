import { NextRequest } from 'next/server';
import { dbMethods } from '@/lib/database';

// Session duration: 24 hours
const SESSION_DURATION = 24 * 60 * 60 * 1000;

export interface SessionUser {
  id: string;
  username: string;
}

/**
 * Create a new session for a user
 */
export function createSession(userId: string, username: string): string {
  const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const expiresAt = Date.now() + SESSION_DURATION;
  
  // Store session in database instead of memory
  try {
    dbMethods.run(`
      INSERT OR REPLACE INTO sessions (id, user_id, username, expires_at)
      VALUES (?, ?, ?, ?)
    `, [sessionId, userId, username, expiresAt]);
  } catch (error) {
    console.error('Failed to store session in database:', error);
    throw error;
  }
  
  return sessionId;
}

/**
 * Get user from session token
 */
export async function getUserFromSession(sessionId: string): Promise<SessionUser | null> {
  try {
    // Get session from database
    const session = await dbMethods.get(`
      SELECT user_id, username, expires_at 
      FROM sessions 
      WHERE id = ?
    `, [sessionId]);
    
    if (!session) {
      return null;
    }
    
    // Check if session has expired
    if (Date.now() > session.expires_at) {
      // Clean up expired session
      await dbMethods.run('DELETE FROM sessions WHERE id = ?', [sessionId]);
      return null;
    }
    
    return {
      id: session.user_id,
      username: session.username
    };
  } catch (error) {
    console.error('Error looking up session:', error);
    return null;
  }
}

/**
 * Get current user from request headers
 */
export async function getCurrentUser(request: NextRequest): Promise<SessionUser | null> {
  const sessionId = request.headers.get('x-session-id');
  
  if (!sessionId) {
    return null;
  }
  
  return await getUserFromSession(sessionId);
}

/**
 * Get user's integrations from database
 */
export async function getUserIntegrations(userId: string) {
  return await dbMethods.all(
    'SELECT * FROM integrations WHERE user_id = ? AND status = ? ORDER BY created_at DESC',
    [userId, 'active']
  );
}

/**
 * Get user's account ID for a specific provider
 */
export async function getUserAccountId(userId: string, provider: string): Promise<string | null> {
  const integration = await dbMethods.get(
    'SELECT account_id FROM integrations WHERE user_id = ? AND provider_key = ? AND status = ?',
    [userId, provider, 'active']
  );
  
  return integration?.account_id || null;
}

/**
 * Clean up expired sessions from database
 */
export function cleanupExpiredSessions(): void {
  try {
    const now = Date.now();
    dbMethods.run('DELETE FROM sessions WHERE expires_at < ?', [now]);
  } catch (error) {
    console.error('Error cleaning up expired sessions:', error);
  }
}

// Clean up expired sessions every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

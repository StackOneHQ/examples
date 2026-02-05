import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/** Get the current user id from the session (server-side). Returns null if not authenticated. */
export async function getCurrentUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return session?.user?.id ?? null
}

/** Get the current user or throw. Use in API routes that require auth. */
export async function requireUser(): Promise<{ id: string; email?: string | null }> {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    throw new Error('Unauthorized')
  }
  return { id: session.user.id, email: session.user.email }
}

import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { requireUser } from '@/lib/auth-server'
import { logger } from '@/utils/logger'

/** GET /api/threads/[id]/messages - list messages for a thread (user must own thread via agent). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id: threadId } = await params

    const thread = await queryOne(
      `SELECT t.id FROM threads t
       INNER JOIN agents a ON t.agent_id = a.id AND a.user_id = $1
       WHERE t.id = $2`,
      [user.id, threadId]
    )
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    const messages = await query(
      `SELECT id, agent_id, thread_id, user_id, role, content, metadata, created_at
       FROM chat_messages
       WHERE thread_id = $1
       ORDER BY created_at ASC`,
      [threadId]
    )

    return NextResponse.json({ messages })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error fetching messages:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

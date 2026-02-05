import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { requireUser } from '@/lib/auth-server'
import { logger } from '@/utils/logger'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id: threadId } = await params

    const existing = await queryOne(
      `SELECT t.id FROM threads t
       INNER JOIN agents a ON t.agent_id = a.id AND a.user_id = $1
       WHERE t.id = $2`,
      [user.id, threadId]
    )
    if (!existing) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    const rows = await query(
      `UPDATE threads SET status = 'archived', updated_at = NOW() WHERE id = $1 RETURNING *`,
      [threadId]
    )
    const thread = rows[0]
    if (!thread) {
      return NextResponse.json({ error: 'Failed to archive thread' }, { status: 500 })
    }

    return NextResponse.json({ thread })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error archiving thread:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

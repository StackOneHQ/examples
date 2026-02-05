import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { requireUser } from '@/lib/auth-server'
import { logger } from '@/utils/logger'

/** PATCH /api/chat/messages/[id] - update message content (user must own via thread/agent). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id: messageId } = await params
    const { content } = await request.json()
    if (typeof content !== 'string' || !content.trim()) {
      return NextResponse.json({ error: 'content required' }, { status: 400 })
    }

    const existing = await queryOne<{ id: string }>(
      `SELECT cm.id FROM chat_messages cm
       INNER JOIN threads t ON cm.thread_id = t.id
       INNER JOIN agents a ON t.agent_id = a.id AND a.user_id = $1
       WHERE cm.id = $2`,
      [user.id, messageId]
    )
    if (!existing) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    await query(`UPDATE chat_messages SET content = $1 WHERE id = $2`, [content.trim(), messageId])
    return NextResponse.json({ success: true })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error updating message:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** DELETE /api/chat/messages/[id] - delete a message (user must own via thread/agent). */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id: messageId } = await params

    const existing = await queryOne<{ id: string }>(
      `SELECT cm.id FROM chat_messages cm
       INNER JOIN threads t ON cm.thread_id = t.id
       INNER JOIN agents a ON t.agent_id = a.id AND a.user_id = $1
       WHERE cm.id = $2`,
      [user.id, messageId]
    )
    if (!existing) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    await query(`DELETE FROM chat_messages WHERE id = $1`, [messageId])
    return NextResponse.json({ success: true })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error deleting message:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

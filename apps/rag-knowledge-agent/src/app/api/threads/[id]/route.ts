import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { requireUser } from '@/lib/auth-server'
import { logger } from '@/utils/logger'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id: threadId } = await params

    const thread = await queryOne(
      `SELECT t.* FROM threads t
       INNER JOIN agents a ON t.agent_id = a.id AND a.user_id = $1
       WHERE t.id = $2`,
      [user.id, threadId]
    )

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    return NextResponse.json({ thread })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error fetching thread:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id: threadId } = await params
    const { title, status } = await request.json()

    const existing = await queryOne(
      `SELECT t.id FROM threads t
       INNER JOIN agents a ON t.agent_id = a.id AND a.user_id = $1
       WHERE t.id = $2`,
      [user.id, threadId]
    )
    if (!existing) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    const updates: string[] = ['updated_at = NOW()']
    const values: unknown[] = []
    let i = 1
    if (title !== undefined) {
      values.push(title)
      updates.push(`title = $${i++}`)
    }
    if (status !== undefined) {
      values.push(status)
      updates.push(`status = $${i++}`)
    }
    values.push(threadId)

    const rows = await query(
      `UPDATE threads SET ${updates.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    )
    const thread = rows[0]
    if (!thread) {
      return NextResponse.json({ error: 'Failed to update thread' }, { status: 500 })
    }

    return NextResponse.json({ thread })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error updating thread:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
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

    await query(`DELETE FROM threads WHERE id = $1`, [threadId])
    return NextResponse.json({ success: true })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error deleting thread:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

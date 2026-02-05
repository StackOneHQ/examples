import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { requireUser } from '@/lib/auth-server'
import { logger } from '@/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser()
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 })
    }

    const agent = await queryOne<{ id: string }>(
      `SELECT id FROM agents WHERE id = $1 AND user_id = $2`,
      [agentId, user.id]
    )
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const threads = await query(
      `SELECT * FROM threads WHERE agent_id = $1 AND user_id = $2 AND status = 'active'
       ORDER BY last_message_at DESC NULLS LAST, updated_at DESC`,
      [agentId, user.id]
    )

    return NextResponse.json({ threads })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error fetching threads:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const { agentId, title } = await request.json()

    if (!agentId || !title) {
      return NextResponse.json({ error: 'Agent ID and title are required' }, { status: 400 })
    }

    const agent = await queryOne<{ id: string }>(
      `SELECT id FROM agents WHERE id = $1 AND user_id = $2`,
      [agentId, user.id]
    )
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const rows = await query<{ id: string; agent_id: string; user_id: string; title: string; status: string; message_count: number; last_message_at: string | null; created_at: string; updated_at: string }>(
      `INSERT INTO threads (agent_id, user_id, title, status) VALUES ($1, $2, $3, 'active')
       RETURNING id, agent_id, user_id, title, status, message_count, last_message_at, created_at, updated_at`,
      [agentId, user.id, title]
    )
    const thread = rows[0]
    if (!thread) {
      return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 })
    }

    return NextResponse.json({ thread })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error creating thread:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

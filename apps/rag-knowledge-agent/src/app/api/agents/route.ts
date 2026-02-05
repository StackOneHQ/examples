import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireUser } from '@/lib/auth-server'
import { logger } from '@/utils/logger'

/** GET /api/agents - list current user's agents */
export async function GET() {
  try {
    const user = await requireUser()
    const agents = await query(
      `SELECT * FROM agents WHERE user_id = $1 ORDER BY created_at DESC`,
      [user.id]
    )
    return NextResponse.json({ agents })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error fetching agents:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST /api/agents - create agent (body: name, description?, integration_ids?, status?) */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const { name, description, integration_ids, status } = body
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name required' }, { status: 400 })
    }
    const rows = await query(
      `INSERT INTO agents (user_id, name, description, integration_ids, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [user.id, name.trim(), (description ?? '').trim() || null, integration_ids ?? [], status ?? 'processing']
    )
    const agent = rows[0]
    if (!agent) return NextResponse.json({ error: 'Failed to create agent' }, { status: 500 })
    return NextResponse.json({ agent })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error creating agent:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

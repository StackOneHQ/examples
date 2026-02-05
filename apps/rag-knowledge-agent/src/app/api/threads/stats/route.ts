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

    const stats = await query<{ total: string; active: string; archived: string }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE status = 'active')::text AS active,
         COUNT(*) FILTER (WHERE status = 'archived')::text AS archived
       FROM threads WHERE agent_id = $1 AND user_id = $2`,
      [agentId, user.id]
    )

    const row = stats[0]
    return NextResponse.json({
      total: parseInt(row?.total ?? '0', 10),
      active: parseInt(row?.active ?? '0', 10),
      archived: parseInt(row?.archived ?? '0', 10),
    })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error fetching thread stats:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import { requireUser } from '@/lib/auth-server'
import { logger } from '@/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser()
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    const threads = agentId
      ? await query(
          `SELECT t.* FROM threads t
           INNER JOIN agents a ON t.agent_id = a.id AND a.user_id = $1
           WHERE t.agent_id = $2
           ORDER BY t.last_message_at DESC NULLS LAST, t.updated_at DESC
           LIMIT 20`,
          [user.id, agentId]
        )
      : await query(
          `SELECT t.* FROM threads t
           INNER JOIN agents a ON t.agent_id = a.id AND a.user_id = $1
           ORDER BY t.last_message_at DESC NULLS LAST, t.updated_at DESC
           LIMIT 20`,
          [user.id]
        )

    return NextResponse.json({ threads })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error fetching recent threads:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

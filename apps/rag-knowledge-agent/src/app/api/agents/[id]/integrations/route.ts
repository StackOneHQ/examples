import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { requireUser } from '@/lib/auth-server'
import { logger } from '@/utils/logger'

/** GET /api/agents/[id]/integrations - list agent_integrations for this agent (user must own agent). */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id: agentId } = await params
    const agent = await queryOne<{ id: string }>(
      `SELECT id FROM agents WHERE id = $1 AND user_id = $2`,
      [agentId, user.id]
    )
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    const rows = await query<{ integration_id: string; file_ids: string[] | unknown }>(
      `SELECT integration_id, file_ids FROM agent_integrations WHERE agent_id = $1`,
      [agentId]
    )
    return NextResponse.json({ integrations: rows })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error fetching agent integrations:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** PUT /api/agents/[id]/integrations - replace agent_integrations (body: { integrations: [{ integration_id, file_ids }] }) */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id: agentId } = await params
    const agent = await queryOne<{ id: string }>(
      `SELECT id FROM agents WHERE id = $1 AND user_id = $2`,
      [agentId, user.id]
    )
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    const body = await request.json()
    const integrations = body.integrations as Array<{ integration_id: string; file_ids: unknown[] }> | undefined
    if (!Array.isArray(integrations)) {
      return NextResponse.json({ error: 'integrations array required' }, { status: 400 })
    }

    await query(`DELETE FROM agent_integrations WHERE agent_id = $1`, [agentId])

    for (const row of integrations) {
      const { integration_id, file_ids } = row
      if (!integration_id) continue
      const fileIdsArray = (file_ids ?? []).map((f: unknown) =>
        typeof f === 'string' ? f : JSON.stringify(f)
      ) as string[]
      await query(
        `INSERT INTO agent_integrations (agent_id, integration_id, file_ids) VALUES ($1, $2, $3)`,
        [agentId, integration_id, fileIdsArray]
      )
    }

    const rows = await query(
      `SELECT integration_id, file_ids FROM agent_integrations WHERE agent_id = $1`,
      [agentId]
    )
    return NextResponse.json({ integrations: rows })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error updating agent integrations:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

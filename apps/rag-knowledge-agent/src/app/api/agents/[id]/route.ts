import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { requireUser } from '@/lib/auth-server'
import { logger } from '@/utils/logger'

/** GET /api/agents/[id] - get a single agent (must belong to current user). Optionally ?integrations=1 to include agent_integrations. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id } = await params
    const agent = await queryOne<Record<string, unknown>>(
      `SELECT * FROM agents WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    )
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    const { searchParams } = new URL(request.url)
    if (searchParams.get('integrations') === '1') {
      const agentIntegrations = await query<{ integration_id: string; file_ids: string[] | unknown }>(
        `SELECT integration_id, file_ids FROM agent_integrations WHERE agent_id = $1`,
        [id]
      )
      ;(agent as Record<string, unknown>).agent_integrations = agentIntegrations
    }
    const countRows = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM agent_documents WHERE agent_id = $1`,
      [id]
    )
    ;(agent as Record<string, unknown>).document_count = parseInt(countRows[0]?.count ?? '0', 10)
    return NextResponse.json({ agent })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error fetching agent:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** PATCH /api/agents/[id] - update agent (body: name?, description?, integration_ids?) */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id } = await params
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM agents WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    )
    if (!existing) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    const body = await request.json()
    const { name, description, integration_ids } = body
    const updates: string[] = ['updated_at = NOW()']
    const values: unknown[] = []
    let i = 1
    if (name !== undefined) {
      values.push(name)
      updates.push(`name = $${i++}`)
    }
    if (description !== undefined) {
      values.push(description ?? null)
      updates.push(`description = $${i++}`)
    }
    if (integration_ids !== undefined) {
      values.push(integration_ids)
      updates.push(`integration_ids = $${i++}`)
    }
    if (values.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }
    values.push(id)
    await query(`UPDATE agents SET ${updates.join(', ')} WHERE id = $${i}`, values)
    const rows = await query(`SELECT * FROM agents WHERE id = $1`, [id])
    return NextResponse.json({ agent: rows[0] })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error updating agent:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** DELETE /api/agents/[id] - delete agent (cascades to agent_integrations, etc.) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id } = await params
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM agents WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    )
    if (!existing) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }
    await query(`DELETE FROM agents WHERE id = $1`, [id])
    return NextResponse.json({ success: true })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error deleting agent:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

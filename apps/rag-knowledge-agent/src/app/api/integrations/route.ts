import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { requireUser } from '@/lib/auth-server'
import { logger } from '@/utils/logger'

/** GET /api/integrations - list current user's integrations */
export async function GET() {
  try {
    const user = await requireUser()
    const integrations = await query(
      `SELECT * FROM integrations WHERE user_id = $1 ORDER BY created_at DESC`,
      [user.id]
    )
    return NextResponse.json({ integrations })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error fetching integrations:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** PATCH /api/integrations - update an integration (body: { id, status?, account_name? }) */
export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const { id, status, account_name } = body
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM integrations WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    )
    if (!existing) return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    const updates: string[] = ['updated_at = NOW()']
    const values: unknown[] = []
    let i = 1
    if (status !== undefined) {
      values.push(status)
      updates.push(`status = $${i++}`)
    }
    if (account_name !== undefined) {
      values.push(account_name)
      updates.push(`account_name = $${i++}`)
    }
    values.push(id)
    await query(`UPDATE integrations SET ${updates.join(', ')} WHERE id = $${i}`, values)
    const rows = await query(`SELECT * FROM integrations WHERE id = $1`, [id])
    return NextResponse.json({ integration: rows[0] })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error updating integration:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** POST /api/integrations - create integration (body: { provider, stackone_account_id, account_name? }) */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json()
    const { provider, stackone_account_id, account_name } = body
    if (!provider || !stackone_account_id) {
      return NextResponse.json({ error: 'provider and stackone_account_id required' }, { status: 400 })
    }
    const rows = await query(
      `INSERT INTO integrations (user_id, provider, stackone_account_id, account_name, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (stackone_account_id) DO UPDATE SET status = 'active', account_name = COALESCE(EXCLUDED.account_name, integrations.account_name), updated_at = NOW()
       RETURNING *`,
      [user.id, provider, stackone_account_id, account_name ?? 'Connected account']
    )
    const integration = rows[0]
    if (!integration) return NextResponse.json({ error: 'Failed to create integration' }, { status: 500 })
    return NextResponse.json({ integration })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error creating integration:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/** DELETE /api/integrations - delete an integration (body: { id }) */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser()
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
    const existing = await queryOne<{ id: string }>(
      `SELECT id FROM integrations WHERE id = $1 AND user_id = $2`,
      [id, user.id]
    )
    if (!existing) return NextResponse.json({ error: 'Integration not found' }, { status: 404 })
    await query(`DELETE FROM integrations WHERE id = $1`, [id])
    return NextResponse.json({ success: true })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error deleting integration:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

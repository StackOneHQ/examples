import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth-server'
import { queryOne } from '@/lib/db'
import { logger } from '@/utils/logger'
import { deleteAccount } from '@/lib/stackone/api'

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser()
    const { accountId } = await request.json()

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 })
    }

    const owned = await queryOne<{ id: string }>(
      `SELECT id FROM integrations WHERE stackone_account_id = $1 AND user_id = $2`,
      [accountId, user.id]
    )
    if (!owned) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 })
    }

    // Get StackOne API key from environment
    const apiKey = process.env.STACKONE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'StackOne API key not configured' }, { status: 500 })
    }

    // Delete account from StackOne
    await deleteAccount(apiKey, accountId)

    return NextResponse.json({
      success: true,
      message: 'Account deleted successfully from StackOne'
    })

  } catch (error) {
    logger.error('StackOne account deletion error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

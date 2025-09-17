import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/utils/logger'
import { deleteAccount } from '@/lib/stackone/api'

export async function DELETE(request: NextRequest) {
  try {
    const { accountId } = await request.json()
    const supabase = await createClient()

    // Get user from auth
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 })
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

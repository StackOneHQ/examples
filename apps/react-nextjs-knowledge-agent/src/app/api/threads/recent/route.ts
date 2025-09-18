import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/utils/logger'
import type { Thread } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get recent threads across all user's agents
    const { data: threads, error } = await supabase
      .from('threads')
      .select(`
        id,
        title,
        status,
        message_count,
        last_message_at,
        created_at,
        updated_at,
        agents!inner(
          id,
          name,
          user_id
        )
      `)
      .eq('agents.user_id', user.id)
      .eq('status', 'active')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })
      .limit(5)

    if (error) {
      logger.error('Error fetching recent threads:', error)
      return NextResponse.json({ error: 'Failed to fetch recent threads' }, { status: 500 })
    }

    return NextResponse.json({ threads })

  } catch (error) {
    logger.error('Error fetching recent threads:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

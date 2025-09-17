import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/utils/logger'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    if (!agentId) {
      return NextResponse.json({ error: 'Agent ID is required' }, { status: 400 })
    }

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Get thread statistics
    const { data: stats, error } = await supabase
      .from('threads')
      .select(`
        status,
        message_count,
        created_at
      `)
      .eq('agent_id', agentId)
      .eq('user_id', user.id)

    if (error) {
      logger.error('Error fetching thread stats:', error)
      return NextResponse.json({ error: 'Failed to fetch thread statistics' }, { status: 500 })
    }

    // Calculate statistics
    const totalThreads = stats.length
    const activeThreads = stats.filter(t => t.status === 'active').length
    const archivedThreads = stats.filter(t => t.status === 'archived').length
    const totalMessages = stats.reduce((sum, t) => sum + (t.message_count || 0), 0)
    const avgMessagesPerThread = totalThreads > 0 ? Math.round(totalMessages / totalThreads) : 0

    // Get threads created in the last 7 days
    const sevenDaysAgo = new Date()
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const recentThreads = stats.filter(t => new Date(t.created_at) > sevenDaysAgo).length

    return NextResponse.json({
      totalThreads,
      activeThreads,
      archivedThreads,
      totalMessages,
      avgMessagesPerThread,
      recentThreads
    })

  } catch (error) {
    logger.error('Error fetching thread stats:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

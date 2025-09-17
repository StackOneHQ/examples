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

    // Get threads for the agent with message count and last message info
    const { data: threads, error } = await supabase
      .from('threads')
      .select('*')
      .eq('agent_id', agentId)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false })

    if (error) {
      logger.error('Error fetching threads:', error)
      return NextResponse.json({ error: 'Failed to fetch threads' }, { status: 500 })
    }

    return NextResponse.json({ threads })

  } catch (error) {
    logger.error('Error fetching threads:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { agentId, title } = await request.json()

    if (!agentId || !title) {
      return NextResponse.json({ error: 'Agent ID and title are required' }, { status: 400 })
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

    // Create new thread
    const { data: thread, error } = await supabase
      .from('threads')
      .insert({
        agent_id: agentId,
        user_id: user.id,
        title,
        status: 'active'
      })
      .select()
      .single()

    if (error) {
      logger.error('Error creating thread:', error)
      return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 })
    }

    return NextResponse.json({ thread })

  } catch (error) {
    logger.error('Error creating thread:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/utils/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    
    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: threadId } = await params

    // Verify thread belongs to user
    const { data: existingThread, error: fetchError } = await supabase
      .from('threads')
      .select(`
        id,
        agents!inner(user_id)
      `)
      .eq('id', threadId)
      .eq('agents.user_id', user.id)
      .single()

    if (fetchError || !existingThread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    // Archive thread
    const { data: thread, error } = await supabase
      .from('threads')
      .update({ 
        status: 'archived',
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId)
      .select()
      .single()

    if (error) {
      logger.error('Error archiving thread:', error)
      return NextResponse.json({ error: 'Failed to archive thread' }, { status: 500 })
    }

    return NextResponse.json({ thread })

  } catch (error) {
    logger.error('Error archiving thread:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

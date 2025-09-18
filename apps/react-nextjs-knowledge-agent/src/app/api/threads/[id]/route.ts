import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '@/utils/logger'

export async function GET(
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

    // Get thread with agent verification
    const { data: thread, error } = await supabase
      .from('threads')
      .select(`
        *,
        agents!inner(user_id)
      `)
      .eq('id', threadId)
      .eq('agents.user_id', user.id)
      .single()

    if (error || !thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    return NextResponse.json({ thread })

  } catch (error) {
    logger.error('Error fetching thread:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(
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
    const { title, status } = await request.json()

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

    // Update thread
    const updateData: { updated_at: string; title?: string; status?: string } = { updated_at: new Date().toISOString() }
    if (title !== undefined) updateData.title = title
    if (status !== undefined) updateData.status = status

    const { data: thread, error } = await supabase
      .from('threads')
      .update(updateData)
      .eq('id', threadId)
      .select()
      .single()

    if (error) {
      logger.error('Error updating thread:', error)
      return NextResponse.json({ error: 'Failed to update thread' }, { status: 500 })
    }

    return NextResponse.json({ thread })

  } catch (error) {
    logger.error('Error updating thread:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
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

    // Hard delete thread (completely remove from database)
    // Chat messages will be automatically deleted due to CASCADE constraint
    const { error } = await supabase
      .from('threads')
      .delete()
      .eq('id', threadId)

    if (error) {
      logger.error('Error deleting thread:', error)
      return NextResponse.json({ error: 'Failed to delete thread' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    logger.error('Error deleting thread:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

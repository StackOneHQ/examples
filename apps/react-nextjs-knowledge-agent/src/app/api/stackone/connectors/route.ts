import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadConnectorMetadata } from '@/lib/connector-metadata-server'
import { logger } from '@/utils/logger'

export async function GET() {
  try {
    const supabase = await createClient()
    const apiKey = process.env.STACKONE_API_KEY || ''
    
    if (!apiKey) {
      return NextResponse.json({ error: 'StackOne API key not configured' }, { status: 500 })
    }

    const connectorMetadata = await loadConnectorMetadata(supabase, apiKey)
    
    return NextResponse.json(connectorMetadata)
  } catch (error) {
    logger.error('Error in connectors API route:', error)
    return NextResponse.json({ error: 'Failed to load connector metadata' }, { status: 500 })
  }
}

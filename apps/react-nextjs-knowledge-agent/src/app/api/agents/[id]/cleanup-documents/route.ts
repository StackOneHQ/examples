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

    const { id: agentId } = await params

    // Verify agent belongs to user
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('id, user_id')
      .eq('id', agentId)
      .eq('user_id', user.id)
      .single()

    if (agentError || !agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    // Get current agent integrations to determine which files should exist
    const { data: agentIntegrations, error: integrationsError } = await supabase
      .from('agent_integrations')
      .select('file_ids, integration_id')
      .eq('agent_id', agentId)

    if (integrationsError) {
      logger.error('Error fetching agent integrations:', integrationsError)
      return NextResponse.json({ error: 'Failed to fetch agent integrations' }, { status: 500 })
    }

    // Get all current agent-document relationships for this agent
    const { data: currentAgentDocuments, error: agentDocsError } = await supabase
      .from('agent_documents')
      .select(`
        document_id,
        documents!inner(
          id,
          stackone_document_id,
          integration_id
        )
      `)
      .eq('agent_id', agentId)

    if (agentDocsError) {
      logger.error('Error fetching agent documents:', agentDocsError)
      return NextResponse.json({ error: 'Failed to fetch agent documents' }, { status: 500 })
    }

    // If no agent integrations exist, remove all agent-document relationships
    if (!agentIntegrations || agentIntegrations.length === 0) {
      logger.log(`No agent integrations found for agent ${agentId}, removing all ${currentAgentDocuments?.length || 0} agent-document relationships`)
      
      if (currentAgentDocuments && currentAgentDocuments.length > 0) {
        const relationshipIds = currentAgentDocuments.map(rel => rel.document_id)
        
        // Remove agent-document relationships
        const { error: deleteRelationsError } = await supabase
          .from('agent_documents')
          .delete()
          .eq('agent_id', agentId)

        if (deleteRelationsError) {
          logger.error('Error deleting agent-document relationships:', deleteRelationsError)
          return NextResponse.json({ error: 'Failed to delete agent-document relationships' }, { status: 500 })
        }

        // Check which documents are no longer used by any agent
        const { data: orphanedDocs, error: orphanedError } = await supabase
          .from('agent_documents')
          .select('document_id')
          .in('document_id', relationshipIds)

        if (orphanedError) {
          logger.error('Error checking orphaned documents:', orphanedError)
          return NextResponse.json({ error: 'Failed to check orphaned documents' }, { status: 500 })
        }

        const usedDocumentIds = new Set(orphanedDocs?.map(rel => rel.document_id) || [])
        const trulyOrphanedIds = relationshipIds.filter(id => !usedDocumentIds.has(id))

        // Delete truly orphaned documents
        if (trulyOrphanedIds.length > 0) {
          const { error: deleteDocsError } = await supabase
            .from('documents')
            .delete()
            .in('id', trulyOrphanedIds)

          if (deleteDocsError) {
            logger.error('Error deleting orphaned documents:', deleteDocsError)
            return NextResponse.json({ error: 'Failed to delete orphaned documents' }, { status: 500 })
          }

          logger.log(`Successfully deleted ${trulyOrphanedIds.length} orphaned documents`)
        }

        logger.log(`Successfully removed all agent-document relationships for agent ${agentId}`)
      }

      return NextResponse.json({ 
        success: true, 
        deletedCount: currentAgentDocuments?.length || 0,
        deletedDocuments: currentAgentDocuments?.map(rel => ({ 
          id: rel.document_id, 
          file_id: (rel.documents as any).stackone_document_id 
        })) || [],
        message: 'All agent-document relationships removed - no agent integrations found'
      })
    }

    // Create a set of valid file IDs from agent integrations
    const validFileIds = new Set<string>()
    agentIntegrations.forEach(ai => {
      if (ai.file_ids && Array.isArray(ai.file_ids)) {
        ai.file_ids.forEach((file: any) => {
          if (typeof file === 'string') {
            validFileIds.add(file)
          } else if (file && typeof file === 'object' && file.id) {
            validFileIds.add(file.id)
          }
        })
      }
    })

    // Find agent-document relationships that are no longer valid
    const relationshipsToRemove = currentAgentDocuments?.filter(rel => 
      !validFileIds.has((rel.documents as any).stackone_document_id)
    ) || []

    logger.log(`Found ${relationshipsToRemove.length} agent-document relationships to remove for agent ${agentId}`)
    logger.log('Relationships to remove:', relationshipsToRemove.map(rel => ({ 
      id: rel.document_id, 
      file_id: (rel.documents as any).stackone_document_id 
    })))

    // Remove invalid agent-document relationships
    if (relationshipsToRemove.length > 0) {
      const documentIdsToRemove = relationshipsToRemove.map(rel => rel.document_id)
      
      const { error: deleteRelationsError } = await supabase
        .from('agent_documents')
        .delete()
        .eq('agent_id', agentId)
        .in('document_id', documentIdsToRemove)

      if (deleteRelationsError) {
        logger.error('Error deleting agent-document relationships:', deleteRelationsError)
        return NextResponse.json({ error: 'Failed to delete agent-document relationships' }, { status: 500 })
      }

      // Check which documents are no longer used by any agent
      const { data: orphanedDocs, error: orphanedError } = await supabase
        .from('agent_documents')
        .select('document_id')
        .in('document_id', documentIdsToRemove)

      if (orphanedError) {
        logger.error('Error checking orphaned documents:', orphanedError)
        return NextResponse.json({ error: 'Failed to check orphaned documents' }, { status: 500 })
      }

      const usedDocumentIds = new Set(orphanedDocs?.map(rel => rel.document_id) || [])
      const trulyOrphanedIds = documentIdsToRemove.filter(id => !usedDocumentIds.has(id))

      // Delete truly orphaned documents
      if (trulyOrphanedIds.length > 0) {
        const { error: deleteDocsError } = await supabase
          .from('documents')
          .delete()
          .in('id', trulyOrphanedIds)

        if (deleteDocsError) {
          logger.error('Error deleting orphaned documents:', deleteDocsError)
          return NextResponse.json({ error: 'Failed to delete orphaned documents' }, { status: 500 })
        }

        logger.log(`Successfully deleted ${trulyOrphanedIds.length} orphaned documents`)
      }

      logger.log(`Successfully removed ${relationshipsToRemove.length} agent-document relationships`)
    }

    return NextResponse.json({ 
      success: true, 
      deletedCount: relationshipsToRemove.length,
      deletedDocuments: relationshipsToRemove.map(rel => ({ 
        id: rel.document_id, 
        file_id: (rel.documents as any).stackone_document_id 
      }))
    })

  } catch (error) {
    logger.error('Error cleaning up documents:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

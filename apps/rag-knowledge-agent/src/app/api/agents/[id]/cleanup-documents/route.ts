import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from '@/lib/db'
import { requireUser } from '@/lib/auth-server'
import { logger } from '@/utils/logger'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser()
    const { id: agentId } = await params

    const agent = await queryOne<{ id: string }>(
      `SELECT id FROM agents WHERE id = $1 AND user_id = $2`,
      [agentId, user.id]
    )
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const agentIntegrations = await query<{ file_ids: string[]; integration_id: string }>(
      `SELECT file_ids, integration_id FROM agent_integrations WHERE agent_id = $1`,
      [agentId]
    )

    const currentAgentDocuments = await query<{ document_id: string; stackone_document_id: string }>(
      `SELECT ad.document_id, d.stackone_document_id
       FROM agent_documents ad
       INNER JOIN documents d ON ad.document_id = d.id
       WHERE ad.agent_id = $1`,
      [agentId]
    )

    if (!agentIntegrations || agentIntegrations.length === 0) {
      logger.log(
        `No agent integrations found for agent ${agentId}, removing all ${currentAgentDocuments?.length ?? 0} agent-document relationships`
      )

      if (currentAgentDocuments && currentAgentDocuments.length > 0) {
        const relationshipIds = currentAgentDocuments.map((r) => r.document_id)
        await query(`DELETE FROM agent_documents WHERE agent_id = $1`, [agentId])

        const orphaned = await query<{ document_id: string }>(
          `SELECT document_id FROM agent_documents WHERE document_id = ANY($1::uuid[])`,
          [relationshipIds]
        )
        const usedIds = new Set(orphaned.map((r) => r.document_id))
        const trulyOrphanedIds = relationshipIds.filter((id) => !usedIds.has(id))
        if (trulyOrphanedIds.length > 0) {
          await query(`DELETE FROM documents WHERE id = ANY($1::uuid[])`, [trulyOrphanedIds])
          logger.log(`Successfully deleted ${trulyOrphanedIds.length} orphaned documents`)
        }

        logger.log(`Successfully removed all agent-document relationships for agent ${agentId}`)
      }

      return NextResponse.json({
        success: true,
        deletedCount: currentAgentDocuments?.length ?? 0,
        deletedDocuments:
          currentAgentDocuments?.map((r) => ({ id: r.document_id, file_id: r.stackone_document_id })) ?? [],
        message: 'All agent-document relationships removed - no agent integrations found',
      })
    }

    const validFileIds = new Set<string>()
    agentIntegrations.forEach((ai) => {
      const ids = Array.isArray(ai.file_ids) ? ai.file_ids : []
      ids.forEach((file: unknown) => {
        if (typeof file === 'string') validFileIds.add(file)
        else if (file && typeof file === 'object' && 'id' in file) validFileIds.add((file as { id: string }).id)
      })
    })

    const relationshipsToRemove =
      currentAgentDocuments?.filter((r) => !validFileIds.has(r.stackone_document_id)) ?? []

    logger.log(
      `Found ${relationshipsToRemove.length} agent-document relationships to remove for agent ${agentId}`
    )

    if (relationshipsToRemove.length > 0) {
      const documentIdsToRemove = relationshipsToRemove.map((r) => r.document_id)
      await query(
        `DELETE FROM agent_documents WHERE agent_id = $1 AND document_id = ANY($2::uuid[])`,
        [agentId, documentIdsToRemove]
      )

      const orphaned = await query<{ document_id: string }>(
        `SELECT document_id FROM agent_documents WHERE document_id = ANY($1::uuid[])`,
        [documentIdsToRemove]
      )
      const usedIds = new Set(orphaned.map((r) => r.document_id))
      const trulyOrphanedIds = documentIdsToRemove.filter((id) => !usedIds.has(id))
      if (trulyOrphanedIds.length > 0) {
        await query(`DELETE FROM documents WHERE id = ANY($1::uuid[])`, [trulyOrphanedIds])
        logger.log(`Successfully deleted ${trulyOrphanedIds.length} orphaned documents`)
      }

      logger.log(`Successfully removed ${relationshipsToRemove.length} agent-document relationships`)
    }

    return NextResponse.json({
      success: true,
      deletedCount: relationshipsToRemove.length,
      deletedDocuments: relationshipsToRemove.map((r) => ({
        id: r.document_id,
        file_id: r.stackone_document_id,
      })),
    })
  } catch (err) {
    if ((err as Error).message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    logger.error('Error cleaning up documents:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

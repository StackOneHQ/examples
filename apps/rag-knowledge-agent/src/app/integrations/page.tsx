import { redirect } from 'next/navigation'
import { query } from '@/lib/db'
import { getCurrentUserId } from '@/lib/auth-server'
import { listUserAccounts } from '@/lib/stackone/api'
import { loadConnectorMetadata } from '@/lib/connector-metadata-server'
import { IntegrationsPageClient } from '@/components/IntegrationsPageClient'
import type { Integration, StackOneAccount, ConnectorMetadata } from '@/types'
import { logger } from '@/utils/logger'

export default async function IntegrationsPage() {
  const userId = await getCurrentUserId()
  if (!userId) {
    redirect('/login')
  }

  let integrationsList: Integration[] = []
  let integrationsError: Error | null = null
  try {
    const rows = await query<Integration>(
      `SELECT * FROM integrations WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    )
    integrationsList = rows ?? []
  } catch (err) {
    integrationsError = err instanceof Error ? err : new Error(String(err))
    logger.error('Error loading integrations:', err)
    if (err instanceof Error && err.message?.includes('relation')) {
      logger.error('Database schema not set up. Please run the database setup script.')
    }
  }

  let connectorMetadata: ConnectorMetadata[] = []
  try {
    const apiKey = process.env.STACKONE_API_KEY || ''
    if (apiKey) {
      connectorMetadata = await loadConnectorMetadata(apiKey)
    }
  } catch (err) {
    logger.error('Error loading StackOne data:', err)
  }

  if (integrationsError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16 bg-red-50 rounded-xl border border-red-200">
          <div className="mx-auto h-16 w-16 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
            <i className="bi bi-exclamation-triangle text-red-600 text-2xl"></i>
          </div>
          <h3 className="text-lg font-medium text-red-900 mb-2">Database Setup Required</h3>
          <p className="text-red-700 mb-4">
            The database schema needs to be set up. Please run the setup script.
          </p>
          <div className="text-sm text-red-600 bg-red-100 p-3 rounded-lg">
            <code>node scripts/setup-database.js</code>
          </div>
        </div>
      </div>
    )
  }

  return (
    <IntegrationsPageClient 
      initialIntegrations={integrationsList}
      connectorMetadata={connectorMetadata}
    />
  )
}

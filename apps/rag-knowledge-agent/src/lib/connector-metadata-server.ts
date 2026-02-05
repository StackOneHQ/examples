import { query } from '@/lib/db'
import { listConnectorsFromActionsMetadata } from '@/lib/stackone/api'
import type { ConnectorMetadata } from '@/types'
import { logger } from '@/utils/logger'

const getAvailableProviders = (): string[] => {
  const envProviders = process.env.AVAILABLE_INTEGRATIONS
  const fromIntegrations = envProviders
    ? envProviders.split(',').map((p) => p.trim().toLowerCase()).filter(Boolean)
    : []
  return fromIntegrations
}

/** Parse AVAILABLE_INTEGRATION_VERSIONS (format: googledrive:1.0,googlesheets:1.0) and return provider keys */
function getProvidersFromIntegrationVersions(): string[] {
  const raw = process.env.AVAILABLE_INTEGRATION_VERSIONS
  if (!raw?.trim()) return []
  const providers: string[] = []
  for (const part of raw.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const sep = trimmed.includes(':') ? ':' : '='
    const i = trimmed.indexOf(sep)
    if (i === -1) continue
    const provider = trimmed.slice(0, i).trim().toLowerCase()
    if (provider) providers.push(provider)
  }
  return providers
}

/** Display names for providers that only appear in AVAILABLE_INTEGRATION_VERSIONS (no metadata from API) */
const FALLBACK_DISPLAY_NAMES: Record<string, string> = {
  googledrive: 'Google Drive',
  googledocs: 'Google Docs',
  googlesheets: 'Google Sheets',
  notion_documents: 'Notion',
}

/**
 * Load connector metadata from StackOne GET /actions (list all actions metadata),
 * plus any providers in AVAILABLE_INTEGRATION_VERSIONS so they appear under Connect New Account.
 * @see https://docs.stackone.com/platform/api-reference/actions/list-all-actions-metadata
 */
export async function loadConnectorMetadata(apiKey: string): Promise<ConnectorMetadata[]> {
  try {
    const fromIntegrations = getAvailableProviders()
    const fromIntegrationVersions = getProvidersFromIntegrationVersions()
    const allProviders = [...new Set([...fromIntegrations, ...fromIntegrationVersions])]

    if (allProviders.length === 0) {
      const fromDb = await query<ConnectorMetadata>(
        `SELECT id, provider, display_name, description, icon_url, is_available, created_at, updated_at
         FROM connector_metadata WHERE is_available = true`
      )
      return fromDb
    }

    const connectors = await listConnectorsFromActionsMetadata(apiKey, allProviders)
    const returnedKeys = new Set(connectors.map((c) => c.key).filter(Boolean))

    for (const c of connectors) {
      const provider = c.key ?? ''
      const displayName = c.name ?? provider
      const description = typeof c.description === 'string' ? c.description : null
      const iconUrl = typeof c.icon === 'string' ? c.icon : ''
      await query(
        `INSERT INTO connector_metadata (provider, display_name, description, icon_url, is_available, updated_at)
         VALUES ($1, $2, $3, $4, true, NOW())
         ON CONFLICT (provider) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           description = EXCLUDED.description,
           icon_url = EXCLUDED.icon_url,
           is_available = EXCLUDED.is_available,
           updated_at = NOW()`,
        [provider, displayName, description, iconUrl]
      )
    }

    for (const provider of allProviders) {
      if (returnedKeys.has(provider)) continue
      const displayName = FALLBACK_DISPLAY_NAMES[provider] ?? provider.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase())
      await query(
        `INSERT INTO connector_metadata (provider, display_name, description, icon_url, is_available, updated_at)
         VALUES ($1, $2, NULL, '', true, NOW())
         ON CONFLICT (provider) DO UPDATE SET
           display_name = COALESCE(NULLIF(connector_metadata.display_name, ''), EXCLUDED.display_name),
           is_available = true,
           updated_at = NOW()`,
        [provider, displayName]
      )
    }

    const fresh = await query<ConnectorMetadata>(
      `SELECT id, provider, display_name, description, icon_url, is_available, created_at, updated_at
       FROM connector_metadata WHERE is_available = true AND provider = ANY($1::text[])`,
      [allProviders]
    )
    if (fresh.length > 0) return fresh

    const fromApi = connectors.map((c) => ({
      id: c.key ?? '',
      provider: c.key ?? '',
      display_name: c.name ?? c.key ?? '',
      description: typeof c.description === 'string' ? c.description : undefined,
      icon_url: typeof c.icon === 'string' ? c.icon : '',
      is_available: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })) as ConnectorMetadata[]
    const fallbacks = allProviders
      .filter((p) => !returnedKeys.has(p))
      .map((p) => ({
        id: p,
        provider: p,
        display_name: FALLBACK_DISPLAY_NAMES[p] ?? p.replace(/_/g, ' ').replace(/\b\w/g, (ch) => ch.toUpperCase()),
        description: undefined,
        icon_url: '',
        is_available: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })) as ConnectorMetadata[]
    return [...fromApi, ...fallbacks]
  } catch (error) {
    logger.error('Error loading connector metadata:', error)
    return []
  }
}

import { createAdminClient } from '@/lib/supabase/server'
import { getConnectorMetaInformation } from '@/lib/stackone/api'
import type { ConnectorMetadata } from '@/types'
import type { SupabaseClient } from '@supabase/supabase-js'
import { logger } from '@/utils/logger'

// Get available providers from environment variable
const getAvailableProviders = (): string[] => {
  const envProviders = process.env.AVAILABLE_INTEGRATIONS
  if (!envProviders) {
    logger.warn('AVAILABLE_INTEGRATIONS not set, defaulting to googledrive')
    return ['googledrive']
  }
  return envProviders.split(',').map(provider => provider.trim().toLowerCase())
}

/**
 * Server-side function to load connector metadata from cache or fetch from StackOne API
 * @param supabase - Supabase client instance
 * @param apiKey - StackOne API key
 * @returns Promise<ConnectorMetadata[]> - Array of connector metadata
 */
export async function loadConnectorMetadata(supabase: SupabaseClient, apiKey: string): Promise<ConnectorMetadata[]> {
  try {
    const PROVIDERS = getAvailableProviders()
    
    // First try to get cached metadata
    const { data: cached, error: cacheError }: { data: ConnectorMetadata[], error: unknown } = await supabase
      .from('connector_metadata')
      .select('*')
      .eq('is_available', true)

    if (
      !cacheError
      && cached
      && cached.length > 0
      && PROVIDERS.every(provider => cached.some(c => c.provider === provider))
    ) {
      // Filter cached results to only return configured providers
      return cached.filter(metadata => PROVIDERS.includes(metadata.provider))
    }

    // If no cache, fetch from StackOne API
    const providers = await Promise.all(
      PROVIDERS.map(async (provider) => {
        const providerData = await getConnectorMetaInformation(apiKey, provider)
        return providerData
      })
    )
    
    // Filter out null results and cache the metadata
    const validProviders = providers.filter(provider => provider !== null)
    if (validProviders.length > 0) {
      const metadataToInsert = validProviders.map(provider => ({
        provider: provider!.provider,
        display_name: provider!.provider_name,
        category: provider!.category,
        icon_url: provider!.resources?.images?.logo_url || '',
        is_available: true
      }))

      // Use admin client for writing connector metadata
      const adminClient = createAdminClient()
      logger.log(await adminClient
        .from('connector_metadata')
        .upsert(metadataToInsert, { onConflict: 'provider' }))
    }

    return validProviders.map(provider => ({
      id: provider!.id,
      provider: provider!.provider,
      display_name: provider!.provider_name,
      category: provider!.category,
      icon_url: provider!.resources.images.logo_url,
      is_available: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }))
  } catch (error) {
    logger.error('Error loading connector metadata:', error)
    return []
  }
}

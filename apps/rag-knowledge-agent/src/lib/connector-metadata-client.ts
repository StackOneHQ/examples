import type { ConnectorMetadata } from '@/types'
import { logger } from '@/utils/logger'

/**
 * Client-side function to load connector metadata via API
 * @returns Promise<ConnectorMetadata[]> - Array of connector metadata
 */
export async function loadConnectorMetadataClient(): Promise<ConnectorMetadata[]> {
  try {
    const response = await fetch('/api/stackone/connectors')
    if (response.ok) {
      return await response.json()
    }
    throw new Error(`HTTP error! status: ${response.status}`)
  } catch (error) {
    logger.error('Error loading connector metadata from client:', error)
    return []
  }
}

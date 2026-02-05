import { StackOneAccountMeta, StackOneAccount, StackOneProvider } from '@/types'
import { logger } from '@/utils/logger'

const STACKONE_API_BASE = 'https://api.stackone.com'

export interface StackOneApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

function getStackOneHeaders(apiKey: string, includeContentType: boolean = true): HeadersInit {
  const headers: HeadersInit = {
    'Authorization': `Basic ${Buffer.from(apiKey + ':' + '').toString('base64')}`,
  }
  
  if (includeContentType) {
    headers['Content-Type'] = 'application/json'
  }
  
  return headers
}

export interface StackOneDocument {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  url?: string;
  created_at: string;
  updated_at: string;
}

export interface StackOneDocumentContent {
  content: string;
  metadata: {
    pages?: number;
    language?: string;
    [key: string]: unknown;
  };
}

export interface StackOneFileMetadata {
  id: string;
  name: string;
  mime_type: string;
  size: number;
  url?: string;
  created_at: string;
  updated_at: string;
  export_formats?: string[]; // Available export formats for the file
  /** Provider's native document ID (e.g. Google Docs document ID). Used for provider APIs like googledocs_update_document. */
  remote_id?: string;
}

// Function to determine export format based on available formats
// Checks if markdown is available, otherwise defaults to text/plain
function getExportFormat(mimeType: string, availableFormats?: string[]): string | null {
  // Check if this is a Google Workspace document
  const googleWorkspaceTypes = [
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.presentation',
    'application/vnd.google-apps.drawing',
    'application/vnd.google-apps.form',
    'application/vnd.google-apps.site',
    'application/vnd.google-apps.jam'
  ]

  if (!googleWorkspaceTypes.includes(mimeType)) {
    return null // Not a Google Workspace document
  }

  // If we have available formats, check for markdown
  if (availableFormats && availableFormats.length > 0) {
    if (availableFormats.includes('text/markdown') || availableFormats.includes('markdown')) {
      return 'text/markdown'
    }
  }

  // Default to text/plain for Google Workspace documents
  return 'text/plain'
}

export async function listUserAccounts(apiKey: string): Promise<StackOneAccount[]> {
  try {
    const response = await fetch(`${STACKONE_API_BASE}/accounts`, {
      headers: getStackOneHeaders(apiKey),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    return result || []
  } catch (error) {
    logger.error('Error fetching StackOne accounts:', error)
    return []
  }
}

export async function getAccountMetaInformation(apiKey: string, accountId: string): Promise<StackOneAccountMeta | null> {
  try {
    const response = await fetch(`${STACKONE_API_BASE}/accounts/${accountId}/meta`, {
      headers: getStackOneHeaders(apiKey),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    return result || null
  } catch (error) {
    logger.error('Error fetching StackOne account metadata:', error)
    return null
  }
}

/** Single connector entry from GET /actions (group_by=connector) */
export interface StackOneActionsMetaItem {
  key?: string
  name?: string
  icon?: string
  description?: string
  release_stage?: string
  [key: string]: unknown
}

/** Paginated response from GET /actions */
export interface StackOneActionsMetaPaginated {
  next?: string | null
  data?: StackOneActionsMetaItem[] | null
}

/**
 * List all actions metadata from StackOne (GET /actions).
 * Use filter[connectors]=a,b,c to restrict to specific connectors.
 * @see https://docs.stackone.com/platform/api-reference/actions/list-all-actions-metadata
 */
export async function listActionsMetadata(
  apiKey: string,
  options?: { connectors?: string[]; pageSize?: number; next?: string }
): Promise<StackOneActionsMetaPaginated> {
  const params = new URLSearchParams()
  params.set('group_by', 'connector')
  if (options?.pageSize != null) params.set('page_size', String(options.pageSize))
  if (options?.next) params.set('next', options.next)
  if (options?.connectors?.length) params.set('filter[connectors]', options.connectors.join(','))

  const url = `${STACKONE_API_BASE}/actions?${params.toString()}`
  logger.log(`Fetching actions metadata: ${url}`)

  const response = await fetch(url, { headers: getStackOneHeaders(apiKey) })
  if (!response.ok) {
    const errorText = await response.text()
    logger.error(`HTTP error! status: ${response.status} for GET /actions - ${errorText}`)
    return { data: [] }
  }

  const result = (await response.json()) as StackOneActionsMetaPaginated
  return result ?? { data: [] }
}

/**
 * Fetch all connector metadata by calling GET /actions and following next cursor.
 * Optionally filter to only connectors in the provided list.
 */
export async function listConnectorsFromActionsMetadata(
  apiKey: string,
  filterConnectors?: string[]
): Promise<StackOneActionsMetaItem[]> {
  const all: StackOneActionsMetaItem[] = []
  let next: string | undefined
  const connectors = filterConnectors?.map((c) => c.trim().toLowerCase()).filter(Boolean)

  do {
    const page = await listActionsMetadata(apiKey, {
      connectors: connectors?.length ? connectors : undefined,
      pageSize: 100,
      next,
    })
    const data = page.data ?? []
    for (const item of data) {
      if (item?.key) all.push(item)
    }
    next = page.next ?? undefined
  } while (next)

  return all
}

export async function getConnectorMetaInformation(apiKey: string, provider: string): Promise<StackOneProvider | null> {
  try {
    const list = await listConnectorsFromActionsMetadata(apiKey, [provider])
    const item = list.find((c) => c.key === provider.trim().toLowerCase())
    if (!item) {
      logger.warn(`Connector not found in actions metadata: ${provider}`)
      return null
    }
    return {
      id: (item as { key: string }).key,
      provider: (item as { key: string }).key,
      provider_name: item.name ?? item.key ?? provider,
      category: typeof item.description === 'string' ? item.description : '',
      resources: { images: { logo_url: item.icon ?? '' } },
    } as StackOneProvider
  } catch (error) {
    logger.error('Error fetching StackOne connector metadata:', error)
    return null
  }
}

export async function downloadFile(apiKey: string, fileId: string, accountId?: string): Promise<Blob> {
  try {
    // First, get file metadata to determine if we need to export to a different format
    const fileMetadata = await getFileMetadata(apiKey, fileId, accountId)
    
    if (!fileMetadata) {
      throw new Error(`Failed to get metadata for file ${fileId}`)
    }

    logger.log(`File metadata for ${fileId}:`, {
      name: fileMetadata.name,
      mime_type: fileMetadata.mime_type,
      size: fileMetadata.size
    })

    // Check if this is a Google Workspace document that needs export
    const exportFormat = getExportFormat(fileMetadata.mime_type, fileMetadata.export_formats)
    
    let url = `${STACKONE_API_BASE}/unified/documents/files/${fileId}/download`
    
    // If it's a Google Workspace document, add export format parameter
    if (exportFormat) {
      logger.log(`Google Workspace document detected (${fileMetadata.mime_type}), exporting to ${exportFormat}`)
      url += `?export_format=${encodeURIComponent(exportFormat)}`
    }
    
    logger.log(`Downloading file from URL: ${url}`)
    logger.log(`File ID: ${fileId}`)
    logger.log(`Account ID: ${accountId}`)
    
    // Prepare headers according to StackOne documentation
    const headers: HeadersInit = {
      'Authorization': `Basic ${Buffer.from(apiKey + ':' + '').toString('base64')}`,
    }
    
    // Add required x-account-id header if provided
    if (accountId) {
      headers['x-account-id'] = accountId
    }
    
    const response = await fetch(url, {
      headers,
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error(`File download failed for ${fileId}:`, {
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
        url,
        accountId: accountId,
        originalMimeType: fileMetadata.mime_type,
        exportFormat: exportFormat
      })
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`)
    }

    logger.log(`Successfully downloaded file from ${url}`)
    return await response.blob()
  } catch (error) {
    logger.error('Error downloading file:', error)
    throw error
  }
}

export async function getFileMetadata(apiKey: string, fileId: string, accountId?: string): Promise<StackOneFileMetadata | null> {
  try {
    const url = `${STACKONE_API_BASE}/unified/documents/files/${fileId}`
    logger.log(`Getting file metadata from URL: ${url}`)
    logger.log(`File ID: ${fileId}`)
    logger.log(`Account ID: ${accountId}`)
    
    // Prepare headers according to StackOne documentation
    const headers: HeadersInit = {
      'Authorization': `Basic ${Buffer.from(apiKey + ':' + '').toString('base64')}`,
      'Content-Type': 'application/json',
    }
    
    // Add required x-account-id header if provided
    if (accountId) {
      headers['x-account-id'] = accountId
    }
    
    const response = await fetch(url, {
      headers,
    })

    if (response.ok) {
      logger.log(`Successfully got file metadata from ${url}`)
      const responseData = await response.json()
      logger.log(`Raw response data:`, responseData)
      
      // Handle StackOne's response structure: { data: { ... } }
      let fileMetadata: StackOneFileMetadata | null = null
      
      if (responseData && typeof responseData === 'object' && responseData.data) {
        const rawData = responseData.data
        
        // Extract only the fields we need for the database (remote_id = provider's native document ID)
        fileMetadata = {
          id: rawData.id,
          name: rawData.name,
          mime_type: rawData.file_format?.source_value || 'application/octet-stream',
          size: rawData.size,
          url: rawData.url,
          created_at: rawData.created_at,
          updated_at: rawData.updated_at,
          remote_id: rawData.remote_id,
        }
      }
      
      if (fileMetadata) {
        logger.log(`Extracted file metadata:`, {
          id: fileMetadata.id,
          name: fileMetadata.name,
          mime_type: fileMetadata.mime_type,
          size: fileMetadata.size,
          url: fileMetadata.url,
          created_at: fileMetadata.created_at,
          updated_at: fileMetadata.updated_at
        })
        return fileMetadata
      } else {
        logger.warn(`Could not extract file metadata from response structure:`, responseData)
        return null
      }
    } else {
      const errorText = await response.text()
      logger.log(`Failed to get metadata from ${url}: ${response.status} - ${errorText}`)
      return null
    }
  } catch (error) {
    logger.error('Error getting file metadata:', error)
    return null
  }
}

export async function getDocumentContent(apiKey: string, fileId: string, accountId?: string): Promise<StackOneDocumentContent | null> {
  try {
    // Try to get document content using the correct StackOne API
    const url = `${STACKONE_API_BASE}/unified/documents/files/${fileId}`
    logger.log(`Trying to get document content from URL: ${url}`)
    logger.log(`File ID: ${fileId}`)
    logger.log(`Account ID: ${accountId}`)
    
    // Prepare headers according to StackOne documentation
    const headers: HeadersInit = {
      'Authorization': `Basic ${Buffer.from(apiKey + ':' + '').toString('base64')}`,
      'Content-Type': 'application/json',
    }
    
    // Add required x-account-id header if provided
    if (accountId) {
      headers['x-account-id'] = accountId
    }
    
    const response = await fetch(url, {
      headers,
    })

    if (response.ok) {
      logger.log(`Successfully got document content from ${url}`)
      return await response.json()
    } else {
      const errorText = await response.text()
      logger.log(`Failed to get content from ${url}: ${response.status} - ${errorText}`)
      return null
    }
  } catch (error) {
    logger.error('Error getting document content:', error)
    return null
  }
}

export async function createSessionToken(
  apiKey: string, 
  originOwnerId: string, 
  originOwnerName: string,
  provider?: string,
  accountId?: string,
  multiple: boolean = false
): Promise<{ token: string }> {
  try {
    const payload = {
      expires_in: 1800, // 30 minutes
      multiple: multiple,
      origin_owner_id: originOwnerId,
      origin_owner_name: originOwnerName,
      provider: provider || undefined,
      account_id: accountId || undefined,
    }

    const response = await fetch(`${STACKONE_API_BASE}/connect_sessions`, {
      method: 'POST',
      headers: getStackOneHeaders(apiKey),
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    return result
  } catch (error) {
    logger.error('Error creating session token:', error)
    throw error
  }
}

export async function deleteAccount(apiKey: string, accountId: string): Promise<StackOneAccount> {
  try {
    const response = await fetch(`${STACKONE_API_BASE}/accounts/${accountId}`, {
      method: 'DELETE',
      headers: getStackOneHeaders(apiKey),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()
    return result
  } catch (error) {
    logger.error('Error deleting StackOne account:', error)
    throw error
  }
}

export interface User {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface Integration {
  id: string;
  user_id: string;
  provider: string;
  stackone_account_id: string;
  account_name: string;
  account_email?: string;
  status: 'active' | 'inactive' | 'error';
  created_at: string;
  updated_at: string;
}

export interface ConnectorMetadata {
  id: string;
  provider: string;
  display_name: string;
  description?: string;
  icon_url: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  integration_id: string;
  user_id: string;
  stackone_document_id: string;
  /** Provider's native document ID (e.g. Google Docs document ID). Used when calling provider APIs like googledocs_update_document. */
  remote_document_id?: string | null;
  name: string;
  mime_type: string;
  size: number;
  url?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  created_at: string;
  updated_at: string;
}

export interface DocumentChunk {
  id: string;
  document_id: string;
  user_id: string;
  content: string;
  chunk_index: number;
  embedding?: number[];
  metadata: {
    document_name: string;
    source_url?: string;
    mime_type?: string;
    /** Provider's native document ID (e.g. Google Docs document ID). Use for provider APIs like googledocs_update_document. */
    remote_document_id?: string;
    size?: number;
    pages?: number;
    language?: string;
    [key: string]: unknown;
  };
  created_at: string;
}

export interface Agent {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  integration_ids: string[];
  status: 'active' | 'inactive' | 'processing';
  created_at: string;
  updated_at: string;
}

export interface AgentIntegration {
  id: string;
  agent_id: string;
  integration_id: string;
  file_ids: string[]; // StackOne file IDs for this integration
  created_at: string;
}

export interface Thread {
  id: string;
  agent_id: string;
  user_id: string;
  title: string;
  status: 'active' | 'archived';
  message_count: number;
  last_message_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  agent_id: string;
  thread_id?: string;
  user_id: string;
  role: 'user' | 'assistant';
  content: string;
  metadata?: {
    sources?: unknown[];
    confidence?: number;
    [key: string]: unknown;
  };
  created_at: string;
}

export interface StackOneAccountMeta {
  provider: string;
  category: string;
  models: Record<string, unknown>;
}

export interface StackOneAccount {
  id: string;
  provider: string;
  name: string;
  email?: string;
  status: string;
  created_at: string;
}

export interface StackOneProvider {
  id: string;
  provider: string;
  provider_name: string;
  category: string;
  resources: {
    images: {
      logo_url: string;
    }
  };
}

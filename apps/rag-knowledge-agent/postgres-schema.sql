-- Postgres schema for local (Docker) and production (e.g. Vercel/Neon).
-- Run after: CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS "vector";

-- Enable extensions (run first if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Users table (for Auth.js / credentials; replaces auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    name TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

-- Integrations
CREATE TABLE IF NOT EXISTS public.integrations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    stackone_account_id TEXT NOT NULL UNIQUE,
    account_name TEXT NOT NULL,
    account_email TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Connector metadata cache
CREATE TABLE IF NOT EXISTS public.connector_metadata (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    provider TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    description TEXT,
    icon_url TEXT,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    stackone_document_id TEXT NOT NULL,
    remote_document_id TEXT,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size BIGINT NOT NULL,
    url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
    content_hash TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(integration_id, stackone_document_id)
);

-- For existing databases, run: ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS remote_document_id TEXT;

-- Document chunks with vector embeddings
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    embedding vector(1536),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agents
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    integration_ids UUID[] NOT NULL DEFAULT '{}',
    document_ids UUID[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'processing')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent integrations junction
CREATE TABLE IF NOT EXISTS public.agent_integrations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES public.integrations(id) ON DELETE CASCADE,
    file_ids TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(agent_id, integration_id)
);

-- Agent documents junction (for document_ids per agent)
CREATE TABLE IF NOT EXISTS public.agent_documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(agent_id, document_id)
);

-- Threads
CREATE TABLE IF NOT EXISTS public.threads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES public.threads(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_integrations_user_id ON public.integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON public.integrations(provider);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON public.integrations(status);
CREATE INDEX IF NOT EXISTS idx_integrations_stackone_account_id ON public.integrations(stackone_account_id);
CREATE INDEX IF NOT EXISTS idx_connector_metadata_provider ON public.connector_metadata(provider);
CREATE INDEX IF NOT EXISTS idx_connector_metadata_is_available ON public.connector_metadata(is_available);
CREATE INDEX IF NOT EXISTS idx_documents_integration_id ON public.documents(integration_id);
CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_stackone_id ON public.documents(stackone_document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON public.document_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_user_id ON public.document_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_chunk_index ON public.document_chunks(chunk_index);
CREATE INDEX IF NOT EXISTS idx_agents_user_id ON public.agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_integration_ids ON public.agents USING GIN(integration_ids);
CREATE INDEX IF NOT EXISTS idx_agents_document_ids ON public.agents USING GIN(document_ids);
CREATE INDEX IF NOT EXISTS idx_agents_status ON public.agents(status);
CREATE INDEX IF NOT EXISTS idx_agent_integrations_agent_id ON public.agent_integrations(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_integrations_integration_id ON public.agent_integrations(integration_id);
CREATE INDEX IF NOT EXISTS idx_agent_documents_agent_id ON public.agent_documents(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_documents_document_id ON public.agent_documents(document_id);
CREATE INDEX IF NOT EXISTS idx_threads_agent_id ON public.threads(agent_id);
CREATE INDEX IF NOT EXISTS idx_threads_user_id ON public.threads(user_id);
CREATE INDEX IF NOT EXISTS idx_threads_status ON public.threads(status);
CREATE INDEX IF NOT EXISTS idx_threads_created_at ON public.threads(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_agent_id ON public.chat_messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON public.chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);

-- Timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON public.integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_connector_metadata_updated_at BEFORE UPDATE ON public.connector_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON public.agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Thread stats trigger
CREATE OR REPLACE FUNCTION update_thread_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.threads SET message_count = message_count + 1, last_message_at = NEW.created_at, updated_at = NOW() WHERE id = NEW.thread_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.threads SET message_count = GREATEST(message_count - 1, 0), updated_at = NOW() WHERE id = OLD.thread_id;
    UPDATE public.threads SET last_message_at = (SELECT MAX(created_at) FROM public.chat_messages WHERE thread_id = OLD.thread_id) WHERE id = OLD.thread_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_thread_stats_trigger AFTER INSERT OR DELETE ON public.chat_messages
    FOR EACH ROW EXECUTE FUNCTION update_thread_stats();

-- Vector similarity search (returns chunks with document name and similarity score)
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  document_ids uuid[]
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  user_id uuid,
  content text,
  chunk_index int,
  embedding vector(1536),
  metadata jsonb,
  created_at timestamptz,
  document_name text,
  remote_document_id text,
  document_mime_type text,
  document_url text,
  similarity float
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    dc.id,
    dc.document_id,
    dc.user_id,
    dc.content,
    dc.chunk_index,
    dc.embedding,
    dc.metadata,
    dc.created_at,
    d.name AS document_name,
    d.remote_document_id,
    d.mime_type AS document_mime_type,
    d.url AS document_url,
    (1 - (dc.embedding <#> query_embedding))::float AS similarity
  FROM public.document_chunks dc
  INNER JOIN public.documents d ON dc.document_id = d.id
  WHERE dc.embedding <#> query_embedding < 1 - match_threshold
    AND dc.document_id = ANY(document_ids)
  ORDER BY dc.embedding <#> query_embedding ASC
  LIMIT LEAST(match_count, 200);
$$;

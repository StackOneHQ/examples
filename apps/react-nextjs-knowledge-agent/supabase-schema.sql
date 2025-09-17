-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";

-- Create tables
CREATE TABLE IF NOT EXISTS public.integrations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    stackone_account_id TEXT NOT NULL UNIQUE,
    account_name TEXT NOT NULL,
    account_email TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Connector metadata cache table
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

-- Documents table for StackOne unified documents
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    integration_id UUID REFERENCES public.integrations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stackone_document_id TEXT NOT NULL,
    name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size BIGINT NOT NULL,
    url TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(integration_id, stackone_document_id)
);

-- Document chunks with vector embeddings
CREATE TABLE IF NOT EXISTS public.document_chunks (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    embedding vector(1536), -- Azure OpenAI text-embedding-ada-002 dimension
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agents (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    integration_ids UUID[] NOT NULL DEFAULT '{}',
    document_ids UUID[] NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'processing')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Agent integrations junction table for better relationship management
CREATE TABLE IF NOT EXISTS public.agent_integrations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    integration_id UUID REFERENCES public.integrations(id) ON DELETE CASCADE,
    file_ids TEXT[] NOT NULL DEFAULT '{}', -- StackOne file IDs for this integration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(agent_id, integration_id)
);

CREATE TABLE IF NOT EXISTS public.threads (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
    message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES public.threads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}', -- Store additional message metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
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

-- Vector similarity search index
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON public.document_chunks 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON public.document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_user_id ON public.document_chunks(user_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_chunk_index ON public.document_chunks(chunk_index);

CREATE INDEX IF NOT EXISTS idx_agents_user_id ON public.agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_integration_ids ON public.agents USING GIN(integration_ids);
CREATE INDEX IF NOT EXISTS idx_agents_document_ids ON public.agents USING GIN(document_ids);
CREATE INDEX IF NOT EXISTS idx_agents_status ON public.agents(status);

CREATE INDEX IF NOT EXISTS idx_agent_integrations_agent_id ON public.agent_integrations(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_integrations_integration_id ON public.agent_integrations(integration_id);

CREATE INDEX IF NOT EXISTS idx_threads_agent_id ON public.threads(agent_id);
CREATE INDEX IF NOT EXISTS idx_threads_user_id ON public.threads(user_id);
CREATE INDEX IF NOT EXISTS idx_threads_status ON public.threads(status);
CREATE INDEX IF NOT EXISTS idx_threads_created_at ON public.threads(created_at);

CREATE INDEX IF NOT EXISTS idx_chat_messages_agent_id ON public.chat_messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON public.chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON public.chat_messages(created_at);

-- Create RLS (Row Level Security) policies
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- Integrations policies
CREATE POLICY "Users can view their own integrations" ON public.integrations
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own integrations" ON public.integrations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own integrations" ON public.integrations
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own integrations" ON public.integrations
    FOR DELETE USING (auth.uid() = user_id);

-- Connector metadata policies (public read access, service role write access)
CREATE POLICY "Anyone can view connector metadata" ON public.connector_metadata
    FOR SELECT USING (true);

-- Allow service role to insert/update connector metadata (for API operations)
CREATE POLICY "Service role can insert connector metadata" ON public.connector_metadata
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Service role can update connector metadata" ON public.connector_metadata
    FOR UPDATE USING (auth.role() = 'service_role');

-- Documents policies
CREATE POLICY "Users can view their own documents" ON public.documents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own documents" ON public.documents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own documents" ON public.documents
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own documents" ON public.documents
    FOR DELETE USING (auth.uid() = user_id);

-- Document chunks policies
CREATE POLICY "Users can view their own document chunks" ON public.document_chunks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own document chunks" ON public.document_chunks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own document chunks" ON public.document_chunks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own document chunks" ON public.document_chunks
    FOR DELETE USING (auth.uid() = user_id);

-- Agents policies
CREATE POLICY "Users can view their own agents" ON public.agents
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own agents" ON public.agents
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own agents" ON public.agents
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own agents" ON public.agents
    FOR DELETE USING (auth.uid() = user_id);

-- Agent integrations policies
CREATE POLICY "Users can view agent integrations for their agents" ON public.agent_integrations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.agents 
            WHERE id = agent_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert agent integrations for their agents" ON public.agent_integrations
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.agents 
            WHERE id = agent_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update agent integrations for their agents" ON public.agent_integrations
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.agents 
            WHERE id = agent_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete agent integrations for their agents" ON public.agent_integrations
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.agents 
            WHERE id = agent_id AND user_id = auth.uid()
        )
    );

-- Threads policies
CREATE POLICY "Users can view their own threads" ON public.threads
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own threads" ON public.threads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own threads" ON public.threads
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own threads" ON public.threads
    FOR DELETE USING (auth.uid() = user_id);

-- Chat messages policies
CREATE POLICY "Users can view messages from their agents" ON public.chat_messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.agents 
            WHERE id = agent_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert messages to their agents" ON public.chat_messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.agents 
            WHERE id = agent_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete messages from their agents" ON public.chat_messages
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.agents 
            WHERE id = agent_id AND user_id = auth.uid()
        )
    );

-- Create functions for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updating timestamps
CREATE TRIGGER update_integrations_updated_at BEFORE UPDATE ON public.integrations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_connector_metadata_updated_at BEFORE UPDATE ON public.connector_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON public.agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update thread statistics when messages are added/removed
CREATE OR REPLACE FUNCTION update_thread_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Update thread with new message count and last message time
    UPDATE public.threads 
    SET 
      message_count = message_count + 1,
      last_message_at = NEW.created_at,
      updated_at = NOW()
    WHERE id = NEW.thread_id;
    
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    -- Update thread with reduced message count
    UPDATE public.threads 
    SET 
      message_count = GREATEST(message_count - 1, 0),
      updated_at = NOW()
    WHERE id = OLD.thread_id;
    
    -- Update last_message_at to the most recent message in the thread
    UPDATE public.threads 
    SET last_message_at = (
      SELECT MAX(created_at) 
      FROM public.chat_messages 
      WHERE thread_id = OLD.thread_id
    )
    WHERE id = OLD.thread_id;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update thread stats
CREATE TRIGGER update_thread_stats_trigger
  AFTER INSERT OR DELETE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION update_thread_stats();

-- Function to search documents by similarity
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  document_ids uuid[]
)
RETURNS setof public.document_chunks
LANGUAGE sql
AS $$
  select *
  from document_chunks
  inner join documents on document_chunks.document_id = documents.id
  where document_chunks.embedding <#> query_embedding < 1 - match_threshold
  and document_chunks.document_id = any(document_ids)
  order by document_chunks.embedding <#> query_embedding asc
  limit least(match_count, 200);
$$;

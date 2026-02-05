# StackOne Context-Aware Agent Playground

A Next.js application that demonstrates how to build AI-powered document chat using [StackOne's Documents API](https://docs.stackone.com/docs/documents-api). This demo shows how to connect multiple cloud storage providers, process documents, and create intelligent AI agents that can answer questions from your documents.

## 📋 Table of Contents

- [🚀 Quick Start](#-quick-start)
- [🎯 Why We Built This](#-why-we-built-this)
- [🏗️ How We Built This](#️-how-we-built-this)
- [🔧 Realtime Agent Actions & Webhooks](#-realtime-agent-actions--webhooks)
- [📱 Screenshots](#-screenshots)

## 🚀 Quick Start

### **Prerequisites**
- Node.js 18+ and npm
- [StackOne account](https://stackone.com) with Documents API access
- PostgreSQL with pgvector extension (e.g. local Docker, or Vercel Postgres / Supabase / RDS)
- [OpenAI API key](https://platform.openai.com/api-keys)

### **Setup**

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd rag-knowledge-agent
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp env.example .env.local
   ```
   
   Configure your `.env.local` (see `env.example` for full list):
   ```bash
   # Database (PostgreSQL with pgvector)
   DATABASE_URL=postgres://postgres:postgres@localhost:5433/rag_agent
   
   # OpenAI
   OPENAI_API_KEY=your_openai_api_key
   OPENAI_CHAT_MODEL=gpt-4o
   OPENAI_EMBEDDING_MODEL=text-embedding-3-small
   OPENAI_EMBEDDING_DIMENSIONS=1536
   # Optional: Use a cheaper model for classification
   # OPENAI_CLASSIFIER_MODEL=gpt-3.5-turbo
   
   # StackOne
   STACKONE_API_KEY=your_stackone_api_key
   
   # NextAuth (for login)
   NEXTAUTH_SECRET=your_secret
   NEXTAUTH_URL=http://localhost:3000
   ```

3. **Database Setup**
   - Run PostgreSQL with pgvector (e.g. `docker-compose up -d` using the project's `docker-compose.yml`, which maps Postgres to port 5433)
   - Run the SQL schema from `postgres-schema.sql` against your database

4. **Run the Application**
   ```bash
   npm run dev
   ```
   
   Visit [http://localhost:3000](http://localhost:3000)

### **User Workflow**

1. **Sign In**: Authenticate with Google OAuth
2. **Connect Storage**: Use StackOne Hub to connect Google Drive, Dropbox, OneDrive, or Notion
3. **Create Agent**: Create an AI agent and select which documents it can access
4. **Chat**: Ask questions about your documents and get AI-powered answers with source citations

## 🎯 Why We Built This

This demo showcases the key capabilities of StackOne's platform for building AI-powered document applications:

### **The Problem**
- Documents are scattered across multiple cloud storage providers (Google Drive, Dropbox, OneDrive, Notion)
- Each provider has different APIs, authentication flows, and file formats
- Building document AI applications requires complex integrations and processing pipelines

### **The Solution**
StackOne provides a unified platform that simplifies:
- **Multi-Provider OAuth**: Connect to multiple cloud storage providers with one integration
- **Unified Document API**: Access documents from any provider with consistent APIs
- **File Picker Component**: Let users select files across providers with a single interface
- **Document Processing**: Automatic text extraction and processing from various file formats

### **What This Demo Shows**
- How to build AI agents that can answer questions from documents across multiple cloud providers
- How to create a seamless user experience for connecting and managing cloud storage
- How to process documents at scale for RAG (Retrieval-Augmented Generation) applications
- How to build production-ready document AI applications with proper security and data isolation

## 🏗️ How We Built This

### **System Architecture**

```mermaid
graph TB
    subgraph "👤 User Interface"
        U[User]
        UI[Next.js Frontend]
    end
    
    subgraph "🔗 StackOne Platform"
        HUB[StackOne Hub<br/>OAuth Management]
        PICKER[StackOne File Picker<br/>File Selection]
        API[StackOne Documents API<br/>Document Processing]
    end
    
    subgraph "☁️ Cloud Storage Providers"
        GD[Google Drive]
        OD[OneDrive]
        NT[Notion]
    end
    
    subgraph "🗄️ Data Layer"
        PG[PostgreSQL]
        VEC[Vector Storage<br/>pgvector]
    end
    
    subgraph "🤖 AI Services"
        OPENAI[OpenAI]
        EMB[Text Embeddings]
        LLM[Chat Completions]
    end
    
    %% User interactions
    U --> UI
    UI --> HUB
    UI --> PICKER
    UI --> API
    
    %% StackOne integrations
    HUB --> GD
    HUB --> OD
    HUB --> NT
    
    PICKER --> GD
    PICKER --> OD
    PICKER --> NT
    
    API --> GD
    API --> OD
    API --> NT
    
    %% Data flow
    API --> PG
    PG --> VEC
    UI --> PG
    
    %% AI processing
    UI --> OPENAI
    OPENAI --> EMB
    OPENAI --> LLM
    EMB --> VEC
    
    %% Styling
    classDef stackone fill:#ff6b6b,stroke:#d63031,stroke-width:3px,color:#fff
    classDef cloud fill:#74b9ff,stroke:#0984e3,stroke-width:2px,color:#fff
    classDef database fill:#00b894,stroke:#00a085,stroke-width:2px,color:#fff
    classDef ai fill:#fdcb6e,stroke:#e17055,stroke-width:2px,color:#000
    classDef user fill:#a29bfe,stroke:#6c5ce7,stroke-width:2px,color:#fff
    
    class HUB,PICKER,API stackone
    class GD,OD,NT cloud
    class PG,VEC database
    class OPENAI,EMB,LLM ai
    class U,UI user
```

### **Component Interactions**

1. **Authentication Flow**: User → StackOne Hub → Cloud Provider OAuth
2. **File Selection**: User → StackOne File Picker → Browse Cloud Storage
3. **Document Processing**: StackOne API → Fetch Documents → PostgreSQL
4. **AI Pipeline**: Documents → Text Extraction → Chunking → Embeddings → Vector Storage
5. **Chat Flow**: User Query → Vector Search → Context Retrieval → AI Response

### **Key Components**

1. **StackOne Integration**
   - **StackOne Hub**: Embedded OAuth flows for connecting cloud storage accounts
   - **StackOne File Picker**: React component for selecting files across providers
   - **StackOne Documents API**: Unified API for accessing documents from any provider

2. **AI Processing Pipeline**
   - **Document Ingestion**: Fetch documents from connected cloud storage
   - **Text Extraction**: Extract content from PDFs, Word docs, Google Docs, etc.
   - **Chunking**: Split documents into optimal chunks for RAG
   - **Embeddings**: Generate vector embeddings using OpenAI
   - **Storage**: Store embeddings in PostgreSQL with pgvector

3. **Chat Interface**
   - **RAG Query**: Vector similarity search to find relevant document chunks
   - **AI Response**: Generate contextual answers using OpenAI
   - **Source Citations**: Show which documents informed the response

### **Technology Stack**
- **Frontend**: Next.js 15, React 18, TypeScript
- **Database**: PostgreSQL + pgvector (e.g. Docker, Vercel Postgres, or any Postgres host)
- **AI**: OpenAI (configurable models for chat, embeddings, and classification)
- **Document Processing**: StackOne Documents API
- **UI**: Ant Design + custom components

### **Architecture Benefits**

This architecture provides several key advantages for building document AI applications:

#### **🔗 Unified Integration**
- **Single API**: Access documents from multiple cloud providers through one interface
- **Consistent Experience**: Same authentication and file selection flow across all providers
- **Reduced Complexity**: No need to implement provider-specific OAuth flows or APIs

#### **⚡ Scalable Processing**
- **Vector Search**: Efficient similarity search using pgvector for large document collections
- **Chunking Strategy**: Optimized document splitting for better RAG performance
- **Real-time Updates**: Webhook integration keeps documents synchronized

#### **🛡️ Production Ready**
- **Multi-tenant Security**: Row-level security ensures data isolation between users
- **Error Handling**: Comprehensive error management and retry logic
- **Monitoring**: Built-in logging and performance tracking

### **Cloud Stack Flexibility**

This architecture is designed to work with different cloud providers and deployment strategies:

#### **AWS Stack**
```
StackOne + AWS Bedrock + RDS PostgreSQL + Lambda + S3
```
- Replace Azure OpenAI with AWS Bedrock for AI services
- Use RDS with pgvector extension for vector storage
- Deploy on Lambda for serverless scaling

#### **Google Cloud Stack**
```
StackOne + Vertex AI + Cloud SQL + Cloud Functions + Cloud Storage
```
- Use Vertex AI for embeddings and chat completions
- Cloud SQL with pgvector for database needs
- Cloud Functions for serverless deployment

#### **OpenAI Stack**
```
StackOne + OpenAI + PostgreSQL + Serverless Functions + Object Storage
```
- Current implementation uses OpenAI directly
- PostgreSQL with pgvector for vector storage
- Serverless functions for compute (Vercel, AWS Lambda, etc.)

#### **Custom/On-Premises Stack**
```
StackOne + Local LLM + Self-hosted PostgreSQL + Docker + MinIO
```
- Use Ollama or other local LLM solutions
- Self-hosted PostgreSQL with pgvector
- Containerized deployment with Docker
- MinIO for S3-compatible object storage

#### **Hybrid Approaches**
- **Multi-Cloud**: Mix providers for different services (e.g., AWS for compute, Azure for AI)
- **Edge Deployment**: Deploy closer to users with edge computing platforms
- **Compliance Focused**: On-premises AI with cloud document storage for regulated industries

## 🔧 Realtime Agent Actions & Webhooks

### Realtime file actions (StackOne utility tools)

The chat agent can perform **realtime file actions** (list files, search, etc.) using [StackOne's TypeScript SDK utility tools](https://docs.stackone.com/agents/typescript). When the user has at least one connected integration, the app:

1. Uses `tool_search` with the user's message to find relevant file/document tools.
2. If a tool matches (e.g. "list my drive files"), runs it via `tool_execute`.
3. Injects the result into the RAG context and streams an "Action result" line before the main answer.

Requires `@stackone/ai` and `STACKONE_API_KEY`. The agent uses the first linked integration's StackOne account ID for tool execution.

### File change events (StackOne webhooks)

[StackOne webhooks](https://docs.stackone.com/guides/webhooks) are supported so file **updates** and **deletes** are reflected in the app:

- **`documents_files.updated`**: The document is marked for re-processing (`status: pending`) and its existing chunks are cleared so it can be re-ingested (e.g. on next agent process run).
- **`documents_files.deleted`**: The document and its chunks are removed from the database, and any `agent_documents` links are cleaned up.

**Setup:**

1. In [StackOne Webhooks](https://app.stackone.com/webhooks), add a webhook and set the URL to your app (e.g. `https://your-ngrok-url.ngrok.io/api/stackone/webhook` for local dev).
2. Subscribe to **Documents > Files**: `documents_files.updated`, `documents_files.deleted` (and any account events you need). The app does not handle `documents_files.created`—users select which files to sync via the file picker.
3. Copy the **Signing secret** and set `STACKONE_WEBHOOK_SECRET` in `.env.local` so the app can verify `x-stackone-signature`.

For local development, use [ngrok](https://ngrok.com) (e.g. `ngrok http 3000`) and use the ngrok URL as the webhook URL in StackOne.

## 📱 Screenshots

### Login Page
![Login Page](docs/screenshots/login-page.png)
*Clean authentication interface with Google OAuth integration*

### Dashboard Overview
![Dashboard Screenshot](docs/screenshots/dashboard-overview.png)
*Overview of your knowledge agents, integrations, and recent conversations*

### Integration Management
![Integrations Screenshot](docs/screenshots/integrations-page.png)
*Connect and manage your cloud storage accounts through StackOne Hub*

### StackOne Hub OAuth Flow
![StackOne Hub OAuth Flow](docs/screenshots/stackone-hub-oauth-flow.png)
*Secure OAuth flow for connecting cloud storage providers*

### Agent Creation with File Picker
![Agent Creation Screenshot](docs/screenshots/agent-creation-page.png)
*Create specialized AI agents with access to specific document sets*

### StackOne File Picker
![StackOne File Picker](docs/screenshots/stackone-file-picker.png)
*File picker interface showing Google Drive files and folders*

### Chat Interface
![Chat Interface with Message](docs/screenshots/chat-page.png)
*Realtime chat powered by document RAG architecture*

## 📚 Additional Resources

- [StackOne Documentation](https://docs.stackone.com/)
- [pgvector](https://github.com/pgvector/pgvector) for vector search in PostgreSQL
- [OpenAI Platform](https://platform.openai.com/)
- [Next.js Documentation](https://nextjs.org/docs)

---

**Built with ❤️ using [StackOne](https://stackone.com) - The unified API for cloud storage integrations.**
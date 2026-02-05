import { OpenAI, OpenAIEmbedding } from '@llamaindex/openai';

// OpenAI Configuration
export const openAIConfig = {
  // API Key (required)
  apiKey: process.env.OPENAI_API_KEY!,
  
  // Model configurations
  // Main model for chat responses (e.g., gpt-4, gpt-4-turbo, gpt-4o)
  chatModel: process.env.OPENAI_CHAT_MODEL || 'gpt-4o',
  
  // Model for embeddings (e.g., text-embedding-3-small, text-embedding-3-large, text-embedding-ada-002)
  embeddingModel: process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small',
  
  // Optional: lighter model for classification/decision-making (e.g., gpt-3.5-turbo, gpt-4o-mini)
  // If not set, falls back to the chat model
  classifierModel: process.env.OPENAI_CLASSIFIER_MODEL,
  
  // Embedding dimensions (must match database schema)
  embeddingDimensions: parseInt(process.env.OPENAI_EMBEDDING_DIMENSIONS || '1536', 10),
}

// Initialize OpenAI LLM (main model for chat responses)
export function createAzureOpenAILLM() {
  const llm = new OpenAI({
    apiKey: openAIConfig.apiKey,
    model: openAIConfig.chatModel,
  });

  return llm;
}

// Initialize lightweight classifier LLM (for decision-making, cheaper/faster)
// Falls back to chat model if classifier model is not configured
export function createAzureOpenAIClassifierLLM() {
  const model = openAIConfig.classifierModel || openAIConfig.chatModel;
  
  const llm = new OpenAI({
    apiKey: openAIConfig.apiKey,
    model: model,
  });

  return llm;
}

// Initialize OpenAI Embeddings
export function createAzureOpenAIEmbeddings() {
  const embeddings = new OpenAIEmbedding({
    apiKey: openAIConfig.apiKey,
    model: openAIConfig.embeddingModel,
    dimensions: openAIConfig.embeddingDimensions,
  });

  return embeddings;
}

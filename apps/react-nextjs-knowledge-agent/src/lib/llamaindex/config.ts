import { AzureOpenAI, AzureOpenAIEmbedding } from '@llamaindex/azure';

// Azure OpenAI Configuration
export const azureOpenAIConfig = {
  llmDeploymentName: process.env.AZURE_LLM_DEPLOYMENT!,
  llmVersion: process.env.AZURE_LLM_VERSION!,
  embeddingDeploymentName: process.env.AZURE_EMBEDDING_DEPLOYMENT!,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
}

// Initialize Azure OpenAI LLM
export function createAzureOpenAILLM() {
  
  const llm = new AzureOpenAI({
    deployment: azureOpenAIConfig.llmDeploymentName,
    model: azureOpenAIConfig.llmDeploymentName,
    apiVersion: azureOpenAIConfig.llmVersion
  });

  return llm;
}

// Initialize Azure OpenAI Embeddings
export function createAzureOpenAIEmbeddings() {
  
  const embeddings = new AzureOpenAIEmbedding({
    deployment: azureOpenAIConfig.embeddingDeploymentName,
    model: azureOpenAIConfig.embeddingDeploymentName,
    dimensions: 1536 // Force 1536 dimensions to match database schema
  });

  return embeddings;
};

import { NextResponse } from 'next/server'
import { RAGService } from '@/lib/llamaindex/rag-service'
import { requireUser } from '@/lib/auth-server'

// Signed-in only: each call spends an embeddings request on the app's OpenAI key.
export async function GET() {
  try {
    await requireUser()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Server is running',
    services: {
      azureOpenAI: {
        status: 'unknown',
        error: null
      }
    }
  }

  // Test Azure OpenAI configuration
  try {
    const ragService = new RAGService()
    // Test with a simple embeddings call
    const isHealthy = await ragService.testEmbeddings()
    health.services.azureOpenAI.status = isHealthy ? 'healthy' : 'unhealthy'
  } catch (error) {
    health.services.azureOpenAI.status = 'unhealthy'
    health.services.azureOpenAI.error = error instanceof Error ? error.message : 'Unknown error'
  }

  const overallStatus = health.services.azureOpenAI.status === 'healthy' ? 'ok' : 'degraded'
  
  return NextResponse.json(health, { 
    status: overallStatus === 'ok' ? 200 : 503 
  })
}

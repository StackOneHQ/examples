'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { 
  Card, 
  Typography, 
  Button, 
  Input, 
  Space,
  App
} from 'antd'
import { 
  ArrowLeftOutlined,
  RobotOutlined,
  SaveOutlined,
  FileTextOutlined,
  LinkOutlined,
  SettingOutlined
} from '@ant-design/icons'
import { createClient } from '@/lib/supabase/client'
import { StackOneFilePicker } from '@/components/StackOneFilePicker'
import { IntegrationsList } from '@/components/IntegrationsList'
import { loadConnectorMetadataClient } from '@/lib/connector-metadata-client'
import type { Agent, Integration, ConnectorMetadata } from '@/types'
import { logger } from '@/utils/logger'

const { Title, Text } = Typography
const { TextArea } = Input

export default function EditAgentPage() {
  const { message } = App.useApp()
  const [agent, setAgent] = useState<Agent | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([])
  const [agentIntegrations, setAgentIntegrations] = useState<Record<string, Array<{id: string, name: string}>>>({})
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [connectorMetadata, setConnectorMetadata] = useState<ConnectorMetadata[]>([])
  const [currentIntegrationId, setCurrentIntegrationId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [documentCount, setDocumentCount] = useState(0)
  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const agentId = params.id as string

  useEffect(() => {
    if (agentId) {
      loadData()
    }
  }, [agentId])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load agent data
      const { data: agentData, error: agentError } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single()

      if (agentError) throw agentError

      if (!agentData) {
        setError('Agent not found')
        return
      }

      setAgent(agentData)
      setName(agentData.name || '')
      setDescription(agentData.description || '')
      setSelectedIntegrations(agentData.integration_ids || [])

      // Load integrations and connector metadata
      const [integrationsData, metadata] = await Promise.all([
        supabase.from('integrations').select('*').eq('status', 'active'),
        loadConnectorMetadataClient()
      ])

      if (integrationsData.error) throw integrationsData.error

      setIntegrations(integrationsData.data || [])
      setConnectorMetadata(metadata)

      // Load existing agent integrations and files
      await loadAgentIntegrations(agentData.integration_ids || [])

      // Load document count
      await loadDocumentCount()

    } catch (err) {
      setError('Failed to load agent data')
      logger.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadDocumentCount = async () => {
    try {
      const { count, error } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', agent?.user_id)
        .in('integration_id', selectedIntegrations)

      if (!error) {
        setDocumentCount(count || 0)
      }
    } catch (err) {
      logger.error('Failed to load document count:', err)
    }
  }

  const loadAgentIntegrations = async (integrationIds: string[]) => {
    try {
      if (integrationIds.length === 0) {
        setAgentIntegrations({})
        return
      }

      // Load agent integrations from the database
      const { data: agentIntegrationsData, error } = await supabase
        .from('agent_integrations')
        .select('integration_id, file_ids')
        .eq('agent_id', agentId)

      if (error) {
        logger.error('Failed to load agent integrations:', error)
        setAgentIntegrations({})
        return
      }

      // Convert to the expected format
      const agentIntegrationsMap: Record<string, Array<{id: string, name: string}>> = {}
      
      for (const agentIntegration of agentIntegrationsData || []) {
        const fileIds = agentIntegration.file_ids || []
        
        agentIntegrationsMap[agentIntegration.integration_id] = fileIds.map(fileObj => {
          // Parse JSON string to get the file object
          if (typeof fileObj === 'string') {
            try {
              const parsed = JSON.parse(fileObj)
              return {
                id: parsed.id,
                name: parsed.name
              }
            } catch (error) {
              logger.warn('Failed to parse file object JSON:', fileObj, error)
              return {
                id: fileObj,
                name: `File ${fileObj.slice(0, 8)}...`
              }
            }
          } else if (fileObj && typeof fileObj === 'object' && fileObj.id && fileObj.name) {
            // Already parsed object
            return {
              id: fileObj.id,
              name: fileObj.name
            }
          } else {
            // Fallback for unexpected format
            logger.warn('Unexpected file object format:', fileObj)
            return {
              id: String(fileObj),
              name: `File ${String(fileObj).slice(0, 8)}...`
            }
          }
        })
      }
      
      setAgentIntegrations(agentIntegrationsMap)
    } catch (err) {
      logger.error('Failed to load agent integrations:', err)
      setAgentIntegrations({})
    }
  }

  const getProviderIcon = (provider: string, metadata?: ConnectorMetadata) => {
    if (metadata?.icon_url) {
      return (
        <img 
          src={metadata.icon_url} 
          alt={metadata.display_name}
          style={{ width: '20px', height: '20px', objectFit: 'contain' }}
        />
      )
    }
    return (LinkOutlined as any)({ style: { fontSize: '16px', color: '#000000' } })
  }

  const handleAddFiles = (integrationId: string) => {
    setCurrentIntegrationId(integrationId)
  }

  const handleFilePickerSuccess = (fileIds: string[], files?: Array<{id: string, name: string}>) => {
    const newFiles = files || fileIds.map(id => ({ id, name: `File ${id.slice(0, 8)}` }))
    
    setAgentIntegrations(prev => {
      const existingFiles = prev[currentIntegrationId] || []
      const existingFileIds = new Set(existingFiles.map(f => f.id))
      
      const uniqueNewFiles = newFiles.filter(file => !existingFileIds.has(file.id))
      
      return {
        ...prev,
        [currentIntegrationId]: [...existingFiles, ...uniqueNewFiles]
      }
    })
    setCurrentIntegrationId('')
  }

  const handleCloseFilePicker = () => {
    setCurrentIntegrationId('')
  }

  const handleRemoveFile = (integrationId: string, fileId: string) => {
    setAgentIntegrations(prev => {
      const newState = { ...prev }
      if (newState[integrationId]) {
        newState[integrationId] = newState[integrationId].filter(file => file.id !== fileId)
        if (newState[integrationId].length === 0) {
          delete newState[integrationId]
          setSelectedIntegrations(prevSelected => prevSelected.filter(id => id !== integrationId))
        }
      }
      return newState
    })
  }

  const getAllSelectedFileIds = () => {
    return Object.values(agentIntegrations).flat().map(file => file.id)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError('Agent name is required')
      return
    }

    try {
      setLoading(true)
      setError('')
      
      // Update agent basic information
      const { error: updateError } = await supabase
        .from('agents')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          integration_ids: selectedIntegrations,
          updated_at: new Date().toISOString()
        })
        .eq('id', agentId)

      if (updateError) throw updateError

      // Clean up orphaned documents BEFORE updating agent integrations
      logger.log('Cleaning up orphaned documents...')
      try {
        const cleanupResponse = await fetch(`/api/agents/${agentId}/cleanup-documents`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        })

        if (cleanupResponse.ok) {
          const cleanupResult = await cleanupResponse.json()
          logger.log('Document cleanup result:', cleanupResult)
          if (cleanupResult.deletedCount > 0) {
            message.info(`Cleaned up ${cleanupResult.deletedCount} orphaned documents`)
          }
        } else {
          logger.warn('Document cleanup failed, but continuing with update')
        }
      } catch (cleanupError) {
        logger.warn('Document cleanup error:', cleanupError)
      }

      // Update agent integrations and files
      if (selectedIntegrations.length > 0) {
        // First, delete existing agent integrations
        const { error: deleteError } = await supabase
          .from('agent_integrations')
          .delete()
          .eq('agent_id', agentId)

        if (deleteError) throw deleteError

        // Insert new agent integrations with file objects (id and name)
        const agentIntegrationsToInsert = selectedIntegrations.map(integrationId => ({
          agent_id: agentId,
          integration_id: integrationId,
          file_ids: (agentIntegrations[integrationId] || []).map(file => ({
            id: file.id,
            name: file.name
          }))
        }))

        if (agentIntegrationsToInsert.length > 0) {
          const { error: insertError } = await supabase
            .from('agent_integrations')
            .insert(agentIntegrationsToInsert)

          if (insertError) throw insertError
        }
      } else {
        // If no integrations selected, delete all agent integrations
        const { error: deleteError } = await supabase
          .from('agent_integrations')
          .delete()
          .eq('agent_id', agentId)

        if (deleteError) throw deleteError

        // Also clean up all documents for this agent when no integrations are selected
        logger.log('No integrations selected, cleaning up all documents for this agent...')
        const { error: documentsDeleteError } = await supabase
          .from('documents')
          .delete()
          .eq('agent_id', agentId)

        if (documentsDeleteError) {
          logger.error('Error deleting documents:', documentsDeleteError)
          // Don't throw here, just log the error
        } else {
          logger.log('Successfully deleted all documents for agent')
        }
      }

      // Start document processing for any new files
      if (Object.keys(agentIntegrations).length > 0) {
        try {
          const response = await fetch('/api/agents/process', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              agentId: agentId,
              agentIntegrations: agentIntegrations
            }),
          })

          if (!response.ok) {
            logger.error('Failed to start document processing')
            message.warning('Agent updated but file processing failed')
          } else {
            message.success('Agent updated and files are being processed')
          }
        } catch (err) {
          logger.error('Error starting document processing:', err)
          message.warning('Agent updated but file processing failed')
        }
      } else {
        message.success('Agent updated successfully')
      }
      
      router.push('/agents')
    } catch (err) {
      logger.error('Error updating agent:', err)
      
      // Provide more specific error messages
      if (err instanceof Error) {
        if (err.message.includes('duplicate key')) {
          setError('A file with this name already exists for this agent')
        } else if (err.message.includes('foreign key')) {
          setError('Invalid integration selected')
        } else if (err.message.includes('permission')) {
          setError('You do not have permission to update this agent')
        } else {
          setError(`Failed to update agent: ${err.message}`)
        }
      } else {
        setError('Failed to update agent. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading && !agent) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        backgroundColor: '#fafafa'
      }}>
        <div>Loading...</div>
      </div>
    )
  }

  if (error && !agent) {
    return (
      <div style={{ 
        padding: '32px',
        backgroundColor: '#fafafa',
        minHeight: '100vh'
      }}>
        <div style={{ 
          maxWidth: '1200px', 
          margin: '0 auto',
          padding: '16px'
        }}>
          <Card 
            style={{ 
              border: '1px solid #ef4444',
              backgroundColor: '#fef2f2'
            }}
            styles={{ body: { padding: '24px' } }}
          >
            <Text style={{ color: '#ef4444', fontSize: '16px' }}>{error}</Text>
            <div style={{ marginTop: '16px' }}>
              <Link href="/agents">
                <Button type="primary">
                  Back to Agents
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div style={{ 
      padding: '16px',
      backgroundColor: '#fafafa',
      minHeight: '100vh'
    }}>
      <div style={{ 
        maxWidth: '1200px', 
        margin: '0 auto',
        padding: '16px'
      }}>
        {/* Header */}
        <div style={{ 
          marginBottom: '32px' 
        }}>
          <Link href="/agents">
            <Button 
              type="text" 
              icon={<ArrowLeftOutlined />}
              style={{ 
                padding: 0, 
                height: 'auto', 
                marginBottom: '16px',
                color: '#707070'
              }}
            >
              Back to Agents
            </Button>
          </Link>
          <Title level={3} style={{ margin: 0, color: '#202020' }}>
            Edit Agent
          </Title>
          <Text style={{ color: '#707070', fontSize: '16px' }}>
            Update your agent&apos;s basic information
          </Text>
        </div>

        {/* Error Message */}
        {error && (
          <Card 
            style={{ 
              marginBottom: '24px',
              border: '1px solid #ef4444',
              backgroundColor: '#fef2f2'
            }}
            styles={{ body: { padding: '16px' } }}
          >
            <Text style={{ color: '#ef4444' }}>{error}</Text>
          </Card>
        )}

        <form onSubmit={handleSubmit}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {/* Basic Information */}
            <Card 
              className="stackone-card"
              title={
                <Space>
                  <RobotOutlined style={{ color: '#000000' }} />
                  <Text strong style={{ color: '#202020' }}>Basic Information</Text>
                </Space>
              }
              styles={{ body: { padding: '24px' } }}
            >
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <div>
                  <Text strong style={{ color: '#202020', display: 'block', marginBottom: '8px' }}>
                    Agent Name *
                  </Text>
                  <Input
                    size="large"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Research Assistant, Document Q&A"
                    required
                    style={{ borderRadius: '8px' }}
                  />
                </div>
                
                <div>
                  <Text strong style={{ color: '#202020', display: 'block', marginBottom: '8px' }}>
                    Description (Optional)
                  </Text>
                  <TextArea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe what this agent will help you with..."
                    style={{ borderRadius: '8px' }}
                  />
                </div>

                {documentCount > 0 && (
                  <div style={{ 
                    padding: '12px', 
                    backgroundColor: '#f0f9ff', 
                    border: '1px solid #0ea5e9', 
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <FileTextOutlined style={{ color: '#0ea5e9' }} />
                    <Text style={{ color: '#0c4a6e' }}>
                      {documentCount} document{documentCount !== 1 ? 's' : ''} processed and ready for queries
                    </Text>
                  </div>
                )}
              </Space>
            </Card>

            {/* Integration Selection */}
            <Card 
              className="stackone-card"
              title={
                <Space>
                  <SettingOutlined style={{ color: '#000000' }} />
                  <Text strong style={{ color: '#202020' }}>Select Integrations</Text>
                </Space>
              }
              styles={{ body: { padding: '24px' } }}
            >
              <IntegrationsList
                integrations={integrations}
                connectorMetadata={connectorMetadata}
                selectedIntegrations={selectedIntegrations}
                onSelectionChange={setSelectedIntegrations}
                showSelection={true}
                variant="selectable"
              />
            </Card>

            {/* File Selection */}
            <Card 
              className="stackone-card"
              title={
                <Space>
                  <FileTextOutlined style={{ color: '#000000' }} />
                  <Text strong style={{ color: '#202020' }}>Select Files</Text>
                </Space>
              }
              styles={{ body: { padding: '24px' } }}
            >
              {selectedIntegrations.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '40px 0',
                  backgroundColor: '#fafafa',
                  borderRadius: '12px',
                  border: '1px solid #f0f0f0'
                }}>
                  <FileTextOutlined style={{ fontSize: '32px', color: '#707070', marginBottom: '16px' }} />
                  <Text style={{ color: '#707070' }}>
                    Select integrations first to choose files
                  </Text>
                </div>
              ) : (
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  {selectedIntegrations.map((integrationId) => {
                    const integration = integrations.find(i => i.id === integrationId)
                    const selectedFiles = agentIntegrations[integrationId] || []
                    
                    if (!integration) return null
                    
                    return (
                      <Card
                        key={integrationId}
                        size="small"
                        style={{ 
                          border: '1px solid #f0f0f0',
                          borderRadius: '12px'
                        }}
                        styles={{ body: { padding: '16px' } }}
                      >
                        <div style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '12px', 
                          marginBottom: '16px'
                        }}>
                          <div style={{ 
                            width: '32px', 
                            height: '32px', 
                            backgroundColor: '#f0f9ff', 
                            borderRadius: '8px', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            flexShrink: 0
                          }}>
                            {getProviderIcon(integration.provider, connectorMetadata.find(m => m.provider === integration.provider))}
                          </div>
                          <div style={{ flex: 1 }}>
                            <Text strong style={{ color: '#202020', fontSize: '14px' }}>
                              {(() => {
                                const metadata = connectorMetadata.find(m => m.provider === integration.provider)
                                return metadata?.display_name || integration.provider.replace('_', ' ')
                              })()}
                            </Text>
                            <div>
                              <Text style={{ color: '#707070', fontSize: '12px' }}>
                                {integration.account_name}
                              </Text>
                            </div>
                          </div>
                          <Button
                            type="default"
                            size="small"
                            onClick={() => handleAddFiles(integrationId)}
                            style={{
                              backgroundColor: '#ffffff',
                              borderColor: '#d9d9d9',
                              color: '#000000',
                              borderRadius: '6px',
                              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                            }}
                          >
                            Add Files
                          </Button>
                        </div>
                        
                        {selectedFiles.length > 0 && (
                          <div>
                            <Text style={{ color: '#707070', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                              <Text strong>{selectedFiles.length}</Text> file{selectedFiles.length !== 1 ? 's' : ''} selected
                            </Text>
                            <div style={{ 
                              display: 'flex', 
                              flexWrap: 'wrap', 
                              gap: '6px'
                            }}>
                              {selectedFiles.map((file, index) => (
                                <div
                                  key={file.id || index}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    maxWidth: '50%',
                                    backgroundColor: '#f0f9ff',
                                    border: '1px solid #d1e7ff',
                                    borderRadius: '4px',
                                    padding: '2px 4px 2px 8px',
                                    fontSize: '11px',
                                    color: '#1d4ed8'
                                  }}
                                >
                                  <span
                                    style={{
                                      flex: 1,
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      minWidth: 0
                                    }}
                                  >
                                    {file.name}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveFile(integrationId, file.id)}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#000000',
                                      cursor: 'pointer',
                                      padding: '0 4px',
                                      fontSize: '12px',
                                      lineHeight: 1,
                                      marginLeft: '4px',
                                      flexShrink: 0
                                    }}
                                  >
                                    ×
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </Card>
                    )
                  })}
                  
                  {getAllSelectedFileIds().length > 0 && (
                    <Card
                      style={{ 
                        backgroundColor: '#f0fdf4',
                        border: '1px solid #bbf7d0'
                      }}
                      styles={{ body: { padding: '16px' } }}
                    >
                      <Text style={{ color: '#000000', fontSize: '14px', fontWeight: 500 }}>
                        Total files selected: {getAllSelectedFileIds().length}
                      </Text>
                      <div>
                        <Text style={{ color: '#000000', fontSize: '12px', opacity: 0.8 }}>
                          Files will be processed when you save the agent
                        </Text>
                      </div>
                    </Card>
                  )}
                </Space>
              )}
            </Card>

            {/* Submit Button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button
                type="default"
                size="large"
                htmlType="submit"
                loading={loading}
                icon={<SaveOutlined />}
                style={{
                  backgroundColor: '#000000',
                  borderColor: '#000000',
                  color: '#ffffff',
                  borderRadius: '8px',
                  height: '48px',
                  fontSize: '16px',
                  fontWeight: 500,
                  boxShadow: '0 4px 8px rgba(0, 0, 0, 0.15)'
                }}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </Space>
        </form>

        {/* File Picker */}
        {currentIntegrationId && (
          <StackOneFilePicker
            isOpen={true}
            onClose={handleCloseFilePicker}
            onSuccess={handleFilePickerSuccess}
            integrationId={currentIntegrationId}
            multiple={true}
            selectedFileIds={(agentIntegrations[currentIntegrationId] || []).map(f => f.id)}
            selectedFiles={agentIntegrations[currentIntegrationId] || []}
            stackoneOnly={true}
          />
        )}
      </div>
    </div>
  )
}

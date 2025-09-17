'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { 
  Card, 
  Typography, 
  Button, 
  Input, 
  Space,
  Tag
} from 'antd'
import { 
  ArrowLeftOutlined,
  RobotOutlined,
  SettingOutlined,
  FileTextOutlined,
  SaveOutlined
} from '@ant-design/icons'
import { createClient } from '@/lib/supabase/client'
import { StackOneFilePicker } from '@/components/StackOneFilePicker'
import { IntegrationsList } from '@/components/IntegrationsList'
import type { Integration, ConnectorMetadata } from '@/types'
import { logger } from '@/utils/logger'

const { Title, Text } = Typography
const { TextArea } = Input

export default function NewAgentPage() {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>([])
  const [agentIntegrations, setAgentIntegrations] = useState<Record<string, Array<{id: string, name: string}>>>({}) // integrationId -> files
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [connectorMetadata, setConnectorMetadata] = useState<ConnectorMetadata[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [error, setError] = useState('')
  const [currentIntegrationId, setCurrentIntegrationId] = useState<string>('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const [integrationsData, metadataData] = await Promise.all([
        supabase
          .from('integrations')
          .select('*')
          .eq('status', 'active'),
        supabase
          .from('connector_metadata')
          .select('*')
          .eq('is_available', true)
      ])

      if (integrationsData.error) throw integrationsData.error
      if (metadataData.error) throw metadataData.error

      setIntegrations(integrationsData.data || [])
      setConnectorMetadata(metadataData.data || [])
    } catch (err) {
      setError('Failed to load integrations')
      logger.error(err)
    }
  }

  const handleIntegrationToggle = (integrationId: string) => {
    const isCurrentlySelected = selectedIntegrations.includes(integrationId)
    
    setSelectedIntegrations(prev => 
      isCurrentlySelected
        ? prev.filter(id => id !== integrationId)
        : [...prev, integrationId]
    )
    
    // If removing integration, also remove its files
    if (isCurrentlySelected) {
      setAgentIntegrations(prev => {
        const newState = { ...prev }
        delete newState[integrationId]
        return newState
      })
    }
  }

  const handleAddFiles = (integrationId: string) => {
    setCurrentIntegrationId(integrationId)
  }


  const handleFilePickerSuccess = (fileIds: string[], files?: Array<{id: string, name: string}>) => {
    logger.log('File picker success called with:', { fileIds, files, currentIntegrationId })
    
    // Use the provided files with names, or create basic file objects as fallback
    const newFiles = files || fileIds.map(id => ({ id, name: `File ${id.slice(0, 8)}` }))
    logger.log('New files to add:', newFiles)
    
    setAgentIntegrations(prev => {
      const existingFiles = prev[currentIntegrationId] || []
      const existingFileIds = new Set(existingFiles.map(f => f.id))
      
      // Only add files that aren't already selected
      const uniqueNewFiles = newFiles.filter(file => !existingFileIds.has(file.id))
      logger.log('Unique new files after filtering:', uniqueNewFiles)
      
      const updated = {
        ...prev,
        [currentIntegrationId]: [...existingFiles, ...uniqueNewFiles]
      }
      logger.log('Updated agentIntegrations:', updated)
      return updated
    })
    setCurrentIntegrationId('')
  }

  const handleCloseFilePicker = () => {
    setCurrentIntegrationId('')
  }

  const handleRemoveIntegrationFiles = (integrationId: string) => {
    setAgentIntegrations(prev => {
      const newState = { ...prev }
      delete newState[integrationId]
      return newState
    })
  }

  const handleRemoveFile = (integrationId: string, fileId: string) => {
    setAgentIntegrations(prev => {
      const newState = { ...prev }
      if (newState[integrationId]) {
        newState[integrationId] = newState[integrationId].filter(file => file.id !== fileId)
        // If no files left, remove the integration from selectedIntegrations
        if (newState[integrationId].length === 0) {
          delete newState[integrationId]
          setSelectedIntegrations(prevSelected => prevSelected.filter(id => id !== integrationId))
        }
      }
      return newState
    })
  }

  const getAllSelectedFiles = () => {
    return Object.values(agentIntegrations).flat()
  }

  const getAllSelectedFileIds = () => {
    return getAllSelectedFiles().map(file => file.id)
  }

  const getProviderIcon = (provider: string) => {
    const metadata = connectorMetadata.find(m => m.provider === provider)
    if (metadata?.icon_url) {
      return (
        <img 
          src={metadata.icon_url} 
          alt={metadata.display_name}
          style={{ width: '24px', height: '24px', objectFit: 'contain' }}
        />
      )
    }
    return <span style={{ fontSize: '14px' }}>📁</span>
  }



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError('Agent name is required')
      return
    }

    if (selectedIntegrations.length === 0) {
      setError('Please select at least one integration')
      return
    }

    const allFileIds = getAllSelectedFileIds()
    if (allFileIds.length === 0) {
      setError('Please select files for at least one integration')
      return
    }

    try {
      setLoading(true)
      setError('')
      
      setLoadingStep('Authenticating user...')
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      setLoadingStep('Creating agent...')
      // Create the agent
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .insert({
          name: name.trim(),
          description: description.trim() || null,
          user_id: user.id,
          integration_ids: selectedIntegrations,
          status: 'processing'
        })
        .select()
        .single()

      if (agentError) throw agentError

      setLoadingStep('Setting up integrations...')
      // Create agent-integration relationships
      const agentIntegrationsData = Object.entries(agentIntegrations).map(([integrationId, fileIds]) => ({
        agent_id: agent.id,
        integration_id: integrationId,
        file_ids: fileIds
      }))

      if (agentIntegrationsData.length > 0) {
        const { error: agentIntegrationsError } = await supabase
          .from('agent_integrations')
          .insert(agentIntegrationsData)

        if (agentIntegrationsError) throw agentIntegrationsError
      }

      setLoadingStep('Processing files...')
      // Start the document processing
      const response = await fetch('/api/agents/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          agentId: agent.id,
          agentIntegrations: agentIntegrations
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start document processing')
      }

      const processResult = await response.json()
      
      // Handle processing results
      if (!processResult.success) {
        if (processResult.agentStatus === 'failed') {
          throw new Error('Failed to process any files. Agent creation was cancelled.')
        } else {
          // Partial success - show warning but continue
          logger.warn('Some files failed to process:', processResult.errors)
        }
      }

      setLoadingStep('Finalizing...')
      
      // Show success message with details
      if (processResult.errors && processResult.errors.length > 0) {
        logger.warn('Agent created with some processing errors:', processResult.errors)
      }

      router.push(`/agents/${agent.id}/chat`)
    } catch (err) {
      logger.error('Agent creation error:', err)
      
      // Provide more specific error messages
      if (err instanceof Error) {
        if (err.message.includes('Failed to process any files')) {
          setError('Agent creation failed: Unable to process any of the selected files. Please check your file permissions and try again.')
        } else if (err.message.includes('User not authenticated')) {
          setError('Authentication failed. Please log in again.')
        } else if (err.message.includes('duplicate key')) {
          setError('An agent with this name already exists. Please choose a different name.')
        } else if (err.message.includes('permission')) {
          setError('You do not have permission to create agents.')
        } else {
          setError(`Failed to create agent: ${err.message}`)
        }
      } else {
        setError('Failed to create agent. Please try again.')
      }
    } finally {
      setLoading(false)
      setLoadingStep('')
    }
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
          Create New Agent
        </Title>
        <Text style={{ color: '#707070', fontSize: '16px' }}>
          Configure your knowledge retrieval agent with integrations and files
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
            </Space>
          </Card>

          {/* Integrations Selection */}
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
            {integrations.length === 0 ? (
              <div style={{ 
                textAlign: 'center', 
                padding: '40px 0',
                backgroundColor: '#fafafa',
                borderRadius: '12px',
                border: '1px solid #f0f0f0'
              }}>
                <SettingOutlined style={{ fontSize: '32px', color: '#707070', marginBottom: '16px' }} />
                <Text style={{ color: '#707070', display: 'block', marginBottom: '16px' }}>
                  No active integrations found
                </Text>
                <Link href="/integrations">
                  <Button 
                    type="link" 
                    style={{ color: '#000000', padding: 0 }}
                  >
                    Connect an integration first
                  </Button>
                </Link>
              </div>
            ) : (
              <IntegrationsList
                integrations={integrations}
                connectorMetadata={connectorMetadata}
                variant="selectable"
                showSelection={true}
                selectedIntegrations={selectedIntegrations}
                onSelectionChange={setSelectedIntegrations}
                maxItems={integrations.length}
              />
            )}
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
                  
                  logger.log('Rendering integration:', { integrationId, integration, selectedFiles, agentIntegrations })
                  
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
                          {getProviderIcon(integration.provider)}
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
                        Files will be processed when you create the agent
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
              disabled={selectedIntegrations.length === 0}
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
              {loading ? (loadingStep || 'Creating...') : 'Create Agent'}
            </Button>
          </div>
        </Space>
      </form>

      {/* File Picker - StackOne handles modal display */}
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

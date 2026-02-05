'use client'

import { useState, useEffect } from 'react'
import { 
  Card, 
  Row, 
  Col, 
  Typography, 
  Button,
  Tag,
  Empty,
  Space,
  Avatar,
  App
} from 'antd'
import { 
  PlusOutlined,
  RobotOutlined,
  MessageOutlined,
  EditOutlined,
  DeleteOutlined,
  LinkOutlined
} from '@ant-design/icons'
import Link from 'next/link'
import { loadConnectorMetadataClient } from '@/lib/connector-metadata-client'
import type { Agent, Integration, ConnectorMetadata } from '@/types'
import { logger } from '@/utils/logger'
import styles from './AgentsPage.module.css'
import {
  handleNewAgentButtonMouseEnter,
  handleNewAgentButtonMouseLeave,
  handleCreateAgentButtonMouseEnter,
  handleCreateAgentButtonMouseLeave,
  handleAgentCardMouseEnter,
  handleAgentCardMouseLeave,
  handleEditButtonMouseEnter,
  handleEditButtonMouseLeave,
  handleDeleteButtonMouseEnter,
  handleDeleteButtonMouseLeave
} from './agentsUtils'

const { Title, Text } = Typography

export default function AgentsPage() {
  const { message } = App.useApp()
  const [agents, setAgents] = useState<Agent[]>([])
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [connectorMetadata, setConnectorMetadata] = useState<ConnectorMetadata[]>([])
  const [metadataLoading, setMetadataLoading] = useState(true)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const [agentsRes, integrationsRes] = await Promise.all([
        fetch('/api/agents', { credentials: 'include' }),
        fetch('/api/integrations', { credentials: 'include' }),
      ])
      if (agentsRes.ok) {
        const { agents: data } = await agentsRes.json()
        setAgents(data ?? [])
      }
      if (integrationsRes.ok) {
        const { integrations: data } = await integrationsRes.json()
        setIntegrations((data ?? []).filter((i: { status: string }) => i.status === 'active'))
      }

      // Load connector metadata for integration logos
      try {
        setMetadataLoading(true)
        const metadata = await loadConnectorMetadataClient()
        logger.log('Loaded connector metadata:', metadata)
        setConnectorMetadata(metadata)
      } catch (err) {
        logger.warn('Failed to load connector metadata:', err)
      } finally {
        setMetadataLoading(false)
      }
    } catch (err) {
      setError('Failed to load agents')
      logger.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteAgent = async (agentId: string) => {
    try {
      const res = await fetch(`/api/agents/${agentId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err?.error ?? 'Failed to delete agent')
      }
      setAgents(agents.filter(a => a.id !== agentId))
      message.success('Agent deleted successfully')
    } catch (err) {
      message.error('Failed to delete agent')
      logger.error(err)
    }
  }

  const getProviderIcon = (provider: string, metadata?: ConnectorMetadata) => {
    logger.log(`Getting icon for provider: ${provider}, metadata:`, metadata)
    if (metadata?.icon_url) {
      logger.log(`Using icon URL: ${metadata.icon_url}`)
      return (
        <img 
          src={metadata.icon_url} 
          alt={metadata.display_name}
          style={{ width: '16px', height: '16px', objectFit: 'contain' }}
        />
      )
    }
    logger.log(`No metadata found for provider: ${provider}, using fallback`)
    return <LinkOutlined style={{ fontSize: '12px', color: '#000000' }} />
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingText}>Loading...</div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Title level={3} className={styles.headerTitle}>
            Agents
          </Title>
          <Text className={styles.headerSubtitle}>
            Create and manage AI agents that can answer questions from your documents
          </Text>
        </div>
        <Link href="/agents/new">
          <Button 
            type="default"
            icon={<PlusOutlined />}
            size="large"
            className={styles.newAgentButton}
            onMouseEnter={handleNewAgentButtonMouseEnter}
            onMouseLeave={handleNewAgentButtonMouseLeave}
          >
            New Agent
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <Row gutter={[24, 24]} className={styles.statsRow}>
        <Col span={8}>
          <Card 
            className="stackone-card"
            styles={{ body: { padding: '24px' } }}
          >
            <div className={styles.statContent}>
              <div className={styles.statNumber}>
                {agents.length}
              </div>
              <Text className={styles.statLabel}>Total Agents</Text>
            </div>
          </Card>
        </Col>

        <Col span={8}>
          <Card 
            className="stackone-card"
            styles={{ body: { padding: '24px' } }}
          >
            <div className={styles.statContent}>
              <div className={styles.statNumber}>
                {integrations.length}
              </div>
              <Text className={styles.statLabel}>Active Integrations</Text>
            </div>
          </Card>
        </Col>

        <Col span={8}>
          <Card 
            className="stackone-card"
            styles={{ body: { padding: '24px' } }}
          >
            <div className={styles.statContent}>
              <div className={styles.statNumber}>
                {agents.filter(a => a.integration_ids && a.integration_ids.length > 0).length}
              </div>
              <Text className={styles.statLabelConnected}>Connected to Data</Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Error Message */}
      {error && (
        <Card 
          className={styles.errorCard}
          styles={{ body: { padding: '16px' } }}
        >
          <Text className={styles.errorText}>{error}</Text>
        </Card>
      )}

      {/* Agents List */}
      <Card 
        className="stackone-card"
        styles={{ body: { padding: '24px' } }}
        title={
          <Title level={4} className={styles.agentsCardTitle}>
            Your Agents
          </Title>
        }
      >
        {agents.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No agents created yet"
            className={styles.emptyState}
          >
            <Text className={styles.emptyText}>
              Create your first knowledge agent to get started.
            </Text>
            <Link href="/agents/new">
              <Button 
                type="default"
                icon={<PlusOutlined />}
                className={styles.createAgentButton}
                onMouseEnter={handleCreateAgentButtonMouseEnter}
                onMouseLeave={handleCreateAgentButtonMouseLeave}
              >
                Create Agent
              </Button>
            </Link>
          </Empty>
        ) : (
          <Row gutter={[16, 16]}>
            {agents.map((agent) => (
              <Col span={8} key={agent.id}>
                <Card
                  size="small"
                  hoverable
                  className={styles.agentCard}
                  styles={{ body: { padding: '16px' } }}
                  onClick={() => window.location.href = `/agents/${agent.id}/chat`}
                  onMouseEnter={handleAgentCardMouseEnter}
                  onMouseLeave={handleAgentCardMouseLeave}
                >
                  {/* Header with agent name and integration icons */}
                  <div className={styles.agentCardHeader}>
                    <div className={styles.agentCardLeft}>
                      <Text strong className={styles.agentName}>
                        {agent.name}
                      </Text>
                      {agent.description && (
                        <div className={styles.agentDescription}>
                          <Text>
                            {agent.description}
                          </Text>
                        </div>
                      )}
                    </div>
                    
                    {/* Integration Logos - moved to top right */}
                    {agent.integration_ids && agent.integration_ids.length > 0 && (
                      <div className={styles.agentIntegrations}>
                        <Space wrap size={[4, 4]}>
                          {agent.integration_ids.map((id, index) => {
                            const integration = integrations.find(i => i.id === id)
                            const metadata = connectorMetadata.find(m => m.provider === integration?.provider)
                            logger.log(`Agent ${agent.name} - Integration ID: ${id}, Integration:`, integration, 'Metadata:', metadata)
                            return integration ? (
                              <div
                                key={index}
                                className={styles.integrationIcon}
                                title={metadata?.display_name || integration.provider.replace('_', ' ')}
                              >
                                {getProviderIcon(integration.provider, metadata)}
                              </div>
                            ) : null
                          })}
                        </Space>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className={styles.agentActions}>
                    <Text className={styles.agentCreatedDate}>
                      Created {new Date(agent.created_at).toLocaleDateString()}
                    </Text>
                    <Space size={4} className={styles.agentActionButtons}>
                      <Link href={`/agents/${agent.id}/edit`}>
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          className={styles.editButton}
                          title="Edit agent"
                          onClick={(e) => e.stopPropagation()}
                          onMouseEnter={handleEditButtonMouseEnter}
                          onMouseLeave={handleEditButtonMouseLeave}
                        />
                      </Link>
                      <Button
                        type="text"
                        size="small"
                        icon={<DeleteOutlined />}
                        className={styles.deleteButton}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteAgent(agent.id)
                        }}
                        title="Delete agent"
                        onMouseEnter={handleDeleteButtonMouseEnter}
                        onMouseLeave={handleDeleteButtonMouseLeave}
                      />
                    </Space>
                  </div>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Card>
    </div>
  )
}
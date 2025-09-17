'use client'

import { useState, useEffect } from 'react'
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Typography, 
  Button,
  Empty,
  Avatar
} from 'antd'
import { 
  RobotOutlined,
  ApiOutlined,
  PlusOutlined,
  LinkOutlined
} from '@ant-design/icons'
import { createClient } from '@/lib/supabase/client'
import { logger } from '@/utils/logger'
import Link from 'next/link'
import { IntegrationsList } from '@/components/IntegrationsList'
import { loadConnectorMetadataClient } from '@/lib/connector-metadata-client'
import type { Agent, Integration, ConnectorMetadata, Thread } from '@/types'

const { Title, Text } = Typography

export default function Dashboard() {
  const [loading, setLoading] = useState(true)
  const [agents, setAgents] = useState<Agent[]>([])
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [threads, setThreads] = useState<Thread[]>([])
  const [connectorMetadata, setConnectorMetadata] = useState<ConnectorMetadata[]>([])
  const [error, setError] = useState('')
  const supabase = createClient()

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      console.log('Loading dashboard data...')
      
      // Load user's agents, integrations, and recent threads
      const [agentsData, integrationsData, threadsResponse] = await Promise.all([
        supabase.from('agents').select('*').order('created_at', { ascending: false }),
        supabase.from('integrations').select('*').order('created_at', { ascending: false }),
        fetch('/api/threads/recent')
      ])

      console.log('Dashboard data loaded:', { agentsData, integrationsData, threadsResponse })

      if (agentsData.error) throw agentsData.error
      if (integrationsData.error) throw integrationsData.error

      setAgents(agentsData.data || [])
      setIntegrations(integrationsData.data || [])

      // Handle threads response
      if (threadsResponse.ok) {
        const threadsData = await threadsResponse.json()
        setThreads(threadsData.threads || [])
      } else {
        logger.warn('Failed to load recent threads')
        setThreads([])
      }

      // Load connector metadata for integration logos
      try {
        const metadata = await loadConnectorMetadataClient()
        setConnectorMetadata(metadata)
      } catch (err) {
        logger.warn('Failed to load connector metadata:', err)
      }
    } catch (err) {
      console.error('Dashboard load error:', err)
      setError('Failed to load dashboard data')
      logger.error(err)
    } finally {
      setLoading(false)
    }
  }

  const activeIntegrations = integrations.filter(i => i.status === 'active')
  const recentAgents = agents.slice(0, 5)




  if (loading) {
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

  return (
    <div style={{ 
      padding: '32px',
      backgroundColor: '#fafafa',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <Title level={3} style={{ margin: 0, color: '#202020' }}>
          Dashboard
        </Title>
        <Text style={{ color: '#707070', fontSize: '16px' }}>
          Overview of your knowledge agents and conversations
        </Text>
      </div>

      {/* Stats Cards */}
      <Row gutter={[24, 24]} style={{ marginBottom: '32px' }}>
        <Col span={8}>
          <Card 
            className="stackone-card"
            styles={{ body: { padding: '24px' } }}
          >
            <Statistic
              title="Total Agents"
              value={agents.length}
              style={{ color: '#000000', fontSize: '32px', fontWeight: 600 }}
              prefix={<RobotOutlined />}
              className="stackone-statistic"
            />
            <div style={{ marginTop: '16px' }}>
              <Link href="/agents/new">
                <Button 
                  type="default" 
                  size="small"
                  icon={<PlusOutlined />}
                  style={{
                    backgroundColor: '#000000',
                    borderColor: '#000000',
                    color: '#ffffff',
                    borderRadius: '6px',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  Create Agent
                </Button>
              </Link>
            </div>
          </Card>
        </Col>

        <Col span={8}>
          <Card 
            className="stackone-card"
            styles={{ body: { padding: '24px' } }}
          >
            <Statistic
              title="Active Integrations"
              value={activeIntegrations.length}
              style={{ color: '#000000', fontSize: '32px', fontWeight: 600 }}
              prefix={<ApiOutlined />}
              className="stackone-statistic"
            />
            <div style={{ marginTop: '16px' }}>
              <Link href="/integrations">
                <Button 
                  type="default" 
                  size="small"
                  icon={<LinkOutlined />}
                  style={{
                    backgroundColor: '#ffffff',
                    borderColor: '#d9d9d9',
                    color: '#000000',
                    borderRadius: '6px',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  Manage
                </Button>
              </Link>
            </div>
          </Card>
        </Col>

        <Col span={8}>
          <Card 
            className="stackone-card"
            styles={{ body: { padding: '24px' } }}
          >
            <Statistic
              title="Total Integrations"
              value={integrations.length}
              style={{ color: '#202020', fontSize: '32px', fontWeight: 600 }}
              prefix={<LinkOutlined />}
              className="stackone-statistic"
            />
            <div style={{ marginTop: '16px' }}>
              <Text style={{ color: '#707070', fontSize: '12px' }}>
                {activeIntegrations.length} active
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]}>
        {/* Integrations */}
        <Col span={8}>
          <Card 
            className="stackone-card"
            style={{ height: '100%' }}
            styles={{ body: { padding: '24px' } }}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title level={4} style={{ margin: 0, color: '#202020' }}>
                  Integrations
                </Title>
                <Link href="/integrations">
                  <Button type="link" style={{ color: '#000000', padding: 0 }}>
                    Manage
                  </Button>
                </Link>
              </div>
            }
          >
            {integrations.length > 0 ? (
              <IntegrationsList 
                integrations={integrations}
                connectorMetadata={connectorMetadata}
                maxItems={6}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No integrations connected yet"
                style={{ margin: '40px 0' }}
              >
                <Link href="/integrations">
                  <Button 
                    type="default"
                    icon={<LinkOutlined />}
                    style={{
                      backgroundColor: '#000000',
                      borderColor: '#000000',
                      color: '#ffffff',
                      borderRadius: '6px',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    Connect Integration
                  </Button>
                </Link>
              </Empty>
            )}
          </Card>
        </Col>

        {/* Recent Agents */}
        <Col span={8}>
          <Card 
            className="stackone-card"
            style={{ height: '100%' }}
            styles={{ body: { padding: '24px' } }}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title level={4} style={{ margin: 0, color: '#202020' }}>
                  Recent Agents
                </Title>
                <Link href="/agents">
                  <Button type="link" style={{ color: '#000000', padding: 0 }}>
                    View All
                  </Button>
                </Link>
              </div>
            }
          >
            {agents.length > 0 ? (
              <Row gutter={[16, 16]}>
                {recentAgents.map((agent) => (
                  <Col span={24} key={agent.id}>
                    <Card
                      hoverable
                      style={{
                        border: '1px solid #f0f0f0',
                        borderRadius: '8px',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.06)',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                      styles={{
                        body: { padding: '16px' }
                      }}
                      onClick={() => window.location.href = `/agents/${agent.id}/chat`}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)'
                        e.currentTarget.style.borderColor = '#d9d9d9'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.06)'
                        e.currentTarget.style.borderColor = '#f0f0f0'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                        <Avatar
                          size={40}
                          icon={<RobotOutlined />}
                          style={{
                            backgroundColor: '#f0f0f0',
                            color: '#000000',
                            flexShrink: 0
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'flex-start',
                            marginBottom: '4px'
                          }}>
                            <Link 
                              href={`/agents/${agent.id}/chat`} 
                              style={{ 
                                color: '#000000', 
                                fontWeight: 600,
                                fontSize: '16px',
                                textDecoration: 'none'
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {agent.name}
                            </Link>
                            <Text style={{ 
                              color: '#707070', 
                              fontSize: '12px',
                              flexShrink: 0,
                              marginLeft: '8px'
                            }}>
                              {new Date(agent.created_at).toLocaleDateString()}
                            </Text>
                          </div>
                          <Text style={{ 
                            color: '#707070', 
                            fontSize: '14px',
                            display: 'block',
                            lineHeight: '1.4'
                          }}>
                            {agent.description || 'No description provided'}
                          </Text>
                        </div>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No agents created yet"
                style={{ margin: '40px 0' }}
              >
                <Link href="/agents/new">
                                  <Button 
                  type="default" 
                  icon={<PlusOutlined />}
                  style={{
                    backgroundColor: '#000000',
                    borderColor: '#000000',
                    color: '#ffffff',
                    borderRadius: '6px',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  Create Your First Agent
                </Button>
                </Link>
              </Empty>
            )}
          </Card>
        </Col>

        {/* Recent Threads */}
        <Col span={8}>
          <Card 
            className="stackone-card"
            style={{ height: '100%' }}
            styles={{ body: { padding: '24px' } }}
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Title level={4} style={{ margin: 0, color: '#202020' }}>
                  Recent Threads
                </Title>
                <Link href="/agents">
                  <Button type="link" style={{ color: '#000000', padding: 0 }}>
                    View All
                  </Button>
                </Link>
              </div>
            }
          >
            {threads.length > 0 ? (
              <Row gutter={[16, 16]}>
                {threads.map((thread) => (
                  <Col span={24} key={thread.id}>
                    <Card
                      hoverable
                      style={{
                        border: '1px solid #f0f0f0',
                        borderRadius: '8px',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.06)',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer'
                      }}
                      styles={{
                        body: { padding: '16px' }
                      }}
                      onClick={() => window.location.href = `/agents/${thread.agent_id}/chat?thread=${thread.id}`}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)'
                        e.currentTarget.style.borderColor = '#d9d9d9'
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.06)'
                        e.currentTarget.style.borderColor = '#f0f0f0'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'flex-start',
                            marginBottom: '4px'
                          }}>
                            <Text style={{ 
                              color: '#000000', 
                              fontWeight: 600,
                              fontSize: '16px',
                              display: 'block',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}>
                              {thread.title}
                            </Text>
                            <Text style={{ 
                              color: '#707070', 
                              fontSize: '12px',
                              flexShrink: 0,
                              marginLeft: '8px'
                            }}>
                              {thread.last_message_at 
                                ? new Date(thread.last_message_at).toLocaleDateString()
                                : new Date(thread.created_at).toLocaleDateString()
                              }
                            </Text>
                          </div>
                          <Text style={{ 
                            color: '#707070', 
                            fontSize: '14px',
                            display: 'block',
                            lineHeight: '1.4'
                          }}>
                            {thread.message_count} message{thread.message_count !== 1 ? 's' : ''}
                          </Text>
                        </div>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No recent conversations"
                style={{ margin: '40px 0' }}
              >
                <Link href="/agents/new">
                  <Button 
                    type="default" 
                    icon={<PlusOutlined />}
                    style={{
                      backgroundColor: '#000000',
                      borderColor: '#000000',
                      color: '#ffffff',
                      borderRadius: '6px',
                      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                    }}
                  >
                    Start a Conversation
                  </Button>
                </Link>
              </Empty>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
'use client'

import { useState, useEffect } from 'react'
import { 
  Card, 
  Row, 
  Col, 
  Typography,
  Empty,
  Avatar
} from 'antd'

const { Title, Text } = Typography
import {
  LinkOutlined
} from '@ant-design/icons'
import { IntegrationActions, ConnectProvider } from './IntegrationActions'
import { IntegrationsList } from './IntegrationsList'
import type { Integration, ConnectorMetadata } from '@/types'
import { logger } from '@/utils/logger'
import styles from './IntegrationsPageClient.module.css'

// Create type-asserted components
const TypographyCard = Card as any
const TypographyRow = Row as any
const TypographyCol = Col as any
const TypographyTitle = Title as any
const TypographyText = Text as any
const TypographyEmpty = Empty as any
const TypographyAvatar = Avatar as any
const LinkOutlinedIcon = LinkOutlined as any

interface IntegrationsPageClientProps {
  initialIntegrations: Integration[]
  connectorMetadata: ConnectorMetadata[]
}

export function IntegrationsPageClient({ 
  initialIntegrations, 
  connectorMetadata 
}: IntegrationsPageClientProps) {
  const [integrations, setIntegrations] = useState<Integration[]>(initialIntegrations)
  const [loading, setLoading] = useState(false)

  const refreshIntegrations = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/integrations', { credentials: 'include' })
      if (!res.ok) throw new Error('Failed to load integrations')
      const { integrations: data } = await res.json()
      setIntegrations(data ?? [])
    } catch (err) {
      logger.error('Error refreshing integrations:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (id: string) => {
    setIntegrations(prev => prev.filter(integration => integration.id !== id))
  }

  const handleUpdate = () => {
    refreshIntegrations()
  }

  const handleConnectSuccess = () => {
    refreshIntegrations()
  }

  const getProviderIcon = (provider: string, metadata?: ConnectorMetadata) => {
    if (metadata?.icon_url) {
      return (
        <img 
          src={metadata.icon_url} 
          alt={metadata.display_name}
          className={styles.providerIcon}
        />
      )
    }
    return <LinkOutlinedIcon className={styles.providerIconFallback} />
  }



  const activeIntegrations = integrations.filter(i => i.status === 'active')
  const availableProviders = connectorMetadata.filter(metadata => 
    !integrations.some(i => i.provider === metadata.provider)
  )

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <TypographyTitle level={3} className={styles.headerTitle}>
          Integrations
        </TypographyTitle>
        <TypographyText className={styles.headerText}>
          Connect your cloud storage accounts to enable knowledge retrieval
        </TypographyText>
      </div>

      {/* Stats Cards */}
      <TypographyRow gutter={[24, 24]} className={styles.statsRow}>
        <TypographyCol span={8}>
          <TypographyCard 
            className="stackone-card"
            styles={{ body: { padding: '24px' } }}
          >
            <div className={styles.statsCard}>
              <div className={styles.statsNumber}>
                {integrations.length}
              </div>
              <TypographyText className={styles.statsLabel}>Total Integrations</TypographyText>
            </div>
          </TypographyCard>
        </TypographyCol>

        <TypographyCol span={8}>
          <TypographyCard 
            className="stackone-card"
            styles={{ body: { padding: '24px' } }}
          >
            <div className={styles.statsCard}>
              <div className={styles.statsNumber}>
                {activeIntegrations.length}
              </div>
              <TypographyText className={styles.statsLabel}>Active</TypographyText>
            </div>
          </TypographyCard>
        </TypographyCol>

        <TypographyCol span={8}>
          <TypographyCard 
            className="stackone-card"
            styles={{ body: { padding: '24px' } }}
          >
            <div className={styles.statsCard}>
              <div className={styles.statsNumber}>
                {availableProviders.length}
              </div>
              <TypographyText className={styles.statsLabel}>Available</TypographyText>
            </div>
          </TypographyCard>
        </TypographyCol>
      </TypographyRow>

      {/* Active Integrations */}
      <TypographyCard 
        className={`stackone-card ${styles.mainCard}`}
        styles={{ body: { padding: '24px' } }}
        title={
          <TypographyTitle level={4} className={styles.cardTitle}>
            Active Integrations
          </TypographyTitle>
        }
      >
        {integrations.length === 0 ? (
          <TypographyEmpty
            image={TypographyEmpty.PRESENTED_IMAGE_SIMPLE}
            description="No integrations connected yet"
            className={styles.emptyState}
          >
            <TypographyText className={styles.emptyText}>
              Get started by connecting your first cloud storage account.
            </TypographyText>
          </TypographyEmpty>
        ) : (
          <IntegrationsList 
            integrations={integrations}
            connectorMetadata={connectorMetadata}
            variant="full"
            showActions={true}
            ActionsComponent={IntegrationActions}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
          />
        )}
      </TypographyCard>

      {/* Available Providers */}
      <TypographyCard 
        className={`stackone-card ${styles.mainCard}`}
        styles={{ body: { padding: '24px' } }}
        title={
          <TypographyTitle level={4} className={styles.cardTitle}>
            Connect New Account
          </TypographyTitle>
        }
      >
        {availableProviders.length === 0 ? (
          <TypographyEmpty
            image={TypographyEmpty.PRESENTED_IMAGE_SIMPLE}
            description="All available providers are already connected"
            className={styles.emptyState}
          />
        ) : (
          <TypographyRow gutter={[16, 16]}>
            {availableProviders.map((metadata) => (
              <TypographyCol xs={24} sm={12} md={8} lg={8} xl={8} key={metadata.id}>
                <TypographyCard
                  size="small"
                  className={styles.providerCard}
                  styles={{ body: { padding: '16px' } }}
                >
                  <div className={styles.providerCardContent}>
                    <TypographyAvatar
                      size={40}
                      className={styles.providerAvatar}
                    >
                      {getProviderIcon(metadata.provider, metadata)}
                    </TypographyAvatar>
                    <div className={styles.providerInfo}>
                      <TypographyText strong className={styles.providerName}>
                        {metadata.display_name}
                      </TypographyText>
                    </div>
                  </div>
                  <ConnectProvider 
                    provider={metadata.provider} 
                    onSuccess={handleConnectSuccess}
                  />
                </TypographyCard>
              </TypographyCol>
            ))}
          </TypographyRow>
        )}
      </TypographyCard>
    </div>
  )
}
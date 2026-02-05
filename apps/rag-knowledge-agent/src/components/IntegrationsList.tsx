'use client'

import { 
  Card, 
  Row, 
  Col, 
  Typography, 
  Tag,
  Avatar,
  Checkbox
} from 'antd'
import { 
  LinkOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons'
import type { Integration, ConnectorMetadata } from '@/types'
import styles from './IntegrationsList.module.css'

// Create type-asserted components
const TypographyCard = Card as any
const TypographyRow = Row as any
const TypographyCol = Col as any
const TypographyTag = Tag as any
const TypographyAvatar = Avatar as any
const TypographyCheckbox = Checkbox as any
const TypographyText = Typography.Text as any
const LinkOutlinedIcon = LinkOutlined as any
const CheckCircleOutlinedIcon = CheckCircleOutlined as any
const ExclamationCircleOutlinedIcon = ExclamationCircleOutlined as any

interface IntegrationsListProps {
  integrations: Integration[]
  connectorMetadata: ConnectorMetadata[]
  maxItems?: number
  showActions?: boolean
  onDelete?: (id: string) => void
  onUpdate?: () => void
  variant?: 'dashboard' | 'full' | 'selectable'
  ActionsComponent?: React.ComponentType<{ integration: Integration; onDelete?: (id: string) => void; onUpdate?: () => void }>
  // Selection props
  selectedIntegrations?: string[]
  onSelectionChange?: (selectedIds: string[]) => void
  showSelection?: boolean
}

export function IntegrationsList({ 
  integrations, 
  connectorMetadata, 
  maxItems = 6,
  showActions = false,
  onDelete,
  onUpdate,
  variant = 'dashboard',
  ActionsComponent,
  selectedIntegrations = [],
  onSelectionChange,
  showSelection = false
}: IntegrationsListProps) {
  const getProviderIcon = (provider: string, metadata?: ConnectorMetadata) => {
    const iconClass = variant === 'full' ? styles.providerIconFull : 
                     variant === 'selectable' ? styles.providerIconSelectable : 
                     styles.providerIconDashboard
    const iconStyleClass = variant === 'full' ? styles.iconFull : 
                          variant === 'selectable' ? styles.iconSelectable : 
                          styles.iconDashboard
    
    if (metadata?.icon_url) {
      return (
        <img 
          src={metadata.icon_url} 
          alt={metadata.display_name}
          className={`${styles.providerIcon} ${iconClass}`}
        />
      )
    }
    return <LinkOutlinedIcon className={`${styles.icon} ${iconStyleClass}`} />
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#00af66'
      case 'inactive':
        return '#d9d9d9'
      case 'error':
        return '#ff4d4f'
      default:
        return '#d9d9d9'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircleOutlinedIcon />
      case 'error':
        return <ExclamationCircleOutlinedIcon />
      default:
        return null
    }
  }

  const handleSelectionChange = (integrationId: string, checked: boolean) => {
    if (!onSelectionChange) return
    
    if (checked) {
      onSelectionChange([...selectedIntegrations, integrationId])
    } else {
      onSelectionChange(selectedIntegrations.filter(id => id !== integrationId))
    }
  }

  // Responsive column spans based on screen size
  const getResponsiveColSpan = () => {
    if (variant === 'full') {
      return { xs: 24, sm: 24, md: 12, lg: 8, xl: 8 }
    } else if (variant === 'selectable') {
      return { xs: 24, sm: 12, md: 12, lg: 12, xl: 12 }
    } else {
      // Dashboard variant - full width on all screen sizes since parent is already constrained
      return { xs: 24, sm: 24, md: 24, lg: 24, xl: 24 }
    }
  }
  const gutter: [number, number] = variant === 'full' ? [16, 16] : [8, 8]
  const avatarSize = variant === 'full' ? 40 : variant === 'selectable' ? 32 : 24
  const cardPadding = variant === 'full' ? '16px' : variant === 'selectable' ? '16px' : '12px'
  const borderRadius = variant === 'full' ? '12px' : variant === 'selectable' ? '12px' : '8px'
  const marginBottom = variant === 'full' ? '12px' : variant === 'selectable' ? '12px' : '8px'
  const textSize = variant === 'full' ? '14px' : variant === 'selectable' ? '16px' : '16px'
  const tagSize = variant === 'full' ? '12px' : variant === 'selectable' ? '12px' : '10px'
  const dateSize = variant === 'full' ? '12px' : variant === 'selectable' ? '12px' : '12px'

  return (
    <TypographyRow gutter={gutter}>
      {integrations.slice(0, maxItems).map((integration) => {
        const metadata = connectorMetadata.find(m => m.provider === integration.provider)
        return (
          <TypographyCol {...getResponsiveColSpan()} key={integration.id}>
            <TypographyCard
              size="small"
              className={`${styles.card} ${variant === 'full' ? styles.cardFull : ''} ${showSelection ? styles.cardSelectable : ''}`}
              style={{ borderRadius }}
              styles={{ body: { padding: cardPadding } }}
              onClick={showSelection ? () => handleSelectionChange(integration.id, !selectedIntegrations.includes(integration.id)) : undefined}
            >
              {variant === 'selectable' ? (
                <>
                  <div className={`${styles.contentContainer} ${styles.contentContainerSelectable}`}>
                    <TypographyAvatar
                      size={avatarSize}
                      className={`${styles.avatar} ${styles.avatarSelectable}`}
                    >
                      {getProviderIcon(integration.provider, metadata)}
                    </TypographyAvatar>
                    <div className={`${styles.infoContainer} ${styles.infoContainerSelectable}`}>
                      <div className={`${styles.headerRow} ${styles.headerRowSelectable}`}>
                        <TypographyText strong className={`${styles.title} ${styles.titleSelectable}`}>
                          {metadata?.display_name || 
                           integration.provider.replace('_', ' ').toUpperCase()}
                        </TypographyText>
                        <TypographyText className={`${styles.date} ${styles.dateSelectable}`}>
                          {new Date(integration.created_at).toLocaleDateString()}
                        </TypographyText>
                      </div>
                      <div className={styles.bottomRowSelectable}>
                        <TypographyTag 
                          color={getStatusColor(integration.status)}
                          icon={getStatusIcon(integration.status)}
                          className={`${styles.tag} ${styles.tagSelectable}`}
                        >
                          {integration.status.toUpperCase()}
                        </TypographyTag>
                        <TypographyCheckbox
                        checked={selectedIntegrations.includes(integration.id)}
                        onChange={(e) => {
                          e.stopPropagation()
                          handleSelectionChange(integration.id, e.target.checked)
                        }}
                        className={`${styles.checkbox} ${styles.checkboxSelectable}`}
                      />
                    </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className={`${styles.contentContainer} ${variant === 'full' ? styles.contentContainerFull : styles.contentContainerDashboard}`}>
                    <TypographyAvatar
                      size={avatarSize}
                      className={`${styles.avatar} ${variant === 'full' ? styles.avatarFull : styles.avatarDashboard}`}
                    >
                      {getProviderIcon(integration.provider, metadata)}
                    </TypographyAvatar>
                    <div className={styles.infoContainer}>
                      <div className={styles.headerRow}>
                        <TypographyText strong className={`${styles.title} ${variant === 'full' ? styles.titleFull : styles.titleDashboard}`}>
                          {metadata?.display_name || 
                           integration.provider.replace('_', ' ').toUpperCase()}
                        </TypographyText>
                        <TypographyText className={`${styles.date} ${variant === 'full' ? styles.dateFull : styles.dateDashboard}`}>
                          {new Date(integration.created_at).toLocaleDateString()}
                        </TypographyText>
                      </div>
                      <div className={styles.bottomRow}>
                        <TypographyTag 
                          color={getStatusColor(integration.status)}
                          icon={getStatusIcon(integration.status)}
                          className={`${styles.tag} ${variant === 'full' ? styles.tagFull : styles.tagDashboard}`}
                        >
                          {integration.status.toUpperCase()}
                        </TypographyTag>
                        {showActions && ActionsComponent && (
                          <div className={styles.actionsContainer}>
                            <ActionsComponent 
                              integration={integration}
                              onDelete={onDelete}
                              onUpdate={onUpdate}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </TypographyCard>
          </TypographyCol>
        )
      })}
    </TypographyRow>
  )
}

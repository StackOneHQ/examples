'use client'

import { useState } from 'react'
import { Button, Space, Modal, App } from 'antd'
import { EditOutlined, DeleteOutlined, PlusOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import { createClient } from '@/lib/supabase/client'
import { StackOneHub } from './StackOneHub'
import type { Integration } from '@/types'
import { Account } from '@stackone/react-hub/dist/entities/Account'
import { logger } from '@/utils/logger'
import styles from './IntegrationActions.module.css'

// Create type-asserted components
const TypographyButton = Button as any
const TypographySpace = Space as any
const TypographyModal = Modal as any
const EditOutlinedIcon = EditOutlined as any
const DeleteOutlinedIcon = DeleteOutlined as any
const PlusOutlinedIcon = PlusOutlined as any
const ExclamationCircleOutlinedIcon = ExclamationCircleOutlined as any

interface IntegrationActionsProps {
  integration: Integration
  onDelete: (id: string) => void
  onUpdate: () => void
}

export function IntegrationActions({ integration, onDelete, onUpdate }: IntegrationActionsProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const supabase = createClient()
  const { modal, message } = App.useApp()

  const handleDelete = async () => {
    modal.confirm({
      title: 'Delete Integration',
      content: 'Are you sure you want to delete this integration?',
      icon: <ExclamationCircleOutlinedIcon />,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        setIsDeleting(true)
        try {
          // First, check if any agents are using this integration
          const { data: agentIntegrations, error: checkError } = await supabase
            .from('agent_integrations')
            .select(`
              agent_id,
              agents!inner(
                id,
                name
              )
            `)
            .eq('integration_id', integration.id)

          if (checkError) {
            throw new Error('Failed to check agent usage')
          }

          if (agentIntegrations && agentIntegrations.length > 0) {
            const agentNames = agentIntegrations.map(ai => (ai.agents as any).name).join(', ')
            modal.error({
              title: 'Cannot Delete Integration',
              content: `This integration is currently being used by the following agents: ${agentNames}. Please remove this integration from those agents first before deleting it.`,
              okText: 'OK',
              icon: <ExclamationCircleOutlinedIcon />
            })
            setIsDeleting(false)
            return // Exit early to prevent deletion
          }

          // First, delete the account from StackOne
          if (integration.stackone_account_id) {
            const deleteResponse = await fetch('/api/stackone/delete-account', {
              method: 'DELETE',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                accountId: integration.stackone_account_id
              })
            })

            if (!deleteResponse.ok) {
              const errorData = await deleteResponse.json()
              throw new Error(errorData.error || 'Failed to delete account from StackOne')
            }
          }

          // Then, delete the integration from Supabase
          const { error } = await supabase
            .from('integrations')
            .delete()
            .eq('id', integration.id)

          if (error) throw error
          onDelete(integration.id)
          message.success('Integration deleted successfully')
        } catch (err) {
          logger.error('Failed to delete integration:', err)
          message.error(`Failed to delete integration: ${err instanceof Error ? err.message : 'Unknown error'}`)
        } finally {
          setIsDeleting(false)
        }
      }
    })
  }

  const handleEditSuccess = async (account: Account) => {
    logger.log('account', account)
    try {
      // Update the integration with new account data
      const { error } = await supabase
        .from('integrations')
        .update({
          status: 'active',
          updated_at: new Date().toISOString()
        })
        .eq('id', integration.id)

      if (error) throw error
      onUpdate()
      message.success('Integration updated successfully')
    } catch (err) {
      logger.error('Failed to update integration:', err)
      message.error('Failed to update integration')
    }
  }

  return (
    <>
      <TypographySpace size={4}>
        <TypographyButton
          type="text"
          size="small"
          icon={<EditOutlinedIcon />}
          onClick={() => setIsEditing(true)}
          className={styles.editButton}
          title="Edit integration"
        />
        <TypographyButton
          type="text"
          size="small"
          icon={<DeleteOutlinedIcon />}
          onClick={handleDelete}
          loading={isDeleting}
          className={styles.deleteButton}
          title="Delete integration"
        />
      </TypographySpace>

      <StackOneHub
        isOpen={isEditing}
        provider={integration.provider}
        accountId={integration.stackone_account_id}
        multiple={false}
        onSuccess={handleEditSuccess}
        onError={(error) => {
          logger.error('Edit integration error:', error)
          alert('Failed to edit integration')
          setIsEditing(false)
        }}
        onClose={() => setIsEditing(false)}
      />
    </>
  )
}

interface ConnectProviderProps {
  provider: string
  onSuccess: () => void
}

export function ConnectProvider({ provider, onSuccess }: ConnectProviderProps) {
  const [isConnecting, setIsConnecting] = useState(false)
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const handleConnectSuccess = async (account: Account) => {
    logger.log('Connect success:', account)
    setIsSettingUp(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('User not authenticated')

      // Insert new integrations for each connected account
      const integrations = [{
        user_id: user.id,
        provider: account.provider,
        stackone_account_id: account.id,
        status: 'active'
      }]

      const { error } = await supabase
        .from('integrations')
        .insert(integrations)

      if (error) throw error
      
      // Add a small delay to show the setup message
      await new Promise(resolve => setTimeout(resolve, 1500))
      onSuccess()
    } catch (err) {
      logger.error('Failed to save integration:', err)
      setError('Failed to save integration. Please try again.')
    } finally {
      setIsSettingUp(false)
      setIsConnecting(false) // Close the StackOneHub iframe
    }
  }

  return (
    <>
      <TypographyButton
        type="primary"
        icon={<PlusOutlinedIcon />}
        onClick={() => setIsConnecting(true)}
        className={styles.connectButton}
      >
        Connect
      </TypographyButton>

      <StackOneHub
        isOpen={isConnecting}
        provider={provider}
        multiple={true}
        onSuccess={handleConnectSuccess}
        onError={(error) => {
          logger.error('Connection error:', error)
          setError('Connection failed. Please try again.')
          setIsConnecting(false)
        }}
        onClose={() => setIsConnecting(false)}
      />

      {/* Setup Loading Modal */}
      <TypographyModal
        open={isSettingUp}
        closable={false}
        footer={null}
        centered
        className={styles.modal}
      >
        <div className={styles.modalContent}>
          <div className={styles.loadingIconContainer}>
            <div className={styles.loadingSpinner} />
          </div>
          <h3 className={styles.loadingTitle}>
            Setting up your integration
          </h3>
          <p className={styles.loadingText}>
            Please wait while we configure your {provider.replace('_', ' ')} connection...
          </p>
        </div>
      </TypographyModal>

      {/* Error Modal */}
      <TypographyModal
        open={!!error}
        onCancel={() => setError(null)}
        footer={null}
        centered
        className={styles.modal}
      >
        <div className={styles.modalContent}>
          <div className={styles.errorIconContainer}>
            <ExclamationCircleOutlinedIcon className={styles.errorIcon} />
          </div>
          <h3 className={styles.errorTitle}>
            Connection Failed
          </h3>
          <p className={styles.errorText}>
            {error}
          </p>
          <TypographyButton
            type="primary"
            onClick={() => setError(null)}
            className={styles.tryAgainButton}
          >
            Try Again
          </TypographyButton>
        </div>
      </TypographyModal>
    </>
  )
}

'use client'

import React, { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { RobotOutlined } from '@ant-design/icons'
import { StreamingChatInterface } from '@/components/StreamingChatInterface'
import { logger } from '@/utils/logger'
import type { Agent } from '@/types'
import styles from './AgentChatPage.module.css'
import { 
  handleLinkMouseEnter, 
  handleLinkMouseLeave, 
  handleEditButtonMouseEnter, 
  handleEditButtonMouseLeave 
} from './agentChatUtils'

export default function AgentChatPage() {
  const [agent, setAgent] = useState<Agent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [threadStats, setThreadStats] = useState<{
    totalThreads: number
    activeThreads: number
    totalMessages: number
  } | null>(null)
  const params = useParams()
  const router = useRouter()
  const agentId = params.id as string

  useEffect(() => {
    loadAgent()
    loadThreadStats()
  }, [agentId])

  const loadAgent = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/agents/${agentId}`, { credentials: 'include' })
      if (!res.ok) throw new Error('Agent not found')
      const { agent: data } = await res.json()
      setAgent(data)
    } catch (err) {
      setError('Failed to load agent')
      logger.error(err)
    } finally {
      setLoading(false)
    }
  }

  const loadThreadStats = async () => {
    try {
      const response = await fetch(`/api/threads/stats?agentId=${agentId}`)
      if (response.ok) {
        const stats = await response.json()
        setThreadStats(stats)
      }
    } catch (err) {
      logger.error('Failed to load thread stats:', err)
    }
  }

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorContent}>
          <i className={`bi bi-robot ${styles.errorIcon}`}></i>
          <h2 className={styles.errorTitle}>Agent not found</h2>
          <p className={styles.errorMessage}>The agent you&apos;re looking for doesn&apos;t exist.</p>
          <Link
            href="/agents"
            className={styles.errorBackLink}
          >
            Back to Agents
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerContent}>
          <div className={styles.leftSection}>
            <Link
              href="/agents"
              className={styles.backLink}
              onMouseEnter={(e) => handleLinkMouseEnter(e)}
              onMouseLeave={(e) => handleLinkMouseLeave(e)}
            >
              <i className="bi bi-arrow-left"></i>
              <span>Back to Agents</span>
            </Link>
            <div className={styles.divider} />
            <div className={styles.agentInfo}>
              <div className={styles.agentIcon}>
                <RobotOutlined style={{ fontSize: '24px' }} />
              </div>
              <div className={styles.agentDetails}>
                <div className={styles.agentName}>
                  {agent.name}
                </div>
                {agent.description && (
                  <div className={styles.agentDescription}>
                    {agent.description}
                  </div>
                )}
                {threadStats && (
                  <div className={styles.threadStats}>
                    <span>{threadStats.activeThreads} active threads</span>
                    <span>{threadStats.totalMessages} messages</span>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Edit Button */}
          <Link
            href={`/agents/${agent.id}/edit`}
            className={styles.editButton}
            onMouseEnter={handleEditButtonMouseEnter}
            onMouseLeave={handleEditButtonMouseLeave}
          >
            <i className="bi bi-pencil"></i>
            <span>Edit Agent</span>
          </Link>
        </div>
      </div>

      {/* Chat Interface */}
      <div className={styles.chatContainer}>
        <StreamingChatInterface agentId={agent.id} />
      </div>
    </div>
  )
}

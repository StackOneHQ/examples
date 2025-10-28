'use client'

import { useCallback, useEffect, useRef } from 'react'
import { useStackOneHub } from '@stackone/react-hub'
import { Account } from '@stackone/react-hub/dist/entities/Account'

interface StackOneHubProps {
  isOpen: boolean
  provider?: string
  multiple?: boolean
  accountId?: string // For editing existing integration
  onSuccess?: (account: Account) => void
  onError?: (error: unknown) => void
  onClose?: () => void
}

export function StackOneHub({ 
  isOpen, 
  provider, 
  multiple = false,
  accountId,
  onSuccess,
  onError,
  onClose
}: StackOneHubProps) {
  
  const messageListenerRef = useRef<((event: MessageEvent) => void) | null>(null)
  const { startConnect } = useStackOneHub()

  // Handle postMessage events from StackOne iframe
  const handleMessage = useCallback((event: MessageEvent) => {
    // Security: Only accept messages from StackOne domains
    const allowedOrigins = [
      'https://hub.stackone.com',
      'https://api.stackone.com',
      'https://stackone.com'
    ]
    
    if (!allowedOrigins.some(origin => event.origin.startsWith(origin))) {
      return
    }

    try {
      let messageData = event.data
      
      // Handle both string and object data
      if (typeof messageData === 'string') {
        try {
          messageData = JSON.parse(messageData)
        } catch {
          return
        }
      }

      // Handle different event types
      switch (messageData.type) {
        case 'STACKONE_CONNECT_SUCCESS':
        case 'connect_success':
        case 'connection_success':
          if (onSuccess && messageData.account) {
            onSuccess(messageData.account)
          }
          break

        case 'STACKONE_CONNECT_ERROR':
        case 'connect_error':
        case 'connection_error':
          if (onError) {
            onError(messageData.error || messageData)
          }
          break

        case 'STACKONE_CONNECT_CLOSE':
        case 'connect_close':
        case 'connection_close':
          if (onClose) {
            onClose()
          }
          break
      }
    } catch (error) {
      console.error('Error handling StackOne message:', error)
    }
  }, [onSuccess, onError, onClose])

  // Set up message listener
  useEffect(() => {
    if (isOpen) {
      messageListenerRef.current = handleMessage
      window.addEventListener('message', handleMessage)
      
      return () => {
        window.removeEventListener('message', handleMessage)
        messageListenerRef.current = null
      }
    }
  }, [isOpen, handleMessage])

  const startFlow = useCallback(async () => {
    try {
      const sessionToken = await getSessionTokenForUser(provider, accountId, multiple)
      
      const connectOptions = {
        sessionToken: sessionToken.token,
        onSuccess: (account: Account) => {
          if (onSuccess) {
            onSuccess(account)
          }
        },
        onCancel: () => {
          // User cancelled the flow
          if (onClose) {
            onClose()
          }
        },
        onClose: () => {
          if (onClose) {
            onClose()
          }
        }
      }
      
      startConnect(connectOptions)
      
    } catch (error) {
      console.error('StackOneHub: Error starting flow', error)
      if (onError) {
        onError(error)
      }
    }
  }, [provider, accountId, multiple, startConnect, onSuccess, onError, onClose])

  // Auto-start the flow when the component opens
  useEffect(() => {
    if (isOpen) {
      startFlow()
    }
  }, [isOpen, startFlow])

  return null
}

// Session token utility function
const getSessionTokenForUser = async (
  provider?: string,
  accountId?: string,
  multiple: boolean = false
): Promise<{ token: string }> => {
  try {
    // Get current user from localStorage (set during login)
    const currentUser = localStorage.getItem('currentUser');
    if (!currentUser) {
      throw new Error('User not authenticated');
    }
    
    const user = JSON.parse(currentUser);
    
    const payload = {
      origin_owner_id: user.id,
      origin_owner_name: user.username,
      provider,
      account_id: accountId,
      multiple
    }

    const response = await fetch('/api/stackone/connect-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error('Failed to get connect session token')
    }

    const data = await response.json()
    return { token: data.token }
  } catch (error) {
    console.error('Error retrieving connect session token:', error)
    throw error
  }
}

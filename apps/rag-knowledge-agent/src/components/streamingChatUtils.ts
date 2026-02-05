/**
 * Utility functions for StreamingChatInterface component
 */

/**
 * Handles mouse enter events for new chat button
 * @param e - Mouse event
 */
export const handleNewChatMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.transform = 'translateY(-1px)'
  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
}

/**
 * Handles mouse leave events for new chat button
 * @param e - Mouse event
 */
export const handleNewChatMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.transform = 'translateY(0)'
  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
}

/**
 * Handles mouse enter events for thread items
 * @param e - Mouse event
 * @param isActive - Whether the thread is currently active
 */
export const handleThreadMouseEnter = (e: React.MouseEvent<HTMLDivElement>, isActive: boolean) => {
  if (!isActive) {
    e.currentTarget.style.backgroundColor = 'rgba(80, 80, 80, 0.04)'
    e.currentTarget.style.transform = 'translateX(4px)'
  }
}

/**
 * Handles mouse leave events for thread items
 * @param e - Mouse event
 * @param isActive - Whether the thread is currently active
 */
export const handleThreadMouseLeave = (e: React.MouseEvent<HTMLDivElement>, isActive: boolean) => {
  if (!isActive) {
    e.currentTarget.style.backgroundColor = 'transparent'
    e.currentTarget.style.transform = 'translateX(0)'
  }
}

/**
 * Handles mouse enter events for agent cards
 * @param e - Mouse event
 */
export const handleAgentCardMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.12)'
  e.currentTarget.style.borderColor = '#d9d9d9'
}

/**
 * Handles mouse leave events for agent cards
 * @param e - Mouse event
 */
export const handleAgentCardMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.06)'
  e.currentTarget.style.borderColor = '#f0f0f0'
}

/**
 * Handles mouse enter events for source pills
 * @param e - Mouse event
 */
export const handleSourcePillMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
  e.currentTarget.style.backgroundColor = 'rgba(240, 240, 240, 1)'
}

/**
 * Handles mouse leave events for source pills
 * @param e - Mouse event
 */
export const handleSourcePillMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
  e.currentTarget.style.backgroundColor = 'rgba(240, 240, 240, 0.8)'
}

/**
 * Handles mouse enter events for send button
 * @param e - Mouse event
 * @param isStreaming - Whether the chat is currently streaming
 */
export const handleSendButtonMouseEnter = (e: React.MouseEvent<HTMLButtonElement>, isStreaming: boolean) => {
  if (!isStreaming) {
    e.currentTarget.style.transform = 'translateY(-1px)'
    e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
  }
}

/**
 * Handles mouse leave events for send button
 * @param e - Mouse event
 */
export const handleSendButtonMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.transform = 'translateY(0)'
  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
}

/**
 * Handles mouse enter events for save button
 * @param e - Mouse event
 */
export const handleSaveButtonMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.transform = 'translateY(-1px)'
  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)'
}

/**
 * Handles mouse leave events for save button
 * @param e - Mouse event
 */
export const handleSaveButtonMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.transform = 'translateY(0)'
  e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)'
}

/**
 * Handles mouse enter events for cancel button
 * @param e - Mouse event
 */
export const handleCancelButtonMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 1)'
}

/**
 * Handles mouse leave events for cancel button
 * @param e - Mouse event
 */
export const handleCancelButtonMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.9)'
}

/**
 * Handles mouse enter events for message wrapper (to show edit button)
 * @param e - Mouse event
 */
export const handleMessageWrapperMouseEnter = (e: React.MouseEvent<HTMLDivElement>) => {
  const editButton = e.currentTarget.querySelector('.edit-button-hover') as HTMLElement
  if (editButton) editButton.style.opacity = '1'
}

/**
 * Handles mouse leave events for message wrapper (to hide edit button)
 * @param e - Mouse event
 */
export const handleMessageWrapperMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
  const editButton = e.currentTarget.querySelector('.edit-button-hover') as HTMLElement
  if (editButton) editButton.style.opacity = '0.3'
}

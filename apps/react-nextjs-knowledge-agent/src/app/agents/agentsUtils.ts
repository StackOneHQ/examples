/**
 * Utility functions for Agents Page
 */

/**
 * Handles mouse enter events for new agent button
 * @param e - Mouse event
 */
export const handleNewAgentButtonMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.backgroundColor = '#333333'
  e.currentTarget.style.borderColor = '#333333'
  e.currentTarget.style.transform = 'translateY(-1px)'
  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)'
}

/**
 * Handles mouse leave events for new agent button
 * @param e - Mouse event
 */
export const handleNewAgentButtonMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.backgroundColor = '#000000'
  e.currentTarget.style.borderColor = '#000000'
  e.currentTarget.style.transform = 'translateY(0)'
  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'
}

/**
 * Handles mouse enter events for create agent button
 * @param e - Mouse event
 */
export const handleCreateAgentButtonMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.backgroundColor = '#333333'
  e.currentTarget.style.borderColor = '#333333'
  e.currentTarget.style.transform = 'translateY(-1px)'
  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.15)'
}

/**
 * Handles mouse leave events for create agent button
 * @param e - Mouse event
 */
export const handleCreateAgentButtonMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.backgroundColor = '#000000'
  e.currentTarget.style.borderColor = '#000000'
  e.currentTarget.style.transform = 'translateY(0)'
  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'
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
 * Handles mouse enter events for edit button
 * @param e - Mouse event
 */
export const handleEditButtonMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.color = '#202020'
}

/**
 * Handles mouse leave events for edit button
 * @param e - Mouse event
 */
export const handleEditButtonMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.color = '#707070'
}

/**
 * Handles mouse enter events for delete button
 * @param e - Mouse event
 */
export const handleDeleteButtonMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.color = '#d9363e'
}

/**
 * Handles mouse leave events for delete button
 * @param e - Mouse event
 */
export const handleDeleteButtonMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
  e.currentTarget.style.color = '#ff4d4f'
}

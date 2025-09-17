/**
 * Utility functions for Agent Chat Page
 */

/**
 * Handles mouse enter events for navigation links
 * @param e - Mouse event
 * @param backgroundColor - Background color to apply on hover
 * @param textColor - Text color to apply on hover
 */
export const handleLinkMouseEnter = (
  e: React.MouseEvent<HTMLAnchorElement>,
  backgroundColor: string = '#f5f5f5',
  textColor: string = '#202020'
) => {
  e.currentTarget.style.backgroundColor = backgroundColor;
  e.currentTarget.style.color = textColor;
};

/**
 * Handles mouse leave events for navigation links
 * @param e - Mouse event
 * @param backgroundColor - Background color to reset to
 * @param textColor - Text color to reset to
 */
export const handleLinkMouseLeave = (
  e: React.MouseEvent<HTMLAnchorElement>,
  backgroundColor: string = 'transparent',
  textColor: string = '#707070'
) => {
  e.currentTarget.style.backgroundColor = backgroundColor;
  e.currentTarget.style.color = textColor;
};

/**
 * Handles mouse enter events for edit button
 * @param e - Mouse event
 */
export const handleEditButtonMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
  e.currentTarget.style.backgroundColor = '#f5f5f5';
  e.currentTarget.style.borderColor = '#d0d0d0';
  e.currentTarget.style.color = '#202020';
};

/**
 * Handles mouse leave events for edit button
 * @param e - Mouse event
 */
export const handleEditButtonMouseLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
  e.currentTarget.style.backgroundColor = 'white';
  e.currentTarget.style.borderColor = '#e0e0e0';
  e.currentTarget.style.color = '#707070';
};

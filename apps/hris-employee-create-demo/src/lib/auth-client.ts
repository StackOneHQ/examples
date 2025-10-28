/**
 * Client-side utility for making authenticated API requests
 */

export function getAuthHeaders(): HeadersInit {
  const sessionId = localStorage.getItem('sessionId');
  
  if (!sessionId) {
    return {
      'Content-Type': 'application/json'
    };
  }
  
  return {
    'Content-Type': 'application/json',
    'x-session-id': sessionId
  };
}

export function getCurrentUserFromStorage() {
  const currentUser = localStorage.getItem('currentUser');
  if (!currentUser) {
    return null;
  }
  
  try {
    return JSON.parse(currentUser);
  } catch (error) {
    console.error('Error parsing current user from storage:', error);
    return null;
  }
}

export function clearAuthData() {
  localStorage.removeItem('currentUser');
  localStorage.removeItem('sessionId');
}

export async function makeAuthenticatedRequest(url: string, options: RequestInit = {}) {
  const headers = {
    ...getAuthHeaders(),
    ...options.headers
  };
  
  const response = await fetch(url, {
    ...options,
    headers
  });
  
  // If unauthorized, clear auth data and redirect to login
  if (response.status === 401) {
    clearAuthData();
    window.location.href = '/login';
    throw new Error('Session expired. Please log in again.');
  }
  
  return response;
}

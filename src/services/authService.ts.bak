/**
 * Authentication service to manage user state and ID
 */

// Event emitter for auth state changes
class AuthEventEmitter {
  private listeners: { [event: string]: Array<(data?: any) => void> } = {};

  on(event: string, callback: (data?: any) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  emit(event: string, data?: any) {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => callback(data));
    }
  }
}

// Create event emitter instance
const authEvents = new AuthEventEmitter();

// User ID storage key
const USER_ID_KEY = 'dingplan_user_id';
const AUTH_STATUS_KEY = 'dingplan_auth_status';

/**
 * Get the current user ID from localStorage
 * Returns 'anonymous' if no user is signed in
 */
export const getCurrentUserId = (): string => {
  return localStorage.getItem(USER_ID_KEY) || 'anonymous';
};

/**
 * Check if a user is currently authenticated
 */
export const isAuthenticated = (): boolean => {
  return localStorage.getItem(AUTH_STATUS_KEY) === 'authenticated';
};

/**
 * Set the current user ID when a user signs in
 */
export const setCurrentUser = (userId: string): void => {
  if (!userId) {
    console.error('[AuthService] Cannot set user ID: Invalid user ID provided');
    return;
  }
  
  try {
    // Store the user ID
    localStorage.setItem(USER_ID_KEY, userId);
    localStorage.setItem(AUTH_STATUS_KEY, 'authenticated');
    
    // Notify listeners that auth state has changed
    authEvents.emit('authStateChanged', { userId, authenticated: true });
    
    console.log(`[AuthService] User authenticated: ${userId}`);
  } catch (error) {
    console.error('[AuthService] Error setting user authentication:', error);
  }
};

/**
 * Clear the current user ID when a user signs out
 */
export const clearCurrentUser = (): void => {
  try {
    // Remove the user ID
    localStorage.removeItem(USER_ID_KEY);
    localStorage.setItem(AUTH_STATUS_KEY, 'anonymous');
    
    // Notify listeners that auth state has changed
    authEvents.emit('authStateChanged', { userId: 'anonymous', authenticated: false });
    
    console.log('[AuthService] User signed out');
  } catch (error) {
    console.error('[AuthService] Error clearing user authentication:', error);
  }
};

/**
 * Subscribe to authentication state changes
 */
export const onAuthStateChanged = (callback: (state: { userId: string; authenticated: boolean }) => void): void => {
  authEvents.on('authStateChanged', callback);
};

// Export the default object
export default {
  getCurrentUserId,
  isAuthenticated,
  setCurrentUser,
  clearCurrentUser,
  onAuthStateChanged
}; 
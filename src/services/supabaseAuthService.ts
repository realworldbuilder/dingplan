/**
 * Supabase Authentication service to manage user state and authentication
 */

import { supabase } from '../config/supabase'
import type { User } from '@supabase/supabase-js'

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

// User ID storage key for localStorage fallback
const USER_ID_KEY = 'dingplan_user_id';
const AUTH_STATUS_KEY = 'dingplan_auth_status';

/**
 * Get the current user from Supabase session or localStorage
 */
export const getCurrentUser = async (): Promise<User | null> => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/**
 * Get the current user ID
 * Returns 'anonymous' if no user is signed in
 */
export const getCurrentUserId = (): string => {
  // Try to get from current session first
  const session = supabase.auth.getSession()
  if (session) {
    session.then(({ data }) => {
      if (data.session?.user) {
        return data.session.user.id
      }
    })
  }
  
  // Fallback to localStorage
  return localStorage.getItem(USER_ID_KEY) || 'anonymous'
}

/**
 * Check if a user is currently authenticated
 */
export const isAuthenticated = async (): Promise<boolean> => {
  const { data: { user } } = await supabase.auth.getUser()
  return !!user
}

/**
 * Check if authenticated synchronously (for compatibility)
 */
export const isAuthenticatedSync = (): boolean => {
  return localStorage.getItem(AUTH_STATUS_KEY) === 'authenticated'
}

/**
 * Sign up with email and password
 */
export const signUp = async (email: string, password: string) => {
  console.log('[SupabaseAuth] Signing up user:', email)
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  
  if (error) {
    console.error('[SupabaseAuth] Sign up error:', error)
    throw error
  }
  
  console.log('[SupabaseAuth] Sign up successful:', data.user?.id)
  return data
}

/**
 * Sign in with email and password
 */
export const signIn = async (email: string, password: string) => {
  console.log('[SupabaseAuth] Signing in user:', email)
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  
  if (error) {
    console.error('[SupabaseAuth] Sign in error:', error)
    throw error
  }
  
  console.log('[SupabaseAuth] Sign in successful:', data.user?.id)
  return data
}

/**
 * Sign in with Google OAuth
 */
export const signInWithGoogle = async () => {
  console.log('[SupabaseAuth] Signing in with Google')
  
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin
    }
  })
  
  if (error) {
    console.error('[SupabaseAuth] Google sign in error:', error)
    throw error
  }
  
  return data
}

/**
 * Sign out the current user
 */
export const signOut = async () => {
  console.log('[SupabaseAuth] Signing out user')
  
  const { error } = await supabase.auth.signOut()
  
  if (error) {
    console.error('[SupabaseAuth] Sign out error:', error)
    throw error
  }
  
  // Clear localStorage
  localStorage.removeItem(USER_ID_KEY)
  localStorage.setItem(AUTH_STATUS_KEY, 'anonymous')
  
  // Notify listeners
  authEvents.emit('authStateChanged', { userId: 'anonymous', authenticated: false })
  
  console.log('[SupabaseAuth] User signed out successfully')
}

/**
 * Set the current user ID when a user signs in (for compatibility)
 */
export const setCurrentUser = (userId: string): void => {
  if (!userId) {
    console.error('[SupabaseAuth] Cannot set user ID: Invalid user ID provided')
    return
  }
  
  try {
    // Store the user ID
    localStorage.setItem(USER_ID_KEY, userId)
    localStorage.setItem(AUTH_STATUS_KEY, 'authenticated')
    
    // Notify listeners that auth state has changed
    authEvents.emit('authStateChanged', { userId, authenticated: true })
    
    console.log(`[SupabaseAuth] User authenticated: ${userId}`)
  } catch (error) {
    console.error('[SupabaseAuth] Error setting user authentication:', error)
  }
}

/**
 * Clear the current user ID when a user signs out (for compatibility)
 */
export const clearCurrentUser = (): void => {
  try {
    // Remove the user ID
    localStorage.removeItem(USER_ID_KEY)
    localStorage.setItem(AUTH_STATUS_KEY, 'anonymous')
    
    // Notify listeners that auth state has changed
    authEvents.emit('authStateChanged', { userId: 'anonymous', authenticated: false })
    
    console.log('[SupabaseAuth] User signed out')
  } catch (error) {
    console.error('[SupabaseAuth] Error clearing user authentication:', error)
  }
}

/**
 * Subscribe to authentication state changes
 */
export const onAuthStateChanged = (callback: (state: { userId: string; authenticated: boolean }) => void): void => {
  // Listen to Supabase auth changes
  supabase.auth.onAuthStateChange((event, session) => {
    console.log('[SupabaseAuth] Auth state changed:', event, session?.user?.id)
    
    if (session?.user) {
      // User signed in
      setCurrentUser(session.user.id)
      callback({ userId: session.user.id, authenticated: true })
    } else {
      // User signed out
      clearCurrentUser()
      callback({ userId: 'anonymous', authenticated: false })
    }
  })
  
  // Also listen to custom events for compatibility
  authEvents.on('authStateChanged', callback)
}

// Export the default object for compatibility
export default {
  getCurrentUser,
  getCurrentUserId,
  isAuthenticated,
  isAuthenticatedSync,
  signUp,
  signIn,
  signInWithGoogle,
  signOut,
  setCurrentUser,
  clearCurrentUser,
  onAuthStateChanged
}
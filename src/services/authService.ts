import { supabase } from './supabase';
import { cleanupLegacyAuth } from '../utils/localStorage';
import type { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
  emailConfirmed: boolean;
}

class AuthService {
  private currentUser: AuthUser | null = null;
  private session: Session | null = null;
  private listeners: Array<(user: AuthUser | null) => void> = [];

  constructor() {
    // Initialize auth state
    this.initialize();
  }

  private async initialize() {
    try {
      // Clean up any legacy auth keys
      cleanupLegacyAuth();
      
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession();
      this.session = session;
      this.currentUser = session?.user ? this.mapUser(session.user) : null;

      // Listen for auth changes
      supabase.auth.onAuthStateChange((event: AuthChangeEvent, session: Session | null) => {
        console.log('Auth state changed:', event, session?.user?.email);
        this.session = session;
        this.currentUser = session?.user ? this.mapUser(session.user) : null;
        this.notifyListeners();
      });
    } catch (error) {
      console.error('Failed to initialize auth:', error);
    }
  }

  private mapUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email!,
      emailConfirmed: !!user.email_confirmed_at
    };
  }

  private notifyListeners() {
    this.listeners.forEach(callback => {
      try {
        callback(this.currentUser);
      } catch (error) {
        console.error('Error in auth listener:', error);
      }
    });
  }

  async signUp(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      });

      if (error) {
        return { user: null, error: error.message };
      }

      return {
        user: data.user ? this.mapUser(data.user) : null,
        error: null
      };
    } catch (error) {
      return { user: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async signIn(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return { user: null, error: error.message };
      }

      return {
        user: data.user ? this.mapUser(data.user) : null,
        error: null
      };
    } catch (error) {
      return { user: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async signInWithGoogle(): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}`
        }
      });

      return { error: error ? error.message : null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async signOut(): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.signOut();
      return { error: error ? error.message : null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  getSession(): Session | null {
    return this.session;
  }

  onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    this.listeners.push(callback);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(listener => listener !== callback);
    };
  }
}

// Export singleton instance
export const authService = new AuthService();
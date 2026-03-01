import { supabase } from '../config/supabase';
import type { User, AuthResponse } from '@supabase/supabase-js';

export interface AuthUser {
  id: string;
  email: string;
}

export class AuthService {
  /**
   * Sign up a new user with email and password
   */
  static async signUp(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        return { user: null, error: error.message };
      }

      if (!data.user) {
        return { user: null, error: 'No user returned from sign up' };
      }

      const user: AuthUser = {
        id: data.user.id,
        email: data.user.email || '',
      };

      return { user, error: null };
    } catch (error) {
      return { user: null, error: error instanceof Error ? error.message : 'Unknown error during sign up' };
    }
  }

  /**
   * Sign in a user with email and password
   */
  static async signIn(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { user: null, error: error.message };
      }

      if (!data.user) {
        return { user: null, error: 'No user returned from sign in' };
      }

      const user: AuthUser = {
        id: data.user.id,
        email: data.user.email || '',
      };

      return { user, error: null };
    } catch (error) {
      return { user: null, error: error instanceof Error ? error.message : 'Unknown error during sign in' };
    }
  }

  /**
   * Sign out the current user
   */
  static async signOut(): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.signOut();
      return { error: error ? error.message : null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error during sign out' };
    }
  }

  /**
   * Get the current user
   */
  static async getUser(): Promise<AuthUser | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        return null;
      }

      return {
        id: user.id,
        email: user.email || '',
      };
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  /**
   * Listen to auth state changes
   */
  static onAuthStateChange(callback: (user: AuthUser | null) => void) {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      let user: AuthUser | null = null;
      
      if (session?.user) {
        user = {
          id: session.user.id,
          email: session.user.email || '',
        };
      }
      
      callback(user);
    });
  }
}
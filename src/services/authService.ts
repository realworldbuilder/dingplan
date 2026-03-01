import { supabase } from '../config/supabase';

export interface AuthUser {
  id: string;
  email: string;
}

export class AuthService {
  /**
   * Check if Supabase is available
   */
  private static get isAvailable(): boolean {
    return supabase !== null;
  }

  /**
   * Sign up a new user with email and password
   */
  static async signUp(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
    if (!this.isAvailable) return { user: null, error: 'Cloud features not configured' };
    try {
      const { data, error } = await supabase!.auth.signUp({ email, password });
      if (error) return { user: null, error: error.message };
      if (!data.user) return { user: null, error: 'No user returned from sign up' };
      return { user: { id: data.user.id, email: data.user.email || '' }, error: null };
    } catch (error) {
      return { user: null, error: error instanceof Error ? error.message : 'Unknown error during sign up' };
    }
  }

  /**
   * Sign in a user with email and password
   */
  static async signIn(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
    if (!this.isAvailable) return { user: null, error: 'Cloud features not configured' };
    try {
      const { data, error } = await supabase!.auth.signInWithPassword({ email, password });
      if (error) return { user: null, error: error.message };
      if (!data.user) return { user: null, error: 'No user returned from sign in' };
      return { user: { id: data.user.id, email: data.user.email || '' }, error: null };
    } catch (error) {
      return { user: null, error: error instanceof Error ? error.message : 'Unknown error during sign in' };
    }
  }

  /**
   * Sign out the current user
   */
  static async signOut(): Promise<{ error: string | null }> {
    if (!this.isAvailable) return { error: null };
    try {
      const { error } = await supabase!.auth.signOut();
      return { error: error ? error.message : null };
    } catch (error) {
      return { error: error instanceof Error ? error.message : 'Unknown error during sign out' };
    }
  }

  /**
   * Get the current user
   */
  static async getUser(): Promise<AuthUser | null> {
    if (!this.isAvailable) return null;
    try {
      const { data: { user } } = await supabase!.auth.getUser();
      if (!user) return null;
      return { id: user.id, email: user.email || '' };
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  /**
   * Listen to auth state changes
   */
  static onAuthStateChange(callback: (user: AuthUser | null) => void) {
    if (!this.isAvailable) return { data: { subscription: { unsubscribe: () => {} } } };
    return supabase!.auth.onAuthStateChange(async (_event, session) => {
      let user: AuthUser | null = null;
      if (session?.user) {
        user = { id: session.user.id, email: session.user.email || '' };
      }
      callback(user);
    });
  }
}

import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { 
  signIn, 
  signUp, 
  signOut, 
  signInWithGoogle,
  setCurrentUser, 
  clearCurrentUser 
} from '../../services/supabaseAuthService';
import './auth-styles.css';

/**
 * Supabase-powered auth component for the sidebar
 */
const SidebarAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('signin'); // 'signin' or 'signup'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get initial session and set up auth listener
  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        console.log('[SidebarAuth] Initial session found:', session.user.id);
        setCurrentUser(session.user.id);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[SidebarAuth] Auth state changed:', event, session?.user?.id);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (session?.user) {
        // User signed in
        console.log('[SidebarAuth] User signed in:', session.user.id);
        setCurrentUser(session.user.id);
        
        // Dispatch event to notify the application
        const authChangeEvent = new CustomEvent('auth-state-changed', {
          detail: { 
            authenticated: true,
            userId: session.user.id
          }
        });
        document.dispatchEvent(authChangeEvent);
      } else {
        // User signed out
        console.log('[SidebarAuth] User signed out');
        clearCurrentUser();
        
        // Dispatch event to notify the application
        const authChangeEvent = new CustomEvent('auth-state-changed', {
          detail: { 
            authenticated: false,
            userId: 'anonymous'
          }
        });
        document.dispatchEvent(authChangeEvent);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleInputChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    setError('');
  };

  const handleSignIn = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      if (!formData.email || !formData.password) {
        throw new Error('Please enter both email and password');
      }

      await signIn(formData.email, formData.password);
      setFormData({ email: '', password: '', confirmPassword: '' });
    } catch (err) {
      setError(err.message || 'Failed to sign in');
      console.error('[SidebarAuth] Sign in error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      if (!formData.email || !formData.password) {
        throw new Error('Please enter both email and password');
      }

      if (formData.password !== formData.confirmPassword) {
        throw new Error('Passwords do not match');
      }

      if (formData.password.length < 6) {
        throw new Error('Password must be at least 6 characters');
      }

      await signUp(formData.email, formData.password);
      setFormData({ email: '', password: '', confirmPassword: '' });
      setError('Check your email for the confirmation link');
    } catch (err) {
      setError(err.message || 'Failed to sign up');
      console.error('[SidebarAuth] Sign up error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsSubmitting(true);
    setError('');

    try {
      await signInWithGoogle();
    } catch (err) {
      setError(err.message || 'Failed to sign in with Google');
      console.error('[SidebarAuth] Google sign in error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    try {
      console.log('[SidebarAuth] Signing out user');
      
      // Clear current project state
      localStorage.removeItem('currentProjectId');
      
      // Clear auth service state
      clearCurrentUser();
      
      // Dispatch event to clear canvas state before sign out
      const authChangeEvent = new CustomEvent('auth-state-changed', {
        detail: { 
          authenticated: false,
          userId: 'anonymous',
          action: 'signout'
        }
      });
      document.dispatchEvent(authChangeEvent);
      
      // Clear relevant localStorage items
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('dingplan_') || key.startsWith('currentProjectId')) {
          console.log(`[SidebarAuth] Clearing localStorage item: ${key}`);
          localStorage.removeItem(key);
        }
      });
      
      // Sign out from Supabase
      await signOut();
    } catch (err) {
      console.error('[SidebarAuth] Sign out error:', err);
    }
  };

  if (loading) {
    return (
      <div className="auth-container-minimal">
        <div className="auth-logo-container">
          <div className="text-logo">dingplanPM</div>
        </div>
        <div className="auth-message">Loading...</div>
      </div>
    );
  }

  if (user) {
    // User is signed in
    return (
      <div className="auth-container-minimal">
        <div className="auth-logo-container">
          <div className="text-logo">dingplanPM</div>
        </div>
        <div className="user-info">
          <div className="user-avatar">
            {user.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <span className="user-name">
            {user.user_metadata?.display_name || user.email?.split('@')[0] || 'User'}
          </span>
        </div>
        <button className="auth-button sign-out" onClick={handleSignOut}>
          Sign Out
        </button>
      </div>
    );
  }

  // User is not signed in
  return (
    <div className="auth-container-minimal">
      <div className="auth-logo-container">
        <div className="text-logo">dingplanPM</div>
      </div>
      
      {error && <div className="auth-error">{error}</div>}
      
      <form onSubmit={authMode === 'signin' ? handleSignIn : handleSignUp}>
        <div className="auth-form">
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleInputChange}
            required
            disabled={isSubmitting}
            className="auth-input"
          />
          
          <input
            type="password"
            name="password"
            placeholder="Password"
            value={formData.password}
            onChange={handleInputChange}
            required
            disabled={isSubmitting}
            className="auth-input"
          />
          
          {authMode === 'signup' && (
            <input
              type="password"
              name="confirmPassword"
              placeholder="Confirm Password"
              value={formData.confirmPassword}
              onChange={handleInputChange}
              required
              disabled={isSubmitting}
              className="auth-input"
            />
          )}
          
          <button 
            type="submit" 
            className="auth-button primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Loading...' : (authMode === 'signin' ? 'Sign In' : 'Sign Up')}
          </button>
        </div>
      </form>
      
      <button 
        className="auth-button google"
        onClick={handleGoogleSignIn}
        disabled={isSubmitting}
      >
        Continue with Google
      </button>
      
      <div className="auth-switch">
        {authMode === 'signin' ? (
          <>
            Don't have an account?{' '}
            <button 
              type="button" 
              className="auth-link"
              onClick={() => {
                setAuthMode('signup');
                setError('');
                setFormData({ email: '', password: '', confirmPassword: '' });
              }}
            >
              Sign Up
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button 
              type="button" 
              className="auth-link"
              onClick={() => {
                setAuthMode('signin');
                setError('');
                setFormData({ email: '', password: '', confirmPassword: '' });
              }}
            >
              Sign In
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default SidebarAuth; 
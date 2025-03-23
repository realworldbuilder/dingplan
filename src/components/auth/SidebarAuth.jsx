import React, { useEffect } from 'react';
import { 
  useClerk, 
  useUser, 
  SignInButton, 
  SignUpButton, 
  UserButton 
} from '@clerk/clerk-react';
import './auth-styles.css';
import { setCurrentUser, clearCurrentUser } from '../../services/authService';

/**
 * Minimalist SidebarAuth component
 */
const SidebarAuth = () => {
  const { isLoaded, isSignedIn, user } = useUser();
  const { signOut } = useClerk();

  // Set user ID in auth service when user authentication state changes
  useEffect(() => {
    console.log('[SidebarAuth] Auth state changed:', { isLoaded, isSignedIn, userId: user?.id });
    
    if (isLoaded) {
      if (isSignedIn && user) {
        // User is signed in, store their ID
        console.log('[SidebarAuth] Setting current user:', user.id);
        setCurrentUser(user.id);
      } else {
        // User is signed out, clear their ID
        console.log('[SidebarAuth] Clearing current user');
        clearCurrentUser();
      }
    }
  }, [isLoaded, isSignedIn, user]);

  const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || '';
  const hasValidKey = clerkPubKey && !clerkPubKey.includes('YOUR_ACTUAL_CLERK_KEY');

  if (!hasValidKey) {
    return (
      <div className="auth-message">
        Add Clerk key to .env
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="auth-message">Loading...</div>;
  }

  if (!isSignedIn) {
    return (
      <div className="auth-container-minimal">
        <div className="auth-logo-container">
          <img src="/dinglogo.png" alt="Dingplan" className="auth-logo" />
        </div>
        <SignInButton mode="modal">
          <button className="auth-button sign-in">Sign In</button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button className="auth-button sign-up">Sign Up</button>
        </SignUpButton>
      </div>
    );
  }

  // Custom sign out handler to clear user ID in auth service
  const handleSignOut = () => {
    console.log('[SidebarAuth] Signing out user');
    clearCurrentUser();
    signOut();
  };

  return (
    <div className="auth-container-minimal">
      <div className="auth-logo-container">
        <img src="/dinglogo.png" alt="Dingplan" className="auth-logo" />
      </div>
      <div className="user-info">
        <UserButton />
        <span className="user-name">{user.firstName || user.fullName || 'User'}</span>
      </div>
      <button className="sign-out" onClick={handleSignOut}>
        Sign Out
      </button>
    </div>
  );
};

export default SidebarAuth; 
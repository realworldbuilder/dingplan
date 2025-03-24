import React, { useEffect, useState } from 'react';
import { useUser } from '@clerk/clerk-react';

/**
 * Main App component that loads the canvas application
 * and handles authentication state
 */
const App = () => {
  const { isSignedIn, user } = useUser();
  const [initialized, setInitialized] = useState(false);

  // Initialize the application when component mounts
  useEffect(() => {
    // Initialize canvas application if not already done
    if (!window.canvasApp && !initialized) {
      console.log('[App] Initializing canvas application...');
      
      // Import main.ts to initialize canvas
      import('./main.ts').then(module => {
        console.log('[App] Canvas module loaded');
        setInitialized(true);
      });
    }
  }, [initialized]);

  // Handle authentication state changes
  useEffect(() => {
    if (!initialized) return;

    // Import auth service
    import('./services/authService').then(authService => {
      const prevAuthState = localStorage.getItem('dingplan_auth_status');
      const currentAuthState = isSignedIn ? 'authenticated' : 'anonymous';
      const authStateChanged = prevAuthState !== currentAuthState;
      
      console.log('[App] Auth state check:', { 
        isSignedIn, 
        prevState: prevAuthState,
        currentState: currentAuthState,
        changed: authStateChanged
      });
      
      if (isSignedIn && user) {
        // User is signed in
        console.log('[App] Clerk user authenticated:', user.id);
        authService.setCurrentUser(user.id);
        
        // Dispatch an event to notify the canvas
        const authEvent = new CustomEvent('auth-state-changed', {
          detail: { 
            authenticated: true, 
            userId: user.id,
            action: authStateChanged ? 'login' : 'update'
          }
        });
        document.dispatchEvent(authEvent);
        
        // Try to trigger project list refresh
        if (authStateChanged && window.canvasApp?.projectManager) {
          console.log('[App] Triggering project list refresh on login');
          // Force project list refresh after a short delay
          setTimeout(() => {
            if (window.canvasApp?.projectManager?.refreshProjectsList) {
              window.canvasApp.projectManager.refreshProjectsList();
            }
          }, 500);
        }
      } else {
        // User is signed out
        if (prevAuthState === 'authenticated') {
          console.log('[App] User signed out, clearing auth state');
          authService.clearCurrentUser();
          
          // Dispatch an event to clear canvas
          const authEvent = new CustomEvent('auth-state-changed', {
            detail: { 
              authenticated: false, 
              userId: 'anonymous',
              action: 'signout'
            }
          });
          document.dispatchEvent(authEvent);
        }
      }
    });
  }, [isSignedIn, user, initialized]);

  return (
    <div id="app-container">
      {/* The canvas app renders directly to the DOM, not through React */}
      {/* This div is just a container to satisfy React's need for a return value */}
    </div>
  );
};

export default App; 
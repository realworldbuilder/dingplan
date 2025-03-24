import React, { useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';

/**
 * Main App component that loads the canvas application
 * and handles authentication state
 */
const App = () => {
  const { isSignedIn, user } = useUser();

  // Initialize the application when component mounts
  useEffect(() => {
    // Import and ensure authService is fully utilized
    import('./services/authService').then(authService => {
      // When user signs in through Clerk, set their ID in auth service
      if (isSignedIn && user) {
        console.log('Clerk user authenticated:', user.id);
        authService.setCurrentUser(user.id);
        // Force refresh window to reset canvas state on auth changes
        if (localStorage.getItem('dingplan_auth_status') !== 'authenticated') {
          window.location.reload();
        }
      } else {
        // Make sure to clear local state when logged out
        if (localStorage.getItem('dingplan_auth_status') === 'authenticated') {
          authService.clearCurrentUser();
          // Force canvas reset on logout
          window.location.reload();
        }
      }
    });
    
    // If there's already an active instance, don't reinitialize
    if (window.canvasApp) return;
    
    // Call main.ts initialization (the canvas is initialized there)
    console.log('App component initializing canvas...');
    
    // Import main.ts to initialize canvas
    import('./main.ts').then(module => {
      console.log('Canvas module loaded');
    });
  }, [isSignedIn, user]);

  return (
    <div id="app-container">
      {/* The canvas app renders directly to the DOM, not through React */}
      {/* This div is just a container to satisfy React's need for a return value */}
    </div>
  );
};

export default App; 
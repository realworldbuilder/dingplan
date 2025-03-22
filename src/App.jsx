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
    // If there's already an active instance, don't reinitialize
    if (window.canvasApp) return;
    
    // Call main.ts initialization (the canvas is initialized there)
    console.log('App component initializing canvas...');
    
    // When user signs in, set their ID in local storage for project service
    if (isSignedIn && user) {
      localStorage.setItem('userId', user.id);
      console.log('User authenticated:', user.id);
    } else {
      // Use anonymous ID if not signed in
      const anonymousId = localStorage.getItem('anonymousUserId') || 
        `anonymous-${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('anonymousUserId', anonymousId);
      localStorage.setItem('userId', anonymousId);
    }
  }, [isSignedIn, user]);

  return (
    <div id="app-container">
      {/* The canvas app renders directly to the DOM, not through React */}
      {/* This div is just a container to satisfy React's need for a return value */}
    </div>
  );
};

export default App; 
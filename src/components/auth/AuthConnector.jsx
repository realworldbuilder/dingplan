import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import SidebarAuth from './SidebarAuth';

/**
 * AuthConnector - Renders the React auth component into the DOM
 * This bridges the gap between the vanilla JS canvas app and React components
 */
class AuthConnector {
  constructor() {
    this.initialized = false;
    console.log('AuthConnector constructor called');
  }

  /**
   * Initialize the auth connector by rendering the React auth component
   * into the sidebar
   */
  init() {
    console.log('Auth connector init called');
    if (this.initialized) {
      console.log('Auth connector already initialized, skipping');
      return;
    }
    
    // Find the auth container in the left sidebar
    const container = document.getElementById('auth-container');
    console.log('Auth container found:', !!container);
    
    if (!container) {
      console.error('Auth container not found in left sidebar');
      return;
    }
    
    try {
      // Get Clerk publishable key
      const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
      console.log('Clerk key available:', !!clerkPubKey);
      
      // Create root and render the React component into the container
      console.log('Creating React root and rendering SidebarAuth component with ClerkProvider');
      const root = ReactDOM.createRoot(container);
      
      // Wrap SidebarAuth with ClerkProvider to provide auth context
      root.render(
        <ClerkProvider publishableKey={clerkPubKey}>
          <SidebarAuth />
        </ClerkProvider>
      );
      
      this.initialized = true;
      console.log('Auth connector initialized in left sidebar successfully');
    } catch (error) {
      console.error('Error initializing auth connector:', error);
    }
  }
}

// Create and export a singleton instance
const authConnector = new AuthConnector();
export default authConnector; 
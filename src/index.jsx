// This file serves as an entry point for the application
// It imports the main TypeScript file to ensure proper bundling

// Import main application
import './main.ts';

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom';
import App from './App';

// Log initialization
console.log('Application entry point loaded successfully');

// Create root and render app
ReactDOM.createRoot(document.getElementById('root')).render(
  <Router>
    <App />
  </Router>
); 
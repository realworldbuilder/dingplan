/**
 * Diagnostic utilities for debugging in production
 */

/**
 * Initialize diagnostic tools for production debugging
 */
export function initializeDiagnostics() {
  console.log('Diagnostic tools initialized');
  
  // Create a floating diagnostic panel
  const panel = document.createElement('div');
  panel.id = 'diagnostic-panel';
  panel.style.position = 'fixed';
  panel.style.top = '40px';
  panel.style.right = '10px';
  panel.style.width = '300px';
  panel.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
  panel.style.color = 'white';
  panel.style.fontFamily = 'monospace';
  panel.style.fontSize = '12px';
  panel.style.padding = '10px';
  panel.style.borderRadius = '5px';
  panel.style.zIndex = '9999';
  panel.style.maxHeight = '400px';
  panel.style.overflowY = 'auto';
  
  // Add diagnostic information
  panel.innerHTML = `
    <h3>Diagnostic Information</h3>
    <p>URL: ${window.location.href}</p>
    <p>Path: ${window.location.pathname}</p>
    <p>UserAgent: ${navigator.userAgent}</p>
    <p>Screen: ${window.innerWidth}x${window.innerHeight}</p>
    <div id="diagnostic-log"></div>
    <button id="run-diagnostics">Run Tests</button>
  `;
  
  document.body.appendChild(panel);
  
  // Add click handler for diagnostic button
  document.getElementById('run-diagnostics')?.addEventListener('click', runDiagnosticTests);
}

/**
 * Run basic diagnostic tests
 */
function runDiagnosticTests() {
  const logElement = document.getElementById('diagnostic-log');
  if (!logElement) return;
  
  logElement.innerHTML = '<p>Running diagnostic tests...</p>';
  
  // Test 1: Check if canvas is available
  const canvas = document.getElementById('canvas');
  logDiagnostic(logElement, 'Canvas element found', !!canvas);
  
  // Test 2: Check if window.canvasApp is defined
  logDiagnostic(logElement, 'Canvas app object found', !!window.canvasApp);
  
  // Test 3: Check for toolbar buttons
  const buttons = document.querySelectorAll('.toolbar-btn');
  logDiagnostic(logElement, 'Toolbar buttons found', buttons.length > 0, `Count: ${buttons.length}`);
  
  // Test 4: Check for monitor
  const monitor = document.getElementById('monitor');
  logDiagnostic(logElement, 'Monitor element found', !!monitor);
  
  // Add script loading test
  testScriptLoading(logElement);
}

/**
 * Log a diagnostic test result
 */
function logDiagnostic(logElement: HTMLElement, name: string, pass: boolean, details: string = '') {
  const result = pass ? '✅ PASS' : '❌ FAIL';
  const detailsText = details ? ` (${details})` : '';
  logElement.innerHTML += `<p>${result}: ${name}${detailsText}</p>`;
}

/**
 * Test script loading
 */
function testScriptLoading(logElement: HTMLElement) {
  try {
    // Create a list of key objects that should be available
    const tests = [
      { name: 'window.canvasApp', obj: window.canvasApp },
      { name: 'window.canvasApp?.camera', obj: window.canvasApp?.camera },
      { name: 'window.canvasApp?.timeAxis', obj: window.canvasApp?.timeAxis },
      { name: 'window.canvasApp?.taskManager', obj: window.canvasApp?.taskManager },
      { name: 'window.canvasApp?.sidebar', obj: window.canvasApp?.sidebar }
    ];
    
    // Log results
    tests.forEach(test => {
      logDiagnostic(logElement, `${test.name} loaded`, !!test.obj);
    });
  } catch (error) {
    logElement.innerHTML += `<p>❌ ERROR: ${(error as Error).message}</p>`;
  }
}

// Declare TypeScript global window interface
declare global {
  interface Window {
    canvasApp: any;
  }
} 
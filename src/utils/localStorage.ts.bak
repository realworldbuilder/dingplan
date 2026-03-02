/**
 * Utility functions for saving and loading application state from localStorage
 */

const BASE_STORAGE_KEY = 'dingplan_state';
const PROJECTS_KEY = 'dingplan_projects';
const DEPENDENCIES_KEY = 'dingplan_dependencies'; // Add a specific key for dependencies

/**
 * Save application state to localStorage with project isolation
 */
export function saveToLocalStorage(state: any, projectId?: string): void {
  try {
    const storageKey = projectId ? `${BASE_STORAGE_KEY}_${projectId}` : BASE_STORAGE_KEY;
    const dependenciesKey = projectId ? `${DEPENDENCIES_KEY}_${projectId}` : DEPENDENCIES_KEY;
    
    // Extract dependencies into a separate map for redundancy
    const dependencyMap: Record<string, string[]> = {};
    if (state.tasks && Array.isArray(state.tasks)) {
      state.tasks.forEach((task: any) => {
        if (task.id && task.dependencies && Array.isArray(task.dependencies) && task.dependencies.length > 0) {
          dependencyMap[task.id] = [...task.dependencies];
        }
      });
    }
    
    // Convert dates to ISO strings for proper serialization
    const serializedState = JSON.stringify(state, (key, value) => {
      // Special handling for Date objects
      if (value instanceof Date) {
        return { __type: 'Date', value: value.toISOString() };
      }
      return value;
    });
    
    // Store the state
    localStorage.setItem(storageKey, serializedState);
    
    // Store dependencies separately for redundancy
    if (Object.keys(dependencyMap).length > 0) {
      localStorage.setItem(dependenciesKey, JSON.stringify(dependencyMap));
      console.log(`Dependencies saved separately to ${dependenciesKey} (${Object.keys(dependencyMap).length} tasks with dependencies)`);
    }
    
    // Also update state version for backwards compatibility
    if (projectId) {
      // Store the current project ID for reference
      localStorage.setItem('currentProjectId', projectId);
    }
    
    console.log(`State saved to localStorage with key: ${storageKey}`);
  } catch (error) {
    console.error('Failed to save state to localStorage:', error);
  }
}

/**
 * Load application state from localStorage
 * Returns null if no state is found or if there's an error
 */
export function loadFromLocalStorage(projectId?: string): any | null {
  try {
    // Check if we have a currentProjectId when no projectId is specified
    if (!projectId) {
      projectId = localStorage.getItem('currentProjectId') || undefined;
    }
    
    // Load authService to check if we're authenticated
    const authStatus = localStorage.getItem('dingplan_auth_status');
    const userId = localStorage.getItem('dingplan_user_id');
    const isAuthenticated = authStatus === 'authenticated' && userId && userId !== 'anonymous';
    
    console.log(`[localStorage] Loading state with auth status: ${authStatus}, userId: ${userId}, projectId: ${projectId}, isAuthenticated: ${isAuthenticated}`);
    
    // If authenticated but no project ID, don't load anything (wait for proper project loading)
    if (!projectId && isAuthenticated) {
      console.log('[localStorage] No project ID and user is authenticated, not loading anonymous state');
      return null;
    }
    
    // Always validate project ID format
    if (projectId) {
      if (projectId === 'undefined' || projectId === 'null' || projectId === 'NaN') {
        console.warn('[localStorage] Invalid project ID format:', projectId);
        projectId = undefined;
      }
    }
    
    const storageKey = projectId ? `${BASE_STORAGE_KEY}_${projectId}` : BASE_STORAGE_KEY;
    const dependenciesKey = projectId ? `${DEPENDENCIES_KEY}_${projectId}` : DEPENDENCIES_KEY;
    
    // Debug additional information for troubleshooting
    console.log(`[localStorage] Using storage keys: ${storageKey}, ${dependenciesKey}`);
    
    let serializedState = localStorage.getItem(storageKey);
    const serializedDependencies = localStorage.getItem(dependenciesKey);
    
    // Try legacy key formats if no data found with new key format
    if (!serializedState && projectId) {
      const legacyKey = `construction-${projectId}-1.2.0`;
      serializedState = localStorage.getItem(legacyKey);
      
      if (serializedState) {
        console.log(`Found data with legacy key: ${legacyKey}, will migrate to new format`);
        
        // Also try to get the legacy dependency map for migration
        const legacyDependencyMapKey = `construction-${projectId}-dependencies`;
        const legacyDependencyMap = localStorage.getItem(legacyDependencyMapKey);
        
        if (legacyDependencyMap) {
          console.log(`Found legacy dependency map, will incorporate into state`);
          
          // Parse both the state and dependency map
          const parsedState = JSON.parse(serializedState);
          const dependencyMap = JSON.parse(legacyDependencyMap);
          
          // Ensure dependencies from the map are incorporated into the state
          if (parsedState.tasks && dependencyMap) {
            parsedState.tasks.forEach((task: any) => {
              const deps = dependencyMap[task.id];
              if (deps && Array.isArray(deps)) {
                // Ensure task.dependencies is an array
                if (!Array.isArray(task.dependencies)) {
                  task.dependencies = [];
                }
                
                // Add dependencies from the map that aren't already in the task
                const existingDeps = new Set(task.dependencies);
                deps.forEach((depId: string) => {
                  if (!existingDeps.has(depId)) {
                    task.dependencies.push(depId);
                  }
                });
              }
            });
          }
          
          // Re-serialize the state with incorporated dependencies
          serializedState = JSON.stringify(parsedState);
          
          // Save to the new format key for future use
          localStorage.setItem(storageKey, serializedState);
          
          // Clean up legacy keys
          localStorage.removeItem(legacyKey);
          localStorage.removeItem(legacyDependencyMapKey);
          
          console.log(`Migrated data from legacy format to new key: ${storageKey}`);
        }
      }
    }
    
    if (!serializedState) {
      console.log(`No saved state found in localStorage for key: ${storageKey}`);
      return null;
    }
    
    // Parse JSON and convert date strings back to Date objects
    const state = JSON.parse(serializedState, (key, value) => {
      // Revive Date objects
      if (value && typeof value === 'object' && value.__type === 'Date') {
        return new Date(value.value);
      }
      return value;
    });
    
    // Merge in dependencies from the separate dependency storage if available
    if (serializedDependencies && state && state.tasks) {
      try {
        const dependencyMap = JSON.parse(serializedDependencies);
        
        // Add any missing dependencies from the separate dependency storage
        state.tasks.forEach((task: any) => {
          if (task.id && dependencyMap[task.id]) {
            // Ensure task.dependencies is initialized as an array
            if (!Array.isArray(task.dependencies)) {
              task.dependencies = [];
            }
            
            // Merge dependencies from the backup source
            const existingDeps = new Set(task.dependencies);
            dependencyMap[task.id].forEach((depId: string) => {
              if (!existingDeps.has(depId)) {
                task.dependencies.push(depId);
                console.log(`Recovered dependency ${depId} for task ${task.id} from backup storage`);
              }
            });
          }
        });
        
        console.log(`Merged dependencies from separate storage (${Object.keys(dependencyMap).length} tasks with dependencies)`);
      } catch (depError) {
        console.error('Error merging dependencies from separate storage:', depError);
      }
    }
    
    console.log(`State loaded from localStorage for key: ${storageKey}`);
    return state;
  } catch (error) {
    console.error('Failed to load state from localStorage:', error);
    return null;
  }
}

/**
 * Clear saved state from localStorage
 */
export function clearLocalStorage(projectId?: string): void {
  try {
    if (projectId) {
      // Clear only the specific project state
      localStorage.removeItem(`${BASE_STORAGE_KEY}_${projectId}`);
      localStorage.removeItem(`${DEPENDENCIES_KEY}_${projectId}`);
      console.log(`State cleared from localStorage for project: ${projectId}`);
    } else {
      // Clear legacy storage key
      localStorage.removeItem(BASE_STORAGE_KEY);
      localStorage.removeItem(DEPENDENCIES_KEY);
      console.log('State cleared from localStorage (legacy key)');
    }
  } catch (error) {
    console.error('Failed to clear state from localStorage:', error);
  }
}

/**
 * Check if there is saved state in localStorage
 */
export function hasSavedState(projectId?: string): boolean {
  const storageKey = projectId ? `${BASE_STORAGE_KEY}_${projectId}` : BASE_STORAGE_KEY;
  return localStorage.getItem(storageKey) !== null;
}

/**
 * Clear all application data from localStorage
 * @param {boolean} preserveAuth - Whether to preserve authentication data
 */
export function clearAllAppData(preserveAuth: boolean = false): void {
  try {
    // Get all localStorage keys
    const keysToRemove = [];
    const preservedValues: Record<string, string> = {};
    
    // If preserving auth, save these values first
    if (preserveAuth) {
      const authKeys = ['dingplan_user_id', 'dingplan_auth_status'];
      authKeys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          preservedValues[key] = value;
        }
      });
    }
    
    // Find all keys related to our app
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith('dingplan_') || 
        key.startsWith(BASE_STORAGE_KEY) || 
        key.startsWith(DEPENDENCIES_KEY) ||
        key.startsWith('backup-') || 
        key.startsWith('construction-') ||
        key === PROJECTS_KEY ||
        key === 'currentProjectId'
      )) {
        // Skip auth keys if preserving auth
        if (preserveAuth && (key === 'dingplan_user_id' || key === 'dingplan_auth_status')) {
          continue;
        }
        keysToRemove.push(key);
      }
    }
    
    // Remove each key
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    // Restore preserved values if needed
    if (preserveAuth) {
      Object.entries(preservedValues).forEach(([key, value]) => {
        localStorage.setItem(key, value);
      });
    }
    
    console.log(`Cleared all application data (${keysToRemove.length} items)${preserveAuth ? ', preserved auth data' : ''}`);
  } catch (error) {
    console.error('Failed to clear all application data:', error);
  }
}

/**
 * Create a database persistence debug panel
 * For troubleshooting persistence issues
 */
export function createDebugPanel(): void {
  if (document.getElementById('db-debug-panel')) {
    return; // Already exists
  }
  
  const debugPanel = document.createElement('div');
  debugPanel.id = 'db-debug-panel';
  debugPanel.style.cssText = `
    position: fixed;
    bottom: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: #fff;
    padding: 10px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 12px;
    z-index: 10000;
    max-width: 300px;
    max-height: 200px;
    overflow: auto;
  `;
  
  const content = document.createElement('div');
  content.id = 'db-debug-content';
  
  const authStatus = localStorage.getItem('dingplan_auth_status') || 'none';
  const userId = localStorage.getItem('dingplan_user_id') || 'none';
  const currentProjectId = localStorage.getItem('currentProjectId') || 'none';
  
  content.innerHTML = `
    <p><strong>Auth Status:</strong> ${authStatus}</p>
    <p><strong>User ID:</strong> ${userId.substring(0, 10)}...</p>
    <p><strong>Current Project:</strong> ${currentProjectId === 'none' ? 'none' : currentProjectId.substring(0, 10) + '...'}</p>
    <button id="db-debug-clear">Clear All Data</button>
    <button id="db-debug-refresh">Refresh Page</button>
  `;
  
  debugPanel.appendChild(content);
  document.body.appendChild(debugPanel);
  
  // Add event listeners
  const clearBtn = document.getElementById('db-debug-clear');
  const refreshBtn = document.getElementById('db-debug-refresh');
  
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('This will clear all localStorage data. Continue?')) {
        clearAllAppData(false);
        alert('All data cleared. Click refresh to reload the page.');
      }
    });
  }
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      window.location.reload();
    });
  }
} 
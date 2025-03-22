/**
 * Utility functions for saving and loading application state from localStorage
 */

const BASE_STORAGE_KEY = 'dingplan_state';
const PROJECTS_KEY = 'dingplan_projects';

/**
 * Save application state to localStorage with project isolation
 */
export function saveToLocalStorage(state: any, projectId?: string): void {
  try {
    const storageKey = projectId ? `${BASE_STORAGE_KEY}_${projectId}` : BASE_STORAGE_KEY;
    
    // Convert dates to ISO strings for proper serialization
    const serializedState = JSON.stringify(state, (key, value) => {
      // Special handling for Date objects
      if (value instanceof Date) {
        return { __type: 'Date', value: value.toISOString() };
      }
      return value;
    });
    
    localStorage.setItem(storageKey, serializedState);
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
    const storageKey = projectId ? `${BASE_STORAGE_KEY}_${projectId}` : BASE_STORAGE_KEY;
    const serializedState = localStorage.getItem(storageKey);
    
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
      console.log(`State cleared from localStorage for project: ${projectId}`);
    } else {
      // Clear legacy storage key
      localStorage.removeItem(BASE_STORAGE_KEY);
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
 */
export function clearAllAppData(): void {
  try {
    // Get all localStorage keys
    const keysToRemove = [];
    
    // Find all keys related to our app
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key.startsWith(BASE_STORAGE_KEY) || 
        key.startsWith('backup-') || 
        key === PROJECTS_KEY
      )) {
        keysToRemove.push(key);
      }
    }
    
    // Remove each key
    keysToRemove.forEach(key => localStorage.removeItem(key));
    
    console.log(`Cleared all application data (${keysToRemove.length} items)`);
  } catch (error) {
    console.error('Failed to clear all application data:', error);
  }
} 
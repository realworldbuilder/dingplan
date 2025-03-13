/**
 * Utility functions for saving and loading application state from localStorage
 */

const STORAGE_KEY = 'dingplan_state';

/**
 * Save application state to localStorage
 */
export function saveToLocalStorage(state: any): void {
  try {
    // Convert dates to ISO strings for proper serialization
    const serializedState = JSON.stringify(state, (key, value) => {
      // Special handling for Date objects
      if (value instanceof Date) {
        return { __type: 'Date', value: value.toISOString() };
      }
      return value;
    });
    
    localStorage.setItem(STORAGE_KEY, serializedState);
    console.log('State saved to localStorage');
  } catch (error) {
    console.error('Failed to save state to localStorage:', error);
  }
}

/**
 * Load application state from localStorage
 * Returns null if no state is found or if there's an error
 */
export function loadFromLocalStorage(): any | null {
  try {
    const serializedState = localStorage.getItem(STORAGE_KEY);
    
    if (!serializedState) {
      console.log('No saved state found in localStorage');
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
    
    console.log('State loaded from localStorage');
    return state;
  } catch (error) {
    console.error('Failed to load state from localStorage:', error);
    return null;
  }
}

/**
 * Clear saved state from localStorage
 */
export function clearLocalStorage(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
    console.log('State cleared from localStorage');
  } catch (error) {
    console.error('Failed to clear state from localStorage:', error);
  }
}

/**
 * Check if there is saved state in localStorage
 */
export function hasSavedState(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null;
} 
/**
 * Migration Service
 * Helps migrate data from localStorage to MongoDB
 */

import { getCurrentUserId } from './authService';

// Base API URL from environment
const API_URL = import.meta.env.VITE_API_URL || 'https://dingplan-server.vercel.app/api';

/**
 * Extracts projects from localStorage and uploads them to MongoDB
 */
export const migrateLocalProjectsToMongoDB = async (): Promise<{
  success: boolean;
  migratedCount: number;
  errors: string[];
}> => {
  try {
    console.log('[migrationService] Starting migration from localStorage to MongoDB');
    
    // Find all localStorage keys that might contain projects
    const projectKeys = [];
    const LOCAL_PROJECTS_KEY = 'dingplan_projects';
    const backupResults = { success: true, migratedCount: 0, errors: [] };
    
    // First check if there's a main projects list
    const projectsListJson = localStorage.getItem(LOCAL_PROJECTS_KEY);
    if (projectsListJson) {
      try {
        const projectsList = JSON.parse(projectsListJson);
        
        if (Array.isArray(projectsList) && projectsList.length > 0) {
          console.log(`[migrationService] Found ${projectsList.length} projects in localStorage`);
          
          // Get current user ID for ownership
          const userId = getCurrentUserId() || 'anonymous';
          
          // Process each project
          for (const project of projectsList) {
            try {
              if (!project._id || !project.name) {
                console.warn('[migrationService] Skipping invalid project:', project);
                backupResults.errors.push(`Invalid project data: missing ID or name`);
                continue;
              }
              
              // Prepare project data for MongoDB
              const payload = {
                name: project.name,
                description: project.description || '',
                isPublic: project.isPublic || false,
                tags: project.tags || [],
                projectData: project.projectData,
                userId: project.userId || userId,
                originalId: project._id
              };
              
              // Upload to MongoDB
              console.log(`[migrationService] Migrating project: ${project.name} (${project._id})`);
              const response = await fetch(`${API_URL}/projects/import`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
              });
              
              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `Failed to migrate project ${project.name}`);
              }
              
              const result = await response.json();
              console.log(`[migrationService] Successfully migrated project: ${result.id}`);
              backupResults.migratedCount++;
              
              // Store a mapping from old ID to new ID for reference
              localStorage.setItem(`migrated_${project._id}`, result.id);
              
            } catch (projectError: any) {
              console.error(`[migrationService] Error migrating project ${project.name}:`, projectError);
              backupResults.errors.push(`Project "${project.name}": ${projectError.message}`);
            }
          }
        } else {
          console.log('[migrationService] No projects found in main project list');
        }
      } catch (parseError) {
        console.error('[migrationService] Error parsing projects list:', parseError);
        backupResults.errors.push(`Failed to parse projects list: ${parseError.message}`);
      }
    } else {
      console.log('[migrationService] No main project list found in localStorage');
    }
    
    // Look for individual project data stored separately
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('dingplan_state_')) {
        const projectId = key.replace('dingplan_state_', '');
        projectKeys.push({ key, projectId });
      }
    }
    
    // Process individual project data if not already migrated
    if (projectKeys.length > 0) {
      console.log(`[migrationService] Found ${projectKeys.length} individual project states`);
      
      for (const { key, projectId } of projectKeys) {
        // Check if this project was already migrated from the main list
        if (localStorage.getItem(`migrated_${projectId}`)) {
          console.log(`[migrationService] Project ${projectId} already migrated, skipping`);
          continue;
        }
        
        try {
          const projectDataJson = localStorage.getItem(key);
          if (!projectDataJson) continue;
          
          const projectData = JSON.parse(projectDataJson);
          
          // Create a minimal project with the data
          const payload = {
            name: `Recovered Project ${projectId.substring(0, 8)}`,
            description: 'Project recovered from localStorage',
            isPublic: false,
            projectData: projectData,
            userId: getCurrentUserId() || 'anonymous',
            originalId: projectId
          };
          
          // Upload to MongoDB
          console.log(`[migrationService] Migrating individual project state: ${projectId}`);
          const response = await fetch(`${API_URL}/projects/import`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
          });
          
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to migrate project ${projectId}`);
          }
          
          const result = await response.json();
          console.log(`[migrationService] Successfully migrated individual project: ${result.id}`);
          backupResults.migratedCount++;
          
          // Store a mapping from old ID to new ID
          localStorage.setItem(`migrated_${projectId}`, result.id);
          
        } catch (projectError: any) {
          console.error(`[migrationService] Error migrating individual project ${projectId}:`, projectError);
          backupResults.errors.push(`Individual project "${projectId}": ${projectError.message}`);
        }
      }
    }
    
    console.log(`[migrationService] Migration complete. Migrated ${backupResults.migratedCount} projects with ${backupResults.errors.length} errors`);
    
    // If we successfully migrated any projects, mark the migration as complete
    if (backupResults.migratedCount > 0) {
      localStorage.setItem('migration_completed', 'true');
    }
    
    return backupResults;
    
  } catch (error: any) {
    console.error('[migrationService] Error during migration:', error);
    return {
      success: false,
      migratedCount: 0,
      errors: [error.message || 'Unknown error during migration']
    };
  }
};

/**
 * Gets the MongoDB ID for a previously migrated project
 * @param oldId The localStorage project ID
 * @returns The new MongoDB ID or null if not found
 */
export const getMigratedProjectId = (oldId: string): string | null => {
  return localStorage.getItem(`migrated_${oldId}`);
};

/**
 * Checks if the migration has been completed
 */
export const isMigrationCompleted = (): boolean => {
  return localStorage.getItem('migration_completed') === 'true';
}; 
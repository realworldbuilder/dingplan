/**
 * Service for handling project data persistence with the server
 * Using MongoDB API for persistence
 */

import { getCurrentUserId, isAuthenticated } from './authService';

// Base API URL - configured from environment
const API_URL = import.meta.env.VITE_API_URL || 'https://dingplan-server.vercel.app/api';
console.log('[projectService] Using API URL:', API_URL);

// Persistent project ID storage
const CURRENT_PROJECT_ID = 'currentProjectId';

interface ProjectMetadata {
  id?: string;
  name: string;
  description?: string;
  isPublic?: boolean;
  tags?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  userId?: string;
}

interface ProjectData {
  metadata: ProjectMetadata;
  projectData: any;
}

/**
 * Save a project to the server
 */
export const saveProject = async (
  projectData: any,
  metadata: ProjectMetadata
): Promise<{ success: boolean; projectId?: string; error?: string }> => {
  try {
    const userId = getCurrentUserId();
    
    console.log('[projectService] Saving project to server:', { 
      name: metadata.name,
      userId,
      dataSize: projectData ? JSON.stringify(projectData).length : 0
    });
    
    // Validate project data
    if (!projectData) {
      console.error('[projectService] Project data is empty or invalid');
      throw new Error('Project data is empty or invalid');
    }
    
    // Create project payload
    const payload = {
      name: metadata.name,
      description: metadata.description || '',
      isPublic: metadata.isPublic || false,
      tags: metadata.tags || [],
      projectData: projectData,
      userId: userId || 'anonymous'
    };
    
    // Save locally as backup during API call
    localStorage.setItem(CURRENT_PROJECT_ID, 'pending');
    
    // Call the create project API
    const response = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to save project to server');
    }
    
    const result = await response.json();
    
    // Store the current project ID in localStorage for persistence
    if (result.id) {
      localStorage.setItem(CURRENT_PROJECT_ID, result.id);
      console.log(`[projectService] Project saved successfully with ID: ${result.id}`);
    }
    
    return {
      success: true,
      projectId: result.id
    };
  } catch (error: any) {
    console.error('[projectService] Error saving project:', error);
    
    // Create a local backup in case of server error
    try {
      const backupId = 'backup_' + Date.now();
      localStorage.setItem(`dingplan_backup_${backupId}`, JSON.stringify({
        projectData,
        metadata,
        timestamp: new Date().toISOString()
      }));
      console.log('[projectService] Created local backup due to server error');
    } catch (backupError) {
      console.error('[projectService] Failed to create local backup:', backupError);
    }
    
    return {
      success: false,
      error: error.message || 'An error occurred while saving the project'
    };
  }
};

/**
 * Update an existing project on the server
 */
export const updateProject = async (
  projectId: string,
  projectData: any,
  metadata: ProjectMetadata
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Validate the projectId
    if (!projectId || projectId === 'undefined' || projectId === 'null') {
      throw new Error('Invalid project ID');
    }
    
    console.log(`[projectService] Updating project: ${projectId}`, {
      taskCount: projectData?.tasks?.length || 0,
      swimlaneCount: projectData?.swimlanes?.length || 0
    });
    
    // Store projectId in localStorage for persistence
    localStorage.setItem(CURRENT_PROJECT_ID, projectId);
    
    // Count dependencies for logging
    let totalDependencyCount = 0;
    if (projectData && projectData.tasks) {
      projectData.tasks.forEach((task: any) => {
        if (task.dependencies && Array.isArray(task.dependencies)) {
          totalDependencyCount += task.dependencies.length;
        }
      });
    }
    console.log(`[projectService] Project includes ${totalDependencyCount} task dependencies`);
    
    // Create update payload
    const payload = {
      name: metadata.name,
      description: metadata.description || '',
      isPublic: metadata.isPublic || false,
      tags: metadata.tags || [],
      projectData: projectData
    };
    
    // Call the update project API
    const response = await fetch(`${API_URL}/projects/${projectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to update project on server');
    }
    
    console.log('[projectService] Project updated:', projectId);
    
    return { success: true };
  } catch (error: any) {
    console.error('[projectService] Error updating project:', error);
    
    // Create a local backup in case of server error
    try {
      const backupId = 'backup_' + Date.now();
      localStorage.setItem(`dingplan_backup_${projectId}_${backupId}`, JSON.stringify({
        projectId,
        projectData,
        metadata,
        timestamp: new Date().toISOString()
      }));
      console.log('[projectService] Created local backup due to server error');
    } catch (backupError) {
      console.error('[projectService] Failed to create local backup:', backupError);
    }
    
    return {
      success: false,
      error: error.message || 'An error occurred while updating the project'
    };
  }
};

/**
 * Load a project from the server
 */
export const loadProject = async (
  projectId: string
): Promise<{ success: boolean; project?: ProjectData; error?: string }> => {
  try {
    // Validate the projectId
    if (!projectId || projectId === 'undefined' || projectId === 'null') {
      throw new Error('Invalid project ID');
    }
    
    console.log(`[projectService] Loading project: ${projectId}`);
    
    // Store the project ID in localStorage for persistence
    localStorage.setItem(CURRENT_PROJECT_ID, projectId);
    
    // Call the get project API
    const response = await fetch(`${API_URL}/projects/${projectId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to load project from server');
    }
    
    const result = await response.json();
    
    if (!result || !result.projectData) {
      throw new Error('Project data is missing or invalid');
    }
    
    // Format the project data from API response
    const formattedProject: ProjectData = {
      metadata: {
        id: result._id || result.id,
        name: result.name,
        description: result.description || '',
        isPublic: result.isPublic || false,
        tags: result.tags || [],
        userId: result.userId,
        createdAt: new Date(result.createdAt),
        updatedAt: new Date(result.updatedAt)
      },
      projectData: result.projectData
    };
    
    // Create a local backup of the loaded data
    try {
      localStorage.setItem(`dingplan_state_${projectId}`, JSON.stringify(result.projectData));
      console.log(`[projectService] Created local backup of loaded project data`);
    } catch (backupError) {
      console.warn('[projectService] Failed to create local backup:', backupError);
    }
    
    console.log(`[projectService] Successfully loaded project with ${result.projectData?.tasks?.length || 0} tasks`);
    
    return {
      success: true,
      project: formattedProject
    };
  } catch (error: any) {
    console.error('[projectService] Error loading project:', error);
    
    // Try to load from local backup if server fails
    try {
      const localBackup = localStorage.getItem(`dingplan_state_${projectId}`);
      if (localBackup) {
        console.log('[projectService] Attempting to load from local backup');
        const projectData = JSON.parse(localBackup);
        
        // Create minimal metadata
        const formattedProject: ProjectData = {
          metadata: {
            id: projectId,
            name: 'Recovered Project',
            description: 'Project recovered from local backup',
            isPublic: false,
            tags: [],
            userId: getCurrentUserId() || 'anonymous',
            createdAt: new Date(),
            updatedAt: new Date()
          },
          projectData: projectData
        };
        
        return {
          success: true,
          project: formattedProject
        };
      }
    } catch (backupError) {
      console.error('[projectService] Failed to load from local backup:', backupError);
    }
    
    return {
      success: false,
      error: error.message || 'An error occurred while loading the project'
    };
  }
};

/**
 * Delete a project from the server
 */
export const deleteProject = async (
  projectId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Validate the projectId
    if (!projectId || projectId === 'undefined' || projectId === 'null') {
      throw new Error('Invalid project ID');
    }
    
    console.log(`[projectService] Deleting project: ${projectId}`);
    
    // Call the delete project API
    const response = await fetch(`${API_URL}/projects/${projectId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to delete project from server');
    }
    
    // Remove from local storage as well
    localStorage.removeItem(`dingplan_state_${projectId}`);
    
    // If this was the current project, clear it
    if (localStorage.getItem(CURRENT_PROJECT_ID) === projectId) {
      localStorage.removeItem(CURRENT_PROJECT_ID);
    }
    
    console.log('[projectService] Project deleted successfully');
    
    return { success: true };
  } catch (error: any) {
    console.error('[projectService] Error deleting project:', error);
    return {
      success: false,
      error: error.message || 'An error occurred while deleting the project'
    };
  }
};

/**
 * Get all projects for the current user from the server
 */
export const getUserProjects = async (): Promise<{
  success: boolean;
  projects?: ProjectMetadata[];
  error?: string;
}> => {
  try {
    const userId = getCurrentUserId();
    console.log(`[projectService] Getting projects for user: ${userId || 'anonymous'}`);
    
    // Call the get user projects API
    let url = `${API_URL}/projects`;
    if (userId) {
      url += `?userId=${userId}`;
    } else {
      url += `/public`; // Fallback to public projects for anonymous users
    }
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to get projects from server');
    }
    
    const result = await response.json();
    
    // Format the projects from API response
    const formattedProjects: ProjectMetadata[] = result.map((project: any) => ({
      id: project._id || project.id,
      name: project.name,
      description: project.description || '',
      isPublic: project.isPublic || false,
      tags: project.tags || [],
      userId: project.userId,
      createdAt: new Date(project.createdAt),
      updatedAt: new Date(project.updatedAt)
    }));
    
    console.log(`[projectService] Found ${formattedProjects.length} projects`);
    
    return {
      success: true,
      projects: formattedProjects
    };
  } catch (error: any) {
    console.error('[projectService] Error loading user projects:', error);
    
    // Try to show at least public projects
    try {
      const response = await fetch(`${API_URL}/projects/public`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const result = await response.json();
        
        const formattedProjects: ProjectMetadata[] = result.map((project: any) => ({
          id: project._id || project.id,
          name: project.name,
          description: project.description || '',
          isPublic: true,
          tags: project.tags || [],
          userId: project.userId,
          createdAt: new Date(project.createdAt),
          updatedAt: new Date(project.updatedAt)
        }));
        
        console.log(`[projectService] Fallback: found ${formattedProjects.length} public projects`);
        
        return {
          success: true,
          projects: formattedProjects
        };
      }
    } catch (fallbackError) {
      console.error('[projectService] Error loading public projects:', fallbackError);
    }
    
    return {
      success: false,
      error: error.message || 'An error occurred while getting projects'
    };
  }
}; 
/**
 * Service for handling project data persistence with the server
 */

import { getCurrentUserId, isAuthenticated } from './authService';

// Base API URL - should be configurable from environment
// Different API URL depending on the environment
let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// In production environments (including Vercel deployments), use relative path for API
if (import.meta.env.PROD) {
  // Use the API URL from environment or fallback to relative path
  API_URL = import.meta.env.VITE_API_URL || '/api';
  console.log('[projectService] Production environment detected, using API path:', API_URL);
}

console.log('[projectService] Using API URL:', API_URL);

// Storage keys for localStorage fallback
const PROJECTS_KEY = 'dingplan_projects';
const CURRENT_PROJECT_INDEX = 'dingplan_current_project_index';

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
 * Initialize localStorage for projects if not already set up
 */
const initializeLocalStorage = (): void => {
  if (!localStorage.getItem(PROJECTS_KEY)) {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify([]));
  }
  
  if (!localStorage.getItem(CURRENT_PROJECT_INDEX)) {
    localStorage.setItem(CURRENT_PROJECT_INDEX, '0');
  }
};

/**
 * Generate a unique ID
 */
const generateId = (): string => {
  return 'project_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

/**
 * Save a project to the server API
 */
export const saveProject = async (
  projectData: any,
  metadata: ProjectMetadata
): Promise<{ success: boolean; projectId?: string; error?: string }> => {
  try {
    const userId = getCurrentUserId();
    const isUserAuthenticated = isAuthenticated();
    
    console.log('[projectService] Saving project:', { 
      name: metadata.name,
      userId,
      isAuthenticated: isUserAuthenticated,
      dataSize: projectData ? JSON.stringify(projectData).length : 0
    });
    
    // Validate project data
    if (!projectData) {
      console.error('[projectService] Project data is empty or invalid');
      throw new Error('Project data is empty or invalid');
    }
    
    // If user is authenticated, save to server API
    if (isUserAuthenticated && userId !== 'anonymous') {
      console.log('[projectService] User is authenticated, saving to server API');
      
      try {
        // Add debug logs for server API call
        console.log(`[projectService] Making API call to: ${API_URL}/projects`);
        console.log('[projectService] API request payload:', {
          userId,
          name: metadata.name,
          description: metadata.description ? 'present' : 'empty',
          dataSize: JSON.stringify(projectData).length,
          isPublic: metadata.isPublic || false
        });

        const response = await fetch(`${API_URL}/projects`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId,
            name: metadata.name,
            description: metadata.description || '',
            projectData,
            isPublic: metadata.isPublic || false,
            tags: metadata.tags || []
          })
        });
        
        console.log('[projectService] API response status:', response.status);
        
        const result = await response.json();
        console.log('[projectService] API response body:', result);
        
        if (!response.ok) {
          console.error('[projectService] API error:', result);
          throw new Error(result.message || 'Failed to save project to server');
        }
        
        console.log('[projectService] Project saved to server successfully:', result);
        
        return {
          success: true,
          projectId: result.data._id || result.data.id
        };
      } catch (apiError) {
        console.error('[projectService] Server API error, falling back to localStorage:', apiError);
        // Fall back to localStorage if server API fails
      }
    }
    
    // Save to localStorage as fallback or for anonymous users
    console.log('[projectService] Saving to localStorage (fallback or anonymous user)');
    
    // Initialize localStorage if needed
    initializeLocalStorage();
    
    // Generate a unique ID for this project
    const projectId = generateId();
    console.log(`[projectService] Generated project ID: ${projectId}`);
    
    // Create project object
    const project = {
      _id: projectId,
      userId: userId,
      name: metadata.name,
      description: metadata.description || '',
      projectData: projectData,
      isPublic: metadata.isPublic || false,
      tags: metadata.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    // Get existing projects
    const projectsJson = localStorage.getItem(PROJECTS_KEY) || '[]';
    let projects = [];
    
    try {
      projects = JSON.parse(projectsJson);
    } catch (parseError) {
      console.error('[projectService] Error parsing existing projects:', parseError);
      // If projects JSON is corrupted, start with empty array
      projects = [];
    }
    
    if (!Array.isArray(projects)) {
      console.error('[projectService] Projects is not an array, resetting to empty array');
      projects = [];
    }
    
    // Add new project
    projects.push(project);
    
    // Save back to localStorage
    try {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
      console.log(`[projectService] Project saved successfully with ID: ${projectId}`);
    } catch (storageError) {
      console.error('[projectService] Error saving to localStorage:', storageError);
      throw new Error('Failed to save project to storage: ' + 
                     (storageError instanceof Error ? storageError.message : 'Storage error'));
    }
    
    return {
      success: true,
      projectId: projectId
    };
  } catch (error: any) {
    console.error('[projectService] Error saving project:', error);
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
    
    const userId = getCurrentUserId();
    const isUserAuthenticated = isAuthenticated();
    
    console.log(`[projectService] Updating project: ${projectId}`, {
      taskCount: projectData?.tasks?.length || 0,
      swimlaneCount: projectData?.swimlanes?.length || 0,
      userId,
      isAuthenticated: isUserAuthenticated
    });
    
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
    
    // If user is authenticated, update on server API
    if (isUserAuthenticated && userId !== 'anonymous') {
      console.log('[projectService] User is authenticated, updating on server API');
      
      try {
        console.log(`[projectService] Making PUT request to: ${API_URL}/projects/${projectId}`);
        console.log(`[projectService] Update payload:`, {
          userId,
          name: metadata.name,
          hasProjectData: !!projectData,
          dataSize: JSON.stringify(projectData).length,
        });
        
        const response = await fetch(`${API_URL}/projects/${projectId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId,
            name: metadata.name,
            description: metadata.description,
            projectData,
            isPublic: metadata.isPublic,
            tags: metadata.tags
          })
        });
        
        console.log(`[projectService] Update response status:`, response.status);
        const result = await response.json();
        console.log(`[projectService] Update response body:`, result);
        
        if (!response.ok) {
          console.error('[projectService] API error:', result);
          throw new Error(result.message || 'Failed to update project on server');
        }
        
        console.log('[projectService] Project updated on server successfully:', result);
        
        // Also make sure we save the currentProjectId for consistency
        localStorage.setItem('currentProjectId', projectId);
        
        return { success: true };
      } catch (apiError) {
        console.error('[projectService] Server API error, falling back to localStorage:', apiError);
        // Fall back to localStorage if server API fails
      }
    }
    
    // Update in localStorage as fallback or for anonymous users
    console.log('[projectService] Updating in localStorage (fallback or anonymous user)');
    
    // Get existing projects
    const projectsJson = localStorage.getItem(PROJECTS_KEY) || '[]';
    const projects = JSON.parse(projectsJson);
    
    // Find the project to update
    const projectIndex = projects.findIndex((p: any) => p._id === projectId);
    
    if (projectIndex === -1) {
      throw new Error('Project not found');
    }
    
    // Check if user owns the project
    if (projects[projectIndex].userId !== userId && projects[projectIndex].userId !== 'anonymous') {
      throw new Error('You do not have permission to edit this project');
    }
    
    // Ensure projectData is properly sanitized to prevent circular references
    const sanitizedData = JSON.parse(JSON.stringify(projectData));
    
    // Update the project
    projects[projectIndex] = {
      ...projects[projectIndex],
      name: metadata.name,
      description: metadata.description,
      projectData: sanitizedData,
      isPublic: metadata.isPublic,
      tags: metadata.tags,
      updatedAt: new Date().toISOString()
    };
    
    // Save back to localStorage
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    
    // Also make sure we save the currentProjectId for consistency
    localStorage.setItem('currentProjectId', projectId);
    
    console.log('[projectService] Project updated locally:', projectId);
    
    return { success: true };
  } catch (error: any) {
    console.error('[projectService] Error updating project:', error);
    return {
      success: false,
      error: error.message || 'An error occurred while updating the project'
    };
  }
};

/**
 * Load a project from the server or localStorage
 */
export const loadProject = async (
  projectId: string
): Promise<{ success: boolean; project?: ProjectData; error?: string }> => {
  try {
    // Validate the projectId
    if (!projectId || projectId === 'undefined' || projectId === 'null') {
      throw new Error('Invalid project ID');
    }
    
    const userId = getCurrentUserId();
    const isUserAuthenticated = isAuthenticated();
    
    console.log(`[projectService] Loading project: ${projectId}, userId: ${userId}, authenticated: ${isUserAuthenticated}`);
    
    // Set currentProjectId in localStorage for consistency
    localStorage.setItem('currentProjectId', projectId);
    
    // First try to load from server API if user is authenticated
    if (isUserAuthenticated && userId !== 'anonymous') {
      console.log('[projectService] User is authenticated, trying to load from server API');
      
      try {
        const url = `${API_URL}/projects/${projectId}?userId=${encodeURIComponent(userId)}`;
        console.log(`[projectService] Making GET request to: ${url}`);
        
        const response = await fetch(url);
        console.log(`[projectService] Load response status:`, response.status);
        
        // If we get a 404, the project might be in localStorage
        if (response.status === 404) {
          console.log('[projectService] Project not found on server, checking localStorage');
          // Continue to localStorage fallback
        } else {
          const result = await response.json();
          console.log(`[projectService] Load response body:`, result);
          
          if (!response.ok) {
            console.error('[projectService] API error:', result);
            throw new Error(result.message || 'Failed to load project from server');
          }
          
          const project = result.data;
          
          // Ensure we have a proper project ID
          const projectId = project._id || project.id;
          
          if (!projectId) {
            console.error('[projectService] Project is missing ID field:', project);
            throw new Error('Project data is invalid - missing ID field');
          }
          
          console.log('[projectService] Project loaded from server successfully:', { 
            id: projectId,
            name: project.name,
            tasks: project.projectData?.tasks?.length || 0
          });
          
          // Count dependencies for logging
          let totalDependencyCount = 0;
          if (project.projectData && project.projectData.tasks) {
            project.projectData.tasks.forEach((task: any) => {
              if (task.dependencies && Array.isArray(task.dependencies)) {
                totalDependencyCount += task.dependencies.length;
              }
            });
          }
          console.log(`[projectService] Loaded project with ${project.projectData?.tasks?.length || 0} tasks and ${totalDependencyCount} dependencies`);
          
          // Format the project data
          const formattedProject: ProjectData = {
            metadata: {
              id: projectId,
              name: project.name,
              description: project.description,
              isPublic: project.isPublic,
              tags: project.tags,
              userId: project.userId,
              createdAt: new Date(project.createdAt),
              updatedAt: new Date(project.updatedAt)
            },
            projectData: project.projectData
          };
          
          return {
            success: true,
            project: formattedProject
          };
        }
      } catch (apiError) {
        if (apiError instanceof Error && apiError.message.includes('Failed to fetch')) {
          console.warn('[projectService] Server API unavailable, falling back to localStorage');
          // Continue to localStorage fallback
        } else {
          console.error('[projectService] Error loading from server API:', apiError);
          // Continue to localStorage fallback
        }
      }
    }
    
    // Fallback to localStorage
    console.log('[projectService] Falling back to localStorage to load project');
    
    // Get existing projects
    const projectsJson = localStorage.getItem(PROJECTS_KEY) || '[]';
    const projects = JSON.parse(projectsJson);
    
    // Find the project
    const project = projects.find((p: any) => p._id === projectId);
    
    if (!project) {
      throw new Error('Project not found in local storage');
    }
    
    // If the project is not public, check if the user owns it
    if (!project.isPublic) {
      if (project.userId !== userId && project.userId !== 'anonymous') {
        throw new Error('You do not have permission to view this project');
      }
    }
    
    // Count dependencies for logging
    let totalDependencyCount = 0;
    if (project.projectData && project.projectData.tasks) {
      project.projectData.tasks.forEach((task: any) => {
        if (task.dependencies && Array.isArray(task.dependencies)) {
          totalDependencyCount += task.dependencies.length;
        }
      });
    }
    console.log(`[projectService] Loaded project with ${project.projectData?.tasks?.length || 0} tasks and ${totalDependencyCount} dependencies from localStorage`);
    
    // Format the project data
    const formattedProject: ProjectData = {
      metadata: {
        id: project._id,
        name: project.name,
        description: project.description,
        isPublic: project.isPublic,
        tags: project.tags,
        userId: project.userId,
        createdAt: new Date(project.createdAt),
        updatedAt: new Date(project.updatedAt)
      },
      projectData: project.projectData
    };
    
    return {
      success: true,
      project: formattedProject
    };
  } catch (error: any) {
    console.error('[projectService] Error loading project:', error);
    return {
      success: false,
      error: error.message || 'An error occurred while loading the project'
    };
  }
};

/**
 * Delete a project from the server or localStorage
 */
export const deleteProject = async (
  projectId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Validate the projectId
    if (!projectId || projectId === 'undefined' || projectId === 'null') {
      throw new Error('Invalid project ID');
    }
    
    const userId = getCurrentUserId();
    const isUserAuthenticated = isAuthenticated();
    
    console.log(`[projectService] Deleting project: ${projectId}, userId: ${userId}, authenticated: ${isUserAuthenticated}`);
    
    // If user is authenticated, delete from server API
    if (isUserAuthenticated && userId !== 'anonymous') {
      console.log('[projectService] User is authenticated, deleting from server API');
      
      try {
        const response = await fetch(`${API_URL}/projects/${projectId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ userId })
        });
        
        // Handle case where project is not found on server
        if (response.status === 404) {
          console.log('[projectService] Project not found on server, checking localStorage');
          // Continue to localStorage fallback
        } else {
          const result = await response.json();
          
          if (!response.ok) {
            console.error('[projectService] API error:', result);
            throw new Error(result.message || 'Failed to delete project from server');
          }
          
          console.log('[projectService] Project deleted from server successfully');
          
          // If the project was successfully deleted from the server,
          // also delete it from localStorage if it exists there
          deleteFromLocalStorage(projectId, userId);
          
          return { success: true };
        }
      } catch (apiError) {
        console.error('[projectService] Server API error, falling back to localStorage:', apiError);
        // Fall back to localStorage if server API fails
      }
    }
    
    // Fallback to delete from localStorage
    return deleteFromLocalStorage(projectId, userId);
  } catch (error: any) {
    console.error('[projectService] Error deleting project:', error);
    return {
      success: false,
      error: error.message || 'An error occurred while deleting the project'
    };
  }
};

/**
 * Helper function to delete a project from localStorage
 */
const deleteFromLocalStorage = (
  projectId: string,
  userId: string
): { success: boolean; error?: string } => {
  console.log(`[projectService] Deleting project from localStorage: ${projectId}`);
  
  try {
    // Get existing projects
    const projectsJson = localStorage.getItem(PROJECTS_KEY) || '[]';
    const projects = JSON.parse(projectsJson);
    
    // Find the project before deleting it
    const projectToDelete = projects.find((p: any) => p._id === projectId);
    if (!projectToDelete) {
      throw new Error('Project not found in localStorage');
    }
    
    // Check if user owns the project
    if (projectToDelete.userId !== userId && projectToDelete.userId !== 'anonymous') {
      throw new Error('You do not have permission to delete this project');
    }
    
    // Filter out the project to delete
    const updatedProjects = projects.filter((p: any) => p._id !== projectId);
    
    // Save back to localStorage
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(updatedProjects));
    
    console.log('[projectService] Project deleted from localStorage:', projectId);
    
    return { success: true };
  } catch (error: any) {
    console.error('[projectService] Error deleting project from localStorage:', error);
    return {
      success: false,
      error: error.message || 'An error occurred while deleting the project from localStorage'
    };
  }
};

/**
 * Get all projects for the current user from the server or localStorage
 */
export const getUserProjects = async (): Promise<{
  success: boolean;
  projects?: ProjectMetadata[];
  error?: string;
}> => {
  try {
    const userId = getCurrentUserId();
    const isUserAuthenticated = isAuthenticated();
    
    console.log(`[projectService] Getting user projects, userId: ${userId}, authenticated: ${isUserAuthenticated}`);
    
    let serverProjects: ProjectMetadata[] = [];
    
    // First try to get projects from server API if user is authenticated
    if (isUserAuthenticated && userId !== 'anonymous') {
      console.log('[projectService] User is authenticated, trying to load projects from server API');
      
      try {
        const response = await fetch(`${API_URL}/projects/user/${encodeURIComponent(userId)}`);
        const result = await response.json();
        
        if (!response.ok) {
          console.error('[projectService] API error:', result);
          throw new Error(result.message || 'Failed to get projects from server');
        }
        
        serverProjects = result.data.map((p: any) => ({
          id: p._id,
          name: p.name,
          description: p.description,
          isPublic: p.isPublic,
          tags: p.tags,
          userId: p.userId,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt)
        }));
        
        console.log(`[projectService] Found ${serverProjects.length} projects on server`);
      } catch (apiError) {
        console.error('[projectService] Server API error, falling back to localStorage:', apiError);
        // Fall back to localStorage if server API fails
      }
    }
    
    // Get local projects as well (for fallback or merging)
    console.log('[projectService] Getting projects from localStorage');
    
    // Get existing projects
    const projectsJson = localStorage.getItem(PROJECTS_KEY) || '[]';
    const localProjects = JSON.parse(projectsJson);
    
    // Get projects based on authentication status
    let userProjects = [];
    
    if (isUserAuthenticated) {
      // If authenticated, get projects from server and merge with local projects that aren't on server
      userProjects = serverProjects;
      
      // Get IDs of server projects
      const serverProjectIds = new Set(serverProjects.map(p => p.id));
      
      // Add local projects that aren't on server yet
      const localOnlyProjects = localProjects
        .filter((p: any) => p.userId === userId && !serverProjectIds.has(p._id))
        .map((p: any) => ({
          id: p._id,
          name: p.name,
          description: p.description,
          isPublic: p.isPublic,
          tags: p.tags,
          userId: p.userId,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
          isLocalOnly: true // Mark as local-only projects
        }));
      
      userProjects = [...userProjects, ...localOnlyProjects];
      console.log(`[projectService] Added ${localOnlyProjects.length} local-only projects`);
    } else {
      // If not authenticated, show only anonymous projects and public projects
      userProjects = localProjects
        .filter((p: any) => p.userId === 'anonymous' || p.isPublic === true)
        .map((p: any) => ({
          id: p._id,
          name: p.name,
          description: p.description,
          isPublic: p.isPublic,
          tags: p.tags,
          userId: p.userId,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt)
        }));
    }
    
    console.log(`[projectService] Found ${userProjects.length} total projects for user`);
    
    return {
      success: true,
      projects: userProjects
    };
  } catch (error: any) {
    console.error('[projectService] Error getting user projects:', error);
    return {
      success: false,
      error: error.message || 'An error occurred while getting projects'
    };
  }
};

/**
 * Migrate a project from localStorage to the server
 */
export const migrateProjectToServer = async (
  projectId: string
): Promise<{ success: boolean; serverProjectId?: string; error?: string }> => {
  try {
    // Validate the projectId
    if (!projectId || projectId === 'undefined' || projectId === 'null') {
      throw new Error('Invalid project ID');
    }
    
    const userId = getCurrentUserId();
    const isUserAuthenticated = isAuthenticated();
    
    // Check if user is authenticated
    if (!isUserAuthenticated || userId === 'anonymous') {
      throw new Error('You must be authenticated to migrate a project to the server');
    }
    
    console.log(`[projectService] Migrating project to server: ${projectId}`);
    
    // First load the project from localStorage
    const projectsJson = localStorage.getItem(PROJECTS_KEY) || '[]';
    const projects = JSON.parse(projectsJson);
    
    // Find the project
    const project = projects.find((p: any) => p._id === projectId);
    
    if (!project) {
      throw new Error('Project not found in localStorage');
    }
    
    // Update the userId to the authenticated user's ID
    project.userId = userId;
    
    // Upload to server
    const response = await fetch(`${API_URL}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId,
        name: project.name,
        description: project.description || '',
        projectData: project.projectData,
        isPublic: project.isPublic || false,
        tags: project.tags || []
      })
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      console.error('[projectService] API error:', result);
      throw new Error(result.message || 'Failed to migrate project to server');
    }
    
    const serverProjectId = result.data._id;
    console.log(`[projectService] Project migrated to server successfully with ID: ${serverProjectId}`);
    
    // Delete the local copy to avoid duplicates
    const updatedProjects = projects.filter((p: any) => p._id !== projectId);
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(updatedProjects));
    
    // Update currentProjectId to the new server ID
    localStorage.setItem('currentProjectId', serverProjectId);
    
    return {
      success: true,
      serverProjectId
    };
  } catch (error: any) {
    console.error('[projectService] Error migrating project to server:', error);
    return {
      success: false,
      error: error.message || 'An error occurred while migrating the project to the server'
    };
  }
};
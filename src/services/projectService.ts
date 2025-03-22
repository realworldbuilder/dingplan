/**
 * Service for handling project data persistence with the server
 * TEMPORARY: Using localStorage for persistence instead of server API
 */

import { getCurrentUserId, isAuthenticated } from './authService';

// Base API URL - should be configurable from environment
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Storage keys for localStorage
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
 * Save a project to localStorage (mock server)
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
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
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
 * Update an existing project in localStorage (mock server)
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
    
    console.log(`[projectService] Updating project locally: ${projectId}`);
    
    // Get existing projects
    const projectsJson = localStorage.getItem(PROJECTS_KEY) || '[]';
    const projects = JSON.parse(projectsJson);
    
    // Find the project to update
    const projectIndex = projects.findIndex((p: any) => p._id === projectId);
    
    if (projectIndex === -1) {
      throw new Error('Project not found');
    }
    
    // Check if user owns the project
    const userId = getCurrentUserId();
    if (projects[projectIndex].userId !== userId && projects[projectIndex].userId !== 'anonymous') {
      throw new Error('You do not have permission to edit this project');
    }
    
    // Update the project
    projects[projectIndex] = {
      ...projects[projectIndex],
      name: metadata.name,
      description: metadata.description,
      projectData: projectData,
      isPublic: metadata.isPublic,
      tags: metadata.tags,
      updatedAt: new Date().toISOString()
    };
    
    // Save back to localStorage
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
    
    console.log('[projectService] Project updated locally:', projectId);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
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
 * Load a project from localStorage (mock server)
 */
export const loadProject = async (
  projectId: string
): Promise<{ success: boolean; project?: ProjectData; error?: string }> => {
  try {
    // Validate the projectId
    if (!projectId || projectId === 'undefined' || projectId === 'null') {
      throw new Error('Invalid project ID');
    }
    
    console.log(`[projectService] Loading project locally: ${projectId}`);
    
    // Get existing projects
    const projectsJson = localStorage.getItem(PROJECTS_KEY) || '[]';
    const projects = JSON.parse(projectsJson);
    
    // Find the project
    const project = projects.find((p: any) => p._id === projectId);
    
    if (!project) {
      throw new Error('Project not found');
    }
    
    // If the project is not public, check if the user owns it
    if (!project.isPublic) {
      const userId = getCurrentUserId();
      if (project.userId !== userId && project.userId !== 'anonymous') {
        throw new Error('You do not have permission to view this project');
      }
    }
    
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
    
    console.log('[projectService] Project loaded locally:', projectId);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
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
 * Delete a project from localStorage (mock server)
 */
export const deleteProject = async (
  projectId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Validate the projectId
    if (!projectId || projectId === 'undefined' || projectId === 'null') {
      throw new Error('Invalid project ID');
    }
    
    console.log(`[projectService] Deleting project locally: ${projectId}`);
    
    // Get existing projects
    const projectsJson = localStorage.getItem(PROJECTS_KEY) || '[]';
    const projects = JSON.parse(projectsJson);
    
    // Find the project before deleting it
    const projectToDelete = projects.find((p: any) => p._id === projectId);
    if (!projectToDelete) {
      throw new Error('Project not found');
    }
    
    // Check if user owns the project
    const userId = getCurrentUserId();
    if (projectToDelete.userId !== userId && projectToDelete.userId !== 'anonymous') {
      throw new Error('You do not have permission to delete this project');
    }
    
    // Filter out the project to delete
    const updatedProjects = projects.filter((p: any) => p._id !== projectId);
    
    // Save back to localStorage
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(updatedProjects));
    
    console.log('[projectService] Project deleted locally:', projectId);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
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
 * Get all projects for the current user from localStorage (mock server)
 */
export const getUserProjects = async (): Promise<{
  success: boolean;
  projects?: ProjectMetadata[];
  error?: string;
}> => {
  try {
    console.log('[projectService] Getting user projects locally');
    
    // Get existing projects
    const projectsJson = localStorage.getItem(PROJECTS_KEY) || '[]';
    const projects = JSON.parse(projectsJson);
    
    // Current user ID
    const userId = getCurrentUserId();
    
    // Get projects based on authentication status
    let userProjects = [];
    
    if (isAuthenticated()) {
      // If authenticated, only show this user's projects
      userProjects = projects.filter((p: any) => p.userId === userId);
    } else {
      // If not authenticated, show only anonymous projects and public projects
      userProjects = projects.filter(
        (p: any) => p.userId === 'anonymous' || p.isPublic === true
      );
    }
    
    // Format the projects
    const formattedProjects: ProjectMetadata[] = userProjects.map((p: any) => ({
      id: p._id,
      name: p.name,
      description: p.description,
      isPublic: p.isPublic,
      tags: p.tags,
      userId: p.userId,
      createdAt: new Date(p.createdAt),
      updatedAt: new Date(p.updatedAt)
    }));
    
    console.log(`[projectService] Found ${formattedProjects.length} projects locally`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return {
      success: true,
      projects: formattedProjects
    };
  } catch (error: any) {
    console.error('[projectService] Error getting user projects:', error);
    return {
      success: false,
      error: error.message || 'An error occurred while getting projects'
    };
  }
}; 
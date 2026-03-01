/**
 * Service for handling project data persistence with Supabase
 */

import { supabase } from '../config/supabase'
import { getCurrentUserId, isAuthenticatedSync } from './supabaseAuthService'

// Storage keys for localStorage fallback
const PROJECTS_KEY = 'dingplan_projects'
const CURRENT_PROJECT_INDEX = 'dingplan_current_project_index'

interface ProjectMetadata {
  id?: string
  name: string
  description?: string
  tags?: string[]
  createdAt?: Date
  updatedAt?: Date
  userId?: string
}

interface ProjectData {
  metadata: ProjectMetadata
  projectData: any
}

/**
 * Initialize localStorage for projects if not already set up
 */
const initializeLocalStorage = (): void => {
  if (!localStorage.getItem(PROJECTS_KEY)) {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify([]))
  }
  
  if (!localStorage.getItem(CURRENT_PROJECT_INDEX)) {
    localStorage.setItem(CURRENT_PROJECT_INDEX, '0')
  }
}

/**
 * Generate a unique ID
 */
const generateId = (): string => {
  return 'project_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
}

/**
 * Save a project to Supabase or localStorage
 */
export const saveProject = async (
  projectData: any,
  metadata: ProjectMetadata
): Promise<{ success: boolean; projectId?: string; error?: string }> => {
  try {
    const userId = getCurrentUserId()
    const isUserAuthenticated = isAuthenticatedSync()
    
    console.log('[SupabaseProjectService] Saving project:', { 
      name: metadata.name,
      userId,
      isAuthenticated: isUserAuthenticated,
      dataSize: projectData ? JSON.stringify(projectData).length : 0
    })
    
    // Validate project data
    if (!projectData) {
      console.error('[SupabaseProjectService] Project data is empty or invalid')
      throw new Error('Project data is empty or invalid')
    }
    
    // If user is authenticated, save to Supabase
    if (isUserAuthenticated && userId !== 'anonymous') {
      console.log('[SupabaseProjectService] User is authenticated, saving to Supabase')
      
      try {
        const { data, error } = await supabase
          .from('projects')
          .insert({
            user_id: userId,
            name: metadata.name,
            data: projectData
          })
          .select()
          .single()
        
        if (error) {
          console.error('[SupabaseProjectService] Supabase error:', error)
          throw new Error(error.message)
        }
        
        console.log('[SupabaseProjectService] Project saved to Supabase successfully:', data)
        
        return {
          success: true,
          projectId: data.id
        }
      } catch (supabaseError) {
        console.error('[SupabaseProjectService] Supabase error, falling back to localStorage:', supabaseError)
        // Fall back to localStorage if Supabase fails
      }
    }
    
    // Save to localStorage as fallback or for anonymous users
    console.log('[SupabaseProjectService] Saving to localStorage (fallback or anonymous user)')
    
    // Initialize localStorage if needed
    initializeLocalStorage()
    
    // Generate a unique ID for this project
    const projectId = generateId()
    console.log(`[SupabaseProjectService] Generated project ID: ${projectId}`)
    
    // Create project object
    const project = {
      _id: projectId,
      userId: userId,
      name: metadata.name,
      description: metadata.description || '',
      projectData: projectData,
      tags: metadata.tags || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    // Get existing projects
    const projectsJson = localStorage.getItem(PROJECTS_KEY) || '[]'
    let projects = []
    
    try {
      projects = JSON.parse(projectsJson)
    } catch (parseError) {
      console.error('[SupabaseProjectService] Error parsing existing projects:', parseError)
      projects = []
    }
    
    if (!Array.isArray(projects)) {
      console.error('[SupabaseProjectService] Projects is not an array, resetting to empty array')
      projects = []
    }
    
    // Add new project
    projects.push(project)
    
    // Save back to localStorage
    try {
      localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
      console.log(`[SupabaseProjectService] Project saved successfully with ID: ${projectId}`)
    } catch (storageError) {
      console.error('[SupabaseProjectService] Error saving to localStorage:', storageError)
      throw new Error('Failed to save project to storage: ' + 
                     (storageError instanceof Error ? storageError.message : 'Storage error'))
    }
    
    return {
      success: true,
      projectId: projectId
    }
  } catch (error: any) {
    console.error('[SupabaseProjectService] Error saving project:', error)
    return {
      success: false,
      error: error.message || 'An error occurred while saving the project'
    }
  }
}

/**
 * Update an existing project in Supabase or localStorage
 */
export const updateProject = async (
  projectId: string,
  projectData: any,
  metadata: ProjectMetadata
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Validate the projectId
    if (!projectId || projectId === 'undefined' || projectId === 'null') {
      throw new Error('Invalid project ID')
    }
    
    const userId = getCurrentUserId()
    const isUserAuthenticated = isAuthenticatedSync()
    
    console.log(`[SupabaseProjectService] Updating project: ${projectId}`, {
      taskCount: projectData?.tasks?.length || 0,
      swimlaneCount: projectData?.swimlanes?.length || 0,
      userId,
      isAuthenticated: isUserAuthenticated
    })
    
    // If user is authenticated, update in Supabase
    if (isUserAuthenticated && userId !== 'anonymous') {
      console.log('[SupabaseProjectService] User is authenticated, updating in Supabase')
      
      try {
        const { data, error } = await supabase
          .from('projects')
          .update({
            name: metadata.name,
            data: projectData,
            updated_at: new Date().toISOString()
          })
          .eq('id', projectId)
          .eq('user_id', userId)
          .select()
          .single()
        
        if (error) {
          console.error('[SupabaseProjectService] Supabase error:', error)
          throw new Error(error.message)
        }
        
        console.log('[SupabaseProjectService] Project updated in Supabase successfully:', data)
        
        // Also save the currentProjectId for consistency
        localStorage.setItem('currentProjectId', projectId)
        
        return { success: true }
      } catch (supabaseError) {
        console.error('[SupabaseProjectService] Supabase error, falling back to localStorage:', supabaseError)
        // Fall back to localStorage if Supabase fails
      }
    }
    
    // Update in localStorage as fallback or for anonymous users
    console.log('[SupabaseProjectService] Updating in localStorage (fallback or anonymous user)')
    
    // Get existing projects
    const projectsJson = localStorage.getItem(PROJECTS_KEY) || '[]'
    const projects = JSON.parse(projectsJson)
    
    // Find the project to update
    const projectIndex = projects.findIndex((p: any) => p._id === projectId)
    
    if (projectIndex === -1) {
      throw new Error('Project not found')
    }
    
    // Check if user owns the project
    if (projects[projectIndex].userId !== userId && projects[projectIndex].userId !== 'anonymous') {
      throw new Error('You do not have permission to edit this project')
    }
    
    // Ensure projectData is properly sanitized to prevent circular references
    const sanitizedData = JSON.parse(JSON.stringify(projectData))
    
    // Update the project
    projects[projectIndex] = {
      ...projects[projectIndex],
      name: metadata.name,
      description: metadata.description,
      projectData: sanitizedData,
      tags: metadata.tags,
      updatedAt: new Date().toISOString()
    }
    
    // Save back to localStorage
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
    
    // Also save the currentProjectId for consistency
    localStorage.setItem('currentProjectId', projectId)
    
    console.log('[SupabaseProjectService] Project updated locally:', projectId)
    
    return { success: true }
  } catch (error: any) {
    console.error('[SupabaseProjectService] Error updating project:', error)
    return {
      success: false,
      error: error.message || 'An error occurred while updating the project'
    }
  }
}

/**
 * Load a project from Supabase or localStorage
 */
export const loadProject = async (
  projectId: string
): Promise<{ success: boolean; project?: ProjectData; error?: string }> => {
  try {
    // Validate the projectId
    if (!projectId || projectId === 'undefined' || projectId === 'null') {
      throw new Error('Invalid project ID')
    }
    
    const userId = getCurrentUserId()
    const isUserAuthenticated = isAuthenticatedSync()
    
    console.log(`[SupabaseProjectService] Loading project: ${projectId}, userId: ${userId}, authenticated: ${isUserAuthenticated}`)
    
    // Set currentProjectId in localStorage for consistency
    localStorage.setItem('currentProjectId', projectId)
    
    // First try to load from Supabase if user is authenticated
    if (isUserAuthenticated && userId !== 'anonymous') {
      console.log('[SupabaseProjectService] User is authenticated, trying to load from Supabase')
      
      try {
        const { data: project, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .eq('user_id', userId)
          .single()
        
        if (error) {
          if (error.code === 'PGRST116') {
            console.log('[SupabaseProjectService] Project not found in Supabase, checking localStorage')
            // Continue to localStorage fallback
          } else {
            console.error('[SupabaseProjectService] Supabase error:', error)
            throw new Error(error.message)
          }
        } else if (project) {
          console.log('[SupabaseProjectService] Project loaded from Supabase successfully:', { 
            id: project.id,
            name: project.name,
            tasks: project.data?.tasks?.length || 0
          })
          
          // Format the project data
          const formattedProject: ProjectData = {
            metadata: {
              id: project.id,
              name: project.name,
              userId: project.user_id,
              createdAt: new Date(project.created_at),
              updatedAt: new Date(project.updated_at)
            },
            projectData: project.data
          }
          
          return {
            success: true,
            project: formattedProject
          }
        }
      } catch (supabaseError) {
        console.error('[SupabaseProjectService] Error loading from Supabase:', supabaseError)
        // Continue to localStorage fallback
      }
    }
    
    // Fallback to localStorage
    console.log('[SupabaseProjectService] Falling back to localStorage to load project')
    
    // Get existing projects
    const projectsJson = localStorage.getItem(PROJECTS_KEY) || '[]'
    const projects = JSON.parse(projectsJson)
    
    // Find the project
    const project = projects.find((p: any) => p._id === projectId)
    
    if (!project) {
      throw new Error('Project not found in local storage')
    }
    
    // Check if the user owns the project (anonymous users can only access their own projects)
    if (project.userId !== userId && project.userId !== 'anonymous') {
      throw new Error('You do not have permission to view this project')
    }
    
    console.log(`[SupabaseProjectService] Loaded project with ${project.projectData?.tasks?.length || 0} tasks from localStorage`)
    
    // Format the project data
    const formattedProject: ProjectData = {
      metadata: {
        id: project._id,
        name: project.name,
        description: project.description,
        tags: project.tags,
        userId: project.userId,
        createdAt: new Date(project.createdAt),
        updatedAt: new Date(project.updatedAt)
      },
      projectData: project.projectData
    }
    
    return {
      success: true,
      project: formattedProject
    }
  } catch (error: any) {
    console.error('[SupabaseProjectService] Error loading project:', error)
    return {
      success: false,
      error: error.message || 'An error occurred while loading the project'
    }
  }
}

/**
 * Delete a project from Supabase or localStorage
 */
export const deleteProject = async (
  projectId: string
): Promise<{ success: boolean; error?: string }> => {
  try {
    // Validate the projectId
    if (!projectId || projectId === 'undefined' || projectId === 'null') {
      throw new Error('Invalid project ID')
    }
    
    const userId = getCurrentUserId()
    const isUserAuthenticated = isAuthenticatedSync()
    
    console.log(`[SupabaseProjectService] Deleting project: ${projectId}, userId: ${userId}, authenticated: ${isUserAuthenticated}`)
    
    // If user is authenticated, delete from Supabase
    if (isUserAuthenticated && userId !== 'anonymous') {
      console.log('[SupabaseProjectService] User is authenticated, deleting from Supabase')
      
      try {
        const { error } = await supabase
          .from('projects')
          .delete()
          .eq('id', projectId)
          .eq('user_id', userId)
        
        if (error) {
          console.error('[SupabaseProjectService] Supabase error:', error)
          throw new Error(error.message)
        }
        
        console.log('[SupabaseProjectService] Project deleted from Supabase successfully')
        
        // If the project was successfully deleted from Supabase,
        // also delete it from localStorage if it exists there
        deleteFromLocalStorage(projectId, userId)
        
        return { success: true }
      } catch (supabaseError) {
        console.error('[SupabaseProjectService] Supabase error, falling back to localStorage:', supabaseError)
        // Fall back to localStorage if Supabase fails
      }
    }
    
    // Fallback to delete from localStorage
    return deleteFromLocalStorage(projectId, userId)
  } catch (error: any) {
    console.error('[SupabaseProjectService] Error deleting project:', error)
    return {
      success: false,
      error: error.message || 'An error occurred while deleting the project'
    }
  }
}

/**
 * Helper function to delete a project from localStorage
 */
const deleteFromLocalStorage = (
  projectId: string,
  userId: string
): { success: boolean; error?: string } => {
  console.log(`[SupabaseProjectService] Deleting project from localStorage: ${projectId}`)
  
  try {
    // Get existing projects
    const projectsJson = localStorage.getItem(PROJECTS_KEY) || '[]'
    const projects = JSON.parse(projectsJson)
    
    // Find the project before deleting it
    const projectToDelete = projects.find((p: any) => p._id === projectId)
    if (!projectToDelete) {
      throw new Error('Project not found in localStorage')
    }
    
    // Check if user owns the project
    if (projectToDelete.userId !== userId && projectToDelete.userId !== 'anonymous') {
      throw new Error('You do not have permission to delete this project')
    }
    
    // Filter out the project to delete
    const updatedProjects = projects.filter((p: any) => p._id !== projectId)
    
    // Save back to localStorage
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(updatedProjects))
    
    console.log('[SupabaseProjectService] Project deleted from localStorage:', projectId)
    
    return { success: true }
  } catch (error: any) {
    console.error('[SupabaseProjectService] Error deleting project from localStorage:', error)
    return {
      success: false,
      error: error.message || 'An error occurred while deleting the project from localStorage'
    }
  }
}

/**
 * Get all projects for the current user from Supabase or localStorage
 */
export const getUserProjects = async (): Promise<{
  success: boolean
  projects?: ProjectMetadata[]
  error?: string
}> => {
  try {
    const userId = getCurrentUserId()
    const isUserAuthenticated = isAuthenticatedSync()
    
    console.log(`[SupabaseProjectService] Getting user projects, userId: ${userId}, authenticated: ${isUserAuthenticated}`)
    
    let supabaseProjects: ProjectMetadata[] = []
    
    // First try to get projects from Supabase if user is authenticated
    if (isUserAuthenticated && userId !== 'anonymous') {
      console.log('[SupabaseProjectService] User is authenticated, trying to load projects from Supabase')
      
      try {
        const { data: projects, error } = await supabase
          .from('projects')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
        
        if (error) {
          console.error('[SupabaseProjectService] Supabase error:', error)
          throw new Error(error.message)
        }
        
        supabaseProjects = projects.map((p: any) => ({
          id: p.id,
          name: p.name,
          tags: [],
          userId: p.user_id,
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.updated_at)
        }))
        
        console.log(`[SupabaseProjectService] Found ${supabaseProjects.length} projects in Supabase`)
      } catch (supabaseError) {
        console.error('[SupabaseProjectService] Supabase error, falling back to localStorage:', supabaseError)
        // Fall back to localStorage if Supabase fails
      }
    }
    
    // Get local projects as well (for fallback or merging)
    console.log('[SupabaseProjectService] Getting projects from localStorage')
    
    // Get existing projects
    const projectsJson = localStorage.getItem(PROJECTS_KEY) || '[]'
    const localProjects = JSON.parse(projectsJson)
    
    // Get projects based on authentication status
    let userProjects = []
    
    if (isUserAuthenticated) {
      // If authenticated, get projects from Supabase and merge with local projects that aren't on Supabase
      userProjects = supabaseProjects
      
      // Get IDs of Supabase projects
      const supabaseProjectIds = new Set(supabaseProjects.map(p => p.id))
      
      // Add local projects that aren't on Supabase yet
      const localOnlyProjects = localProjects
        .filter((p: any) => p.userId === userId && !supabaseProjectIds.has(p._id))
        .map((p: any) => ({
          id: p._id,
          name: p.name,
          description: p.description,
          tags: p.tags,
          userId: p.userId,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt),
          isLocalOnly: true // Mark as local-only projects
        }))
      
      userProjects = [...userProjects, ...localOnlyProjects]
      console.log(`[SupabaseProjectService] Added ${localOnlyProjects.length} local-only projects`)
    } else {
      // If not authenticated, show only anonymous projects
      userProjects = localProjects
        .filter((p: any) => p.userId === 'anonymous')
        .map((p: any) => ({
          id: p._id,
          name: p.name,
          description: p.description,
          tags: p.tags,
          userId: p.userId,
          createdAt: new Date(p.createdAt),
          updatedAt: new Date(p.updatedAt)
        }))
    }
    
    console.log(`[SupabaseProjectService] Found ${userProjects.length} total projects for user`)
    
    return {
      success: true,
      projects: userProjects
    }
  } catch (error: any) {
    console.error('[SupabaseProjectService] Error getting user projects:', error)
    return {
      success: false,
      error: error.message || 'An error occurred while getting projects'
    }
  }
}
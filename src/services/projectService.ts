import { supabase } from '../config/supabase';
import { AuthService } from './authService';

export interface ProjectMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectData {
  id: string;
  name: string;
  tasks: any[];
  swimlanes?: any[];
  settings?: any;
}

const STORAGE_KEY = 'dingplan_projects';

// Local Storage functions (unchanged for backward compatibility)
function getProjectIndex(): ProjectMetadata[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function setProjectIndex(index: ProjectMetadata[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(index));
}

function saveProjectToLocalStorage(project: ProjectData): string {
  const id = project.id || crypto.randomUUID();
  const now = new Date().toISOString();
  
  // Save project data
  localStorage.setItem(`dingplan_project_${id}`, JSON.stringify(project));
  
  // Update index
  const index = getProjectIndex();
  const existing = index.findIndex(p => p.id === id);
  const meta: ProjectMetadata = { id, name: project.name, createdAt: existing >= 0 ? index[existing].createdAt : now, updatedAt: now };
  
  if (existing >= 0) {
    index[existing] = meta;
  } else {
    index.push(meta);
  }
  setProjectIndex(index);
  return id;
}

function loadProjectFromLocalStorage(id: string): ProjectData | null {
  try {
    const data = localStorage.getItem(`dingplan_project_${id}`);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

function deleteProjectFromLocalStorage(id: string): boolean {
  localStorage.removeItem(`dingplan_project_${id}`);
  const index = getProjectIndex().filter(p => p.id !== id);
  setProjectIndex(index);
  return true;
}

// Supabase functions
async function saveProjectToSupabase(project: ProjectData): Promise<string> {
  const user = await AuthService.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const id = project.id || crypto.randomUUID();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from('projects')
    .upsert({
      id,
      user_id: user.id,
      name: project.name,
      project_data: project,
      updated_at: now,
    });

  if (error) {
    throw new Error(`Failed to save project: ${error.message}`);
  }

  // Also save to localStorage as cache
  saveProjectToLocalStorage(project);
  
  return id;
}

async function loadProjectFromSupabase(id: string): Promise<ProjectData | null> {
  const user = await AuthService.getUser();
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from('projects')
    .select('project_data')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    return null;
  }

  const project = data.project_data as ProjectData;
  
  // Cache in localStorage
  if (project) {
    saveProjectToLocalStorage(project);
  }
  
  return project;
}

async function listProjectsFromSupabase(): Promise<ProjectMetadata[]> {
  const user = await AuthService.getUser();
  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('projects')
    .select('id, name, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map(project => ({
    id: project.id,
    name: project.name,
    createdAt: project.created_at,
    updatedAt: project.updated_at,
  }));
}

async function deleteProjectFromSupabase(id: string): Promise<boolean> {
  const user = await AuthService.getUser();
  if (!user) {
    return false;
  }

  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) {
    console.error('Failed to delete project from Supabase:', error);
    return false;
  }

  // Also remove from localStorage
  deleteProjectFromLocalStorage(id);
  
  return true;
}

// Public API - now all async and works with both storage methods
export async function listProjects(): Promise<ProjectMetadata[]> {
  const user = await AuthService.getUser();
  
  if (user) {
    // User is logged in - use Supabase with localStorage as fallback
    try {
      const supabaseProjects = await listProjectsFromSupabase();
      if (supabaseProjects.length > 0) {
        return supabaseProjects;
      }
    } catch (error) {
      console.error('Failed to load projects from Supabase, falling back to localStorage:', error);
    }
  }
  
  // Anonymous user or Supabase failed - use localStorage
  return getProjectIndex().sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function saveProject(project: ProjectData): Promise<string> {
  const user = await AuthService.getUser();
  
  if (user) {
    // User is logged in - save to Supabase
    try {
      return await saveProjectToSupabase(project);
    } catch (error) {
      console.error('Failed to save project to Supabase, saving to localStorage:', error);
      return saveProjectToLocalStorage(project);
    }
  } else {
    // Anonymous user - save to localStorage only
    return saveProjectToLocalStorage(project);
  }
}

export async function loadProject(id: string): Promise<ProjectData | null> {
  const user = await AuthService.getUser();
  
  if (user) {
    // User is logged in - try Supabase first, then localStorage
    try {
      const project = await loadProjectFromSupabase(id);
      if (project) {
        return project;
      }
    } catch (error) {
      console.error('Failed to load project from Supabase, trying localStorage:', error);
    }
  }
  
  // Anonymous user or Supabase failed - use localStorage
  return loadProjectFromLocalStorage(id);
}

export async function deleteProject(id: string): Promise<boolean> {
  const user = await AuthService.getUser();
  
  if (user) {
    // User is logged in - delete from Supabase
    try {
      return await deleteProjectFromSupabase(id);
    } catch (error) {
      console.error('Failed to delete project from Supabase, deleting from localStorage:', error);
      return deleteProjectFromLocalStorage(id);
    }
  } else {
    // Anonymous user - delete from localStorage only
    return deleteProjectFromLocalStorage(id);
  }
}

export async function duplicateProject(id: string, newName?: string): Promise<string | null> {
  const project = await loadProject(id);
  if (!project) return null;
  const newId = crypto.randomUUID();
  return await saveProject({ ...project, id: newId, name: newName || `${project.name} (copy)` });
}

// Helper function to migrate localStorage projects to Supabase
export async function migrateLocalProjectsToSupabase(): Promise<{ success: number; failed: number }> {
  const user = await AuthService.getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  const localProjects = getProjectIndex();
  let success = 0;
  let failed = 0;

  for (const meta of localProjects) {
    try {
      const project = loadProjectFromLocalStorage(meta.id);
      if (project) {
        await saveProjectToSupabase(project);
        success++;
      }
    } catch (error) {
      console.error(`Failed to migrate project ${meta.name}:`, error);
      failed++;
    }
  }

  return { success, failed };
}
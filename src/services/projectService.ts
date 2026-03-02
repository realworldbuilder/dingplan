import { supabase } from './supabase';
import { authService } from './authService';

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

// Local Storage functions
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

// === Supabase functions ===

async function saveProjectToSupabase(project: ProjectData): Promise<string> {
  const user = authService.getCurrentUser();
  if (!user) throw new Error('User not authenticated');
  
  const { data, error } = await supabase
    .from('projects')
    .upsert({
      id: project.id || undefined,
      user_id: user.id,
      name: project.name,
      data: project
    })
    .select()
    .single();
  
  if (error) throw new Error(`Failed to save project: ${error.message}`);
  return data.id;
}

async function loadProjectFromSupabase(id: string): Promise<ProjectData | null> {
  const user = authService.getCurrentUser();
  if (!user) return null;
  
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  
  if (error) {
    console.error('Failed to load project from Supabase:', error.message);
    return null;
  }
  
  return data.data;
}

async function listProjectsFromSupabase(): Promise<ProjectMetadata[]> {
  const user = authService.getCurrentUser();
  if (!user) return [];
  
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, created_at, updated_at')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });
  
  if (error) {
    console.error('Failed to list projects from Supabase:', error.message);
    return [];
  }
  
  return data.map(p => ({
    id: p.id,
    name: p.name,
    createdAt: p.created_at,
    updatedAt: p.updated_at
  }));
}

async function deleteProjectFromSupabase(id: string): Promise<boolean> {
  const user = authService.getCurrentUser();
  if (!user) return false;
  
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  
  if (error) {
    console.error('Failed to delete project from Supabase:', error.message);
    return false;
  }
  
  return true;
}

// === Sync function ===

export async function syncLocalToCloud(): Promise<void> {
  const user = authService.getCurrentUser();
  if (!user) return;
  
  console.log('Syncing local projects to cloud...');
  
  const localProjects = getProjectIndex();
  let syncCount = 0;
  
  for (const meta of localProjects) {
    try {
      const project = loadProjectFromLocalStorage(meta.id);
      if (project) {
        // Check if project already exists in cloud
        const cloudProject = await loadProjectFromSupabase(project.id);
        if (!cloudProject) {
          await saveProjectToSupabase(project);
          syncCount++;
          console.log(`Synced project "${project.name}" to cloud`);
        }
      }
    } catch (error) {
      console.error(`Failed to sync project ${meta.name}:`, error);
    }
  }
  
  if (syncCount > 0) {
    console.log(`Successfully synced ${syncCount} local projects to cloud`);
  }
}

// === Public API ===

export async function listProjects(): Promise<ProjectMetadata[]> {
  const user = authService.getCurrentUser();
  
  if (user) {
    try {
      return await listProjectsFromSupabase();
    } catch (error) {
      console.error('Failed to load projects from cloud, falling back to localStorage:', error);
    }
  }
  
  return getProjectIndex().sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export async function saveProject(project: ProjectData): Promise<string> {
  const user = authService.getCurrentUser();
  
  if (user) {
    try {
      return await saveProjectToSupabase(project);
    } catch (error) {
      console.error('Failed to save to cloud, saving locally:', error);
    }
  }
  
  return saveProjectToLocalStorage(project);
}

export async function loadProject(id: string): Promise<ProjectData | null> {
  const user = authService.getCurrentUser();
  
  if (user) {
    try {
      const project = await loadProjectFromSupabase(id);
      if (project) return project;
    } catch (error) {
      console.error('Failed to load from cloud, trying localStorage:', error);
    }
  }
  
  return loadProjectFromLocalStorage(id);
}

export async function deleteProject(id: string): Promise<boolean> {
  const user = authService.getCurrentUser();
  
  let cloudDeleted = false;
  if (user) {
    try {
      cloudDeleted = await deleteProjectFromSupabase(id);
    } catch (error) {
      console.error('Failed to delete from cloud:', error);
    }
  }
  
  const localDeleted = deleteProjectFromLocalStorage(id);
  return cloudDeleted || localDeleted;
}

export async function duplicateProject(id: string, newName?: string): Promise<string | null> {
  const project = await loadProject(id);
  if (!project) return null;
  const newId = crypto.randomUUID();
  return await saveProject({ ...project, id: newId, name: newName || `${project.name} (copy)` });
}

// === JSON Sharing ===

export async function exportProjectAsJSON(projectId: string): Promise<string | null> {
  const project = await loadProject(projectId);
  if (!project) return null;
  return JSON.stringify(project, null, 2);
}

export async function importProjectFromJSON(json: string): Promise<string> {
  const data = JSON.parse(json) as ProjectData;
  data.id = crypto.randomUUID(); // new ID to avoid conflicts
  return await saveProject(data);
}

export async function exportProjectAsURL(projectId: string): Promise<string | null> {
  const project = await loadProject(projectId);
  if (!project) return null;
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(project))));
  return `${window.location.origin}${window.location.pathname}#share=${encoded}`;
}

export async function importProjectFromURL(): Promise<string | null> {
  const hash = window.location.hash;
  if (!hash.startsWith('#share=')) return null;
  try {
    const encoded = hash.slice(7);
    const json = decodeURIComponent(escape(atob(encoded)));
    const id = await importProjectFromJSON(json);
    window.location.hash = '';
    return id;
  } catch { return null; }
}

export async function downloadProjectJSON(projectId: string): Promise<void> {
  const json = await exportProjectAsJSON(projectId);
  if (!json) return;
  const project = await loadProject(projectId);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project?.name || 'project'}.dingplan.json`;
  a.click();
  URL.revokeObjectURL(url);
}
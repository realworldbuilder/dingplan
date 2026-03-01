// Project storage service — localStorage now, Supabase later
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

function getProjectIndex(): ProjectMetadata[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

function setProjectIndex(index: ProjectMetadata[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(index));
}

export function listProjects(): ProjectMetadata[] {
  return getProjectIndex().sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function saveProject(project: ProjectData): string {
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

export function loadProject(id: string): ProjectData | null {
  try {
    const data = localStorage.getItem(`dingplan_project_${id}`);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
}

export function deleteProject(id: string): boolean {
  localStorage.removeItem(`dingplan_project_${id}`);
  const index = getProjectIndex().filter(p => p.id !== id);
  setProjectIndex(index);
  return true;
}

export function duplicateProject(id: string, newName?: string): string | null {
  const project = loadProject(id);
  if (!project) return null;
  const newId = crypto.randomUUID();
  return saveProject({ ...project, id: newId, name: newName || `${project.name} (copy)` });
}
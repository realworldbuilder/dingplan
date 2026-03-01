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

// Public API - now synchronous and localStorage-only
export function listProjects(): ProjectMetadata[] {
  return getProjectIndex().sort((a, b) => 
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function saveProject(project: ProjectData): string {
  return saveProjectToLocalStorage(project);
}

export function loadProject(id: string): ProjectData | null {
  return loadProjectFromLocalStorage(id);
}

export function deleteProject(id: string): boolean {
  return deleteProjectFromLocalStorage(id);
}

export function duplicateProject(id: string, newName?: string): string | null {
  const project = loadProject(id);
  if (!project) return null;
  const newId = crypto.randomUUID();
  return saveProject({ ...project, id: newId, name: newName || `${project.name} (copy)` });
}

// === JSON Sharing ===

export function exportProjectAsJSON(projectId: string): string | null {
  const project = loadProject(projectId);
  if (!project) return null;
  return JSON.stringify(project, null, 2);
}

export function importProjectFromJSON(json: string): string {
  const data = JSON.parse(json) as ProjectData;
  data.id = crypto.randomUUID(); // new ID to avoid conflicts
  return saveProject(data);
}

export function exportProjectAsURL(projectId: string): string | null {
  const project = loadProject(projectId);
  if (!project) return null;
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(project))));
  return `${window.location.origin}${window.location.pathname}#share=${encoded}`;
}

export function importProjectFromURL(): string | null {
  const hash = window.location.hash;
  if (!hash.startsWith('#share=')) return null;
  try {
    const encoded = hash.slice(7);
    const json = decodeURIComponent(escape(atob(encoded)));
    const id = importProjectFromJSON(json);
    window.location.hash = '';
    return id;
  } catch { return null; }
}

export function downloadProjectJSON(projectId: string): void {
  const json = exportProjectAsJSON(projectId);
  if (!json) return;
  const project = loadProject(projectId);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project?.name || 'project'}.dingplan.json`;
  a.click();
  URL.revokeObjectURL(url);
}
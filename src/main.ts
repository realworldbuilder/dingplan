import { Canvas } from './Canvas';
import { generateUUID } from './utils';
import { authService } from './services/authService';
import { authUI } from './services/authUI';
import { importProjectFromURL } from './services/projectService';

declare global {
  interface Window {
    canvasApp: any;
    forceSave: () => boolean;
  }
}

const LEFT_PANEL_WIDTH = 260;

function updateCanvasSize(canvasElement: HTMLCanvasElement, app: any, panelOpen: boolean) {
  const offset = panelOpen ? LEFT_PANEL_WIDTH : 0;
  canvasElement.width = window.innerWidth - offset;
  canvasElement.height = window.innerHeight;
  if (panelOpen) {
    canvasElement.classList.add('panel-open');
  } else {
    canvasElement.classList.remove('panel-open');
  }
  if (app) app.resize(canvasElement.width, canvasElement.height);
}

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize auth first
  console.log('Initializing DingPlan with Supabase auth...');
  
  // Check for URL-based project import
  const importedProjectId = await importProjectFromURL();
  if (importedProjectId) {
    console.log('Imported project from URL:', importedProjectId);
  }
  
  // Initialize auth UI now that DOM is ready
  authUI.init();
  
  // Show auth modal only if there's no current user and no imported project
  const currentUser = authService.getCurrentUser();
  if (!currentUser && !localStorage.getItem('dingplan_skip_auth')) {
    setTimeout(() => {
      authUI.show();
    }, 1000);
  }

  const canvasElement = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvasElement) {
    console.error('Canvas element not found');
    return;
  }
  
  let leftPanelOpen = false;
  
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
  canvasElement.style.cursor = 'grab';

  const startDate = new Date();
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);
  
  const app = new Canvas({
    canvas: canvasElement,
    backgroundColor: '#f0f0f0',
    gridColor: '#e0e0e0',
    startDate,
  });
  
  window.canvasApp = app;
  
  // Wire up left panel toggle
  const toggleBtn = document.getElementById('left-panel-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      leftPanelOpen = !leftPanelOpen;
      if (leftPanelOpen) {
        app.sidebar.showLeftPanel();
        toggleBtn.style.left = `${LEFT_PANEL_WIDTH + 12}px`;
      } else {
        app.sidebar.hideLeftPanel();
        toggleBtn.style.left = '12px';
      }
      updateCanvasSize(canvasElement, app, leftPanelOpen);
    });
  }
  
  // Expose panel state for sidebar to use
  (window as any).__leftPanelOpen = () => leftPanelOpen;
  (window as any).__setLeftPanelOpen = (open: boolean) => {
    leftPanelOpen = open;
    if (toggleBtn) toggleBtn.style.left = open ? `${LEFT_PANEL_WIDTH + 12}px` : '12px';
    updateCanvasSize(canvasElement, app, leftPanelOpen);
  };
  
  // Initialize composer
  setTimeout(() => {
    if (app && app.sidebar) {
      app.sidebar.initializeComposer?.(app);
    }
  }, 500);
  
  // Keyboard shortcut for composer
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.code === 'Space') {
      if (app && app.sidebar) {
        app.sidebar.show?.('composer');
        e.preventDefault();
      }
    }
  });
  
  // Animation loop
  function animate() {
    app.render();
    requestAnimationFrame(animate);
  }
  animate();
  
  // Handle window resize
  window.addEventListener('resize', () => {
    updateCanvasSize(canvasElement, app, leftPanelOpen);
  });
  
  // Save before unload
  window.addEventListener('beforeunload', () => {
    if (window.canvasApp) {
      window.canvasApp.saveToLocalStorage();
    }
  });
  
  // Auto-save every minute
  if (window.canvasApp && window.canvasApp.saveToLocalStorage) {
    setInterval(() => {
      window.canvasApp.saveToLocalStorage();
    }, 60000);
  }
  
  // Check for shared project in URL
  setTimeout(async () => {
    const hash = window.location.hash;
    if (hash.startsWith('#share=')) {
      try {
        const base64Data = hash.slice(7);
        const jsonString = decodeURIComponent(atob(base64Data));
        const projectData = JSON.parse(jsonString);
        
        if (app && app.taskManager) {
          const existingTasks = app.taskManager.getAllTasks();
          existingTasks.forEach((task: any) => {
            app.taskManager.removeTask(task.id);
          });
          
          if (projectData.swimlanes && Array.isArray(projectData.swimlanes)) {
            app.taskManager.swimlanes = projectData.swimlanes;
          }
          
          if (projectData.tasks && Array.isArray(projectData.tasks)) {
            projectData.tasks.forEach((taskData: any) => {
              try {
                app.taskManager.addTask({
                  id: taskData.id || generateUUID(),
                  name: taskData.name || 'Untitled Task',
                  startDate: new Date(taskData.startDate),
                  duration: taskData.duration || 1,
                  crewSize: taskData.crewSize || 1,
                  color: taskData.color || '#3B82F6',
                  tradeId: taskData.tradeId || '',
                  dependencies: taskData.dependencies || []
                });
              } catch (taskErr) {
                console.error('Error loading shared task:', taskErr, taskData);
              }
            });
          }
          
          app.render();
          window.history.replaceState({}, document.title, window.location.pathname);
          console.log(`Loaded shared project: ${projectData.name} with ${projectData.tasks?.length || 0} tasks`);
          alert(`Loaded shared project: ${projectData.name}`);
        }
      } catch (error) {
        console.error('Failed to load shared project:', error);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, 1000);
});

window.forceSave = function() {
  if (window.canvasApp && window.canvasApp.saveToLocalStorage) {
    window.canvasApp.saveToLocalStorage();
    return true;
  }
  return false;
};

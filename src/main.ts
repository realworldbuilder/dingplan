import { Canvas } from './Canvas';
import { generateUUID } from './utils';

declare global {
  interface Window {
    canvasApp: any;
    forceSave: () => boolean;
  }
}

const LEFT_PANEL_WIDTH = 260;

document.addEventListener('DOMContentLoaded', () => {
  const canvasElement = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvasElement) {
    console.error('Canvas element not found');
    return;
  }
  
  canvasElement.width = window.innerWidth - LEFT_PANEL_WIDTH;
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
    canvasElement.width = window.innerWidth - LEFT_PANEL_WIDTH;
    canvasElement.height = window.innerHeight;
    app.resize(window.innerWidth - LEFT_PANEL_WIDTH, window.innerHeight);
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

import { Canvas } from './Canvas';
import { Composer } from './composer/Composer';
import { initializeDiagnostics } from './diagnostic';
import { generateUUID } from './utils';
import authConnector from './components/auth/AuthConnector';

// Declare the global window object to have our canvasApp property
declare global {
  interface Window {
    canvasApp: any;
  }
}

// Enable diagnostic tools in production
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  console.log('Production environment detected, enabling diagnostics');
  // Wait for DOM to be ready
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      initializeDiagnostics();
    }, 2000); // Give app time to initialize
  });
}

// Class to monitor performance
class Monitor {
  private element: HTMLElement;
  private canvas: Canvas;
  private fpsValues: number[] = [];
  private lastTime = performance.now();
  private frameCount = 0;
  private mouseX = 0;
  private mouseY = 0;

  constructor(canvas: Canvas) {
    this.canvas = canvas;
    this.element = document.getElementById('monitor') as HTMLElement;
    this.update = this.update.bind(this);

    // Track mouse position
    this.canvas.canvas.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
  }

  update() {
    this.frameCount++;
    const currentTime = performance.now();
    const elapsed = currentTime - this.lastTime;

    if (elapsed >= 1000) {
      const fps = (this.frameCount * 1000) / elapsed;
      this.fpsValues.push(fps);
      if (this.fpsValues.length > 60) {
        this.fpsValues.shift();
      }

      const avgFps = this.fpsValues.reduce((a, b) => a + b) / this.fpsValues.length;
      const camera = this.canvas.camera;
      const zoom = camera.zoom;

      // Get date at mouse position
      const date = this.canvas.getDateAtPosition(this.mouseX, this.mouseY);
      const dateStr = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });

      this.element.innerHTML = `
        FPS: ${Math.round(avgFps)}<br>
        Zoom: ${zoom.toFixed(2)}x<br>
        Position: (${Math.round(camera.x)}, ${Math.round(camera.y)})<br>
        Date at cursor: ${dateStr}
      `;

      this.frameCount = 0;
      this.lastTime = currentTime;
    }
  }
}

// Variables for change detection and autosave
let lastKnownTaskCount = 0;
let lastTaskModificationTime = 0;
let autoSaveScheduled = false;
let areDependenciesVisible = true; // Flag for dependency visibility

// Wait for the DOM to be fully loaded before initializing the app
document.addEventListener('DOMContentLoaded', () => {
  // Set up the canvas with initial size
  const canvasElement = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvasElement) {
    console.error('Canvas element not found');
    return;
  }
  
  canvasElement.width = window.innerWidth;
  canvasElement.height = window.innerHeight;
  
  // Set initial cursor style
  canvasElement.style.cursor = 'grab';

  // Set start date to beginning of current month
  const startDate = new Date();
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);
  
  console.log('Initializing Canvas application...');
  
  // Create Canvas instance with initial configuration
  const app = new Canvas({
    canvas: canvasElement,
    backgroundColor: '#f0f0f0',
    gridColor: '#e0e0e0',
    startDate,
  });
  
  // Function to broadcast the current tasks to the parent window
  const broadcastTasksToParent = () => {
    if (window.parent && window.parent !== window) {
      const tasks = app.taskManager.getAllTasks();
      window.parent.postMessage({
        type: 'TASKS_UPDATE',
        tasks: tasks
      }, '*');
      console.log('Broadcast tasks update to parent window', tasks.length);
    }
  };
  
  // Make app available globally
  console.log('Making Canvas app available globally');
  window.canvasApp = app;
  
  // Initialize performance monitor if enabled
  if (document.getElementById('monitor')) {
    const monitor = new Monitor(app);
    setInterval(() => monitor.update(), 500);
  }
  
  // Initialize the Composer via sidebar after a short delay
  setTimeout(() => {
    if (app && app.sidebar) {
      app.sidebar.initializeComposer?.(app);
      console.log('Composer initialized through sidebar.');
      
      // Initialize auth connector after components are ready
      setTimeout(() => {
        console.log('Initializing auth connector with increased delay');
        // Ensure the sidebar is visible before initializing
        if (app && app.sidebar) {
          app.sidebar.show();
        }
        authConnector.init();
      }, 3000); // Increased delay to ensure DOM is fully loaded
    }
  }, 500);
  
  // Add keyboard shortcut to open sidebar composer view
  document.addEventListener('keydown', (e) => {
    // Toggle Composer with Ctrl+Space
    if (e.ctrlKey && e.code === 'Space') {
      if (app && app.sidebar) {
        app.sidebar.show?.('composer');
        e.preventDefault();
      }
    }
  });
  
  // Set up the toolbar buttons if the function exists
  if ((window as any).setupToolbarButtons) {
    console.log('setupToolbarButtons found, calling it');
    (window as any).setupToolbarButtons(app);
  }
  
  // Attempt to set up toolbar buttons after a delay in case the function isn't ready yet
  setTimeout(() => {
    if ((window as any).setupToolbarButtons) {
      console.log('setupToolbarButtons found after timeout, calling it');
      (window as any).setupToolbarButtons(app);
    }
  }, 1000);
  
  // Animation loop with task change detection
  function animate() {
    app.render();
    
    // Check for changes in tasks
    const currentTaskCount = app.taskManager.getAllTasks().length;
    if (currentTaskCount !== lastKnownTaskCount) {
      lastKnownTaskCount = currentTaskCount;
      lastTaskModificationTime = performance.now();
      
      // Schedule auto-save when tasks change
      if (!autoSaveScheduled) {
        autoSaveScheduled = true;
        setTimeout(() => {
          broadcastTasksToParent();
          autoSaveScheduled = false;
        }, 2000); // Wait 2 seconds after last change to save
      }
    }
    
    requestAnimationFrame(animate);
  }
  
  // Start the animation loop
  animate();
  
  // Handle window resize
  window.addEventListener('resize', () => {
    canvasElement.width = window.innerWidth;
    canvasElement.height = window.innerHeight;
    app.resize(window.innerWidth, window.innerHeight);
  });
  
  // Listen for messages from parent iframe
  window.addEventListener('message', (event) => {
    try {
      if (event.data && event.data.type) {
        console.log('Received message from parent:', event.data.type);
        
        switch (event.data.type) {
          case 'GET_TASKS':
            broadcastTasksToParent();
            break;
            
          case 'LOAD_DATA':
            console.log('Received data from parent:', event.data.data);
            if (event.data.data) {
              try {
                // Extract and apply settings
                if (event.data.data.settings) {
                  areDependenciesVisible = !!event.data.data.settings.areDependenciesVisible;
                }
                
                // Clear existing tasks
                const existingTasks = app.taskManager.getAllTasks();
                existingTasks.forEach(task => {
                  app.taskManager.removeTask(task.id);
                });
                
                // Add tasks from data
                if (event.data.data.tasks && Array.isArray(event.data.data.tasks)) {
                  event.data.data.tasks.forEach((taskData: any) => {
                    try {
                      // Create the task
                      app.taskManager.addTask({
                        id: taskData.id || generateUUID(),
                        name: taskData.name || taskData.title || 'Untitled Task',
                        startDate: new Date(taskData.startDate),
                        duration: taskData.duration || 3,
                        crewSize: taskData.crewSize || 1,
                        color: taskData.color || '#3B82F6',
                        tradeId: taskData.tradeId || taskData.trade || '',
                        dependencies: taskData.dependencies || []
                      });
                    } catch (taskErr) {
                      console.error('Error adding task:', taskErr, taskData);
                    }
                  });
                  
                  // Update tracking variables
                  lastKnownTaskCount = app.taskManager.getAllTasks().length;
                  console.log(`Successfully loaded ${lastKnownTaskCount} tasks into construction planner`);
                } else {
                  console.warn('No tasks found in the data or tasks is not an array');
                }
              } catch (err) {
                console.error('Error loading data:', err);
                window.parent.postMessage({
                  type: 'CP_ERROR',
                  message: 'Failed to load data into construction planner: ' + (err as Error).message
                }, '*');
              }
            }
            break;
          
          case 'SAVE_REQUEST':
            console.log('Save requested from parent');
            broadcastTasksToParent();
            break;
        }
      }
    } catch (err) {
      console.error('Error processing message from parent:', err);
      window.parent.postMessage({
        type: 'CP_ERROR',
        message: 'Error processing message: ' + (err as Error).message
      }, '*');
    }
  });
  
  // Send ready message to parent
  if (window.parent && window.parent !== window) {
    console.log('In iframe, sending ready message to parent');
    window.parent.postMessage({
      type: 'CP_READY'
    }, '*');
  } else {
    console.log('Not in iframe, running standalone');
  }
  
  // Set up the page unload handler to ensure state is saved
  window.addEventListener('beforeunload', () => {
    if (window.canvasApp) {
      // Final save before unloading the page
      window.canvasApp.saveToLocalStorage();
    }
  });
  
  // Ensure auto-save is set up
  if (window.canvasApp && window.canvasApp.saveToLocalStorage) {
    setInterval(() => {
      window.canvasApp.saveToLocalStorage();
    }, 60000); // Auto-save every minute
  }
}); 
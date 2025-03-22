/**
 * Direct Fix for Task Creation Issue
 * 
 * This script:
 * 1. Silences console logging by overriding console methods
 * 2. Injects a task directly into the tasks array
 * 3. Forces a render to check if tasks appear
 */

// Step 1: Silence console logs
const originalConsole = {
  log: console.log
};

// Override console.log to filter out the spam
console.log = function(...args) {
  // Filter out all the task array empty messages
  if (args[0] && typeof args[0] === 'string' && 
      (args[0].includes('tasks array is empty') || 
       args[0].includes('Render method - Total tasks'))) {
    return; // Don't log these messages
  }
  
  // Log everything else normally
  originalConsole.log(...args);
};

// Step 2: Function to directly inject a task
function injectTestTask() {
  if (!window.canvasApp || !window.canvasApp.taskManager) {
    console.log('Canvas app not found. Try running this after the page fully loads.');
    return false;
  }
  
  try {
    // Create a task with distinctive properties
    const uniqueId = 'test-' + Date.now();
    const testTask = {
      id: uniqueId,
      name: `Direct Test Task ${new Date().toLocaleTimeString()}`,
      startDate: new Date(),
      duration: 5,
      crewSize: 3,
      color: '#ff0000',
      tradeId: 'default',
      dependencies: []
    };
    
    // Get the reference to the tasks array - might be null or private
    const tasks = window.canvasApp.taskManager.tasks;
    if (!tasks) {
      console.log('Tasks array is not accessible directly. Using addTask method instead.');
      
      // Find first available swimlane
      if (window.canvasApp.taskManager.swimlanes.length > 0) {
        const swimlaneId = window.canvasApp.taskManager.swimlanes[0].id;
        console.log(`Adding task to swimlane ${swimlaneId}`);
        
        // Use the addTask method
        const task = window.canvasApp.addTask(testTask, swimlaneId);
        console.log('Task created:', task);
        
        // Force render
        window.canvasApp.render();
        window.canvasApp.scrollToToday();
        
        return task;
      } else {
        console.log('No swimlanes found. Cannot add tasks without swimlanes.');
        return false;
      }
    }
    
    // Try direct modification of the array - this might not work due to TypeScript private members
    console.log(`Before adding, tasks.length = ${tasks.length}`);
    tasks.push(testTask);
    console.log(`After adding, tasks.length = ${tasks.length}`);
    
    // Also try to add to a swimlane if possible
    if (window.canvasApp.taskManager.swimlanes.length > 0) {
      const swimlane = window.canvasApp.taskManager.swimlanes[0];
      swimlane.tasks.push(testTask);
      
      // Set position in the swimlane
      swimlane.taskPositions.set(testTask.id, { 
        x: 0, 
        y: swimlane.y + 50 + (swimlane.tasks.length * 70)
      });
      
      console.log(`Task also added to swimlane ${swimlane.name}`);
    }
    
    // Force render and scroll to see the task
    window.canvasApp.render();
    window.canvasApp.scrollToToday();
    
    return testTask;
  } catch (error) {
    console.error('Error injecting test task:', error);
    return false;
  }
}

// Step 3: Verify tasks - run this after injecting a task
function verifyTasks() {
  if (!window.canvasApp) {
    console.log('Canvas app not found');
    return;
  }
  
  console.log('=== TASK VERIFICATION ===');
  console.log(`TaskManager.tasks available: ${!!window.canvasApp.taskManager.tasks}`);
  
  if (window.canvasApp.taskManager.tasks) {
    console.log(`Tasks array length: ${window.canvasApp.taskManager.tasks.length}`);
    
    // Force getAllTasks() to be called and see if it returns the expected data
    const allTasks = window.canvasApp.taskManager.getAllTasks();
    console.log(`getAllTasks() returns ${allTasks.length} tasks`);
    
    if (allTasks.length > 0) {
      console.log('First task:', allTasks[0].name);
    }
  }
  
  // Check swimlanes
  const swimlanes = window.canvasApp.taskManager.swimlanes;
  console.log(`Found ${swimlanes.length} swimlanes`);
  
  let totalTasksInSwimlanes = 0;
  swimlanes.forEach((lane, index) => {
    console.log(`Swimlane ${index}: "${lane.name}" has ${lane.tasks.length} tasks`);
    totalTasksInSwimlanes += lane.tasks.length;
  });
  
  console.log(`Total tasks in swimlanes: ${totalTasksInSwimlanes}`);
}

// Execute both functions
console.log('Running task fix script...');
injectTestTask();
setTimeout(verifyTasks, 500);

// Return these functions so they can be called from console if needed
{ injectTestTask, verifyTasks } 
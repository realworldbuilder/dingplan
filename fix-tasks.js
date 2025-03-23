/**
 * Direct Fix for Task Visibility Issue
 * 
 * This script addresses the issue where tasks are invisible but resources still show up.
 * It focuses on fixing:
 * 1. Trade filters that might be hiding tasks
 * 2. Task positions that might be incorrect
 * 3. Swimlane-task relationships
 */

// Step 1: Reset all trade filters to ensure everything is visible
function resetTradeFilters() {
  if (!window.canvasApp) {
    console.log('Canvas app not found. Try running this after the page fully loads.');
    return false;
  }
  
  try {
    console.log('Resetting all trade filters to make all tasks visible...');
    
    // Reset filters in TaskManager
    if (window.canvasApp.taskManager.tradeFilters) {
      // Get all trades
      const trades = window.canvasApp.taskManager.trades || Trades.getAllTrades();
      
      // Create a new map with all trades set to visible
      const newFilters = new Map();
      trades.forEach(trade => {
        newFilters.set(trade.id, true);
        // Also set by color for backward compatibility
        if (trade.color) {
          newFilters.set(trade.color, true);
        }
      });
      
      // Additional protection - make sure any existing task colors are visible
      const tasks = window.canvasApp.taskManager.getAllTasks();
      tasks.forEach(task => {
        if (task.color) {
          newFilters.set(task.color, true);
        }
        if (task.tradeId) {
          newFilters.set(task.tradeId, true);
        }
      });
      
      // Apply the new filters
      window.canvasApp.taskManager.setTradeFilters(newFilters);
      console.log('Trade filters reset: All trades are now visible');
      
      // Also reset in sidebar if available
      if (window.canvasApp.sidebar) {
        // Reset sidebar filters too
        window.canvasApp.sidebar.onTradeFilterChange?.(newFilters);
      }
    } else {
      console.log('Trade filters not found on taskManager');
    }
    
    return true;
  } catch (error) {
    console.error('Error resetting trade filters:', error);
    return false;
  }
}

// Step 2: Fix task positions and ensure they're in swimlanes
function fixTaskPositions() {
  if (!window.canvasApp) {
    console.log('Canvas app not found. Try running this after the page fully loads.');
    return false;
  }
  
  try {
    console.log('Fixing task positions and swimlane assignments...');
    
    const taskManager = window.canvasApp.taskManager;
    const tasks = taskManager.getAllTasks();
    
    console.log(`Found ${tasks.length} tasks total`);
    
    if (tasks.length === 0) {
      console.log('No tasks found to fix positions');
      return false;
    }
    
    // Check if we have swimlanes
    if (!taskManager.swimlanes || taskManager.swimlanes.length === 0) {
      console.log('No swimlanes found, cannot fix task positions');
      return false;
    }
    
    // Keep track of fixes
    let fixCount = 0;
    
    // First make sure all tasks are in a swimlane
    tasks.forEach(task => {
      // Find if this task exists in any swimlane
      const existsInSwimlane = taskManager.swimlanes.some(lane => 
        lane.tasks.some(t => t.id === task.id)
      );
      
      if (!existsInSwimlane) {
        // Add to the first swimlane
        const swimlane = taskManager.swimlanes[0];
        console.log(`Task ${task.id} (${task.name}) was not in any swimlane. Adding to ${swimlane.name}`);
        
        // Add task to swimlane
        swimlane.tasks.push(task);
        
        // Calculate y-position to avoid overlap with existing tasks
        const yPosition = swimlane.y + 50 + (swimlane.tasks.length * 40);
        
        // Set position in taskPositions map
        swimlane.taskPositions.set(task.id, { x: 0, y: yPosition });
        
        fixCount++;
      }
    });
    
    // Next fix any invalid positions within swimlanes
    taskManager.swimlanes.forEach(swimlane => {
      swimlane.tasks.forEach(task => {
        const pos = swimlane.taskPositions.get(task.id);
        
        // Check if position exists and is valid
        if (!pos || pos.y < swimlane.y || isNaN(pos.y)) {
          // Calculate a valid y-position within this swimlane
          const yPosition = swimlane.y + 50 + (swimlane.tasks.indexOf(task) * 40);
          
          console.log(`Fixing position for task ${task.id} (${task.name}) in swimlane ${swimlane.name}`);
          console.log(`  Old position: ${pos ? `x:${pos.x}, y:${pos.y}` : 'undefined'}`);
          console.log(`  New position: x:0, y:${yPosition}`);
          
          // Set the fixed position
          swimlane.taskPositions.set(task.id, { x: 0, y: yPosition });
          
          fixCount++;
        }
      });
    });
    
    console.log(`Fixed positions for ${fixCount} tasks`);
    
    // Force a render to apply changes
    window.canvasApp.render();
    
    return true;
  } catch (error) {
    console.error('Error fixing task positions:', error);
    return false;
  }
}

// This function will dump task data to console for debugging
function dumpTaskData() {
  if (!window.canvasApp) {
    console.log('Canvas app not found');
    return;
  }
  
  console.log('=== TASK DATA DUMP ===');
  const taskManager = window.canvasApp.taskManager;
  const tasks = taskManager.getAllTasks();
  
  console.log(`Total tasks: ${tasks.length}`);
  
  tasks.forEach(task => {
    console.log(`Task: ${task.id} - "${task.name}"`);
    console.log(`  - Start date: ${task.startDate}`);
    console.log(`  - Duration: ${task.duration} days`);
    console.log(`  - Trade ID: ${task.tradeId}`);
    console.log(`  - Color: ${task.color}`);
  });
  
  // Check swimlanes
  console.log('=== SWIMLANES ===');
  const swimlanes = taskManager.swimlanes;
  console.log(`Found ${swimlanes.length} swimlanes`);
  
  swimlanes.forEach((lane, index) => {
    console.log(`Swimlane ${index}: "${lane.name}" has ${lane.tasks.length} tasks`);
    lane.tasks.forEach(task => {
      const pos = lane.taskPositions.get(task.id);
      console.log(`  - Task: ${task.id} - "${task.name}" at position ${pos ? `x:${pos.x}, y:${pos.y}` : 'unknown'}`);
    });
  });
  
  // Check trade filters
  console.log('=== TRADE FILTERS ===');
  if (taskManager.tradeFilters) {
    const filters = Array.from(taskManager.tradeFilters.entries());
    console.log(`Trade filters: ${filters.length} entries`);
    filters.forEach(([key, value]) => {
      console.log(`  - ${key}: ${value ? 'visible' : 'hidden'}`);
    });
  } else {
    console.log('No trade filters found');
  }
}

// Execute all fixes
console.log('Running task visibility fix script...');
resetTradeFilters();
fixTaskPositions();
dumpTaskData();

// Force render
if (window.canvasApp) {
  console.log('Forcing render to apply fixes...');
  window.canvasApp.render();
  
  // Try to center view on tasks
  window.canvasApp.camera.zoom = 1; // Reset zoom
  window.canvasApp.camera.y = 200;  // Reset vertical position
  const todayX = window.canvasApp.timeAxis.getTodayPosition();
  window.canvasApp.camera.x = todayX + (window.canvasApp.canvas.width / (3 * window.canvasApp.camera.zoom));
  
  console.log('View centered on today. Tasks should now be visible if they exist.');
}

// Return these functions so they can be called from console if needed
{ resetTradeFilters, fixTaskPositions, dumpTaskData } 
// Fix for Task Visibility in Dingplan
// Copy & paste this entire script into your browser console when viewing dingplan.vercel.app

(function() {
  console.log('🔧 Running Dingplan Task Visibility Fix...');
  
  // STEP 1: Reset all trade filters to ensure everything is visible
  function resetTradeFilters() {
    try {
      console.log('Resetting all trade filters to make all tasks visible...');
      
      // Get the taskManager
      const taskManager = window.canvasApp?.taskManager;
      if (!taskManager) {
        console.error('⚠️ Task manager not found!');
        return false;
      }
      
      // Get sidebar
      const sidebar = window.canvasApp?.sidebar;
      
      // Get all trades - try multiple methods to get trade data
      let trades = [];
      try {
        trades = taskManager.trades || window.Trades?.getAllTrades?.() || [];
      } catch (e) {
        console.log('Could not get trades directly, using hardcoded trade list');
        // Fallback with common trade colors
        trades = [
          { id: 'general', color: '#3b82f6' },
          { id: 'electrical', color: '#f59e0b' },
          { id: 'plumbing', color: '#10b981' },
          { id: 'carpentry', color: '#8b5cf6' }
        ];
      }
      
      // Create a new map with all trades set to visible
      const newFilters = new Map();
      trades.forEach(trade => {
        if (trade.id) newFilters.set(trade.id, true);
        if (trade.color) newFilters.set(trade.color, true);
      });
      
      // Make sure all task colors are also visible
      const tasks = taskManager.getAllTasks?.() || [];
      tasks.forEach(task => {
        if (task.color) newFilters.set(task.color, true);
        if (task.tradeId) newFilters.set(task.tradeId, true);
      });
      
      // CRITICAL FIX: If tradeFilters exists but is incorrectly initialized
      if (!taskManager.tradeFilters || !(taskManager.tradeFilters instanceof Map)) {
        console.log('🔧 Creating new tradeFilters map from scratch');
        taskManager.tradeFilters = new Map();
      }
      
      // Apply new filters
      if (typeof taskManager.setTradeFilters === 'function') {
        taskManager.setTradeFilters(newFilters);
        console.log('✅ Trade filters reset via setTradeFilters');
      } else {
        // Direct assignment if method not available
        taskManager.tradeFilters = newFilters;
        console.log('✅ Trade filters reset via direct assignment');
      }
      
      // Also update sidebar if available
      if (sidebar && typeof sidebar.onTradeFilterChange === 'function') {
        sidebar.onTradeFilterChange(newFilters);
        console.log('✅ Sidebar trade filters also reset');
      }
      
      // Extra verification log
      console.log(`Set ${newFilters.size} trade filters to visible`);
      
      return true;
    } catch (error) {
      console.error('⚠️ Error resetting trade filters:', error);
      return false;
    }
  }
  
  // STEP 2: Fix task positions and swimlane associations
  function fixTaskPositions() {
    try {
      console.log('Fixing task positions and swimlane assignments...');
      
      const taskManager = window.canvasApp?.taskManager;
      if (!taskManager) {
        console.error('⚠️ Task manager not found!');
        return false;
      }
      
      const tasks = taskManager.getAllTasks?.() || [];
      const swimlanes = taskManager.swimlanes || [];
      
      console.log(`Found ${tasks.length} tasks and ${swimlanes.length} swimlanes`);
      
      if (tasks.length === 0) {
        console.log('⚠️ No tasks found to fix positions');
        return false;
      }
      
      if (swimlanes.length === 0) {
        console.log('⚠️ No swimlanes found, cannot fix task positions');
        return false;
      }
      
      // Fix count
      let fixCount = 0;
      
      // STEP 2.1: Make sure all tasks are in a swimlane
      tasks.forEach(task => {
        // Find if task exists in any swimlane
        const existsInSwimlane = swimlanes.some(lane => 
          lane.tasks && lane.tasks.some(t => t.id === task.id)
        );
        
        if (!existsInSwimlane) {
          // Add to first swimlane
          const swimlane = swimlanes[0];
          console.log(`🔧 Task ${task.id} (${task.name}) not in any swimlane. Adding to ${swimlane.name}`);
          
          // Add to swimlane tasks array
          if (!swimlane.tasks) swimlane.tasks = [];
          swimlane.tasks.push(task);
          
          // Make sure taskPositions map exists
          if (!swimlane.taskPositions) swimlane.taskPositions = new Map();
          
          // Calculate y-position (below swimlane header)
          const yPosition = swimlane.y + 50 + (swimlane.tasks.length * 50);
          
          // Set position
          swimlane.taskPositions.set(task.id, { x: 0, y: yPosition });
          fixCount++;
        }
      });
      
      // STEP 2.2: Fix task positions within swimlanes
      swimlanes.forEach(swimlane => {
        if (!swimlane.tasks) {
          swimlane.tasks = [];
          return;
        }
        
        if (!swimlane.taskPositions) {
          swimlane.taskPositions = new Map();
        }
        
        swimlane.tasks.forEach((task, index) => {
          const pos = swimlane.taskPositions.get(task.id);
          
          // Check if position is missing or invalid
          if (!pos || pos.y < swimlane.y || isNaN(pos.y)) {
            // Calculate new position (50px from top, 50px between tasks)
            const yPosition = swimlane.y + 50 + (index * 50);
            
            console.log(`🔧 Fixing position for task ${task.id} (${task.name})`);
            console.log(`  Old: ${pos ? `x:${pos.x}, y:${pos.y}` : 'undefined'} → New: x:0, y:${yPosition}`);
            
            // Set fixed position
            swimlane.taskPositions.set(task.id, { x: 0, y: yPosition });
            fixCount++;
          }
        });
      });
      
      console.log(`✅ Fixed ${fixCount} task positions/associations`);
      return true;
    } catch (error) {
      console.error('⚠️ Error fixing task positions:', error);
      return false;
    }
  }
  
  // STEP 3: Force render and scroll to tasks
  function forceRender() {
    try {
      if (!window.canvasApp) {
        console.error('⚠️ Canvas app not found!');
        return false;
      }
      
      console.log('📊 Forcing re-render...');
      
      // Force a complete render
      window.canvasApp.render();
      
      // Reset camera to sensible defaults
      const camera = window.canvasApp.camera;
      if (camera) {
        console.log('🔧 Resetting camera position...');
        camera.zoom = 1; // Reset zoom level
        camera.y = 200;  // Standard vertical position
        
        // Try to center on today horizontally
        if (window.canvasApp.timeAxis) {
          const todayX = window.canvasApp.timeAxis.getTodayPosition();
          camera.x = todayX + (window.canvasApp.canvas.width / (3 * camera.zoom));
        }
      }
      
      console.log('✅ Render complete');
      return true;
    } catch (error) {
      console.error('⚠️ Error rendering canvas:', error);
      return false;
    }
  }
  
  // Run all fixes in sequence
  console.log('🚀 Starting fix sequence...');
  resetTradeFilters();
  fixTaskPositions();
  forceRender();
  console.log('✅ All fixes applied! Tasks should now be visible.');
  console.log('If tasks remain invisible, please try refreshing the page and running this script again.');
})(); 
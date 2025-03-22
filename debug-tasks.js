console.log('Running test script...'); // Task Creation Diagnostic Test
// This script tests the task creation and rendering flow from composer to task manager to canvas

// 1. First check if canvas and composer are accessible
console.log('Canvas app available:', !!window.canvasApp);
console.log('Composer available:', !!window.canvasApp?.composer);

// 2. Create a test task via direct API
const testTaskConfig = {
  id: 'test-task-' + Date.now(),
  name: 'Diagnostic Test Task',
  duration: 5,
  startDate: new Date(),
  tradeId: 'general',
  color: '#3b82f6',
  crewSize: 1
};

// Get the first swimlane ID
const swimlaneId = window.canvasApp.taskManager.swimlanes[0].id;
console.log('Using swimlane:', swimlaneId);

// 3. Check task counts before adding
console.log('Before adding task:');
console.log('- All tasks count:', window.canvasApp.taskManager.getAllTasks().length);
console.log('- Swimlane tasks count:', window.canvasApp.taskManager.swimlanes[0].tasks.length);

// 4. Add the task
console.log('Adding task...');
const newTask = window.canvasApp.taskManager.addTask(testTaskConfig, swimlaneId);
console.log('Task added, task object:', newTask);

// 5. Check if task was added to data structures
console.log('After adding task:');
console.log('- All tasks count:', window.canvasApp.taskManager.getAllTasks().length);
console.log('- Swimlane tasks count:', window.canvasApp.taskManager.swimlanes[0].tasks.length);
console.log('- Task position in swimlane:', window.canvasApp.taskManager.swimlanes[0].taskPositions.get(newTask.id));

// 6. Force render and check again
console.log('Forcing render...');
window.canvasApp.render();
console.log('Render completed');

// 7. Debug the rendering functions
const taskManagerDrawWasCalled = () => {
  console.log('TaskManager.drawTasks called');
  const originalDrawTasks = window.canvasApp.taskManager.drawTasks;
  window.canvasApp.taskManager.drawTasks = function(ctx, timeAxis, camera) {
    console.log('Drawing tasks. Tasks count:', window.canvasApp.taskManager.getAllTasks().length);
    console.log('Swimlane 0 tasks count:', window.canvasApp.taskManager.swimlanes[0].tasks.length);
    
    // Check task positions
    const positions = [];
    window.canvasApp.taskManager.swimlanes[0].tasks.forEach(task => {
      const pos = window.canvasApp.taskManager.swimlanes[0].taskPositions.get(task.id);
      positions.push({ id: task.id, name: task.name, pos });
    });
    console.log('Task positions:', positions);
    
    // Call original function
    return originalDrawTasks.call(this, ctx, timeAxis, camera);
  };
};

// 8. Run the draw tasks debugging function
taskManagerDrawWasCalled();

// 9. Force another render to see the debug output
console.log('Forcing another render with debug logging...');
window.canvasApp.render();

// 10. Verify task is visible on screen (this outputs to console)
console.log('Check if the test task is visible on screen now');

// 11. Try an alternative creation method via composer
console.log('
Testing task creation via Composer:');
window.canvasApp.composer.createTask({
  name: 'Composer Test Task',
  duration: 3,
  startDate: new Date().toISOString().split('T')[0],
  swimlaneId: swimlaneId
}).then(result => {
  console.log('Composer task creation result:', result);
  console.log('Tasks after composer creation:', window.canvasApp.taskManager.getAllTasks().length);
  console.log('Forcing render after composer creation...');
  window.canvasApp.render();
});

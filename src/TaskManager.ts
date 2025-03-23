import { Task, TaskConfig } from './Task';
import { Camera } from './Camera';
import { Trades, Trade } from './Trades';
import { Logger } from './utils/logger';

interface WorldPosition {
  x: number;
  y: number;
}

interface Swimlane {
  id: string;
  name: string;
  y: number;
  height: number;
  color: string;
  tasks: Task[];
  taskPositions: Map<string, { x: number; y: number }>;
  wbsId?: string; // ID used when exporting to XER format
}

export class TaskManager {
  private tasks: Task[] = [];
  private selectedTasks: Set<Task> = new Set();
  private selectedTasksInOrder: Task[] = [];
  private draggedTask: Task | null = null;
  private dragStartPosition: { x: number; y: number } | null = null;
  private taskPositions: Map<string, { x: number; y: number }> = new Map();
  private isDraggingLeftEdge = false;
  private isDraggingRightEdge = false;
  private readonly EDGE_SENSITIVITY = 10; // Pixels from edge that trigger resize cursor
  private lastMouseWorld = { x: 0, y: 0 };
  readonly swimlanes: Swimlane[] = [];
  readonly SWIMLANE_HEIGHT = 400; // Doubled for more vertical space
  private readonly SWIMLANE_LABEL_WIDTH = 160;
  private isHandMode = false; // New mode flag
  private copiedTasks: TaskConfig[] = []; // Changed type to TaskConfig[]
  private lastCursorWorldX: number = 0; // Track cursor world X position
  private lastCursorWorldY: number = 0; // Track cursor world Y position
  
  // Add new properties for selection box
  private isDrawingSelectionBox = false;
  private selectionBoxStart: { x: number; y: number } | null = null;
  private selectionBoxEnd: { x: number; y: number } | null = null;
  areDependenciesVisible: boolean = true; // For dependency visibility

  // New property for trade filters
  private tradeFilters: Map<string, boolean> = new Map();

  constructor(private timeAxis: any) {
    this.tasks = [];
    
    // Default swimlanes are now created by the template system
    // This constructor no longer initializes default zones

    // Add keyboard listener for mode switching and shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === ' ') { // Spacebar
        // Toggle hand mode when spacebar is pressed
        this.isHandMode = !this.isHandMode;
        document.body.style.cursor = this.isHandMode ? 'grab' : 'default';
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        this.deleteSelectedTasks();
      }
      
      // Handle copy (Ctrl+C or Cmd+C)
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        this.copySelectedTasks();
      }
      
      // Handle paste (Ctrl+V or Cmd+V)
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
        this.pasteSelectedTasks(this.timeAxis);
      }
      
      // Add dependency toggle on 'D' key press
      if (e.key === 'd' || e.key === 'D') {
        this.areDependenciesVisible = !this.areDependenciesVisible;
      }
    });

    // Initialize the trade filters with all trades visible by default
    Trades.getAllTrades().forEach(trade => {
      this.tradeFilters.set(trade.id, true);
    });
  }

  addSwimlane(id: string, name: string, color: string): void {
    const y = this.swimlanes.length * this.SWIMLANE_HEIGHT;
    
    this.swimlanes.push({
      id,
      name,
      y,
      height: this.SWIMLANE_HEIGHT,
      color,
      tasks: [],
      taskPositions: new Map()
    });
  }

  getSwimlaneAt(worldY: number): Swimlane | null {
    return this.swimlanes.find(lane => 
      worldY >= lane.y && 
      worldY <= lane.y + lane.height
    ) || null;
  }

  // Check if there is currently a selected task
  hasSelectedTask(): boolean {
    return this.selectedTasks.size > 0;
  }

  addTask(config: TaskConfig, swimlaneId?: string): Task {
    // Find the swimlane - use first available if not specified
    if (!swimlaneId && this.swimlanes.length > 0) {
      swimlaneId = this.swimlanes[0].id;
    } else if (!swimlaneId) {
      throw new Error("No swimlanes available to add task to");
    }
    
    const swimlane = this.swimlanes.find(s => s.id === swimlaneId);
    if (!swimlane) {
      // If specified swimlane not found, use first available
      if (this.swimlanes.length > 0) {
        swimlaneId = this.swimlanes[0].id;
        const firstSwimlane = this.swimlanes[0];
        console.log(`Swimlane '${swimlaneId}' not found, using '${firstSwimlane.name}' instead`);
        return this.addTask(config, firstSwimlane.id);
      } else {
        throw new Error("No swimlanes available to add task to");
      }
    }
    
    // Ensure a trade is assigned
    if (!config.tradeId || config.tradeId.trim() === '') {
      // If no trade specified, select the first available trade
      const availableTrades = Trades.getAllTrades();
      if (availableTrades.length > 0) {
        config.tradeId = availableTrades[0].id;
        config.color = availableTrades[0].color;
      } else {
        // Default to a blue color if no trades exist
        config.tradeId = 'default';
        config.color = '#3b82f6';
      }
    }
    
    // Ensure swimlaneId is set in the task config
    config.swimlaneId = swimlaneId;
    
    // Create the task
    const task = new Task(config);
    
    // Add to the main task list
    this.tasks.push(task);
    
    // Add to the swimlane
    swimlane.tasks.push(task);
    
    // Calculate task position within the swimlane
    const taskY = this.calculateTaskYInSwimlane(swimlane);
    
    // Set the position in both maps for consistency
    const position = { x: 0, y: taskY };
    swimlane.taskPositions.set(task.id, position);
    this.taskPositions.set(task.id, position);
    
    return task;
  }

  private calculateTaskYInSwimlane(swimlane: Swimlane): number {
    const taskSpacing = 15; // Spacing between tasks
    const topPadding = 40; // Padding from top of swimlane
    const rowHeight = 60; // Standard height for a row of tasks
    const bottomPadding = 30; // Padding from bottom of swimlane
    
    // If there are no tasks yet, return the top position
    if (swimlane.tasks.length === 0) {
      return swimlane.y + topPadding;
    }
    
    // For safety, limit the maximum Y position to ensure tasks don't go outside swimlane
    const maxYPosition = swimlane.y + swimlane.height - rowHeight - bottomPadding;
    
    // Calculate Y position based on existing tasks
    const yPosition = swimlane.y + topPadding + (swimlane.tasks.length * (rowHeight + taskSpacing));
    
    // Ensure it doesn't exceed swimlane bounds
    return Math.min(yPosition, maxYPosition);
  }

  removeTask(id: string) {
    this.tasks.splice(this.tasks.findIndex(t => t.id === id), 1);
    this.taskPositions.delete(id);
  }

  getTask(id: string): Task | undefined {
    return this.tasks.find(t => t.id === id);
  }

  draw(ctx: CanvasRenderingContext2D, timeAxis: any, camera: Camera) {
    // Do not clear the canvas, as Canvas.ts already handles this
    this.drawTasks(ctx, timeAxis, camera);
  }

  private screenToWorld(e: MouseEvent, canvas: HTMLCanvasElement, camera: Camera, timeAxis: any): { x: number, y: number } {
    const rect = canvas.getBoundingClientRect();
    const headerHeight = timeAxis.getHeaderHeight();
    
    // Get screen coordinates relative to canvas
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top - headerHeight; // Subtract header height
    
    // Convert to world coordinates
    return camera.screenToWorld(screenX, screenY);
  }

  handleMouseDown(e: MouseEvent, canvas: HTMLCanvasElement, camera: Camera, timeAxis: any) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Don't handle clicks in the header area
    if (y < timeAxis.getHeaderHeight()) {
      return;
    }

    // Convert screen coordinates to world coordinates
    const worldPos = this.screenToWorld(e, canvas, camera, timeAxis);
    const worldX = worldPos.x;
    const worldY = worldPos.y;

    this.draggedTask = null;
    this.dragStartPosition = null;
    this.isDraggingLeftEdge = false;
    this.isDraggingRightEdge = false;

    let clickedTask: Task | null = null;
    let clickedSwimlane: Swimlane | null = null;

    // Find clicked task within swimlanes
    for (const swimlane of this.swimlanes) {
      if (worldY >= swimlane.y && worldY <= swimlane.y + swimlane.height) {
        clickedSwimlane = swimlane;
        for (const task of swimlane.tasks) {
          const pos = swimlane.taskPositions.get(task.id);
          if (!pos) continue;

          const startX = timeAxis.dateToWorld(task.startDate);
          const endX = timeAxis.dateToWorld(task.getEndDate());
          
          if (worldX >= startX && worldX <= endX && 
              worldY >= pos.y && worldY <= pos.y + task.getCurrentHeight()) {
            clickedTask = task;
            
            // Check for edge dragging
            if (Math.abs(worldX - startX) <= this.EDGE_SENSITIVITY / camera.zoom) {
              this.isDraggingLeftEdge = true;
              canvas.style.cursor = 'ew-resize';
            } else if (Math.abs(worldX - endX) <= this.EDGE_SENSITIVITY / camera.zoom) {
              this.isDraggingRightEdge = true;
              canvas.style.cursor = 'ew-resize';
            }
            break;
          }
        }
        if (clickedTask) break;
      }
    }

    if (clickedTask && clickedSwimlane) {
      // Select the task and show details
      this.selectTask(clickedTask, e);
      
      if (!this.isDraggingLeftEdge && !this.isDraggingRightEdge) {
        this.draggedTask = clickedTask;
        const taskStartX = timeAxis.dateToWorld(clickedTask.startDate);
        const pos = clickedSwimlane.taskPositions.get(clickedTask.id);
        this.dragStartPosition = { 
          x: worldX - taskStartX,
          y: worldY - (pos?.y || 0)
        };
      }
    } else {
      // Start drawing selection box
      this.isDrawingSelectionBox = true;
      this.selectionBoxStart = { x: worldX, y: worldY };
      this.selectionBoxEnd = { x: worldX, y: worldY };
      
      // Only clear selection if not using modifier keys
      if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
        this.selectedTasks.clear();
        // Clear task details when deselecting
        const detailsView = document.getElementById('details-view');
        if (detailsView) {
          detailsView.innerHTML = '<div style="color: #666; text-align: center; padding: 40px;">Select a task to view details</div>';
        }
      }
    }
  }

  handleMouseMove(e: MouseEvent, canvas: HTMLCanvasElement, camera: Camera, timeAxis: any) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Convert screen coordinates to world coordinates
    const worldPos = this.screenToWorld(e, canvas, camera, timeAxis);
    const worldX = worldPos.x;
    const worldY = worldPos.y;

    // Update cursor world position
    this.lastCursorWorldX = worldX;
    this.lastCursorWorldY = worldY;

    // Update selection box if drawing
    if (this.isDrawingSelectionBox && this.selectionBoxStart) {
      this.selectionBoxEnd = { x: worldX, y: worldY };
      
      // Find tasks within selection box
      const left = Math.min(this.selectionBoxStart.x, this.selectionBoxEnd.x);
      const right = Math.max(this.selectionBoxStart.x, this.selectionBoxEnd.x);
      const top = Math.min(this.selectionBoxStart.y, this.selectionBoxEnd.y);
      const bottom = Math.max(this.selectionBoxStart.y, this.selectionBoxEnd.y);

      this.swimlanes.forEach(swimlane => {
        swimlane.tasks.forEach(task => {
          const pos = swimlane.taskPositions.get(task.id);
          if (!pos) return;

          const taskStartX = timeAxis.dateToWorld(task.startDate);
          const taskEndX = timeAxis.dateToWorld(task.getEndDate());
          const taskTop = pos.y;
          const taskBottom = pos.y + task.getCurrentHeight();

          // Check if task intersects with selection box
          if (taskStartX <= right && taskEndX >= left &&
              taskTop <= bottom && taskBottom >= top) {
            this.selectedTasks.add(task);
          }
        });
      });
      return;
    }

    // Handle edge dragging
    if (this.selectedTasks.size > 0) {
      const selectedTask = Array.from(this.selectedTasks)[0];
      if (this.isDraggingLeftEdge || this.isDraggingRightEdge) {
        this.handleEdgeDragging(worldX, selectedTask, timeAxis);
        
        // Update task details when resizing
        if (this.selectedTasks.size === 1) {
          this.updateTaskDetails(selectedTask);
        }
        return;
      }
    }

    // Handle task dragging
    if (this.draggedTask && this.dragStartPosition) {
      // Calculate the time difference for the dragged task
      const newStartDate = timeAxis.worldToDate(worldX - this.dragStartPosition.x);
      const timeDifference = newStartDate.getTime() - this.draggedTask.startDate.getTime();
      
      // Calculate target Y position
      const targetSwimlane = this.getSwimlaneAt(worldY);
      if (!targetSwimlane) return;
      
      // Get the dragged task as a non-null value
      const draggedTask: Task = this.draggedTask;
      
      // Calculate the vertical distance moved from the drag start
      const originalSwimlane = this.swimlanes.find(s => s.tasks.includes(draggedTask));
      if (!originalSwimlane) return;
      
      const originalPos = originalSwimlane.taskPositions.get(draggedTask.id);
      if (!originalPos) return;
      
      // Calculate vertical movement
      const dragStartY = originalPos.y;
      const verticalMovement = worldY - this.dragStartPosition.y - dragStartY;
      
      // Get all tasks to move: selected tasks and dependent tasks
      const tasksToMove = new Set<Task>();
      
      // First add all selected tasks
      if (this.selectedTasks.size > 0) {
        this.selectedTasks.forEach(task => tasksToMove.add(task));
      } else {
        // If no tasks are selected, just add the dragged task
        tasksToMove.add(draggedTask);
      }
      
      // Get tasks that depend on any of the selected tasks (only if showDependencies is enabled)
      if (this.areDependenciesVisible) {
        // Find dependents for each selected/dragged task
        const processedTasks = new Set<string>();
        
        tasksToMove.forEach(task => {
          if (!processedTasks.has(task.id)) {
            processedTasks.add(task.id);
            
            // Get successor tasks (those that depend on this task)
            const successors = this.getSuccessorTasks(task.id, true);
            successors.forEach(successor => {
              if (!tasksToMove.has(successor)) {
                tasksToMove.add(successor);
              }
            });
          }
        });
      }
      
      // Now move all tasks in tasksToMove
      tasksToMove.forEach(task => {
        // Skip the dragged task as we'll handle it separately
        if (task === draggedTask) return;
        
        const currentSwimlane = this.swimlanes.find(s => s.tasks.includes(task));
        if (!currentSwimlane) return;
        
        // Apply the same time shift
        const taskNewStartDate = new Date(task.startDate.getTime() + timeDifference);
        task.startDate = taskNewStartDate;
        
        // Update vertical position - only if it's in the same swimlane as the original task and part of the selection
        if (currentSwimlane.taskPositions.has(task.id) && this.selectedTasks.has(task)) {
          const currentPos = currentSwimlane.taskPositions.get(task.id)!;
          
          // Check if task is in same swimlane as dragged task
          if (currentSwimlane.id === targetSwimlane.id) {
            const newY = Math.max(
              targetSwimlane.y + 40,
              Math.min(
                currentPos.y + verticalMovement,
                targetSwimlane.y + targetSwimlane.height - task.getCurrentHeight() - 20
              )
            );
            
            currentSwimlane.taskPositions.set(task.id, {
              x: currentPos.x,
              y: newY
            });
          }
        }
      });
      
      // Now handle the dragged task
      const currentSwimlane = this.swimlanes.find(s => s.tasks.includes(draggedTask));
      if (!currentSwimlane) return;

      const newY = Math.max(
        targetSwimlane.y + 40,
        Math.min(
          worldY - this.dragStartPosition.y,
          targetSwimlane.y + targetSwimlane.height - draggedTask.getCurrentHeight() - 20
        )
      );

      // Move the dragged task to the target swimlane if it changed
      if (targetSwimlane !== currentSwimlane) {
        currentSwimlane.tasks = currentSwimlane.tasks.filter(t => t !== draggedTask);
        currentSwimlane.taskPositions.delete(draggedTask.id);
        targetSwimlane.tasks.push(draggedTask);
      }

      // Update the dragged task's position
      targetSwimlane.taskPositions.set(draggedTask.id, {
        x: 0,
        y: newY
      });

      // Update the dragged task's start date
      draggedTask.startDate = newStartDate;
      
      // Update task details in real-time while dragging
      this.updateTaskDetails(draggedTask);
      
      // Dispatch a taskUpdated event to trigger autosave
      const taskUpdatedEvent = new CustomEvent('taskUpdated', {
        detail: {
          task: draggedTask,
          tasksUpdated: Array.from(tasksToMove),
          hasDependencies: true
        }
      });
      document.dispatchEvent(taskUpdatedEvent);
      
      return;
    }

    // Update cursor based on edge hover
    if (!this.draggedTask) {
      let overEdge = false;
      for (const swimlane of this.swimlanes) {
        for (const task of swimlane.tasks) {
          const pos = swimlane.taskPositions.get(task.id);
          if (!pos) continue;

          const startX = timeAxis.dateToWorld(task.startDate);
          const endX = timeAxis.dateToWorld(task.getEndDate());
          
          if (worldX >= startX && worldX <= endX && 
              worldY >= pos.y && worldY <= pos.y + task.getCurrentHeight()) {
            if (Math.abs(worldX - startX) <= this.EDGE_SENSITIVITY / camera.zoom ||
                Math.abs(worldX - endX) <= this.EDGE_SENSITIVITY / camera.zoom) {
              canvas.style.cursor = 'ew-resize';
              overEdge = true;
              break;
            } else {
              canvas.style.cursor = 'grab';
              overEdge = true;
              break;
            }
          }
        }
        if (overEdge) break;
      }
      if (!overEdge && !this.isHandMode) {
        canvas.style.cursor = 'default';
      }
    }
  }

  private handleEdgeDragging(worldX: number, selectedTask: Task, timeAxis: any) {
    if (this.isDraggingLeftEdge) {
      const newStartDate = timeAxis.worldToDate(worldX);
      // Calculate the end date based on the current task's end date
      const endDate = selectedTask.getEndDate();
      
      // Check if the new configuration would result in at least a 1-day task
      let wouldBeValid = false;
      const testDate = new Date(newStartDate);
      let businessDays = 0;
      
      while (testDate < endDate && businessDays < 1) {
        // Check if the day is a work day based on task settings
        const isWeekend = Task.isWeekend(testDate, selectedTask.workOnSaturday, selectedTask.workOnSunday);
        if (!isWeekend) {
          businessDays++;
        }
        testDate.setDate(testDate.getDate() + 1);
      }
      
      wouldBeValid = businessDays >= 1;
      
      if (wouldBeValid) {
        this.selectedTasks.forEach(task => {
          task.startDate = newStartDate;
          const taskEndDate = task.getEndDate();
          let days = 0;
          const current = new Date(newStartDate);
          while (current < taskEndDate) {
            // Use task-specific weekend settings
            const isWeekend = Task.isWeekend(current, task.workOnSaturday, task.workOnSunday);
            if (!isWeekend) {
              days++;
            }
            current.setDate(current.getDate() + 1);
          }
          // Ensure minimum of 1 day
          task.duration = Math.max(1, days);
        });
        
        // Update task details in real-time when resizing from left edge
        if (this.selectedTasks.size === 1) {
          this.updateTaskDetails(selectedTask);
        }
      }
    } else if (this.isDraggingRightEdge) {
      const newEndDate = timeAxis.worldToDate(worldX);
      
      // Check if the new configuration would result in at least a 1-day task
      const startDate = selectedTask.startDate;
      let wouldBeValid = false;
      const testDate = new Date(startDate);
      let businessDays = 0;
      
      while (testDate < newEndDate && businessDays < 1) {
        // Check if the day is a work day based on task settings
        const isWeekend = Task.isWeekend(testDate, selectedTask.workOnSaturday, selectedTask.workOnSunday);
        if (!isWeekend) {
          businessDays++;
        }
        testDate.setDate(testDate.getDate() + 1);
      }
      
      wouldBeValid = businessDays >= 1;
      
      if (wouldBeValid) {
        this.selectedTasks.forEach(task => {
          const current = new Date(task.startDate);
          let days = 0;
          while (current < newEndDate) {
            // Use task-specific weekend settings
            const isWeekend = Task.isWeekend(current, task.workOnSaturday, task.workOnSunday);
            if (!isWeekend) {
              days++;
            }
            current.setDate(current.getDate() + 1);
          }
          // Ensure minimum of 1 day
          task.duration = Math.max(1, days);
        });
        
        // Update task details in real-time when resizing from right edge
        if (this.selectedTasks.size === 1) {
          this.updateTaskDetails(selectedTask);
        }
      }
    }
  }

  handleMouseUp() {
    this.isDrawingSelectionBox = false;
    this.selectionBoxStart = null;
    this.selectionBoxEnd = null;
    this.draggedTask = null;
    this.dragStartPosition = null;
    this.isDraggingLeftEdge = false;
    this.isDraggingRightEdge = false;
  }

  handleKeyDown(e: KeyboardEvent) {
    // Add dependency toggle on 'D' key press
    if (e.key === 'd' || e.key === 'D') {
      this.areDependenciesVisible = !this.areDependenciesVisible;
      return;
    }
    
    // No longer needed with HTML sidebar
  }

  isOverSidebar(x: number, y: number): boolean {
    // Fixed width for sidebar check
    const SIDEBAR_WIDTH = 360;
    return x >= window.innerWidth - SIDEBAR_WIDTH;
  }

  private getTaskY(task: Task): number {
    const pos = this.taskPositions.get(task.id) || { x: 0, y: 0 };
    return pos.y;
  }

  // New method to handle task selection
  private selectTask(task: Task, event: MouseEvent) {
    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      // Multi-select mode
      if (this.selectedTasks.has(task)) {
        this.selectedTasks.delete(task);
        this.selectedTasksInOrder = this.selectedTasksInOrder.filter(t => t !== task);
        console.log('Task deselected. Selected tasks:', this.selectedTasks.size);
      } else {
        this.selectedTasks.add(task);
        this.selectedTasksInOrder.push(task);
        console.log('Task added to selection. Selected tasks:', this.selectedTasks.size);
      }
    } else {
      // Single select mode
      this.selectedTasks.clear();
      this.selectedTasksInOrder = [task];
      this.selectedTasks.add(task);
      console.log('Single task selected. Task ID:', task.id);
    }

    // Update task details in sidebar
    this.updateTaskDetails(task);
  }

  private updateTaskDetails(task: Task) {
    const detailsView = document.getElementById('details-view');
    if (!detailsView) return;

    const swimlane = this.swimlanes.find(s => s.tasks.includes(task));
    if (!swimlane) return;

    // Calculate successors - any task that has this task as a dependency
    const successors = this.tasks.filter(t => t.dependencies.includes(task.id));

    // Determine relationship types (default to FS - Finish-to-Start)
    const calculateRelationship = (task: Task, relatedTask: Task, isSuccessor: boolean): string => {
      // For now, we'll assume FS relationships with calculated lag
      const mainTask = isSuccessor ? task : relatedTask;
      const otherTask = isSuccessor ? relatedTask : task;
      
      // Calculate the lag in business days
      const mainTaskEnd = mainTask.getEndDate();
      const otherTaskStart = otherTask.startDate;
      
      // Calculate business days between dates
      let lagDays = 0;
      let currentDate = new Date(mainTaskEnd);
      
      while (currentDate < otherTaskStart) {
        currentDate.setDate(currentDate.getDate() + 1);
        if (!Task.isWeekend(currentDate, mainTask.workOnSaturday, mainTask.workOnSunday)) {
          lagDays++;
        }
      }
      
      return lagDays > 0 ? `FS+${lagDays}` : 'FS';
    };

    // Remove scrollable container properties to fix double scrollbar
    detailsView.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 24px;">
        <div>
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 16px;">
            <div style="width: 12px; height: 12px; border-radius: 3px; background-color: ${task.color}"></div>
            <input 
              type="text" 
              value="${task.name}"
              style="margin: 0; font-size: 18px; font-weight: 600; color: #1a1a1a; border: 1px solid transparent; padding: 4px 8px; border-radius: 4px; width: 100%; background: transparent;"
              onFocus="this.style.border='1px solid #2196F3'; this.style.background='#fff';"
              onBlur="this.style.border='1px solid transparent'; this.style.background='transparent';"
              data-field="name"
            >
          </div>
          <div style="display: flex; align-items: center; gap: 8px; color: #666; font-size: 14px;">
            <div>in</div>
            <div style="font-weight: 600; background-color: ${swimlane.color}20; padding: 2px 8px; border-radius: 4px; color: ${swimlane.color}; border: 1px solid ${swimlane.color}40;">
              ${swimlane.name}
            </div>
          </div>
        </div>

        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 10px; color: #333; font-weight: 600; font-size: 15px;">Trade</label>
          <div style="position: relative;">
            <select id="trade" data-field="trade" style="width: 100%; padding: 10px 16px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; background-color: #f8f9fa; cursor: pointer; appearance: none; padding-right: 36px;">
              <option value="">-- Select Trade --</option>
              ${Trades.getAllTrades().map(trade => `
                <option value="${trade.id}" ${task.tradeId === trade.id ? 'selected' : ''} style="background-color: ${trade.color}20; padding: 6px; color: #333;">
                  ${trade.name}
                </option>
              `).join('')}
            </select>
            <div style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); pointer-events: none;">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M2 4L6 8L10 4" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
          <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
            <div style="color: #666; font-size: 13px; margin-bottom: 8px;">Start Date</div>
            <input 
              type="date" 
              value="${task.startDate.toISOString().split('T')[0]}"
              style="width: 100%; padding: 8px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px;"
              data-field="startDate"
            >
          </div>
          <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
            <div style="color: #666; font-size: 13px; margin-bottom: 8px;">Duration (days)</div>
            <input 
              type="number" 
              value="${task.duration}"
              min="1"
              style="width: 100%; padding: 8px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px;"
              data-field="duration"
            >
          </div>
          <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
            <div style="color: #666; font-size: 13px; margin-bottom: 8px;">Crew Size</div>
            <input 
              type="number" 
              value="${task.crewSize}"
              min="1"
              style="width: 100%; padding: 8px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px;"
              data-field="crewSize"
            >
          </div>
          <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
            <div style="color: #666; font-size: 13px; margin-bottom: 8px;">End Date</div>
            <div class="end-date-display" style="padding: 8px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px; background: white;">
              ${task.getEndDate().toLocaleDateString()}
            </div>
          </div>
        </div>
        
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
          <div style="color: #666; font-size: 13px; margin-bottom: 8px;">Status</div>
          <select 
            style="width: 100%; padding: 8px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px;"
            data-field="status"
          >
            <option value="not-started" ${task.status === 'not-started' ? 'selected' : ''}>Not Started</option>
            <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
            <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
            <option value="blocked" ${task.status === 'blocked' ? 'selected' : ''}>Blocked</option>
          </select>
        </div>

        <!-- Weekend Work Options -->
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
          <div style="color: #666; font-size: 13px; margin-bottom: 12px;">Work Schedule</div>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <input 
                type="checkbox" 
                id="workOnSaturday" 
                ${task.workOnSaturday ? 'checked' : ''}
                style="width: 16px; height: 16px; cursor: pointer;"
                data-field="workOnSaturday"
              >
              <label for="workOnSaturday" style="font-size: 14px; cursor: pointer;">Work on Saturdays</label>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <input 
                type="checkbox" 
                id="workOnSunday" 
                ${task.workOnSunday ? 'checked' : ''}
                style="width: 16px; height: 16px; cursor: pointer;"
                data-field="workOnSunday"
              >
              <label for="workOnSunday" style="font-size: 14px; cursor: pointer;">Work on Sundays</label>
            </div>
          </div>
        </div>

        <!-- Predecessors Section -->
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
          <div style="color: #666; font-size: 13px; margin-bottom: 12px;">Predecessors</div>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <div style="display: flex; gap: 8px; align-items: center;">
              <select 
                id="predecessorSelect"
                style="flex-grow: 1; padding: 8px; border: 1px solid #e0e0e0; border-radius: 4px; font-size: 14px;"
              >
                <option value="">Select a predecessor...</option>
                ${this.tasks
                  .filter(t => t.id !== task.id && !task.dependencies.includes(t.id) && !this.wouldCreateCycle(task.id, t.id))
                  .map(t => `
                    <option value="${t.id}">
                      ${t.name}
                    </option>
                  `).join('')}
              </select>
              <button 
                style="padding: 8px 16px; background: #2196F3; color: white; border: none; border-radius: 4px; font-size: 14px; cursor: pointer;"
                onclick="this.closest('#details-view').dispatchEvent(new CustomEvent('addPredecessor', { detail: { taskId: '${task.id}' } }))"
              >
                Add
              </button>
            </div>
            ${task.dependencies.map(depId => {
              const depTask = this.getTask(depId);
              return depTask ? `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: white; border-radius: 4px; border: 1px solid #e0e0e0;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="width: 8px; height: 8px; border-radius: 2px; background-color: ${depTask.color}"></div>
                    <span style="font-size: 14px;">${depTask.name}</span>
                    <span style="font-size: 12px; background: #f0f0f0; padding: 2px 5px; border-radius: 3px; color: #666;">
                      ${calculateRelationship(task, depTask, false)}
                    </span>
                  </div>
                  <button 
                    style="padding: 4px 8px; background: none; border: none; color: #666; cursor: pointer;"
                    onclick="this.closest('#details-view').dispatchEvent(new CustomEvent('removePredecessor', { detail: { taskId: '${task.id}', predecessorId: '${depId}' } }))"
                  >
                    ×
                  </button>
                </div>
              ` : '';
            }).join('')}
          </div>
        </div>

        <!-- Successors Section -->
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
          <div style="color: #666; font-size: 13px; margin-bottom: 12px;">Successors</div>
          <div style="display: flex; flex-direction: column; gap: 12px;">
            ${successors.length === 0 ? `
              <div style="padding: 8px; background: white; border-radius: 4px; border: 1px solid #e0e0e0; color: #666; font-size: 14px; font-style: italic;">
                No successors
              </div>
            ` : successors.map(succ => `
              <div style="display: flex; align-items: center; justify-content: space-between; padding: 8px; background: white; border-radius: 4px; border: 1px solid #e0e0e0;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <div style="width: 8px; height: 8px; border-radius: 2px; background-color: ${succ.color}"></div>
                  <span style="font-size: 14px;">${succ.name}</span>
                  <span style="font-size: 12px; background: #f0f0f0; padding: 2px 5px; border-radius: 3px; color: #666;">
                    ${calculateRelationship(task, succ, true)}
                  </span>
                </div>
                <button 
                  style="padding: 4px 8px; background: none; border: none; color: #666; cursor: pointer;"
                  onclick="this.closest('#details-view').dispatchEvent(new CustomEvent('removeSuccessor', { detail: { taskId: '${task.id}', successorId: '${succ.id}' } }))"
                >
                  ×
                </button>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;

    // Add event listeners to handle updates to task details
    detailsView.querySelectorAll('input, select').forEach(element => {
      element.addEventListener('change', (e: any) => {
        const fieldName = e.target.dataset.field;
        if (!fieldName) return;
        
        let value: any = e.target.value;
        
        // Convert types based on field
        if (fieldName === 'duration' || fieldName === 'crewSize' || fieldName === 'progress') {
          value = Number(value);
        } else if (fieldName === 'workOnSaturday' || fieldName === 'workOnSunday') {
          value = e.target.checked;
          
          // When weekend work settings change, recalculate task end date
          this.updateTaskField(task.id, fieldName, value);
          
          return; // Skip the general update below since we handled it specifically
        } else if (fieldName === 'startDate') {
          value = new Date(value);
          task.startDate = value;
          
          // Ensure start date doesn't fall on a weekend (unless weekend work is enabled)
          task.adjustStartDate();
          
          // Update the input with potentially adjusted date
          e.target.value = task.startDate.toISOString().split('T')[0];
          
          // Update UI to reflect end date change
          const endDateElement = detailsView.querySelector('.end-date-display');
          if (endDateElement) {
            const endDate = task.getEndDate();
            endDateElement.textContent = endDate.toLocaleDateString();
          }
        } else if (fieldName === 'trade') {
          // Handle trade selection specially to update both tradeId and color
          const tradeId = value;
          const trade = Trades.getTradeById(tradeId);
          
          if (trade) {
            // Update both the tradeId and color
            task.tradeId = tradeId;
            task.color = trade.color;
            
            // Refresh the task details view to show updated color
            this.updateTaskDetails(task);
            
            // Force a refresh to update the UI
            document.dispatchEvent(new Event('taskUpdated'));
            return; // Skip the general update below since we handled it specifically
          }
        }
        
        // Update task property
        if (task.hasOwnProperty(fieldName)) {
          (task as any)[fieldName] = value;
        }
      });
    });
    
    // Add specific event listeners for checkbox changes
    detailsView.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e: any) => {
        const fieldName = e.target.dataset.field;
        if (!fieldName) return;
        
        // Update task property
        const isChecked = e.target.checked;
        if (fieldName === 'workOnSaturday') {
          task.workOnSaturday = isChecked;
        } else if (fieldName === 'workOnSunday') {
          task.workOnSunday = isChecked;
        } else if (task.hasOwnProperty(fieldName)) {
          (task as any)[fieldName] = isChecked;
        }
        
        if (fieldName === 'workOnSaturday' || fieldName === 'workOnSunday') {
          // Update end date display when weekend settings change
          const endDateElement = detailsView.querySelector('.end-date-display');
          if (endDateElement) {
            const endDate = task.getEndDate();
            endDateElement.textContent = endDate.toLocaleDateString();
          }
        }
      });
    });
    
    // Add event listener for add and remove predecessor buttons
    detailsView.addEventListener('addPredecessor', (e: any) => {
      const taskId = e.detail.taskId;
      const predecessorId = (document.getElementById('predecessorSelect') as HTMLSelectElement)?.value;
      
      const task = this.getTask(taskId);
      const predecessor = this.getTask(predecessorId);
      
      if (!task || !predecessor) return;
      if (task.dependencies.includes(predecessorId)) return;
      
      // Check for dependency cycles
      if (this.wouldCreateCycle(taskId, predecessorId)) {
        console.error(`Adding dependency would create a cycle: ${predecessorId} -> ${taskId}`);
        // TODO: Show a user-friendly error message
        return;
      }
      
      // Add dependency
      task.dependencies.push(predecessorId);
      
      // Dispatch taskUpdated event for autosave
      const taskUpdatedEvent = new CustomEvent('taskUpdated', {
        detail: {
          task: task,
          hasDependencies: true
        }
      });
      document.dispatchEvent(taskUpdatedEvent);
      
      this.updateTaskDetails(task); // Refresh details view
    });
    
    detailsView.addEventListener('removePredecessor', (e: any) => {
      const taskId = e.detail.taskId;
      const predecessorId = e.detail.predecessorId;
      
      const task = this.getTask(taskId);
      if (!task) return;
      
      // Remove dependency
      task.dependencies = task.dependencies.filter(id => id !== predecessorId);
      
      // Dispatch taskUpdated event for autosave
      const taskUpdatedEvent = new CustomEvent('taskUpdated', {
        detail: {
          task: task,
          hasDependencies: true
        }
      });
      document.dispatchEvent(taskUpdatedEvent);
      
      this.updateTaskDetails(task); // Refresh details view
    });
    
    detailsView.addEventListener('removeSuccessor', (e: any) => {
      const taskId = e.detail.taskId;
      const successorId = e.detail.successorId;
      
      const successor = this.getTask(successorId);
      if (!successor) return;
      
      // Remove the dependency from the successor task
      successor.dependencies = successor.dependencies.filter(id => id !== taskId);
      
      // Dispatch taskUpdated event for autosave
      const taskUpdatedEvent = new CustomEvent('taskUpdated', {
        detail: {
          task: successor,
          hasDependencies: true
        }
      });
      document.dispatchEvent(taskUpdatedEvent);
      
      this.updateTaskDetails(task); // Refresh details view
    });
  }

  // Helper method to check if adding a dependency would create a cycle
  private wouldCreateCycle(taskId: string, newDependencyId: string, visited = new Set<string>()): boolean {
    if (visited.has(taskId)) return true;
    if (taskId === newDependencyId) return true;
    
    visited.add(taskId);
    const task = this.getTask(taskId);
    if (!task) return false;

    for (const depId of task.dependencies) {
      if (this.wouldCreateCycle(depId, newDependencyId, visited)) {
        return true;
      }
    }
    
    visited.delete(taskId);
    return false;
  }

  // New method to copy selected tasks
  private copySelectedTasks() {
    this.copiedTasks = Array.from(this.selectedTasks).map(task => ({
      id: task.id,
      name: task.name,
      startDate: new Date(task.startDate),
      duration: task.duration,
      crewSize: task.crewSize,
      color: task.color,
      dependencies: [...task.dependencies],
      tradeId: task.tradeId,
      status: task.status
    }));
  }

  // New method to paste selected tasks
  private pasteSelectedTasks(timeAxis: any) {
    if (this.copiedTasks.length === 0) return;

    // Clear current selection
    this.selectedTasks.clear();

    // Find target swimlane based on cursor position
    const targetSwimlane = this.getSwimlaneAt(this.lastCursorWorldY) || this.swimlanes[0];
    if (!targetSwimlane) return;

    // Calculate time difference between cursor and first task
    const firstTaskStartX = timeAxis.dateToWorld(this.copiedTasks[0].startDate);
    const timeOffset = timeAxis.worldToDate(this.lastCursorWorldX).getTime() - timeAxis.worldToDate(firstTaskStartX).getTime();

    // Calculate vertical spacing
    const taskSpacing = 10;
    let currentY = Math.max(
      targetSwimlane.y + 40,  // Start after swimlane header
      this.lastCursorWorldY   // Or at cursor position
    );

    // Add tasks at cursor position
    this.copiedTasks.forEach(config => {
      const newConfig = { ...config };
      // Generate new ID using browser's crypto API
      newConfig.id = self.crypto && self.crypto.randomUUID ? 
                    self.crypto.randomUUID() : 
                    'task-' + Math.random().toString(36).substring(2, 15);
      
      // Adjust start date based on cursor position
      const newStartDate = new Date(config.startDate.getTime() + timeOffset);
      newConfig.startDate = newStartDate;
      
      const task = this.addTask(newConfig, targetSwimlane.id);
      
      // Set position in both maps
      const position = {
        x: 0,
        y: currentY
      };
      
      this.taskPositions.set(task.id, position);
      targetSwimlane.taskPositions.set(task.id, { ...position });
      
      // Update currentY for next task
      currentY += task.getCurrentHeight() + taskSpacing;
      
      this.selectedTasks.add(task);
    });
  }

  // Add new method for deleting selected tasks
  deleteSelectedTasks() {
    if (this.selectedTasks.size === 0) return;

    // Remove tasks from swimlanes and clear positions
    this.selectedTasks.forEach(task => {
      const swimlane = this.swimlanes.find(s => s.tasks.includes(task));
      if (swimlane) {
        swimlane.tasks = swimlane.tasks.filter(t => t !== task);
        swimlane.taskPositions.delete(task.id);
      }
      this.tasks = this.tasks.filter(t => t !== task);
      this.taskPositions.delete(task.id);
    });

    // Clear selection and hide sidebar
    this.selectedTasks.clear();
    this.selectedTasksInOrder = [];
  }

  // Add missing methods that Canvas.ts is trying to use
  
  setTradeFilters(filters: Map<string, boolean>) {
    this.tradeFilters = new Map(filters);
    console.log("Trade filters applied to TaskManager:", 
      Array.from(this.tradeFilters.entries())
        .map(([color, visible]) => `${color}: ${visible}`)
        .join(', ')
    );
  }
  
  getAllTasks(): Task[] {
    return this.tasks;
  }
  
  getAllTasksUnfiltered(): Task[] {
    return this.tasks;
  }
  
  getTasksAtPoint(worldX: number, worldY: number): Task[] {
    const result: Task[] = [];
    
    for (const swimlane of this.swimlanes) {
      for (const task of swimlane.tasks) {
        // Skip tasks that are filtered out by trade
        if (task.tradeId && task.color) {
          const isTradeVisible = this.tradeFilters.has(task.color) ? 
            this.tradeFilters.get(task.color) : true;
          
          if (!isTradeVisible) {
            continue; // Skip this task as it's filtered out
          }
        }
        
        const pos = swimlane.taskPositions.get(task.id);
        if (!pos) continue;
        
        const startX = this.timeAxis.dateToWorld(task.startDate);
        const endX = this.timeAxis.dateToWorld(task.getEndDate());
        
        if (worldX >= startX && worldX <= endX && 
            worldY >= pos.y && worldY <= pos.y + task.getCurrentHeight()) {
          result.push(task);
        }
      }
    }
    
    return result;
  }
  
  getTotalHeight(): number {
    if (this.swimlanes.length === 0) return 0;
    
    const lastSwimlane = this.swimlanes[this.swimlanes.length - 1];
    return lastSwimlane.y + lastSwimlane.height;
  }
  
  drawTasks(ctx: CanvasRenderingContext2D, timeAxis: any, camera: Camera) {
    // Run integrity check with limited frequency
    this.checkTaskPositionIntegrity();
    
    // Safety check - if no tasks, nothing to draw
    if (!this.tasks || this.tasks.length === 0) {
      return;
    }
    
    // Ensure trade filters are valid before drawing
    if (!this.tradeFilters || !(this.tradeFilters instanceof Map)) {
      console.warn('[TaskManager] Invalid trade filters detected during draw, resetting...');
      this.validateTradeFilters();
    }
    
    // Calculate visible area based on camera
    const visibleLeft = camera.x - (ctx.canvas.width / (2 * camera.zoom));
    const visibleRight = camera.x + (ctx.canvas.width / (2 * camera.zoom));
    const visibleTop = camera.y - (ctx.canvas.height / (2 * camera.zoom));
    const visibleBottom = camera.y + (ctx.canvas.height / (2 * camera.zoom));
    
    // Draw swimlanes
    this.swimlanes.forEach(lane => {
      // Skip rendering swimlanes that are completely outside the visible area
      if (lane.y > visibleBottom || lane.y + lane.height < visibleTop) {
        return;
      }
      
      // Safety check - ensure swimlane has tasks array
      if (!lane.tasks) {
        console.warn(`[TaskManager] Swimlane ${lane.name} has no tasks array`);
        lane.tasks = [];
        return;
      }
      
      // Draw tasks in this swimlane, respecting trade filters
      lane.tasks.forEach(task => {
        try {
          // Safety check - ensure task has basic required properties
          if (!task || !task.id) {
            console.warn('[TaskManager] Invalid task in swimlane:', task);
            return;
          }
          
          // Skip tasks that have been filtered out by trade
          // If no filter exists for this trade color, default to showing it
          if (task.tradeId && task.color) {
            const isTradeVisible = this.tradeFilters.has(task.color) ? 
              this.tradeFilters.get(task.color) : true;
            
            if (!isTradeVisible) {
              return; // Skip drawing this task
            }
          }
          
          // Get task position - ensure it exists and is valid
          const pos = lane.taskPositions.get(task.id);
          if (!pos) {
            console.warn(`[TaskManager] No position found for task ${task.id} (${task.name})`);
            // Generate a position
            const yPosition = lane.y + 50 + (lane.tasks.indexOf(task) * 40);
            lane.taskPositions.set(task.id, { x: 0, y: yPosition });
          }
          
          const position = lane.taskPositions.get(task.id) || { x: 0, y: lane.y + 40 };
          
          // Skip rendering tasks that are completely outside the visible area
          const startX = timeAxis.dateToWorld(task.startDate);
          const endX = timeAxis.dateToWorld(task.getEndDate());
          
          if (endX < visibleLeft || startX > visibleRight || 
              position.y + task.getCurrentHeight() < visibleTop || position.y > visibleBottom) {
            return;
          }
          
          // Draw the task
          task.draw(ctx, timeAxis, position.y);
        } catch (error) {
          console.error(`[TaskManager] Error drawing task ${task?.id || 'unknown'}:`, error);
        }
      });
    });

    // Draw dependency arrows if enabled
    if (this.areDependenciesVisible) {
      this.drawDependencies(ctx, timeAxis, camera);
    }

    // Draw selection highlight for selected tasks
    ctx.save();
    Logger.log('Drawing selection highlights for', this.selectedTasks.size, 'tasks');
    this.selectedTasks.forEach(task => {
      try {
        // Skip highlighting filtered tasks
        if (task.tradeId && task.color) {
          const isTradeVisible = this.tradeFilters.has(task.color) ? 
            this.tradeFilters.get(task.color) : true;
          
          if (!isTradeVisible) {
            return; // Skip highlighting this task
          }
        }
        
        const swimlane = this.swimlanes.find(s => s.tasks.includes(task));
        if (swimlane) {
          const pos = swimlane.taskPositions.get(task.id);
          if (pos) {
            // Calculate task bounds
            const startX = timeAxis.dateToWorld(task.startDate);
            const endX = timeAxis.dateToWorld(task.getEndDate());
            const width = endX - startX;
            const height = task.getCurrentHeight();
            
            // Skip rendering highlight if task is completely outside the visible area
            if (endX < visibleLeft || startX > visibleRight || 
                pos.y + height < visibleTop || pos.y > visibleBottom) {
              return;
            }
            
            Logger.log('Drawing highlight for task:', task.id, 'at position:', pos);

            // Modern subtle outline for selected tasks
            const radius = 10; // Match the task card's radius for a consistent look
            
            // Draw a more noticeable glow effect
            ctx.shadowColor = 'rgba(33, 150, 243, 0.7)'; // Increased opacity for more visible glow
            ctx.shadowBlur = 10 / camera.zoom; // Increased blur for more visible effect
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Draw a more noticeable outline
            ctx.strokeStyle = '#1976D2'; // Darker blue for better contrast
            ctx.lineWidth = 2.5 / camera.zoom; // Slightly thicker line
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.setLineDash([]); // Solid line
            
            // Draw the outline with rounded corners
            ctx.beginPath();
            if (ctx.roundRect) {
              ctx.roundRect(startX - 3 / camera.zoom, pos.y - 3 / camera.zoom, 
                width + 6 / camera.zoom, height + 6 / camera.zoom, radius);
            } else {
              // Fallback for browsers that don't support roundRect
              const x = startX - 3 / camera.zoom;
              const y = pos.y - 3 / camera.zoom;
              const w = width + 6 / camera.zoom;
              const h = height + 6 / camera.zoom;
              const r = radius;
              
              ctx.beginPath();
              ctx.moveTo(x + r, y);
              ctx.lineTo(x + w - r, y);
              ctx.quadraticCurveTo(x + w, y, x + w, y + r);
              ctx.lineTo(x + w, y + h - r);
              ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
              ctx.lineTo(x + r, y + h);
              ctx.quadraticCurveTo(x, y + h, x, y + h - r);
              ctx.lineTo(x, y + r);
              ctx.quadraticCurveTo(x, y, x + r, y);
              ctx.closePath();
            }
            ctx.stroke();
          }
        }
      } catch (error) {
        console.error('Error drawing selection highlight:', error);
      }
    });
    ctx.restore();
    
    // Remove shadow effect for other drawings
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    
    // Draw selection box if active
    if (this.isDrawingSelectionBox && this.selectionBoxStart && this.selectionBoxEnd) {
      ctx.save();
      ctx.strokeStyle = '#2196F3';
      ctx.lineWidth = 2 / camera.zoom;
      ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
      ctx.fillStyle = 'rgba(33, 150, 243, 0.1)';
      
      const x = Math.min(this.selectionBoxStart.x, this.selectionBoxEnd.x);
      const y = Math.min(this.selectionBoxStart.y, this.selectionBoxEnd.y);
      const width = Math.abs(this.selectionBoxEnd.x - this.selectionBoxStart.x);
      const height = Math.abs(this.selectionBoxEnd.y - this.selectionBoxStart.y);
      
      ctx.fillRect(x, y, width, height);
      ctx.strokeRect(x, y, width, height);
      ctx.restore();
    }
  }

  linkSelectedTasksInSequence() {
    if (this.selectedTasksInOrder.length < 2) return;
    
    // Create dependencies in the order they were selected
    for (let i = 0; i < this.selectedTasksInOrder.length - 1; i++) {
      const successor = this.selectedTasksInOrder[i + 1];
      const predecessor = this.selectedTasksInOrder[i];
      
      if (!successor.dependencies.includes(predecessor.id)) {
        successor.dependencies.push(predecessor.id);
      }
    }
    
    // Update task details after creating dependencies if a single task is selected
    if (this.selectedTasks.size === 1) {
      const selectedTask = Array.from(this.selectedTasks)[0];
      this.updateTaskDetails(selectedTask);
    }
    
    // Dispatch taskUpdated event for autosave
    const taskUpdatedEvent = new CustomEvent('taskUpdated', {
      detail: {
        tasks: this.selectedTasksInOrder,
        hasDependencies: true
      }
    });
    document.dispatchEvent(taskUpdatedEvent);
  }

  moveTasksTo(targetDate: Date) {
    if (this.selectedTasks.size === 0) return;
    
    // Convert the Set to an Array for easier handling
    const selectedTasksArray = Array.from(this.selectedTasks);
    
    // Ensure the target date isn't a weekend for the first task
    // unless that task is configured to work on weekends
    const firstTask = selectedTasksArray[0];
    let adjustedDate = new Date(targetDate);
    
    // Check if target date is a weekend and adjust if needed based on task settings
    while (Task.isWeekend(adjustedDate, firstTask.workOnSaturday, firstTask.workOnSunday)) {
      adjustedDate.setDate(adjustedDate.getDate() + 1);
    }
    
    // Calculate the offset from the first selected task
    const offset = adjustedDate.getTime() - firstTask.startDate.getTime();
    
    // Apply the same offset to all selected tasks
    this.selectedTasks.forEach(task => {
      const newStartDate = new Date(task.startDate.getTime() + offset);
      
      // Adjust start date if it falls on a weekend based on task settings
      while (Task.isWeekend(newStartDate, task.workOnSaturday, task.workOnSunday)) {
        newStartDate.setDate(newStartDate.getDate() + 1);
      }
      
      task.startDate = newStartDate;
    });
    
    // Update task details if a single task is selected
    if (this.selectedTasks.size === 1) {
      this.updateTaskDetails(selectedTasksArray[0]);
    }
  }

  // Add new method to draw dependencies between tasks
  private drawDependencies(ctx: CanvasRenderingContext2D, timeAxis: any, camera: Camera) {
    // Save context state
    ctx.save();
    
    // Set arrow style
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.6)';
    ctx.lineWidth = 1.5 / camera.zoom;
    
    // Loop through all tasks
    this.tasks.forEach(task => {
      // Find this task's position
      const swimlane = this.swimlanes.find(s => s.tasks.includes(task));
      if (!swimlane) return;
      
      const taskPos = swimlane.taskPositions.get(task.id);
      if (!taskPos) return;
      
      // For each task that has dependencies, draw arrows FROM each dependency TO this task
      // (predecessor → successor)
      task.dependencies.forEach(depId => {
        const depTask = this.getTask(depId);
        if (!depTask) return;
        
        // Find the dependency's position
        const depSwimlane = this.swimlanes.find(s => s.tasks.includes(depTask));
        if (!depSwimlane) return;
        
        const depPos = depSwimlane.taskPositions.get(depTask.id);
        if (!depPos) return;
        
        // Calculate position coordinates
        const taskStartX = timeAxis.dateToWorld(task.startDate); // Successor task start
        const taskY = taskPos.y + task.getCurrentHeight() / 2;   // Successor task Y center
        
        const depEndX = timeAxis.dateToWorld(depTask.getEndDate()); // Predecessor task end
        const depY = depPos.y + depTask.getCurrentHeight() / 2;     // Predecessor task Y center
        
        // Draw the arrow line FROM predecessor TO successor
        // (opposite of previous implementation)
        ctx.beginPath();
        ctx.moveTo(depEndX, depY); // Start from predecessor end
        
        // If tasks are in different swimlanes, draw a curved arrow
        if (depSwimlane !== swimlane) {
          const controlPointX = (taskStartX + depEndX) / 2;
          ctx.bezierCurveTo(
            controlPointX, depY,
            controlPointX, taskY,
            taskStartX, taskY
          );
        } else {
          // Simple line for same swimlane
          ctx.lineTo(taskStartX, taskY);
        }
        ctx.stroke();
        
        // Draw arrowhead at the successor task (reversed from previous)
        const arrowSize = 6 / camera.zoom;
        const angle = Math.atan2(taskY - depY, taskStartX - depEndX);
        
        ctx.beginPath();
        ctx.moveTo(taskStartX, taskY);
        ctx.lineTo(
          taskStartX - arrowSize * Math.cos(angle - Math.PI/6),
          taskY - arrowSize * Math.sin(angle - Math.PI/6)
        );
        ctx.lineTo(
          taskStartX - arrowSize * Math.cos(angle + Math.PI/6),
          taskY - arrowSize * Math.sin(angle + Math.PI/6)
        );
        ctx.closePath();
        ctx.fillStyle = 'rgba(100, 100, 100, 0.6)';
        ctx.fill();
      });
    });
    
    // Restore context state
    ctx.restore();
  }

  // Add method to get filtered tasks (for task selection and other operations)
  getFilteredTasks(): Task[] {
    if (!this.tradeFilters || this.tradeFilters.size === 0) {
      return this.tasks;
    }
    
    return this.tasks.filter(task => {
      if (!task.tradeId || !task.color) return true;
      
      const isTradeVisible = this.tradeFilters.has(task.color) ? 
        this.tradeFilters.get(task.color) : true;
      
      return isTradeVisible;
    });
  }

  private calculateTaskDuration(startDate: Date, endDate: Date, task: Task): number {
    // Calculate business days between start and end dates, respecting weekend settings
    let days = 0;
    const current = new Date(startDate);
    
    while (current < endDate) {
      // Use task-specific weekend settings
      if (!Task.isWeekend(current, task.workOnSaturday, task.workOnSunday)) {
        days++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    // Ensure minimum of 1 day
    return Math.max(1, days);
  }

  // Add this helper method to get the actual calendar duration including weekends
  private getCalendarDays(task: Task): number {
    const startDate = new Date(task.startDate);
    const endDate = task.getEndDate();
    
    // Calculate calendar days difference
    const timeDiff = endDate.getTime() - startDate.getTime();
    return Math.ceil(timeDiff / (1000 * 3600 * 24));
  }

  // Method to reset task positions in a specific swimlane for better layout
  resetTaskPositionsInSwimlane(swimlaneId: string): void {
    const swimlane = this.swimlanes.find(s => s.id === swimlaneId);
    if (!swimlane) {
      console.warn(`Swimlane with ID ${swimlaneId} not found for position reset`);
      return;
    }
    
    // Sort tasks by start date for proper sequential layout
    const sortedTasks = [...swimlane.tasks].sort((a, b) => 
      a.startDate.getTime() - b.startDate.getTime()
    );
    
    const topPadding = 40;
    const taskSpacing = 15;
    const rowHeight = 60;
    
    // Recalculate all positions
    sortedTasks.forEach((task, index) => {
      const yPosition = swimlane.y + topPadding + (index * (rowHeight + taskSpacing));
      // Ensure position is within swimlane bounds
      const safeY = Math.min(
        yPosition, 
        swimlane.y + swimlane.height - task.getCurrentHeight() - 30
      );
      swimlane.taskPositions.set(task.id, { 
        ...swimlane.taskPositions.get(task.id) || { x: 0 }, 
        y: safeY 
      });
    });
  }

  updateTaskField(taskId: string, fieldName: string, value: any): void {
    const task = this.getTask(taskId);
    if (!task) return;
    
    // When weekend work settings change, recalculate task end date
    if (task.hasOwnProperty(fieldName)) {
      // Use type-safe approach
      (task as any)[fieldName] = value;
      
      // If tradeId is changed, also update the color to match the new trade
      if (fieldName === 'tradeId') {
        const trade = Trades.getTradeById(value);
        if (trade) {
          task.color = trade.color;
          // Trigger UI update
          document.dispatchEvent(new Event('taskUpdated'));
        }
      }
      
      // Update UI to reflect end date change
      const detailsView = document.getElementById('details-view');
      if (detailsView) {
        const endDateElement = detailsView.querySelector('.end-date-display');
        if (endDateElement) {
          // Force recalculation of end date
          const endDate = task.getEndDate();
          endDateElement.textContent = endDate.toLocaleDateString();
        }
      }
    }
  }

  /**
   * Export the current state as a serializable object
   * @returns The serialized state
   */
  exportState(): any {
    // Create a serializable copy of swimlanes
    const serializedSwimlanes = this.swimlanes.map(swimlane => {
      // Convert task positions map to a serializable object
      const taskPositions: Record<string, { x: number; y: number }> = {};
      swimlane.taskPositions.forEach((position, taskId) => {
        taskPositions[taskId] = position;
      });
      
      return {
        id: swimlane.id,
        name: swimlane.name,
        y: swimlane.y,
        height: swimlane.height,
        color: swimlane.color,
        tasks: swimlane.tasks.map(task => task.id),
        taskPositions,
        wbsId: swimlane.wbsId
      };
    });
    
    // Convert global task positions map to a serializable object
    const serializedTaskPositions: Record<string, { x: number; y: number }> = {};
    this.taskPositions.forEach((position, taskId) => {
      serializedTaskPositions[taskId] = position;
    });
    
    // Return the complete state
    return {
      tasks: this.tasks.map(task => ({
        id: task.id,
        name: task.name,
        startDate: task.startDate,
        duration: task.duration,
        crewSize: task.crewSize,
        color: task.color,
        tradeId: task.tradeId,
        dependencies: task.dependencies,
        progress: task.progress,
        status: task.status,
        workOnSaturday: task.workOnSaturday,
        workOnSunday: task.workOnSunday,
        swimlaneId: task.swimlaneId // Ensure swimlaneId is included
      })),
      swimlanes: serializedSwimlanes,
      taskPositions: serializedTaskPositions,
      tradeFilters: Array.from(this.tradeFilters.entries())
    };
  }

  /**
   * Import a previously exported state
   * @param state The state object to import
   */
  importState(state: any): void {
    // Clear current state
    this.tasks = [];
    this.selectedTasks.clear();
    this.selectedTasksInOrder = [];
    this.taskPositions.clear();
    this.swimlanes.length = 0; // Clear swimlanes array
    
    // Restore tasks
    if (state.tasks && Array.isArray(state.tasks)) {
      state.tasks.forEach((taskData: any) => {
        const task = new Task({
          id: taskData.id,
          name: taskData.name,
          startDate: new Date(taskData.startDate), // Ensure date is properly instantiated
          duration: taskData.duration,
          crewSize: taskData.crewSize,
          color: taskData.color,
          tradeId: taskData.tradeId,
          dependencies: taskData.dependencies || [],
          progress: taskData.progress,
          status: taskData.status,
          workOnSaturday: taskData.workOnSaturday,
          workOnSunday: taskData.workOnSunday,
          swimlaneId: taskData.swimlaneId || null // Ensure swimlaneId is preserved
        });
        this.tasks.push(task);
      });
    }
    
    // Restore swimlanes
    if (state.swimlanes && Array.isArray(state.swimlanes)) {
      state.swimlanes.forEach((swimlaneData: any) => {
        const taskPositionsMap = new Map<string, { x: number; y: number }>();
        
        // Convert object back to Map for task positions
        if (swimlaneData.taskPositions) {
          Object.entries(swimlaneData.taskPositions).forEach(([taskId, pos]: [string, any]) => {
            taskPositionsMap.set(taskId, pos);
          });
        }
        
        // Find tasks that belong to this swimlane
        const swimlaneTasks = this.tasks.filter(task => 
          (swimlaneData.tasks && swimlaneData.tasks.includes(task.id)) || 
          task.swimlaneId === swimlaneData.id
        );
        
        // Ensure these tasks have the correct swimlaneId
        swimlaneTasks.forEach(task => {
          if (task.swimlaneId !== swimlaneData.id) {
            console.log(`[TaskManager] Setting swimlaneId for task ${task.id} (${task.name}) to ${swimlaneData.id}`);
            task.swimlaneId = swimlaneData.id;
          }
        });
        
        this.swimlanes.push({
          id: swimlaneData.id,
          name: swimlaneData.name,
          y: swimlaneData.y,
          height: swimlaneData.height,
          color: swimlaneData.color,
          tasks: swimlaneTasks,
          taskPositions: taskPositionsMap,
          wbsId: swimlaneData.wbsId
        });
      });
    }
    
    // Restore global task positions
    if (state.taskPositions) {
      Object.entries(state.taskPositions).forEach(([taskId, pos]: [string, any]) => {
        this.taskPositions.set(taskId, pos);
      });
    }
    
    // Restore trade filters
    if (state.tradeFilters && Array.isArray(state.tradeFilters)) {
      this.tradeFilters = new Map(state.tradeFilters);
    }
    
    // Validate the imported state to fix any issues
    this.validateTradeFilters();
    this.validateTaskPositions();
    this.renameSwimlanesIfNeeded();
    
    // Force a full integrity check once after import
    this.forceIntegrityCheck();
    
    // Log success
    console.log(`[TaskManager] Successfully imported ${this.tasks.length} tasks and ${this.swimlanes.length} swimlanes`);
  }

  /**
   * Ensure all swimlane IDs are consistent and unique
   * Called after loading from storage to fix any potential issues
   */
  renameSwimlanesIfNeeded(): void {
    // Check for duplicate swimlane IDs and fix them
    const usedIds = new Set<string>();
    
    this.swimlanes.forEach((swimlane, index) => {
      if (!swimlane.id || usedIds.has(swimlane.id)) {
        // Generate a new unique ID
        const newId = `swimlane-${index}-${Date.now().toString(36)}`;
        console.log(`Renaming swimlane from ${swimlane.id} to ${newId} to ensure uniqueness`);
        swimlane.id = newId;
      }
      usedIds.add(swimlane.id);
    });
  }

  /**
   * Ensure all trade filters are properly initialized
   * Called after loading from storage to fix any potential issues with trade visibility
   */
  validateTradeFilters(): void {
    // Make sure tradeFilters is a valid Map
    if (!this.tradeFilters || !(this.tradeFilters instanceof Map)) {
      console.log('[TaskManager] Initializing tradeFilters as new Map');
      this.tradeFilters = new Map();
    }
    
    // Ensure all trades are set to visible by default
    Trades.getAllTrades().forEach(trade => {
      if (!this.tradeFilters.has(trade.id)) {
        this.tradeFilters.set(trade.id, true);
      }
      // Also set by color for backward compatibility
      if (trade.color && !this.tradeFilters.has(trade.color)) {
        this.tradeFilters.set(trade.color, true);
      }
    });
    
    // Make sure all task colors are also visible
    this.tasks.forEach(task => {
      if (task.color && !this.tradeFilters.has(task.color)) {
        this.tradeFilters.set(task.color, true);
      }
      if (task.tradeId && !this.tradeFilters.has(task.tradeId)) {
        this.tradeFilters.set(task.tradeId, true);
      }
    });
    
    console.log(`[TaskManager] Validated trade filters: ${this.tradeFilters.size} entries`);
  }

  /**
   * Validate task positions and swimlane assignments
   * Ensures every task has a valid position and is assigned to a swimlane
   */
  validateTaskPositions(): void {
    // Skip if no tasks or swimlanes
    if (this.tasks.length === 0 || this.swimlanes.length === 0) {
      return;
    }
    
    console.log(`[TaskManager] Validating positions for ${this.tasks.length} tasks`);
    let fixCount = 0;
    
    // First make sure all tasks are in a swimlane
    this.tasks.forEach(task => {
      // Find if this task exists in any swimlane
      const existsInSwimlane = this.swimlanes.some(lane => 
        lane.tasks.some(t => t.id === task.id)
      );
      
      if (!existsInSwimlane) {
        // Add to the first swimlane
        const swimlane = this.swimlanes[0];
        console.log(`[TaskManager] Task ${task.id} (${task.name}) was not in any swimlane. Adding to ${swimlane.name}`);
        
        // Add task to swimlane
        swimlane.tasks.push(task);
        
        // Update the swimlaneId on the task itself
        task.swimlaneId = swimlane.id;
        
        // Calculate y-position to avoid overlap with existing tasks
        const yPosition = swimlane.y + 50 + (swimlane.tasks.length * 40);
        
        // Set position in taskPositions map
        swimlane.taskPositions.set(task.id, { x: 0, y: yPosition });
        
        fixCount++;
      }
    });
    
    // Next fix any invalid positions within swimlanes
    this.swimlanes.forEach(swimlane => {
      // Get all tasks that should be in this swimlane based on their swimlaneId property
      const allTasksForSwimlane = this.tasks.filter(task => task.swimlaneId === swimlane.id);
      
      // Make sure every task with this swimlaneId is actually in the swimlane's tasks array
      allTasksForSwimlane.forEach(task => {
        if (!swimlane.tasks.some(t => t.id === task.id)) {
          console.log(`[TaskManager] Task ${task.id} (${task.name}) has swimlaneId ${swimlane.id} but is not in the swimlane's tasks array. Adding it.`);
          swimlane.tasks.push(task);
          fixCount++;
        }
      });
      
      // Now fix positions for all tasks in this swimlane
      swimlane.tasks.forEach(task => {
        // Ensure task's swimlaneId matches current swimlane
        if (task.swimlaneId !== swimlane.id) {
          console.log(`[TaskManager] Task ${task.id} (${task.name}) was in swimlane ${swimlane.id} but had swimlaneId ${task.swimlaneId}. Fixing.`);
          task.swimlaneId = swimlane.id;
          fixCount++;
        }
        
        const pos = swimlane.taskPositions.get(task.id);
        
        // Check if position exists and is valid
        if (!pos || pos.y < swimlane.y || pos.y > swimlane.y + swimlane.height || isNaN(pos.y)) {
          // Calculate a valid y-position within this swimlane
          const yPosition = swimlane.y + 50 + (swimlane.tasks.indexOf(task) * 40);
          
          // Ensure position stays within swimlane bounds
          const maxY = swimlane.y + swimlane.height - task.getCurrentHeight() - 10;
          const safeY = Math.min(yPosition, maxY);
          
          // Set the fixed position
          const newPos = { x: pos ? pos.x : 0, y: safeY };
          swimlane.taskPositions.set(task.id, newPos);
          
          // Ensure the global taskPositions map is updated too
          this.taskPositions.set(task.id, { ...newPos });
          
          console.log(`[TaskManager] Fixed position for task ${task.id} (${task.name}) in swimlane ${swimlane.id}. Position set to y=${safeY}`);
          fixCount++;
        }
      });
    });
    
    // Update the global taskPositions map to match swimlane positions
    this.swimlanes.forEach(swimlane => {
      swimlane.tasks.forEach(task => {
        const pos = swimlane.taskPositions.get(task.id);
        if (pos) {
          this.taskPositions.set(task.id, pos);
        }
      });
    });
    
    if (fixCount > 0) {
      console.log(`[TaskManager] Fixed positions for ${fixCount} tasks`);
    }
  }

  /**
   * Checks that all tasks are within their swimlane bounds
   * @returns Number of integrity issues found
   */
  checkTaskPositionIntegrity(): number {
    // Only run integrity checks periodically to avoid performance issues
    if (TaskManager._integrityCheckCounter++ < 10) {
      return 0; // Skip check to improve performance
    }
    TaskManager._integrityCheckCounter = 0;
    
    let issuesFound = 0;
    
    // Skip if no tasks or swimlanes
    if (this.tasks.length === 0 || this.swimlanes.length === 0) {
      return issuesFound;
    }
    
    // Check that all tasks have swimlaneId that matches the swimlane they're in
    this.swimlanes.forEach(swimlane => {
      swimlane.tasks.forEach(task => {
        if (task.swimlaneId !== swimlane.id) {
          console.warn(`[Integrity] Task ${task.id} (${task.name}) is in swimlane ${swimlane.id} but has swimlaneId ${task.swimlaneId}`);
          issuesFound++;
        }
        
        // Check that position is within the swimlane's vertical bounds
        const pos = swimlane.taskPositions.get(task.id);
        if (pos) {
          const taskHeight = task.getCurrentHeight();
          const minValidY = swimlane.y;
          const maxValidY = swimlane.y + swimlane.height - taskHeight;
          
          if (pos.y < minValidY || pos.y > maxValidY) {
            console.warn(`[Integrity] Task ${task.id} (${task.name}) has y-position ${pos.y} which is outside swimlane bounds: ${minValidY} to ${maxValidY}`);
            issuesFound++;
          }
        } else {
          console.warn(`[Integrity] Task ${task.id} (${task.name}) has no position in swimlane ${swimlane.id}`);
          issuesFound++;
        }
      });
    });
    
    // Check that all tasks are in a swimlane
    this.tasks.forEach(task => {
      const inSwimlane = this.swimlanes.some(lane => lane.tasks.includes(task));
      if (!inSwimlane) {
        console.warn(`[Integrity] Task ${task.id} (${task.name}) is not in any swimlane`);
        issuesFound++;
      }
    });
    
    if (issuesFound > 0) {
      console.warn(`[Integrity] Found ${issuesFound} issues with task positions. Running fix...`);
      this.validateTaskPositions();
    }
    
    return issuesFound;
  }
  
  // Add static counter for integrity checks
  static _integrityCheckCounter: number = 0;
  
  // Method to force a full integrity check
  forceIntegrityCheck(): void {
    console.log("[TaskManager] Performing integrity check");
    
    const issues = this.checkTaskPositionIntegrity();
    if (issues > 0) {
      console.log(`[TaskManager] Found ${issues} position integrity issues, applying fixes...`);
      const fixCount = this.validateTaskPositions();
      console.log(`[TaskManager] Applied ${fixCount} position fixes`);
      
      // Perform a second check to verify fixes were applied correctly
      const remainingIssues = this.checkTaskPositionIntegrity();
      if (remainingIssues > 0) {
        console.warn(`[TaskManager] ${remainingIssues} position issues remain after attempted fixes`);
      } else {
        console.log(`[TaskManager] All position issues resolved successfully`);
      }
    } else {
      console.log("[TaskManager] No integrity issues found");
    }
  }

  // Find all tasks that depend on the given task (successors)
  // This includes both direct and indirect dependencies
  private getSuccessorTasks(taskId: string, includeIndirect: boolean = true): Task[] {
    // Find direct successors - tasks that have this task as a dependency
    const directSuccessors = this.tasks.filter(t => t.dependencies.includes(taskId));
    
    if (!includeIndirect) {
      return directSuccessors;
    }
    
    // Find indirect successors recursively
    const allSuccessors = new Set<Task>(directSuccessors);
    
    const findIndirectSuccessors = (task: Task) => {
      const successors = this.tasks.filter(t => t.dependencies.includes(task.id));
      for (const successor of successors) {
        if (!allSuccessors.has(successor)) {
          allSuccessors.add(successor);
          findIndirectSuccessors(successor);
        }
      }
    };
    
    // Start the recursive search with direct successors
    directSuccessors.forEach(findIndirectSuccessors);
    
    return Array.from(allSuccessors);
  }
}
import { Task, TaskConfig } from './Task';
import { Camera } from './Camera';
import { Trades, Trade } from './Trades';
import { Logger } from './utils/logger';
import { generateUUID } from './utils';

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
  tasks: Task[] = [];
  private selectedTasks: Set<Task> = new Set();
  private selectedTasksInOrder: Task[] = [];
  private draggedTask: Task | null = null;
  private dragStartPosition: { x: number; y: number } | null = null;
  private taskPositions: Map<string, { x: number; y: number }> = new Map();
  private isDraggingLeftEdge = false;
  private isDraggingRightEdge = false;
  private readonly EDGE_SENSITIVITY_PX = 8; // Fixed pixel threshold for edge detection
  private readonly HIT_PADDING_PX = 4; // Extra padding around tasks for easier clicking
  private lastMouseWorld = { x: 0, y: 0 };
  swimlanes: Swimlane[] = [];
  SWIMLANE_HEIGHT = 80; // Minimum height for empty swimlanes
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
    // Calculate y as the sum of all previous swimlane heights
    let y = 0;
    this.swimlanes.forEach(existingSwimlane => {
      y += existingSwimlane.height;
    });
    
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
    
    // Recalculate swimlane heights after adding task
    this.recalculateSwimlaneHeights();
    
    return task;
  }

  private calculateTaskYInSwimlane(swimlane: Swimlane): number {
    const taskSpacing = 15; // Spacing between tasks
    const topPadding = 40; // Padding from top of swimlane
    const rowHeight = 60; // Standard height for a row of tasks
    
    // If there are no tasks yet, return the top position
    if (swimlane.tasks.length === 0) {
      return swimlane.y + topPadding;
    }
    
    // Calculate Y position based on existing tasks - no clamping, let tasks extend as needed
    const yPosition = swimlane.y + topPadding + (swimlane.tasks.length * (rowHeight + taskSpacing));
    
    return yPosition;
  }

  private recalculateSwimlaneHeights(): void {
    const MIN_HEIGHT = 80;
    const topPadding = 30;
    const rowHeight = 44;
    const taskSpacing = 6;
    const bottomPadding = 20;
    
    // First, calculate heights based on task count
    this.swimlanes.forEach(swimlane => {
      const taskCount = swimlane.tasks.length;
      const calculatedHeight = Math.max(
        MIN_HEIGHT,
        topPadding + (taskCount * (rowHeight + taskSpacing)) + bottomPadding
      );
      swimlane.height = calculatedHeight;
    });
    
    // Then, recalculate Y positions (they stack vertically)
    let currentY = 0;
    this.swimlanes.forEach(swimlane => {
      swimlane.y = currentY;
      currentY += swimlane.height;
      
      // Update task positions within each swimlane
      swimlane.tasks.forEach((task, index) => {
        const yPosition = swimlane.y + topPadding + (index * (rowHeight + taskSpacing));
        swimlane.taskPositions.set(task.id, {
          x: swimlane.taskPositions.get(task.id)?.x || 0,
          y: yPosition
        });
        // Also update global task positions
        this.taskPositions.set(task.id, {
          x: this.taskPositions.get(task.id)?.x || 0,
          y: yPosition
        });
      });
    });
  }

  removeTask(id: string) {
    // Remove from main tasks array
    this.tasks.splice(this.tasks.findIndex(t => t.id === id), 1);
    this.taskPositions.delete(id);
    
    // Remove from swimlanes
    this.swimlanes.forEach(swimlane => {
      const taskIndex = swimlane.tasks.findIndex(t => t.id === id);
      if (taskIndex !== -1) {
        swimlane.tasks.splice(taskIndex, 1);
        swimlane.taskPositions.delete(id);
      }
    });
    
    // Recalculate swimlane heights after removing task
    this.recalculateSwimlaneHeights();
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
    const screenY = e.clientY - rect.top - headerHeight; // Subtract header height to match rendering
    
    // Convert to world coordinates using the same transform as Canvas rendering
    return camera.screenToWorld(screenX, screenY);
  }

  private getEdgeSensitivityWorld(camera: Camera): number {
    // Convert fixed pixel threshold to world coordinates
    return this.EDGE_SENSITIVITY_PX / camera.zoom;
  }

  private getHitPaddingWorld(camera: Camera): number {
    // Convert fixed pixel padding to world coordinates
    return this.HIT_PADDING_PX / camera.zoom;
  }

  private snapToDay(worldX: number, timeAxis: any): Date {
    // Get the date at this world position
    const date = timeAxis.worldToDate(worldX);
    
    // Snap to start of day (midnight)
    const snappedDate = new Date(date);
    snappedDate.setHours(0, 0, 0, 0);
    
    return snappedDate;
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

    // Get hit detection padding in world coordinates
    const hitPadding = this.getHitPaddingWorld(camera);
    const edgeSensitivity = this.getEdgeSensitivityWorld(camera);

    // Find clicked task within swimlanes
    for (const swimlane of this.swimlanes) {
      if (worldY >= swimlane.y && worldY <= swimlane.y + swimlane.height) {
        clickedSwimlane = swimlane;
        for (const task of swimlane.tasks) {
          const pos = swimlane.taskPositions.get(task.id);
          if (!pos) continue;

          const startX = timeAxis.dateToWorld(task.startDate);
          const endX = timeAxis.dateToWorld(task.getEndDate());
          
          // Add padding to hit area for easier clicking
          const hitStartX = startX - hitPadding;
          const hitEndX = endX + hitPadding;
          const hitStartY = pos.y - hitPadding;
          const hitEndY = pos.y + task.getCurrentHeight() + hitPadding;
          
          if (worldX >= hitStartX && worldX <= hitEndX && 
              worldY >= hitStartY && worldY <= hitEndY) {
            clickedTask = task;
            
            // Check for edge dragging with fixed pixel sensitivity
            if (Math.abs(worldX - startX) <= edgeSensitivity) {
              this.isDraggingLeftEdge = true;
              canvas.style.cursor = 'ew-resize';
            } else if (Math.abs(worldX - endX) <= edgeSensitivity) {
              this.isDraggingRightEdge = true;
              canvas.style.cursor = 'ew-resize';
            } else {
              canvas.style.cursor = 'grab';
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
        // Set cursor to indicate dragging will start
        canvas.style.cursor = 'grabbing';
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
      // Set cursor to grabbing during drag
      canvas.style.cursor = 'grabbing';
      
      // Calculate new position with day snapping
      const rawWorldX = worldX - this.dragStartPosition.x;
      const snappedDate = this.snapToDay(rawWorldX, timeAxis);
      const timeDifference = snappedDate.getTime() - this.draggedTask.startDate.getTime();
      
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
        
        // Apply the same time shift with day boundary snapping
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

      // Update the dragged task's start date (using snapped date)
      draggedTask.startDate = snappedDate;
      
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

    // Update cursor based on hover state (immediate feedback)
    if (!this.draggedTask && !this.isDrawingSelectionBox) {
      const hitPadding = this.getHitPaddingWorld(camera);
      const edgeSensitivity = this.getEdgeSensitivityWorld(camera);
      let cursorSet = false;
      
      // Check all visible tasks for hover
      for (const swimlane of this.swimlanes) {
        if (cursorSet) break;
        
        for (const task of swimlane.tasks) {
          const pos = swimlane.taskPositions.get(task.id);
          if (!pos) continue;

          const startX = timeAxis.dateToWorld(task.startDate);
          const endX = timeAxis.dateToWorld(task.getEndDate());
          
          // Use hit area with padding for cursor detection
          const hitStartX = startX - hitPadding;
          const hitEndX = endX + hitPadding;
          const hitStartY = pos.y - hitPadding;
          const hitEndY = pos.y + task.getCurrentHeight() + hitPadding;
          
          if (worldX >= hitStartX && worldX <= hitEndX && 
              worldY >= hitStartY && worldY <= hitEndY) {
            
            // Check for edge resize zones first
            if (Math.abs(worldX - startX) <= edgeSensitivity) {
              canvas.style.cursor = 'ew-resize';
              cursorSet = true;
              break;
            } else if (Math.abs(worldX - endX) <= edgeSensitivity) {
              canvas.style.cursor = 'ew-resize';
              cursorSet = true;
              break;
            } else {
              // Over task body - show pointer for selection, grab for drag
              canvas.style.cursor = 'pointer';
              cursorSet = true;
              break;
            }
          }
        }
      }
      
      // If not over any task, show default cursor
      if (!cursorSet && !this.isHandMode) {
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

  handleMouseUp(canvas?: HTMLCanvasElement) {
    this.isDrawingSelectionBox = false;
    this.selectionBoxStart = null;
    this.selectionBoxEnd = null;
    this.draggedTask = null;
    this.dragStartPosition = null;
    this.isDraggingLeftEdge = false;
    this.isDraggingRightEdge = false;
    
    // Reset cursor to default when mouse is released
    if (canvas) {
      canvas.style.cursor = 'default';
    }
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

    // Details panel — uses .form-group design system from Sidebar
    const statusColors: Record<string, string> = {
      'not-started': '#6b7280',
      'in-progress': '#f59e0b',
      'completed': '#22c55e',
      'blocked': '#ef4444'
    };
    const statusColor = statusColors[task.status || 'not-started'] || '#6b7280';
    const statusLabel = (task.status || 'not-started').replace('-', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());

    detailsView.innerHTML = `
      <div class="task-details-panel">
        <!-- Task Header -->
        <div class="td-header">
          <div class="td-color-bar" style="background: ${task.color};"></div>
          <div class="td-header-content">
            <input 
              type="text" 
              value="${task.name}"
              class="td-name-input"
              data-field="name"
            >
            <div class="td-meta">
              <span class="td-swimlane-badge" style="background: ${swimlane.color}12; color: ${swimlane.color}; border-color: ${swimlane.color}30;">
                ${swimlane.name}
              </span>
              <span class="td-status-badge" style="background: ${statusColor}15; color: ${statusColor}; border-color: ${statusColor}30;">
                ${statusLabel}
              </span>
            </div>
          </div>
        </div>

        <!-- Quick Stats -->
        <div class="td-stats-row">
          <div class="td-stat">
            <span class="td-stat-value">${task.duration}d</span>
            <span class="td-stat-label">Duration</span>
          </div>
          <div class="td-stat">
            <span class="td-stat-value">${task.crewSize}</span>
            <span class="td-stat-label">Crew</span>
          </div>
          <div class="td-stat">
            <span class="td-stat-value">${task.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            <span class="td-stat-label">Start</span>
          </div>
          <div class="td-stat">
            <span class="td-stat-value">${task.getEndDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            <span class="td-stat-label">End</span>
          </div>
        </div>

        <!-- Trade -->
        <div class="form-group">
          <label>TRADE</label>
          <select data-field="trade">
            <option value="">-- Select Trade --</option>
            ${Trades.getAllTrades().map(trade => `
              <option value="${trade.id}" ${task.tradeId === trade.id ? 'selected' : ''}>${trade.name}</option>
            `).join('')}
          </select>
        </div>

        <!-- Schedule Grid -->
        <div class="td-section-label">SCHEDULE</div>
        <div class="td-grid">
          <div class="form-group">
            <label>Start Date</label>
            <input type="date" value="${task.startDate.toISOString().split('T')[0]}" data-field="startDate">
          </div>
          <div class="form-group">
            <label>Duration (days)</label>
            <input type="number" value="${task.duration}" min="1" data-field="duration">
          </div>
          <div class="form-group">
            <label>Crew Size</label>
            <input type="number" value="${task.crewSize}" min="1" data-field="crewSize">
          </div>
          <div class="form-group">
            <label>End Date</label>
            <div class="td-readonly-field end-date-display">${task.getEndDate().toLocaleDateString()}</div>
          </div>
        </div>

        <!-- Status -->
        <div class="form-group">
          <label>STATUS</label>
          <select data-field="status">
            <option value="not-started" ${task.status === 'not-started' ? 'selected' : ''}>Not Started</option>
            <option value="in-progress" ${task.status === 'in-progress' ? 'selected' : ''}>In Progress</option>
            <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>Completed</option>
            <option value="blocked" ${task.status === 'blocked' ? 'selected' : ''}>Blocked</option>
          </select>
        </div>

        <!-- Work Schedule -->
        <div class="td-section-label">WORK SCHEDULE</div>
        <div class="td-toggle-group">
          <label class="td-toggle">
            <input type="checkbox" ${task.workOnSaturday ? 'checked' : ''} data-field="workOnSaturday">
            <span class="td-toggle-slider"></span>
            <span>Saturdays</span>
          </label>
          <label class="td-toggle">
            <input type="checkbox" ${task.workOnSunday ? 'checked' : ''} data-field="workOnSunday">
            <span class="td-toggle-slider"></span>
            <span>Sundays</span>
          </label>
        </div>

        <!-- Predecessors -->
        <div class="td-section-label">PREDECESSORS</div>
        <div class="td-dep-add">
          <select id="predecessorSelect">
            <option value="">Add predecessor...</option>
            ${this.tasks
              .filter(t => t.id !== task.id && !task.dependencies.includes(t.id) && !this.wouldCreateCycle(task.id, t.id))
              .map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
          </select>
          <button class="td-add-btn" onclick="this.closest('#details-view').dispatchEvent(new CustomEvent('addPredecessor', { detail: { taskId: '${task.id}' } }))">+</button>
        </div>
        <div class="td-dep-list">
          ${task.dependencies.length === 0 ? '<div class="td-dep-empty">No predecessors</div>' : ''}
          ${task.dependencies.map(depId => {
            const depTask = this.getTask(depId);
            return depTask ? `
              <div class="td-dep-item">
                <div class="td-dep-info">
                  <div class="td-dep-dot" style="background: ${depTask.color}"></div>
                  <span class="td-dep-name">${depTask.name}</span>
                  <span class="td-dep-type">${calculateRelationship(task, depTask, false)}</span>
                </div>
                <button class="td-dep-remove" onclick="this.closest('#details-view').dispatchEvent(new CustomEvent('removePredecessor', { detail: { taskId: '${task.id}', predecessorId: '${depId}' } }))">×</button>
              </div>
            ` : '';
          }).join('')}
        </div>

        <!-- Successors -->
        <div class="td-section-label">SUCCESSORS</div>
        <div class="td-dep-list">
          ${successors.length === 0 ? '<div class="td-dep-empty">No successors</div>' : ''}
          ${successors.map(succ => `
            <div class="td-dep-item">
              <div class="td-dep-info">
                <div class="td-dep-dot" style="background: ${succ.color}"></div>
                <span class="td-dep-name">${succ.name}</span>
                <span class="td-dep-type">${calculateRelationship(task, succ, true)}</span>
              </div>
              <button class="td-dep-remove" onclick="this.closest('#details-view').dispatchEvent(new CustomEvent('removeSuccessor', { detail: { taskId: '${task.id}', successorId: '${succ.id}' } }))">×</button>
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
    // Cannot delete if no tasks are selected
    if (this.selectedTasks.size === 0) return;
    
    // Get IDs of tasks to be deleted for dependency cleanup
    const deletedTaskIds = Array.from(this.selectedTasks).map(task => task.id);
    
    // Update dependencies: Remove references to deleted tasks from all other tasks
    this.tasks.forEach(task => {
      // Skip tasks that are being deleted
      if (this.selectedTasks.has(task)) return;
      
      // Filter out dependencies to deleted tasks
      if (task.dependencies.some(depId => deletedTaskIds.includes(depId))) {
        const originalCount = task.dependencies.length;
        task.dependencies = task.dependencies.filter(depId => !deletedTaskIds.includes(depId));
        console.log(`[TaskManager] Removed ${originalCount - task.dependencies.length} dependencies from task ${task.id} due to deletion`);
      }
    });
    
    // Now delete the tasks from each swimlane
    for (const swimlane of this.swimlanes) {
      // Remove selected tasks from this swimlane
      swimlane.tasks = swimlane.tasks.filter(task => !this.selectedTasks.has(task));
      
      // Remove the task positions for deleted tasks
      for (const task of this.selectedTasks) {
        swimlane.taskPositions.delete(task.id);
      }
    }
    
    // Remove selected tasks from the global tasks array
    this.tasks = this.tasks.filter(task => !this.selectedTasks.has(task));
    
    // Clear selection
    this.selectedTasks.clear();
    this.selectedTasksInOrder = [];
    
    // Clear task details
    const detailsView = document.getElementById('details-view');
    if (detailsView) {
      detailsView.innerHTML = '<div style="color: #666; text-align: center; padding: 40px;">Select a task to view details</div>';
    }
    
    console.log('Deleted selected tasks');
    
    // Dispatch a taskUpdated event to trigger autosave
    const taskUpdatedEvent = new CustomEvent('taskUpdated', {
      detail: {
        type: 'deletion',
        deletedIds: deletedTaskIds,
        hasDependencies: true
      }
    });
    document.dispatchEvent(taskUpdatedEvent);
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

  clearSelection(): void {
    this.selectedTasks.clear();
    this.selectedTasksInOrder = [];
  }

  clearSwimlanes(): void {
    this.swimlanes.length = 0;
  }

  removeSwimlane(id: string): boolean {
    const idx = this.swimlanes.findIndex(s => s.id === id);
    if (idx >= 0) {
      this.swimlanes.splice(idx, 1);
      return true;
    }
    return false;
  }
  
  getTasksAtPoint(worldX: number, worldY: number, camera?: Camera): Task[] {
    const result: Task[] = [];
    
    // Get hit padding if camera is provided (for more forgiving hover detection)
    const hitPadding = camera ? this.getHitPaddingWorld(camera) : 0;
    
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
        
        // Apply hit padding for easier hover detection
        const hitStartX = startX - hitPadding;
        const hitEndX = endX + hitPadding;
        const hitStartY = pos.y - hitPadding;
        const hitEndY = pos.y + task.getCurrentHeight() + hitPadding;
        
        if (worldX >= hitStartX && worldX <= hitEndX && 
            worldY >= hitStartY && worldY <= hitEndY) {
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
            ctx.strokeStyle = '#10a37f'; // Green accent
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
      ctx.strokeStyle = '#10a37f';
      ctx.lineWidth = 2 / camera.zoom;
      ctx.setLineDash([5 / camera.zoom, 5 / camera.zoom]);
      ctx.fillStyle = 'rgba(79, 209, 197, 0.1)';
      
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
    
    // Set arrow style - soft purple with slight opacity
    ctx.strokeStyle = 'rgba(159, 122, 234, 0.7)';
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
        ctx.fillStyle = 'rgba(159, 122, 234, 0.7)';
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
    // First build a set of valid task IDs for dependency validation
    const validTaskIds = new Set(this.tasks.map(task => task.id));
    
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
    
    // Create a dedicated dependencies map for explicit dependency tracking
    const dependencyMap: Record<string, string[]> = {};
    
    // Create a clean copy of each task with validated dependencies
    const serializedTasks = this.tasks.map(task => {
      // Only include valid dependencies (that point to existing tasks)
      const validDependencies = Array.isArray(task.dependencies) 
        ? task.dependencies.filter(depId => validTaskIds.has(depId)) 
        : [];
      
      // Store valid dependencies in the dedicated map
      if (validDependencies.length > 0) {
        dependencyMap[task.id] = [...validDependencies];
      }
      
      return {
        id: task.id,
        name: task.name,
        startDate: task.startDate,
        duration: task.duration,
        crewSize: task.crewSize,
        color: task.color,
        tradeId: task.tradeId,
        dependencies: validDependencies, // Use the validated dependencies
        progress: task.progress,
        status: task.status,
        workOnSaturday: task.workOnSaturday,
        workOnSunday: task.workOnSunday,
        swimlaneId: task.swimlaneId // Ensure swimlaneId is included
      };
    });
    
    // Count dependencies for logging
    let totalDependencyCount = 0;
    Object.values(dependencyMap).forEach(deps => {
      totalDependencyCount += deps.length;
    });
    
    console.log(`[TaskManager] Exporting state with ${serializedTasks.length} tasks, ${Object.keys(dependencyMap).length} tasks have dependencies (total: ${totalDependencyCount} dependencies)`);
    
    // Return the complete state
    return {
      tasks: serializedTasks,
      swimlanes: serializedSwimlanes,
      taskPositions: serializedTaskPositions,
      tradeFilters: Array.from(this.tradeFilters.entries()),
      dependencyMap: dependencyMap // Add the dedicated dependency map as a redundant backup
    };
  }

  /**
   * Import a previously exported state
   * @param state The state object to import
   */
  importState(state: any): void {
    console.log(`[TaskManager] Starting import with state:`, {
      hasTasks: Boolean(state.tasks),
      taskCount: state.tasks?.length || 0,
      hasSwimlanes: Boolean(state.swimlanes),
      swimlaneCount: state.swimlanes?.length || 0,
      hasDependencyMap: Boolean(state.dependencyMap),
      dependencyMapSize: state.dependencyMap ? Object.keys(state.dependencyMap).length : 0
    });
    
    // Clear current state
    this.tasks = [];
    this.selectedTasks.clear();
    this.selectedTasksInOrder = [];
    this.taskPositions.clear();
    this.swimlanes.length = 0; // Clear swimlanes array
    
    // First pass: Create all tasks to ensure they exist for dependency linking
    const taskMap = new Map<string, Task>();
    
    // Keep track of dependencies to ensure they are all properly preserved
    const taskDependencies = new Map<string, string[]>();
    
    // Prefer the dedicated dependency map if available, as it's more reliable
    if (state.dependencyMap && typeof state.dependencyMap === 'object') {
      console.log(`[TaskManager] Using dedicated dependency map with ${Object.keys(state.dependencyMap).length} task dependencies`);
      
      // Copy the dependency map
      Object.entries(state.dependencyMap).forEach(([taskId, deps]: [string, any]) => {
        if (Array.isArray(deps) && deps.length > 0) {
          taskDependencies.set(taskId, [...deps]);
        }
      });
    }
    
    // Restore tasks
    if (state.tasks && Array.isArray(state.tasks)) {
      // First create all the tasks without dependencies
      state.tasks.forEach((taskData: any) => {
        try {
          // Ensure essential properties are valid
          const taskId = taskData.id || generateUUID();
          const taskName = taskData.name || 'Untitled Task';
          const taskStartDate = taskData.startDate instanceof Date 
            ? taskData.startDate 
            : new Date(taskData.startDate || Date.now());
          
          // Store dependencies from task data if not already in dedicated map
          if (!taskDependencies.has(taskId) && Array.isArray(taskData.dependencies) && taskData.dependencies.length > 0) {
            taskDependencies.set(taskId, [...taskData.dependencies]);
            console.log(`[TaskManager] Stored ${taskData.dependencies.length} dependencies for task ${taskId} from task data`);
          }
          
          // Create the task initially without dependencies
          const task = new Task({
            id: taskId,
            name: taskName,
            startDate: taskStartDate,
            duration: taskData.duration || 1,
            crewSize: taskData.crewSize || 1,
            color: taskData.color || '#4287f5',
            tradeId: taskData.tradeId || null,
            dependencies: [], // Initialize with empty dependencies first
            progress: taskData.progress || 0,
            status: taskData.status || 'not-started',
            workOnSaturday: taskData.workOnSaturday || false,
            workOnSunday: taskData.workOnSunday || false,
            swimlaneId: taskData.swimlaneId || null
          });
          
          // Add to our collection and mapping
          this.tasks.push(task);
          taskMap.set(taskId, task);
          
          // Log for debugging
          console.log(`[TaskManager] Created task: ${taskId} (${taskName})`);
        } catch (error) {
          console.error(`[TaskManager] Error creating task:`, error, taskData);
        }
      });
      
      // Second pass: Now set dependencies after all tasks exist
      console.log(`[TaskManager] Setting dependencies for ${taskDependencies.size} tasks`);
      
      this.tasks.forEach(task => {
        // Get stored dependencies for this task
        const dependencies = taskDependencies.get(task.id);
        if (dependencies && dependencies.length > 0) {
          // Validate and add each dependency
          const validDependencies: string[] = [];
          
          dependencies.forEach(depId => {
            // Check if the dependency target exists
            if (taskMap.has(depId)) {
              validDependencies.push(depId);
            } else {
              console.warn(`[TaskManager] Skipping invalid dependency ${depId} for task ${task.id} - referenced task doesn't exist`);
            }
          });
          
          // Set the validated dependencies
          if (validDependencies.length > 0) {
            task.dependencies = validDependencies;
            console.log(`[TaskManager] Set ${validDependencies.length} dependencies for task ${task.id}:`, JSON.stringify(validDependencies));
          }
        }
      });
      
      // Count total dependencies set for logging
      let totalDependenciesSet = 0;
      this.tasks.forEach(task => {
        if (task.dependencies.length > 0) {
          totalDependenciesSet += task.dependencies.length;
        }
      });
      
      console.log(`[TaskManager] Successfully set ${totalDependenciesSet} total dependencies across ${this.tasks.filter(t => t.dependencies.length > 0).length} tasks`);
    }
    
    // Restore swimlanes
    if (state.swimlanes && Array.isArray(state.swimlanes)) {
      state.swimlanes.forEach((swimlaneData: any) => {
        try {
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
          
          console.log(`[TaskManager] Created swimlane ${swimlaneData.id} with ${swimlaneTasks.length} tasks`);
        } catch (error) {
          console.error(`[TaskManager] Error creating swimlane:`, error, swimlaneData);
        }
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
    
    // Verify dependencies after import
    this.verifyDependencies();
    
    // Verify all dependencies are valid after the full import
    this.verifyAllDependencies();
    
    // Log the final state
    console.log(`[TaskManager] Import completed with ${this.tasks.length} tasks, ${this.swimlanes.length} swimlanes`);
  }
  
  /**
   * Verify dependencies after import
   */
  private verifyDependencies(): void {
    let tasksWithDeps = 0;
    let totalDeps = 0;
    let fixedDeps = 0;
    
    // First create a map of all valid task IDs for quick lookup
    const validTaskIds = new Set<string>();
    this.tasks.forEach(task => {
      validTaskIds.add(task.id);
    });
    
    // Now check and fix each task's dependencies
    this.tasks.forEach(task => {
      if (!Array.isArray(task.dependencies)) {
        task.dependencies = [];
        console.error(`[TaskManager] Fixed null dependencies for task ${task.id}`);
        fixedDeps++;
      }
      
      if (task.dependencies.length > 0) {
        tasksWithDeps++;
        totalDeps += task.dependencies.length;
        
        // Check if all dependencies point to valid tasks
        const invalidDeps = task.dependencies.filter(depId => !validTaskIds.has(depId));
        
        if (invalidDeps.length > 0) {
          console.warn(`[TaskManager] Task ${task.id} has ${invalidDeps.length} invalid dependencies:`, invalidDeps);
          
          // Remove invalid dependencies
          const originalCount = task.dependencies.length;
          task.dependencies = task.dependencies.filter(depId => validTaskIds.has(depId));
          fixedDeps += (originalCount - task.dependencies.length);
          
          // Log each removed dependency for debugging
          invalidDeps.forEach(depId => {
            console.warn(`[TaskManager] Removed invalid dependency ${depId} from task ${task.id}`);
          });
        }
      }
    });
    
    console.log(`[TaskManager] Dependency verification: ${tasksWithDeps} tasks have ${totalDeps} total dependencies, fixed ${fixedDeps} invalid dependencies`);
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

  /**
   * Public method to verify and sanitize all task dependencies
   * @returns Object with counts of valid and fixed dependencies
   */
  verifyAllDependencies(): { validCount: number, fixedCount: number } {
    // Create a set of valid task IDs for quick lookup
    const validTaskIds = new Set(this.tasks.map(task => task.id));
    let fixedCount = 0;
    let validCount = 0;
    
    // Check each task's dependencies
    this.tasks.forEach(task => {
      if (!Array.isArray(task.dependencies)) {
        // Fix null or invalid dependencies
        task.dependencies = [];
        console.warn(`[TaskManager] Fixed invalid dependencies format for task ${task.id}`);
      } else if (task.dependencies.length > 0) {
        // Filter out any dependencies that don't point to valid tasks
        const originalCount = task.dependencies.length;
        const validDependencies = task.dependencies.filter(depId => validTaskIds.has(depId));
        
        // Update counts
        validCount += validDependencies.length;
        fixedCount += originalCount - validDependencies.length;
        
        // If any were filtered out, update the task
        if (validDependencies.length !== originalCount) {
          task.dependencies = validDependencies;
          console.warn(`[TaskManager] Fixed ${originalCount - validDependencies.length} invalid dependencies for task ${task.id}`);
        }
      }
    });
    
    // Log summary
    console.log(`[TaskManager] Dependency verification complete: ${this.tasks.length} tasks checked, ${validCount} valid dependencies, ${fixedCount} invalid dependencies fixed`);
    
    // Return the results for external use
    return { validCount, fixedCount };
  }

  /**
   * Clear all tasks and swimlanes
   */
  clearAll(): void {
    // Remove all tasks
    const allTasks = [...this.tasks];
    allTasks.forEach(t => this.removeTask(t.id));
    
    // Clear swimlanes (mutate the readonly array)
    (this.swimlanes as Swimlane[]).length = 0;
    
    // Clear other state
    this.selectedTasks.clear();
    this.taskPositions.clear();
    
    // Recalculate swimlane heights after clearing
    this.recalculateSwimlaneHeights();
  }
}
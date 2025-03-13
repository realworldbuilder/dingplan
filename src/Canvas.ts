import { Camera } from './Camera';
import { TimeAxis } from './TimeAxis';
import { TaskManager } from './TaskManager';
import { TaskConfig, Task } from './Task';
import { Sidebar } from './Sidebar';
import { ResourceHistogram } from './ResourceHistogram';
import { jsPDF } from 'jspdf';
import { Trades, Trade } from './Trades';
// import { XerExporter } from './XerExporter'; // Temporarily removed XER export
import { generateUUID } from './utils';
import { TouchManager } from './TouchManager';
import { Logger } from './utils/logger';

export interface CanvasConfig {
  canvas: HTMLCanvasElement;
  backgroundColor?: string;
  gridColor?: string;
  startDate?: Date;
}

export interface CanvasOptions {
  canvas: HTMLCanvasElement;
  backgroundColor?: string;
  gridColor?: string;
  startDate?: Date;
}

export class Canvas {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  camera: Camera;
  taskManager: TaskManager;
  isDragging: boolean = false;
  lastMouseX: number = 0;
  lastMouseY: number = 0;
  backgroundColor: string;
  gridColor: string;
  startDate: Date = new Date(); // Initialize startDate
  zoomLevel: number = 1;
  selectedTaskId: string | null = null;
  dayWidth: number = 30; // Width of a day in pixels
  areDependenciesVisible: boolean = true; // Flag to control dependency visibility
  timeAxis: TimeAxis; // Add the timeAxis property

  sidebar: Sidebar;
  resourceHistogram: ResourceHistogram;

  // Use the centralized trade definitions
  private readonly trades: Trade[] = Trades.getAllTrades();

  // Add TouchManager property
  private touchManager: TouchManager | null = null;
  private touchSupportEnabled: boolean = true; // Feature flag for touch support

  constructor(config: CanvasConfig) {
    this.canvas = config.canvas;
    this.ctx = this.canvas.getContext('2d')!;
    this.backgroundColor = config.backgroundColor || '#f0f0f0';
    this.gridColor = config.gridColor || '#e0e0e0';
    
    if (config.startDate) {
      this.startDate = config.startDate;
    }
    
    // Initialize camera
    this.camera = new Camera(this.canvas.width, this.canvas.height);
    this.camera.zoom = 1;
    
    // Center the camera on current date on initial load
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(today);
    
    this.timeAxis = new TimeAxis(startDate);
    this.sidebar = new Sidebar();
    
    // Center the view with today on the left third of the screen
    const todayX = this.timeAxis.getTodayPosition();
    this.camera.x = todayX + (this.canvas.width / (3 * this.camera.zoom));
    this.camera.y = 200;
    
    this.taskManager = new TaskManager(this.timeAxis);
    
    // Connect the sidebar trade filters to the task manager
    this.sidebar.onTradeFiltersChanged((filters) => {
      this.taskManager.setTradeFilters(filters);
      this.render(); // Redraw canvas to reflect filtered tasks
    });
    
    // Initialize resource histogram
    this.resourceHistogram = new ResourceHistogram(this.timeAxis);
    
    // In production, disable debug logging by default
    if (window.location.hostname !== 'localhost' && 
        window.location.hostname !== '127.0.0.1' &&
        !window.location.hostname.includes('.local')) {
      Logger.disableDebugMode();
    }
    
    this.setupEventListeners();
    
    // Initialize the touch manager for mobile devices
    this.initTouchSupport();
  }

  /**
   * Initialize touch support for mobile devices
   */
  private initTouchSupport(): void {
    // Check if this is a touch-capable device and touch support is enabled
    if (this.touchSupportEnabled && ('ontouchstart' in window || navigator.maxTouchPoints > 0)) {
      console.log('Touch device detected, enabling mobile touch support');
      this.touchManager = new TouchManager(this.canvas, this);
    }
  }

  /**
   * Disable touch support (if it causes issues)
   */
  public disableTouchSupport(): void {
    console.log('Disabling touch support');
    this.touchSupportEnabled = false;
    if (this.touchManager) {
      this.touchManager.destroy();
      this.touchManager = null;
    }
  }

  /**
   * Enable touch support
   */
  public enableTouchSupport(): void {
    console.log('Enabling touch support');
    this.touchSupportEnabled = true;
    this.initTouchSupport();
  }

  private setupEventListeners() {
    this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
    this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
    this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
    
    // Listen for custom task update events to refresh the view
    document.addEventListener('taskUpdated', () => {
      this.render();
    });
  }

  private handleMouseDown(e: MouseEvent) {
    // Ignore clicks on the toolbar
    const clickedElement = e.target as HTMLElement;
    const toolbarElement = document.querySelector('div[style*="position: absolute"][style*="bottom: 20px"]');
    
    // Check if the click is on the toolbar or any of its children
    if (toolbarElement && (clickedElement === toolbarElement || toolbarElement.contains(clickedElement))) {
      return; // Don't handle mousedown for toolbar elements
    }

    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if we're clicking the sidebar first
    if (this.taskManager.isOverSidebar(x, y)) {
      this.taskManager.handleMouseDown(e, this.canvas, this.camera, this.timeAxis);
      return;
    }

    // Handle regular task clicking
    this.taskManager.handleMouseDown(e, this.canvas, this.camera, this.timeAxis);
    
    // If a task is selected, show the task details in the sidebar
    if (this.taskManager.hasSelectedTask()) {
      this.sidebar.show('details');
    }

    // Only start board dragging if we're not on a task and not in header
    if (!this.taskManager.hasSelectedTask() && 
        e.clientY - this.canvas.offsetTop >= this.timeAxis.getHeaderHeight()) {
      this.isDragging = true;
      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      this.canvas.style.cursor = 'grabbing';
    }
  }

  private handleMouseMove(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if we're over the sidebar first
    if (this.taskManager.isOverSidebar(x, y)) {
      this.canvas.style.cursor = 'default';
      return;
    }
    
    // If we're dragging the canvas, prioritize panning over other operations
    if (this.isDragging) {
      const dx = e.clientX - this.lastMouseX;
      const dy = e.clientY - this.lastMouseY;

      this.camera.x -= dx / this.camera.zoom;
      this.camera.y -= dy / this.camera.zoom;

      this.lastMouseX = e.clientX;
      this.lastMouseY = e.clientY;
      return;
    }

    // Convert screen coordinates to world coordinates
    const worldX = (x - this.camera.x * this.camera.zoom) / this.camera.zoom;
    const worldY = (y - this.camera.y * this.camera.zoom) / this.camera.zoom;

    // Check for task hover - use the taskManager's new method that respects filters
    let hoveredTask = null;
    const visibleTasks = this.taskManager.getTasksAtPoint(worldX, worldY);
    if (visibleTasks.length > 0) {
      hoveredTask = visibleTasks[0];
    }

    // Update hover states for all tasks
    const tasks = this.taskManager.getAllTasksUnfiltered();
    for (const task of tasks) {
      task.setHovered(task === hoveredTask);
    }

    // Update cursor style based on hover state
    if (hoveredTask) {
      this.canvas.style.cursor = 'pointer';
    } else if (e.clientY - this.canvas.offsetTop < this.timeAxis.getHeaderHeight()) {
      this.canvas.style.cursor = 'default';
    } else if (!this.isDragging && !this.taskManager.hasSelectedTask()) {
      this.canvas.style.cursor = 'grab';
    }

    // Handle task dragging
    this.taskManager.handleMouseMove(e, this.canvas, this.camera, this.timeAxis);
  }

  private handleMouseUp() {
    this.isDragging = false;
    this.taskManager.handleMouseUp();
    
    // Set cursor based on position and task selection
    const mouseY = this.lastMouseY - this.canvas.offsetTop;
    if (mouseY < this.timeAxis.getHeaderHeight()) {
      this.canvas.style.cursor = 'default';
    } else if (!this.taskManager.hasSelectedTask()) {
      this.canvas.style.cursor = 'grab';
    }
  }

  private handleWheel(e: WheelEvent) {
    e.preventDefault();
    
    const mouseX = e.clientX - this.canvas.offsetLeft;
    const mouseY = e.clientY - this.canvas.offsetTop;
    
    // Don't zoom if in header area
    if (mouseY < this.timeAxis.getHeaderHeight()) {
      return;
    }
    
    // Convert mouse position to world coordinates before zoom
    const worldPos = this.camera.screenToWorld(mouseX, mouseY - this.timeAxis.getHeaderHeight());
    
    // Adjust zoom with smooth factor
    const zoomFactor = e.deltaY > 0 ? 0.95 : 1.05;
    const newZoom = this.camera.zoom * zoomFactor;
    
    // Calculate effective pixels per day at the new zoom level
    const pixelsPerDay = 50;
    const effectivePixelsPerDay = pixelsPerDay * newZoom;
    
    // Limit zoom with smooth boundaries
    if (effectivePixelsPerDay >= 10 && effectivePixelsPerDay <= 200) {
      this.camera.zoom = newZoom;
      
      // Adjust camera position to zoom into/out of mouse position
      const newWorldPos = this.camera.screenToWorld(mouseX, mouseY - this.timeAxis.getHeaderHeight());
      this.camera.x += (worldPos.x - newWorldPos.x) * 0.95; // Smooth factor
      this.camera.y += (worldPos.y - newWorldPos.y) * 0.95; // Smooth factor

      this.camera.onchange?.();
    }
  }

  private handleKeyDown(e: KeyboardEvent) {
    this.taskManager.handleKeyDown(e);
  }

  private drawVerticalGrid() {
    const weekWidth = 50 * 7; // Width of one week in world units (7 days * 50 pixels per day)
    const startX = Math.floor(this.camera.x / weekWidth) * weekWidth;
    const endX = startX + (this.canvas.width / this.camera.zoom);

    // Save current transform state
    this.ctx.save();
    
    // Reset any existing paths
    this.ctx.beginPath();
    this.ctx.strokeStyle = 'rgba(200, 200, 200, 0.15)'; // Very subtle lines
    this.ctx.lineWidth = 1 / this.camera.zoom;

    // Draw week marker lines
    for (let x = startX; x <= endX; x += weekWidth) {
      this.ctx.moveTo(x, 0); // Start below header
      this.ctx.lineTo(x, this.canvas.height);
    }

    this.ctx.stroke();
    this.ctx.restore();
  }

  resize(width: number, height: number) {
    this.canvas.width = width;
    this.canvas.height = height;
    this.camera.projection(width, height - this.timeAxis.getHeaderHeight());
    // Trigger a re-render
    this.render();
  }

  render() {
    Logger.log("Render method called", {
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      cameraZoom: this.camera.zoom,
      cameraX: this.camera.x,
      cameraY: this.camera.y
    });
    
    // Clear canvas
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    Logger.log("Canvas cleared");

    // Draw fixed header background
    this.ctx.fillStyle = '#ffffff';
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    this.ctx.shadowBlur = 4;
    this.ctx.shadowOffsetY = 2;
    this.ctx.fillRect(0, 0, this.canvas.width, this.timeAxis.getHeaderHeight());
    this.ctx.shadowColor = 'transparent';
    Logger.log("Header drawn");

    // Apply main transform for all content
    this.ctx.setTransform(
      this.camera.zoom,
      0,
      0,
      this.camera.zoom,
      -this.camera.x * this.camera.zoom + this.canvas.width / 2,
      -this.camera.y * this.camera.zoom + this.canvas.height / 2 + this.timeAxis.getHeaderHeight()
    );

    // Calculate visible time range
    const dayWidth = 50;
    const visibleStartX = this.camera.x - (this.canvas.width / 2 / this.camera.zoom);
    const visibleEndX = this.camera.x + (this.canvas.width / 2 / this.camera.zoom);
    const startX = Math.floor(visibleStartX / dayWidth) * dayWidth;
    const endX = Math.ceil(visibleEndX / dayWidth) * dayWidth;

    // Draw swimlanes first
    const totalHeight = this.taskManager.getTotalHeight();
    this.taskManager.swimlanes.forEach(lane => {
      // Draw swimlane background with opacity based on zoom
      const bgOpacity = Math.min(0.08, 0.08 * (this.camera.zoom));
      this.ctx.fillStyle = `${lane.color}${Math.floor(bgOpacity * 255).toString(16).padStart(2, '0')}`;
      this.ctx.fillRect(
        visibleStartX,
        lane.y,
        visibleEndX - visibleStartX,
        lane.height
      );

      // Draw swimlane header with opacity based on zoom
      const headerOpacity = Math.min(0.15, 0.15 * (this.camera.zoom));
      this.ctx.fillStyle = `${lane.color}${Math.floor(headerOpacity * 255).toString(16).padStart(2, '0')}`;
      this.ctx.fillRect(
        visibleStartX,
        lane.y,
        visibleEndX - visibleStartX,
        40 / this.camera.zoom
      );

      // Don't draw lane labels here anymore (we'll draw them in fixed position later)
    });

    // Draw main grid based on zoom level
    this.ctx.beginPath();
    this.ctx.lineWidth = 1 / this.camera.zoom;

    // Calculate grid visibility thresholds
    const effectivePixelsPerDay = dayWidth * this.camera.zoom;
    const showDayLines = effectivePixelsPerDay >= 25;
    const showWeekLines = effectivePixelsPerDay >= 10;
    const showMonthLines = true; // Always show month lines

    // Draw vertical time lines
    for (let x = startX; x <= endX; x += dayWidth) {
      const date = this.timeAxis.worldToDate(x);
      const isMonthStart = date.getDate() === 1;
      const isWeekStart = date.getDay() === 1; // Monday
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      if (isMonthStart) {
        // Month lines are always visible and more prominent
        this.ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
      } else if (isWeekStart && showWeekLines) {
        // Week lines when zoomed enough
        this.ctx.strokeStyle = 'rgba(200, 200, 200, 0.15)';
      } else if (showDayLines) {
        // Day lines only when zoomed in enough
        this.ctx.strokeStyle = isWeekend ? 'rgba(200, 200, 200, 0.15)' : 'rgba(200, 200, 200, 0.1)';
      } else {
        continue; // Skip drawing if line shouldn't be visible
      }

      this.ctx.beginPath();
      this.ctx.moveTo(x, -this.canvas.height);
      this.ctx.lineTo(x, this.taskManager.getTotalHeight() + this.canvas.height);
      this.ctx.stroke();
    }

    // Draw horizontal swimlane borders
    this.taskManager.swimlanes.forEach(lane => {
      const borderOpacity = Math.min(0.2, 0.2 * (this.camera.zoom));
      this.ctx.strokeStyle = `rgba(200, 200, 200, ${borderOpacity})`;
      this.ctx.beginPath();
      this.ctx.moveTo(visibleStartX, lane.y);
      this.ctx.lineTo(visibleEndX, lane.y);
      this.ctx.stroke();
    });

    // Draw time axis on top of everything
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.timeAxis.draw(this.ctx, {
      x: this.camera.x,
      y: this.camera.y,
      zoom: this.camera.zoom,
      width: this.canvas.width,
      height: this.canvas.height
    });
    
    // Draw swimlane labels with fixed positioning
    this.drawFixedSwimlaneLabels();

    // Restore transform for tasks
    this.ctx.setTransform(
      this.camera.zoom,
      0,
      0,
      this.camera.zoom,
      -this.camera.x * this.camera.zoom + this.canvas.width / 2,
      -this.camera.y * this.camera.zoom + this.canvas.height / 2 + this.timeAxis.getHeaderHeight()
    );

    // Draw tasks
    this.taskManager.drawTasks(this.ctx, this.timeAxis, this.camera);
    
    // Reset transformation for resource histogram
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // Calculate resource data from tasks
    this.resourceHistogram.calculateResources(this.taskManager.getAllTasks());
    
    // Draw resource histogram at bottom of screen
    this.resourceHistogram.draw(this.ctx, this.camera, this.canvas.height);

    // Draw fixed elements
    this.drawFixedElements();
  }
  
  // New method to draw swimlane labels in fixed position
  private drawFixedSwimlaneLabels() {
    // Reset transform to draw in screen coordinates
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // We'll draw the labels directly over the swimlane headers, but in screen coordinates
    this.taskManager.swimlanes.forEach(lane => {
      // Calculate screen Y position for this swimlane
      const screenY = (lane.y - this.camera.y) * this.camera.zoom + 
                      this.canvas.height / 2 + 
                      this.timeAxis.getHeaderHeight();
      
      // Only draw if swimlane is visible on screen (header area)
      if (screenY >= this.timeAxis.getHeaderHeight() && 
          screenY <= this.canvas.height && 
          screenY + 40 >= this.timeAxis.getHeaderHeight()) {
        
        // Draw label text with original styling - move further right to avoid cutoff
        this.ctx.fillStyle = '#1f2937';
        this.ctx.font = 'bold 14px Inter, system-ui, -apple-system, sans-serif';
        this.ctx.fillText(lane.name, 40, screenY + 26);
      }
    });
  }

  private drawFixedElements() {
    // Reset transform for fixed position elements
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    
    // Draw header bottom border
    this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.timeAxis.getHeaderHeight());
    this.ctx.lineTo(this.canvas.width, this.timeAxis.getHeaderHeight());
    this.ctx.stroke();
  }

  // Helper method to get the date at a specific screen position
  getDateAtPosition(screenX: number, screenY: number): Date {
    const worldPos = this.camera.screenToWorld(screenX, screenY - this.timeAxis.getHeaderHeight());
    return this.timeAxis.worldToDate(worldPos.x);
  }

  // Add a new task to the canvas
  addTask(config: TaskConfig) {
    return this.taskManager.addTask(config);
  }

  // Remove a task from the canvas
  removeTask(id: string) {
    this.taskManager.removeTask(id);
  }

  // Make these methods public so they can be called from HTML toolbar
  showAddTaskDialog() {
    console.log('showAddTaskDialog method called'); // Debug log
    
    // Create dialog overlay 
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.25)'; // Lighter background
    overlay.style.backdropFilter = 'blur(4px)';
    overlay.style.zIndex = '1000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.transition = 'opacity 0.2s ease';

    // Create dialog container
    const dialog = document.createElement('div');
    dialog.style.position = 'relative';
    dialog.style.backgroundColor = 'white';
    dialog.style.padding = '28px';
    dialog.style.borderRadius = '16px';
    dialog.style.boxShadow = '0 10px 25px rgba(0,0,0,0.08)';
    dialog.style.width = '540px';
    dialog.style.maxWidth = '90vw';
    dialog.style.maxHeight = '90vh';
    dialog.style.overflowY = 'auto';
    dialog.style.transition = 'transform 0.2s ease';
    dialog.style.transform = 'translateY(0)';
    dialog.style.opacity = '1';
    dialog.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

    // Create dialog content with modern styling
    dialog.innerHTML = `
      <div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
          <div style="font-size: 24px;">➕</div>
          <h2 style="margin: 0; color: #1a1a1a; font-size: 20px; font-weight: 600; letter-spacing: -0.2px;">Add New Task</h2>
        </div>
        
        <div style="margin-bottom: 24px;">
          <label for="taskName" style="display: block; margin-bottom: 8px; color: #444; font-weight: 500; font-size: 14px;">Task Name</label>
          <input type="text" id="taskName" placeholder="Enter task name" 
                 style="width: 100%; box-sizing: border-box; padding: 10px 14px; border: 1px solid #e0e0e0; 
                        border-radius: 8px; font-size: 14px; font-family: inherit; 
                        background-color: #f8f9fa; transition: all 0.2s ease;">
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
          <div>
            <label for="trade" style="display: block; margin-bottom: 8px; color: #444; font-weight: 500; font-size: 14px;">Trade</label>
            <div style="position: relative;">
              <select id="trade" 
                      style="width: 100%; box-sizing: border-box; padding: 10px 14px; 
                             border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; 
                             font-family: inherit; background-color: #f8f9fa; 
                             appearance: none; padding-right: 32px; cursor: pointer;
                             transition: all 0.2s ease;">
                <option value="" disabled selected>Select a trade</option>
                ${Trades.getAllTrades().map(trade => `
                  <option value="${trade.id}" 
                          data-color="${trade.color}">
                    ${trade.name}
                  </option>
                `).join('')}
              </select>
              <div style="position: absolute; right: 14px; top: 50%; transform: translateY(-50%); pointer-events: none;">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 5L7 9L11 5" stroke="#666" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
          </div>
          <div>
            <label for="zone" style="display: block; margin-bottom: 8px; color: #444; font-weight: 500; font-size: 14px;">Zone</label>
            <div style="position: relative;">
              <select id="zone" 
                      style="width: 100%; box-sizing: border-box; padding: 10px 14px; 
                             border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; 
                             font-family: inherit; background-color: #f8f9fa; 
                             appearance: none; padding-right: 32px; cursor: pointer;
                             transition: all 0.2s ease;">
                ${this.taskManager.swimlanes.map(swimlane => `
                  <option value="${swimlane.id}">
                    ${swimlane.name}
                  </option>
                `).join('')}
              </select>
              <div style="position: absolute; right: 14px; top: 50%; transform: translateY(-50%); pointer-events: none;">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 5L7 9L11 5" stroke="#666" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
          
        <!-- Trade color preview -->
        <div id="tradeColorPreview" style="margin-top: -8px; margin-bottom: 24px; display: none; align-items: center; 
                                         gap: 10px; padding: 8px 12px; border-radius: 6px;">
          <div id="tradeColorSwatch" style="width: 16px; height: 16px; border-radius: 4px;"></div>
          <div id="tradeName" style="font-size: 13px; color: #666;"></div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 24px;">
          <div>
            <label for="startDate" style="display: block; margin-bottom: 8px; color: #444; font-weight: 500; font-size: 14px;">Start Date</label>
            <input type="date" id="startDate" 
                  style="width: 100%; box-sizing: border-box; padding: 10px 14px; 
                         border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; 
                         font-family: inherit; background-color: #f8f9fa; cursor: pointer;
                         transition: all 0.2s ease;">
          </div>
          <div>
            <label for="duration" style="display: block; margin-bottom: 8px; color: #444; font-weight: 500; font-size: 14px;">Duration</label>
            <div style="position: relative;">
              <input type="number" id="duration" min="1" value="1" 
                    style="width: 100%; box-sizing: border-box; padding: 10px 14px; 
                           padding-right: 48px; border: 1px solid #e0e0e0; border-radius: 8px; 
                           font-size: 14px; font-family: inherit; background-color: #f8f9fa;
                           transition: all 0.2s ease;">
              <span style="position: absolute; right: 14px; top: 50%; transform: translateY(-50%); 
                         color: #666; font-size: 14px; font-weight: 400;">days</span>
            </div>
          </div>
          <div>
            <label for="crewSize" style="display: block; margin-bottom: 8px; color: #444; font-weight: 500; font-size: 14px;">Crew Size</label>
            <input type="number" id="crewSize" min="1" value="1" 
                  style="width: 100%; box-sizing: border-box; padding: 10px 14px; 
                         border: 1px solid #e0e0e0; border-radius: 8px; font-size: 14px; 
                         font-family: inherit; background-color: #f8f9fa;
                         transition: all 0.2s ease;">
          </div>
        </div>

        <div style="margin-bottom: 24px; padding: 16px; background-color: #f8f9fa; border-radius: 8px;">
          <label style="display: block; margin-bottom: 12px; color: #444; font-weight: 500; font-size: 14px; display: flex; align-items: center;">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style="margin-right: 8px;">
              <path d="M12 2H14C14.5523 2 15 2.44772 15 3V14C15 14.5523 14.5523 15 14 15H2C1.44772 15 1 14.5523 1 14V3C1 2.44772 1.44772 2 2 2H4" stroke="#666" stroke-width="1.5" stroke-linecap="round"/>
              <rect x="4" y="1" width="8" height="4" rx="1" stroke="#666" stroke-width="1.5"/>
              <line x1="3.75" y1="7.25" x2="12.25" y2="7.25" stroke="#666" stroke-width="1.5" stroke-linecap="round"/>
              <line x1="3.75" y1="10.25" x2="8.25" y2="10.25" stroke="#666" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            Work Schedule
          </label>
          
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center;">
              <input type="checkbox" id="workOnSaturday" 
                     style="margin-right: 8px; width: 16px; height: 16px; accent-color: #4CAF50; cursor: pointer;">
              <label for="workOnSaturday" style="font-size: 14px; color: #444; cursor: pointer;">
                Work on Saturdays
              </label>
            </div>
            
            <div style="display: flex; align-items: center;">
              <input type="checkbox" id="workOnSunday" 
                     style="margin-right: 8px; width: 16px; height: 16px; accent-color: #4CAF50; cursor: pointer;">
              <label for="workOnSunday" style="font-size: 14px; color: #444; cursor: pointer;">
                Work on Sundays
              </label>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; 
                    padding-top: 20px; border-top: 1px solid #f0f0f0;">
          <button id="cancelBtn" 
                 style="padding: 10px 16px; border: 1px solid #e0e0e0; border-radius: 8px; 
                        background: white; color: #555; cursor: pointer; font-size: 14px; 
                        font-weight: 500; font-family: inherit; transition: all 0.2s ease;">Cancel</button>
          <button id="addAndCreateBtn" 
                 style="padding: 10px 16px; border: 1px solid #4CAF50; border-radius: 8px; 
                        background: white; color: #4CAF50; cursor: pointer; font-size: 14px; 
                        font-weight: 500; font-family: inherit; transition: all 0.2s ease;">Add & Create Another</button>
          <button id="addBtn" 
                 style="padding: 10px 16px; border: none; border-radius: 8px; 
                        background: #4CAF50; color: white; cursor: pointer; font-size: 14px; 
                        font-weight: 500; font-family: inherit; transition: all 0.2s ease;">Add Task</button>
        </div>
      </div>
    `;

    // Add hover and focus effects for inputs
    const inputs = dialog.querySelectorAll('input, select');
    inputs.forEach(input => {
      input.addEventListener('focus', () => {
        (input as HTMLElement).style.borderColor = '#4CAF50';
        (input as HTMLElement).style.boxShadow = '0 0 0 3px rgba(76, 175, 80, 0.1)';
        (input as HTMLElement).style.backgroundColor = '#ffffff';
      });
      input.addEventListener('blur', () => {
        (input as HTMLElement).style.borderColor = '#e0e0e0';
        (input as HTMLElement).style.boxShadow = 'none';
        (input as HTMLElement).style.backgroundColor = '#f8f9fa';
      });
    });
    
    // Set up trade selection preview
    const tradeSelect = dialog.querySelector('#trade') as HTMLSelectElement;
    const colorPreview = dialog.querySelector('#tradeColorPreview') as HTMLElement;
    const colorSwatch = dialog.querySelector('#tradeColorSwatch') as HTMLElement;
    const tradeName = dialog.querySelector('#tradeName') as HTMLElement;
    
    if (tradeSelect && colorPreview && colorSwatch && tradeName) {
      tradeSelect.addEventListener('change', () => {
        const selectedOption = tradeSelect.options[tradeSelect.selectedIndex];
        const tradeId = selectedOption.value;
        
        if (tradeId) {
          const trade = Trades.getTradeById(tradeId);
          if (trade) {
            colorSwatch.style.backgroundColor = trade.color;
            tradeName.textContent = trade.name;
            colorPreview.style.backgroundColor = `${trade.color}15`; // Very light background
            colorPreview.style.border = `1px solid ${trade.color}30`;
            colorPreview.style.display = 'flex';
          }
        } else {
          colorPreview.style.display = 'none';
        }
      });
    }

    // Set today as the default date
    const today = new Date();
    const dateInput = dialog.querySelector('#startDate') as HTMLInputElement;
    dateInput.value = today.toISOString().split('T')[0];

    // Add event listeners
    const cancelBtn = dialog.querySelector('#cancelBtn');
    const addBtn = dialog.querySelector('#addBtn');
    const addAndCreateBtn = dialog.querySelector('#addAndCreateBtn');
    
    // Close dialog when clicking overlay
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        // Animate close
        dialog.style.transform = 'translateY(10px)';
        dialog.style.opacity = '0';
        overlay.style.opacity = '0';
        
        setTimeout(() => {
          document.body.removeChild(overlay);
        }, 200);
      }
    });

    // Add hover effects for buttons
    cancelBtn?.addEventListener('mouseover', () => {
      (cancelBtn as HTMLElement).style.backgroundColor = '#f8f8f8';
    });
    cancelBtn?.addEventListener('mouseout', () => {
      (cancelBtn as HTMLElement).style.backgroundColor = 'white';
    });

    addAndCreateBtn?.addEventListener('mouseover', () => {
      (addAndCreateBtn as HTMLElement).style.backgroundColor = '#f0fff0';
    });
    addAndCreateBtn?.addEventListener('mouseout', () => {
      (addAndCreateBtn as HTMLElement).style.backgroundColor = 'white';
    });

    addBtn?.addEventListener('mouseover', () => {
      (addBtn as HTMLElement).style.backgroundColor = '#43a047';
    });
    addBtn?.addEventListener('mouseout', () => {
      (addBtn as HTMLElement).style.backgroundColor = '#4CAF50';
    });

    // Set button click handlers
    cancelBtn?.addEventListener('click', () => {
      // Animate close
      dialog.style.transform = 'translateY(10px)';
      dialog.style.opacity = '0';
      overlay.style.opacity = '0';
      
      setTimeout(() => {
        document.body.removeChild(overlay);
      }, 200);
    });

    // Helper function to create a task from the form values
    const createTaskFromForm = () => {
      const name = (dialog.querySelector('#taskName') as HTMLInputElement).value;
      const startDateValue = (dialog.querySelector('#startDate') as HTMLInputElement).value;
      const duration = parseInt((dialog.querySelector('#duration') as HTMLInputElement).value);
      const crewSize = parseInt((dialog.querySelector('#crewSize') as HTMLInputElement).value);
      const tradeId = (dialog.querySelector('#trade') as HTMLSelectElement).value;
      const swimlaneId = (dialog.querySelector('#zone') as HTMLSelectElement).value;
      
      // Get weekend work preferences
      const workOnSaturday = (dialog.querySelector('#workOnSaturday') as HTMLInputElement).checked;
      const workOnSunday = (dialog.querySelector('#workOnSunday') as HTMLInputElement).checked;
      
      // Get the color from the selected trade
      let color = '#3b82f6'; // Default blue color
      if (tradeId) {
        const trade = Trades.getTradeById(tradeId);
        if (trade) {
          color = trade.color;
        }
      }

      if (!name || !startDateValue || !duration || !crewSize) {
        // Highlight missing fields with a subtle shake animation
        const shake = [
          { transform: 'translateX(0)' },
          { transform: 'translateX(-4px)' },
          { transform: 'translateX(4px)' },
          { transform: 'translateX(-3px)' },
          { transform: 'translateX(3px)' },
          { transform: 'translateX(0)' }
        ];
        
        if (!name) {
          const input = dialog.querySelector('#taskName') as HTMLElement;
          input.style.borderColor = '#ff5252';
          input.animate(shake, { duration: 400, easing: 'ease-in-out' });
        }
        if (!duration) {
          const input = dialog.querySelector('#duration') as HTMLElement;
          input.style.borderColor = '#ff5252';
          input.animate(shake, { duration: 400, easing: 'ease-in-out' });
        }
        if (!crewSize) {
          const input = dialog.querySelector('#crewSize') as HTMLElement;
          input.style.borderColor = '#ff5252';
          input.animate(shake, { duration: 400, easing: 'ease-in-out' });
        }
        
        return null;
      }

      return {
        id: Date.now().toString(),
        name,
        startDate: startDateValue ? new Date(startDateValue) : new Date(),
        duration,
        crewSize,
        color,
        tradeId,
        swimlaneId,
        workOnSaturday,
        workOnSunday
      };
    };

    addBtn?.addEventListener('click', () => {
      const taskConfig = createTaskFromForm();
      
      if (taskConfig) {
        this.addTask(taskConfig);

        // Animate close
        dialog.style.transform = 'translateY(10px)';
        dialog.style.opacity = '0';
        overlay.style.opacity = '0';
        
        setTimeout(() => {
          document.body.removeChild(overlay);
        }, 200);
      }
    });

    // Add & Create Another button
    addAndCreateBtn?.addEventListener('click', () => {
      const taskConfig = createTaskFromForm();
      
      if (taskConfig) {
        this.addTask(taskConfig);
        
        // Reset name field only and keep other settings
        const nameInput = dialog.querySelector('#taskName') as HTMLInputElement;
        nameInput.value = '';
        nameInput.focus();
        
        // Show success feedback
        const successToast = document.createElement('div');
        successToast.style.position = 'absolute';
        successToast.style.top = '10px';
        successToast.style.left = '50%';
        successToast.style.transform = 'translateX(-50%)';
        successToast.style.backgroundColor = '#4CAF50';
        successToast.style.color = 'white';
        successToast.style.padding = '8px 16px';
        successToast.style.borderRadius = '4px';
        successToast.style.fontSize = '14px';
        successToast.style.fontWeight = '500';
        successToast.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        successToast.textContent = `Task "${taskConfig.name}" added. Create another?`;
        
        dialog.appendChild(successToast);
        
        setTimeout(() => {
          successToast.style.opacity = '0';
          setTimeout(() => {
            dialog.removeChild(successToast);
          }, 300);
        }, 2000);
      }
    });

    // Add dialog to overlay with entrance animation
    overlay.appendChild(dialog);
    dialog.style.transform = 'translateY(20px)';
    dialog.style.opacity = '0';
    
    // Add overlay to the page
    document.body.appendChild(overlay);
    
    // Trigger entrance animation
    setTimeout(() => {
      dialog.style.transform = 'translateY(0)';
      dialog.style.opacity = '1';
    }, 10);

    // Focus the task name input
    (dialog.querySelector('#taskName') as HTMLInputElement).focus();
  }

  showSwimlaneDialog() {
    console.log('showSwimlaneDialog method called'); // Debug log
    
    // Create dialog overlay
    const overlay = document.createElement('div');
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.width = '100%';
    overlay.style.height = '100%';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.25)';
    overlay.style.backdropFilter = 'blur(4px)';
    overlay.style.zIndex = '1000';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.transition = 'opacity 0.2s ease';

    // Create dialog container
    const dialog = document.createElement('div');
    dialog.style.position = 'relative';
    dialog.style.backgroundColor = 'white';
    dialog.style.padding = '28px';
    dialog.style.borderRadius = '16px';
    dialog.style.boxShadow = '0 10px 25px rgba(0,0,0,0.08)';
    dialog.style.width = '540px';
    dialog.style.maxWidth = '90vw';
    dialog.style.maxHeight = '90vh';
    dialog.style.overflowY = 'auto';
    dialog.style.transition = 'transform 0.2s ease';
    dialog.style.transform = 'translateY(0)';
    dialog.style.opacity = '1';
    dialog.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

    // Create dialog content
    dialog.innerHTML = `
      <div>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 24px;">
          <div style="font-size: 24px;">🏊</div>
          <h2 style="margin: 0; color: #1a1a1a; font-size: 20px; font-weight: 600; letter-spacing: -0.2px;">Edit Swimlanes</h2>
        </div>
        
        <div id="swimlaneList" style="margin-bottom: 24px;">
          ${this.taskManager.swimlanes.map((lane, index) => `
            <div class="swimlane-item" style="display: flex; align-items: center; margin-bottom: 12px; padding: 14px; background: #f8f9fa; border-radius: 8px; border: 1px solid #f0f0f0;">
              <div style="width: 16px; height: 16px; border-radius: 4px; margin-right: 12px; background-color: ${lane.color}"></div>
              <input type="text" value="${lane.name}" 
                     data-lane-id="${lane.id}" 
                     class="swimlane-name-input"
                     style="flex-grow: 1; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 6px; font-size: 14px; background: white; transition: all 0.2s ease;">
              ${index > 0 ? `
                <button class="move-up-btn" data-lane-id="${lane.id}"
                        style="padding: 8px; margin-left: 4px; background: none; border: none; cursor: pointer; color: #666; opacity: 0.8; transition: opacity 0.2s ease;">
                  ⬆️
                </button>
              ` : '<div style="width: 36px;"></div>'}
              ${index < this.taskManager.swimlanes.length - 1 ? `
                <button class="move-down-btn" data-lane-id="${lane.id}"
                        style="padding: 8px; margin-left: 4px; background: none; border: none; cursor: pointer; color: #666; opacity: 0.8; transition: opacity 0.2s ease;">
                  ⬇️
                </button>
              ` : '<div style="width: 36px;"></div>'}
              <button class="delete-lane-btn" data-lane-id="${lane.id}"
                      style="padding: 8px; margin-left: 4px; background: none; border: none; cursor: pointer; color: #666; opacity: 0.8; transition: opacity 0.2s ease;">
                🗑️
              </button>
            </div>
          `).join('')}
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 24px; padding-top: 20px; border-top: 1px solid #f0f0f0;">
          <button id="cancelBtn" style="padding: 10px 16px; border: 1px solid #e0e0e0; border-radius: 8px; background: white; color: #555; cursor: pointer; font-size: 14px; font-weight: 500; font-family: inherit; transition: all 0.2s ease;">Cancel</button>
          <button id="addBtn" style="padding: 10px 16px; border: 1px solid #e0e0e0; border-radius: 8px; background: #f8f9fa; color: #333; cursor: pointer; font-size: 14px; font-weight: 500; font-family: inherit; transition: all 0.2s ease;">Add Swimlane</button>
          <button id="saveBtn" style="padding: 10px 16px; border: none; border-radius: 8px; background: #2196F3; color: white; cursor: pointer; font-size: 14px; font-weight: 500; font-family: inherit; transition: all 0.2s ease;">Save Changes</button>
        </div>
      </div>
    `;

    // Add event listeners
    const cancelBtn = dialog.querySelector('#cancelBtn');
    const addBtn = dialog.querySelector('#addBtn');
    const saveBtn = dialog.querySelector('#saveBtn');
    
    // Close dialog when clicking overlay
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        // Animate close
        dialog.style.transform = 'translateY(10px)';
        dialog.style.opacity = '0';
        overlay.style.opacity = '0';
        
        setTimeout(() => {
          document.body.removeChild(overlay);
        }, 200);
      }
    });

    // Add hover effects for buttons
    [cancelBtn, addBtn, saveBtn].forEach(btn => {
      if (!btn) return;
      
      btn.addEventListener('mouseover', () => {
        if (btn.id === 'cancelBtn') {
          (btn as HTMLElement).style.backgroundColor = '#f8f8f8';
        } else if (btn.id === 'addBtn') {
          (btn as HTMLElement).style.backgroundColor = '#f0f0f0';
        } else {
          (btn as HTMLElement).style.backgroundColor = '#1976d2';
        }
      });
      
      btn.addEventListener('mouseout', () => {
        if (btn.id === 'cancelBtn') {
          (btn as HTMLElement).style.backgroundColor = 'white';
        } else if (btn.id === 'addBtn') {
          (btn as HTMLElement).style.backgroundColor = '#f8f9fa';
        } else {
          (btn as HTMLElement).style.backgroundColor = '#2196F3';
        }
      });
    });

    // Add hover effects for icon buttons
    const iconButtons = dialog.querySelectorAll('.move-up-btn, .move-down-btn, .delete-lane-btn');
    iconButtons.forEach(btn => {
      btn.addEventListener('mouseover', () => {
        (btn as HTMLElement).style.opacity = '1';
      });
      
      btn.addEventListener('mouseout', () => {
        (btn as HTMLElement).style.opacity = '0.8';
      });
    });

    // Handle swimlane name changes
    const nameInputs = dialog.querySelectorAll('.swimlane-name-input');
    nameInputs.forEach(input => {
      // Add focus/blur effects
      input.addEventListener('focus', () => {
        (input as HTMLElement).style.borderColor = '#2196F3';
        (input as HTMLElement).style.boxShadow = '0 0 0 3px rgba(33, 150, 243, 0.1)';
        (input as HTMLElement).style.backgroundColor = '#ffffff';
      });
      
      input.addEventListener('blur', () => {
        (input as HTMLElement).style.borderColor = '#e0e0e0';
        (input as HTMLElement).style.boxShadow = 'none';
        (input as HTMLElement).style.backgroundColor = '#ffffff';
      });
      
      // Update lane name on input
      input.addEventListener('input', (e) => {
        const target = e.target as HTMLInputElement;
        const laneId = target.dataset.laneId;
        if (laneId) {
          const lane = this.taskManager.swimlanes.find(l => l.id === laneId);
          if (lane) {
            lane.name = target.value;
          }
        }
      });
    });

    // Handle move up/down buttons
    const moveUpBtns = dialog.querySelectorAll('.move-up-btn');
    const moveDownBtns = dialog.querySelectorAll('.move-down-btn');
    
    moveUpBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const laneId = (btn as HTMLElement).dataset.laneId;
        if (laneId) {
          const index = this.taskManager.swimlanes.findIndex(l => l.id === laneId);
          if (index > 0) {
            // Swap positions
            const temp = this.taskManager.swimlanes[index];
            this.taskManager.swimlanes[index] = this.taskManager.swimlanes[index - 1];
            this.taskManager.swimlanes[index - 1] = temp;
            
            // Update Y positions
            this.taskManager.swimlanes.forEach((lane, i) => {
              lane.y = i * this.taskManager.SWIMLANE_HEIGHT;
            });
            
            // Refresh dialog
            this.showSwimlaneDialog();
            document.body.removeChild(overlay);
          }
        }
      });
    });
    
    moveDownBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const laneId = (btn as HTMLElement).dataset.laneId;
        if (laneId) {
          const index = this.taskManager.swimlanes.findIndex(l => l.id === laneId);
          if (index < this.taskManager.swimlanes.length - 1) {
            // Swap positions
            const temp = this.taskManager.swimlanes[index];
            this.taskManager.swimlanes[index] = this.taskManager.swimlanes[index + 1];
            this.taskManager.swimlanes[index + 1] = temp;
            
            // Update Y positions
            this.taskManager.swimlanes.forEach((lane, i) => {
              lane.y = i * this.taskManager.SWIMLANE_HEIGHT;
            });
            
            // Refresh dialog
            this.showSwimlaneDialog();
            document.body.removeChild(overlay);
          }
        }
      });
    });

    // Handle delete buttons
    const deleteBtns = dialog.querySelectorAll('.delete-lane-btn');
    deleteBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const laneId = (btn as HTMLElement).dataset.laneId;
        if (laneId) {
          // Don't allow deleting if there's only one swimlane
          if (this.taskManager.swimlanes.length <= 1) {
            alert('Cannot delete the last swimlane');
            return;
          }
          
          // Check if swimlane has tasks
          const lane = this.taskManager.swimlanes.find(l => l.id === laneId);
          if (lane && lane.tasks.length > 0) {
            alert('Cannot delete swimlane with tasks');
            return;
          }
          
          // Remove swimlane
          const index = this.taskManager.swimlanes.findIndex(l => l.id === laneId);
          this.taskManager.swimlanes.splice(index, 1);
          
          // Update Y positions
          this.taskManager.swimlanes.forEach((lane, i) => {
            lane.y = i * this.taskManager.SWIMLANE_HEIGHT;
          });
          
          // Refresh dialog
          this.showSwimlaneDialog();
          document.body.removeChild(overlay);
        }
      });
    });

    cancelBtn?.addEventListener('click', () => {
      // Animate close
      dialog.style.transform = 'translateY(10px)';
      dialog.style.opacity = '0';
      overlay.style.opacity = '0';
      
      setTimeout(() => {
        document.body.removeChild(overlay);
      }, 200);
    });

    addBtn?.addEventListener('click', () => {
      const id = `floor${this.taskManager.swimlanes.length + 1}`;
      const name = `FLOOR ${this.taskManager.swimlanes.length + 1}`;
      const colors = ['#4338ca', '#0891b2', '#059669', '#7c3aed', '#c026d3', '#db2777'];
      const color = colors[this.taskManager.swimlanes.length % colors.length];
      
      this.taskManager.addSwimlane(id, name, color);
      
      // Refresh dialog
      this.showSwimlaneDialog();
      document.body.removeChild(overlay);
    });

    saveBtn?.addEventListener('click', () => {
      // Animate close
      dialog.style.transform = 'translateY(10px)';
      dialog.style.opacity = '0';
      overlay.style.opacity = '0';
      
      setTimeout(() => {
        document.body.removeChild(overlay);
      }, 200);
    });

    // Add dialog to overlay with entrance animation
    overlay.appendChild(dialog);

    // Add overlay to body
    document.body.appendChild(overlay);

    // Trigger entrance animation
    setTimeout(() => {
      dialog.style.transform = 'translateY(0)';
      dialog.style.opacity = '1';
    }, 10);
  }

  exportToPDF() {
    console.log('exportToPDF method called'); // Debug log
    // Create new PDF document in landscape mode
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });

    // Set font and styles
    pdf.setFont('helvetica');
    
    // Calculate dimensions
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    const timelineStartY = 30;
    const labelWidth = 50; // Width for task labels
    const chartStartX = margin + labelWidth;
    const chartWidth = pageWidth - chartStartX - margin;
    const rowHeight = 7;
    const footerHeight = 15; // Space reserved for page footer/legend
    
    // Get date range
    const startDate = new Date(Math.min(...this.taskManager.getAllTasks().map(t => t.startDate.getTime())));
    const endDate = new Date(Math.max(...this.taskManager.getAllTasks().map(t => t.getEndDate().getTime())));
    const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const dayWidth = chartWidth / totalDays;

    // Page specific variables
    let currentY = timelineStartY + 5;
    let pageNum = 1;
    let totalPages = 0; // Will be calculated after we process all swimlanes
    
    // Function to add header and timeline to a page
    const addPageHeaderAndTimeline = () => {
      // Add title and date
      const today = new Date();
      pdf.setFontSize(16);
      pdf.text('Construction Schedule', 15, 15);
      pdf.setFontSize(8);
      pdf.text(`Generated: ${today.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })}`, 15, 20);
      
      // Draw timeline header
      pdf.setFontSize(7);
      pdf.setDrawColor(200, 200, 200);
      pdf.setLineWidth(0.1);

      // Draw month labels and grid
      let currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const x = chartStartX + (((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) * dayWidth);
        
        // Draw vertical grid line
        pdf.setDrawColor(200, 200, 200);
        pdf.line(x, timelineStartY, x, pageHeight - margin);

        // First of month label
        if (currentDate.getDate() === 1 || currentDate.getTime() === startDate.getTime()) {
          pdf.setFontSize(8);
          pdf.setTextColor(0, 0, 0);
          pdf.text(currentDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }), 
            x, timelineStartY - 3, { align: 'center' });
        }

        // Day label and grid
        pdf.setFontSize(6);
        pdf.text(currentDate.getDate().toString(), x, timelineStartY - 1, { align: 'center' });

        // Weekend highlighting
        if (currentDate.getDay() === 0 || currentDate.getDay() === 6) {
          pdf.setFillColor(245, 245, 245);
          pdf.rect(x, timelineStartY, dayWidth, pageHeight - timelineStartY - margin, 'F');
        }

        // Advance to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Reset currentY position to start drawing swimlanes
      currentY = timelineStartY + 5;
    };
    
    // Function to add page footer
    const addPageFooter = (isLastPage = false) => {
      // Add pagination at bottom right
      const footerY = pageHeight - 5;
      pdf.setFontSize(8);
      pdf.text(`Page ${pageNum}${totalPages > 0 ? ' of ' + totalPages : ''}`, pageWidth - margin, footerY, { align: 'right' });
      
      // Add legend at the bottom if it's the last Gantt chart page
      if (isLastPage) {
        const legendY = pageHeight - 10;
        pdf.setFontSize(7);
        pdf.text('Trades:', margin, legendY);
        
        this.trades.forEach((trade, index) => {
          const x = margin + 20 + (index * 25);
          const rgb = this.hexToRGB(trade.color);
          pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
          pdf.rect(x, legendY - 3, 3, 3, 'F');
          pdf.setTextColor(0, 0, 0);
          pdf.text(trade.name, x + 5, legendY);
        });
      }
    };
    
    // Function to check if there's enough space for a swimlane
    const hasEnoughSpaceForSwimlane = (swimlane: any) => {
      // Calculate required height for this swimlane
      const headerHeight = rowHeight * 1.5;
      const tasksHeight = swimlane.tasks.length * rowHeight;
      const spaceHeight = rowHeight; // Space after swimlane
      const requiredHeight = headerHeight + tasksHeight + spaceHeight;
      
      // Check if we have enough space on current page
      return (currentY + requiredHeight < pageHeight - footerHeight);
    };
    
    // Start the first page
    addPageHeaderAndTimeline();
    
    // First pass: calculate how many pages we'll need
    // This is a simulation to determine the total page count
    let simulatedY = timelineStartY + 5;
    let simulatedPageCount = 1;
    
    this.taskManager.swimlanes.forEach((swimlane) => {
      // Calculate required height for this swimlane
      const headerHeight = rowHeight * 1.5;
      const tasksHeight = swimlane.tasks.length * rowHeight;
      const spaceHeight = rowHeight; // Space after swimlane
      const requiredHeight = headerHeight + tasksHeight + spaceHeight;
      
      // Check if we need a new page
      if (simulatedY + requiredHeight >= pageHeight - footerHeight) {
        simulatedPageCount++;
        simulatedY = timelineStartY + 5;
      }
      
      simulatedY += requiredHeight;
    });
    
    // +1 for the histogram page
    totalPages = simulatedPageCount + 1;
    
    // Draw swimlanes and tasks
    this.taskManager.swimlanes.forEach((swimlane, laneIndex) => {
      // Check if we need a new page
      if (!hasEnoughSpaceForSwimlane(swimlane)) {
        // Add footer to current page
        addPageFooter(false);
        
        // Add a new page
        pdf.addPage('landscape');
        pageNum++;
        
        // Add header and timeline to the new page
        addPageHeaderAndTimeline();
      }
      
      // Draw swimlane header
      pdf.setFillColor(245, 245, 245);
      pdf.rect(margin, currentY, pageWidth - 2 * margin, rowHeight * 1.5, 'F');
      
      pdf.setFontSize(8);
      pdf.setTextColor(0, 0, 0);
      pdf.text(swimlane.name, margin + 2, currentY + 5);
      currentY += rowHeight * 1.5;

      // Sort tasks by start date
      const sortedTasks = [...swimlane.tasks].sort((a, b) => 
        a.startDate.getTime() - b.startDate.getTime()
      );

      // Draw tasks
      sortedTasks.forEach((task, taskIndex) => {
        // Calculate task position
        const taskX = chartStartX + (((task.startDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) * dayWidth);
        const taskWidth = task.duration * dayWidth;

        // Draw task bar
        const rgb = this.hexToRGB(task.color);
        pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
        pdf.rect(taskX, currentY, taskWidth, rowHeight - 1, 'F');

        // Add task label in the left margin
        pdf.setFontSize(6);
        pdf.setTextColor(0, 0, 0);
        pdf.text(task.name, margin + 2, currentY + 4, {
          maxWidth: labelWidth - 4
        });

        // Add task details inside the bar if there's room
        if (taskWidth > 15) {
          pdf.setTextColor(0, 0, 0);
          const taskLabel = `${task.duration}d, ${task.crewSize} crew`;
          pdf.text(taskLabel, taskX + 2, currentY + 4, {
            maxWidth: taskWidth - 4
          });
        }

        // Draw dependencies
        if (task.dependencies.length > 0) {
          pdf.setDrawColor(180, 180, 180);
          pdf.setLineWidth(0.1);
          
          task.dependencies.forEach(depId => {
            const depTask = this.taskManager.getTask(depId);
            if (depTask) {
              const depEndX = chartStartX + (((depTask.getEndDate().getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) * dayWidth);
              const depY = currentY + rowHeight / 2;
              
              // Draw arrow
              pdf.line(depEndX, depY, taskX, depY);
              
              // Draw arrowhead
              const arrowSize = 1;
              pdf.line(taskX, depY, taskX - arrowSize, depY - arrowSize);
              pdf.line(taskX, depY, taskX - arrowSize, depY + arrowSize);
            }
          });
        }

        currentY += rowHeight;
      });

      currentY += rowHeight; // Add space between swimlanes
    });

    // Add footer to last Gantt chart page
    addPageFooter(true);

    // Add resource histogram on a new page (always the last page)
    pdf.addPage('landscape');
    pageNum++;
    
    // Add title to histogram page
    pdf.setFontSize(16);
    pdf.text('Resource Utilization', 15, 15);
    pdf.setFontSize(8);
    pdf.text('Daily crew size by trade', 15, 20);
    
    // Calculate resource data from tasks
    this.resourceHistogram.calculateResources(this.taskManager.getAllTasks());
    
    // Set histogram dimensions
    const histogramMargin = 15;
    const histogramStartY = 30;
    const histogramHeight = 100;
    const histogramWidth = pageWidth - 2 * histogramMargin;
    
    // Draw background
    pdf.setFillColor(245, 245, 245);
    pdf.rect(histogramMargin, histogramStartY, histogramWidth, histogramHeight, 'F');
    
    // Draw horizontal lines and labels
    const lineCount = 5;
    pdf.setDrawColor(220, 220, 220);
    pdf.setTextColor(100, 100, 100);
    
    // Find the maximum resource value
    const allTasks = this.taskManager.getAllTasks();
    let maxResource = 0;
    
    // Create daily resources map
    const dailyResourceMap = new Map<string, Map<string, number>>();
    
    // Populate daily resources
    allTasks.forEach(task => {
      const taskStart = new Date(task.startDate);
      taskStart.setHours(0, 0, 0, 0);
      
      const taskEnd = new Date(task.getEndDate());
      taskEnd.setHours(0, 0, 0, 0);
      
      let currentDate = new Date(taskStart);
      
      while (currentDate <= taskEnd) {
        // Skip weekends
        if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
          const dateKey = currentDate.toISOString().split('T')[0];
          
          if (!dailyResourceMap.has(dateKey)) {
            dailyResourceMap.set(dateKey, new Map<string, number>());
          }
          
          const colorMap = dailyResourceMap.get(dateKey)!;
          const currentValue = colorMap.get(task.color) || 0;
          colorMap.set(task.color, currentValue + task.crewSize);
          
          // Update max resource
          let totalForDay = 0;
          colorMap.forEach(value => totalForDay += value);
          maxResource = Math.max(maxResource, totalForDay);
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    // Draw grid lines
    for (let i = 0; i <= lineCount; i++) {
      const y = histogramStartY + histogramHeight - (i / lineCount) * histogramHeight;
      const value = Math.round((i / lineCount) * maxResource);
      
      // Draw line
      pdf.setLineWidth(0.1);
      pdf.line(histogramMargin, y, histogramMargin + histogramWidth, y);
      
      // Draw label
      pdf.setFontSize(7);
      pdf.text(value.toString(), histogramMargin - 5, y, { align: 'right' });
    }
    
    // Draw day labels along x-axis
    const dayCount = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    const barWidth = histogramWidth / dayCount;
    
    let currentDay = new Date(startDate);
    for (let i = 0; i < dayCount; i++) {
      const x = histogramMargin + i * barWidth;
      const dateKey = currentDay.toISOString().split('T')[0];
      
      // Draw date label for first of month or first date
      if (currentDay.getDate() === 1 || i === 0) {
        pdf.setFontSize(6);
        pdf.setTextColor(0, 0, 0);
        pdf.text(currentDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          x + barWidth / 2, histogramStartY + histogramHeight + 5, { align: 'center' });
      }
      
      // Weekend highlighting
      if (currentDay.getDay() === 0 || currentDay.getDay() === 6) {
        pdf.setFillColor(230, 230, 230);
        pdf.rect(x, histogramStartY, barWidth, histogramHeight, 'F');
      }
      
      // Draw stacked bars
      if (dailyResourceMap.has(dateKey)) {
        const colorMap = dailyResourceMap.get(dateKey)!;
        let currentHeight = 0;
        
        // Sort color entries for consistent rendering
        const sortedColors = Array.from(colorMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]));
        
        sortedColors.forEach(([color, value]) => {
          const barHeight = (value / maxResource) * histogramHeight;
          const rgb = this.hexToRGB(color);
          
          pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
          pdf.rect(
            x, 
            histogramStartY + histogramHeight - currentHeight - barHeight, 
            barWidth, 
            barHeight, 
            'F'
          );
          
          currentHeight += barHeight;
        });
      }
      
      // Move to next day
      currentDay.setDate(currentDay.getDate() + 1);
    }
    
    // Add footer to histogram page (last page)
    pdf.setFontSize(8);
    pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });

    // Save the PDF
    pdf.save('construction-schedule.pdf');
  }

  private hexToRGB(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  }

  // Add a method to open the Options sidebar
  showOptions() {
    this.sidebar.show('options');
  }

  // Add the exportToXer method
  exportToXer(): void {
    console.log('XER export functionality has been temporarily disabled.');
    alert('XER export functionality has been temporarily disabled.');
    // Removed XER export implementation temporarily
  }

  // Load data from JSON string
  loadFromJSON(jsonString: string): void {
    try {
      const data = JSON.parse(jsonString);
      
      // Clear existing tasks
      const existingTasks = this.taskManager.getAllTasks();
      existingTasks.forEach(task => {
        this.removeTask(task.id);
      });
      
      // Load settings if available
      if (data.settings) {
        this.areDependenciesVisible = data.settings.areDependenciesVisible !== undefined 
          ? data.settings.areDependenciesVisible 
          : true;
      }
      
      // Load tasks
      if (data.tasks) {
        data.tasks.forEach((taskData: any) => {
          this.addTask({
            id: taskData.id || generateUUID(),
            name: taskData.name || taskData.title || 'Untitled Task',
            startDate: new Date(taskData.startDate),
            duration: taskData.duration || 3,
            crewSize: taskData.crewSize || 1,
            color: taskData.color || '#3B82F6',
            tradeId: taskData.tradeId || taskData.trade || '',
            dependencies: taskData.dependencies || []
          });
        });
        console.log(`Loaded ${data.tasks.length} tasks from JSON`);
      }
    } catch (err) {
      console.error('Error parsing or loading JSON:', err);
      throw err;
    }
  }
  
  // Export data to JSON format
  exportToJSON(): string {
    const tasks = this.taskManager.getAllTasks();
    const data = {
      tasks: tasks,
      settings: {
        showGrid: true,
        areDependenciesVisible: this.areDependenciesVisible,
        tradeVisibility: {}
      },
      version: '1.0.0'
    };
    
    return JSON.stringify(data);
  }
  
  // Toggle dependency visibility
  toggleDependencyVisibility(): void {
    this.areDependenciesVisible = !this.areDependenciesVisible;
    this.render();
  }

  // Add this method after disableTouchSupport() and enableTouchSupport() methods
  
  /**
   * Toggle debug logging mode
   * @returns The new debug mode state (true = enabled, false = disabled)
   */
  public toggleDebugLogging(): boolean {
    return Logger.toggleDebugMode();
  }
  
  /**
   * Enable debug logging
   */
  public enableDebugLogging(): void {
    Logger.enableDebugMode();
  }
  
  /**
   * Disable debug logging
   */
  public disableDebugLogging(): void {
    Logger.disableDebugMode();
  }
} 
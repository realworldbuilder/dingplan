import { Trades, Trade } from './Trades';
import { v4 as uuidv4 } from 'uuid';

// Define missing interfaces
export interface TaskMaterial {
  name: string;
  quantity: number;
  unit: string;
  cost?: number;
}

export interface SubTask {
  id: string;
  name: string;
  completed: boolean;
}

export interface TaskConfig {
  id?: string;
  name: string;
  startDate: Date;
  duration: number; // in business days
  crewSize?: number;
  color?: string;
  tradeId?: string; // ID of the trade this task belongs to
  dependencies?: string[]; // IDs of tasks that must complete before this one can start
  swimlaneId?: string;
  isMillestone?: boolean;
  iconType?: string;
  tags?: string[];
  priority?: 'low' | 'medium' | 'high';
  status?: 'not-started' | 'in-progress' | 'completed' | 'blocked';
  notes?: string;
  showDetails?: boolean;
  assignees?: string[];
  materials?: TaskMaterial[];
  cost?: number;
  progress?: number;
  subtasks?: SubTask[];
  xerTaskId?: string; // ID used when exporting to XER format
  workOnSaturday?: boolean; // Whether this task includes Saturday as a workday
  workOnSunday?: boolean; // Whether this task includes Sunday as a workday
}

// Generated browser-compatible UUID
function generateUUID(): string {
  return self.crypto && self.crypto.randomUUID ? 
    self.crypto.randomUUID() : 
    'task-' + Math.random().toString(36).substring(2, 15);
}

export class Task {
  public id: string;
  public name: string;
  public startDate: Date;
  public duration: number;
  public crewSize: number;
  public color: string;
  public dependencies: string[] = [];
  public swimlaneId: string | null = null;
  public tradeId: string | null = null;
  public isMilestone: boolean = false;
  public iconType: string | null = null;
  public tags: string[] = [];
  public priority: 'low' | 'medium' | 'high' = 'medium';
  public status: 'not-started' | 'in-progress' | 'completed' | 'blocked' = 'not-started';
  public notes: string = '';
  public showDetails: boolean = false;
  public assignees: string[] = [];
  public materials: TaskMaterial[] = [];
  public cost: number = 0;
  public progress: number = 0;
  public subtasks: SubTask[] = [];
  public customFields: Map<string, any> = new Map();
  public workOnSaturday: boolean = false;
  public workOnSunday: boolean = false;
  public height: number = 40;
  private isHovered: boolean = false;
  
  // Property for XER export
  xerTaskId?: string;

  // New properties
  public successors: string[] = [];
  public description: string = '';
  public assignee: string = '';
  public priorityNumber: number = 1;
  public wbsId?: string;
  public resourceUrl: string = '';
  public _positionRef: { x: number, y: number } | null = null;
  
  constructor(config: TaskConfig) {
    this.id = config.id || self.crypto.randomUUID ? self.crypto.randomUUID() : 'task-' + Math.random().toString(36).substring(2, 15);
    this.name = config.name;
    this.startDate = config.startDate;
    this.duration = Math.max(1, config.duration);
    this.crewSize = config.crewSize || 1;
    this.color = config.color || '#3b82f6';
    this.dependencies = config.dependencies || [];
    this.swimlaneId = config.swimlaneId || null;
    this.tradeId = config.tradeId || null;
    this.isMilestone = config.isMillestone || false;
    this.iconType = config.iconType || null;
    this.tags = config.tags || [];
    this.priority = config.priority || 'medium';
    this.status = config.status || 'not-started';
    this.notes = config.notes || '';
    this.showDetails = config.showDetails || false;
    this.assignees = config.assignees || [];
    this.materials = config.materials || [];
    this.cost = config.cost || 0;
    this.progress = config.progress || 0;
    this.subtasks = config.subtasks || [];
    
    // Handle trade assignment
    if (this.tradeId) {
      const trade = Trades.getTradeById(this.tradeId);
      if (trade) {
        this.color = trade.color;
      }
    }
    
    // If tradeId is not specified but color is, try to find the trade by color
    if (!this.tradeId && this.color) {
      const trade = Trades.getTradeByColor(this.color);
      if (trade) {
        this.tradeId = trade.id;
      }
    }
    
    // Weekend work preferences
    this.workOnSaturday = config.workOnSaturday || false;
    this.workOnSunday = config.workOnSunday || false;
    
    // Adjust start date if it falls on a weekend
    this.adjustStartDate();
  }

  /**
   * Get the trade this task belongs to
   */
  getTrade(): Trade | undefined {
    if (this.tradeId) {
      return Trades.getTradeById(this.tradeId);
    }
    return Trades.getTradeByColor(this.color);
  }

  /**
   * Get the trade name for this task
   */
  getTradeName(): string {
    const trade = this.getTrade();
    return trade ? trade.name : '';
  }

  /**
   * Set the trade for this task
   */
  setTrade(tradeIdOrColor: string): void {
    const trade = Trades.getTrade(tradeIdOrColor);
    if (trade) {
      this.tradeId = trade.id;
      this.color = trade.color;
    }
  }

  static isWeekend(date: Date, workOnSaturday: boolean = false, workOnSunday: boolean = false): boolean {
    const day = date.getDay();
    // If working on Saturday, don't consider it a weekend
    // If working on Sunday, don't consider it a weekend
    return (day === 0 && !workOnSunday) || (day === 6 && !workOnSaturday);
  }

  private static addBusinessDays(date: Date, days: number, workOnSaturday: boolean = false, workOnSunday: boolean = false): Date {
    let result = new Date(date);
    let addedDays = 0;
    while (addedDays < days) {
      result.setDate(result.getDate() + 1);
      if (!Task.isWeekend(result, workOnSaturday, workOnSunday)) {
        addedDays++;
      }
    }
    return result;
  }

  getEndDate(): Date {
    return Task.addBusinessDays(this.startDate, this.duration, this.workOnSaturday, this.workOnSunday);
  }

  setHovered(hovered: boolean) {
    this.isHovered = hovered;
  }

  private getStatusIcon(): string {
    switch (this.status) {
      case 'completed': return '✓';
      case 'in-progress': return '►';
      case 'blocked': return '⚠';
      default: return '○';
    }
  }

  private drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
    ctx.shadowBlur = this.isHovered ? 12 : 8;
    ctx.shadowOffsetY = 2;
    
    // Draw shadow shape
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
    
    ctx.restore();
  }

  /**
   * Draw this task on the canvas
   */
  draw(ctx: CanvasRenderingContext2D, timeAxis: any, camera: any, isSelected: boolean = false) {
    try {
      const startX = timeAxis.dateToWorld(this.startDate);
      const endX = timeAxis.dateToWorld(this.getEndDate());
      
      // Optimization: Don't try to render zero-width tasks
      if (startX >= endX) return;
      
      const width = endX - startX;
      const height = this.getCurrentHeight();
      
      // Get the task position from our parent TaskManager
      if (!this._positionRef) return;
      const y = this._positionRef.y;
      
      // Simplified rendering when zoomed out too far
      const isZoomedOut = camera.zoom < 0.6;
      
      // Save context for future restore
      ctx.save();
      
      // Background
      const fillColor = this.color || '#3b82f6';
      ctx.fillStyle = fillColor;
      
      if (isZoomedOut) {
        // When zoomed out, just draw a simple rectangle without rounded corners
        ctx.fillRect(startX, y, width, height);
      } else {
        // Rounded corners and more detailed rendering when zoomed in
        const cornerRadius = 8;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(startX, y, width, height, cornerRadius);
        } else {
          // Fallback for browsers without roundRect
          const r = cornerRadius;
          ctx.moveTo(startX + r, y);
          ctx.lineTo(startX + width - r, y);
          ctx.arcTo(startX + width, y, startX + width, y + r, r);
          ctx.lineTo(startX + width, y + height - r);
          ctx.arcTo(startX + width, y + height, startX + width - r, y + height, r);
          ctx.lineTo(startX + r, y + height);
          ctx.arcTo(startX, y + height, startX, y + height - r, r);
          ctx.lineTo(startX, y + r);
          ctx.arcTo(startX, y, startX + r, y, r);
        }
        ctx.fill();
        
        // Only draw detailed elements when zoomed in enough
        if (camera.zoom > 0.8) {
          // Progress bar - only if progress is set
          if (this.progress > 0 && this.progress <= 100) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            const progressWidth = (width * this.progress) / 100;
            ctx.fillRect(startX, y, progressWidth, height);
          }
          
          // Text - task name
          if (width > 50 / camera.zoom) { // Only draw text if task is wide enough
            ctx.fillStyle = '#ffffff';
            ctx.font = `${14 / camera.zoom}px Arial`;
            ctx.textBaseline = 'middle';
            
            // Text position - centered vertically, padded horizontally
            const textX = startX + 5 / camera.zoom;
            const textY = y + height / 2;
            
            // Calculate available width for text
            const maxTextWidth = width - 10 / camera.zoom;
            
            // Truncate text with ellipsis if too long
            let taskName = this.name;
            if (ctx.measureText(taskName).width > maxTextWidth) {
              // Truncate and add ellipsis
              let truncated = taskName;
              while (ctx.measureText(truncated + '...').width > maxTextWidth && truncated.length > 0) {
                truncated = truncated.slice(0, -1);
              }
              taskName = truncated + '...';
            }
            
            ctx.fillText(taskName, textX, textY);
          }
        }
      }
      
      // Restore context
      ctx.restore();
    } catch (error) {
      console.error('Error drawing task:', error);
    }
  }

  // Utility method for drawing rounded rectangles when ctx.roundRect is not available
  private drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
  
  // Utility method for drawing rounded rectangles with rounded corners only at the top
  private drawRoundedRectTopOnly(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height);
    ctx.lineTo(x, y + height);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
  
  // Utility method for drawing rounded rectangles with rounded corners only at the bottom
  private drawRoundedRectBottomOnly(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width, y);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y);
    ctx.closePath();
  }

  // New helper method to truncate text if it's too long to fit
  private truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
    const ellipsis = '...';
    const ellipsisWidth = ctx.measureText(ellipsis).width;
    
    if (ctx.measureText(text).width <= maxWidth) {
      return text;
    }
    
    let truncated = text;
    while (ctx.measureText(truncated + ellipsis).width > maxWidth && truncated.length > 0) {
      truncated = truncated.slice(0, -1);
    }
    
    return truncated + ellipsis;
  }

  // Helper method to check if a point is inside the task card
  containsPoint(x: number, y: number, timeAxis: any, taskY: number): boolean {
    const startX = timeAxis.dateToWorld(this.startDate);
    const endX = timeAxis.dateToWorld(this.getEndDate());
    
    return x >= startX && x <= endX && 
           y >= taskY && y <= taskY + this.height;
  }

  getCurrentHeight(): number {
    return this.height;
  }

  // Utility methods for color manipulation
  private static adjustColor(color: string, factor: number): string {
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);

    // Adjust each component
    const adjustedR = Math.min(255, Math.max(0, Math.round(r * factor)));
    const adjustedG = Math.min(255, Math.max(0, Math.round(g * factor)));
    const adjustedB = Math.min(255, Math.max(0, Math.round(b * factor)));

    // Convert back to hex
    return `#${adjustedR.toString(16).padStart(2, '0')}${adjustedG.toString(16).padStart(2, '0')}${adjustedB.toString(16).padStart(2, '0')}`;
  }

  private static getContrastColor(hexcolor: string): string {
    // Convert hex to RGB
    const hex = hexcolor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    
    // Return black or white based on luminance
    return luminance > 0.5 ? '#000000' : '#FFFFFF';
  }

  // Adjust start date if it falls on a non-work day based on settings
  adjustStartDate(): void {
    // If start date is on weekend and not working on that day, move to next work day
    while (Task.isWeekend(this.startDate, this.workOnSaturday, this.workOnSunday)) {
      this.startDate.setDate(this.startDate.getDate() + 1);
    }
  }

  // Add method to get task width based on its duration
  getWidth(timeAxis?: any): number {
    if (timeAxis) {
      const startX = timeAxis.dateToWorld(this.startDate);
      const endX = timeAxis.dateToWorld(this.getEndDate());
      return Math.max(endX - startX, 80); // Ensure minimum width of 80 pixels
    }
    
    // If no timeAxis is provided, return a default minimum width
    return 80;
  }

  /**
   * Draw selection highlight for this task
   */
  drawSelectionHighlight(ctx: CanvasRenderingContext2D, timeAxis: any, camera: any) {
    try {
      // Calculate task bounds
      const startX = timeAxis.dateToWorld(this.startDate);
      const endX = timeAxis.dateToWorld(this.getEndDate());
      const width = endX - startX;
      const height = this.getCurrentHeight();
      
      // Get the task position from our parent reference
      if (!this._positionRef) return;
      const taskY = this._positionRef.y;

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
        ctx.roundRect(startX - 3 / camera.zoom, taskY - 3 / camera.zoom, 
          width + 6 / camera.zoom, height + 6 / camera.zoom, radius);
      } else {
        // Fallback for browsers that don't support roundRect
        const rectX = startX - 3 / camera.zoom;
        const rectY = taskY - 3 / camera.zoom;
        const rectW = width + 6 / camera.zoom;
        const rectH = height + 6 / camera.zoom;
        const r = radius;
        
        ctx.beginPath();
        ctx.moveTo(rectX + r, rectY);
        ctx.lineTo(rectX + rectW - r, rectY);
        ctx.quadraticCurveTo(rectX + rectW, rectY, rectX + rectW, rectY + r);
        ctx.lineTo(rectX + rectW, rectY + rectH - r);
        ctx.quadraticCurveTo(rectX + rectW, rectY + rectH, rectX + rectW - r, rectY + rectH);
        ctx.lineTo(rectX + r, rectY + rectH);
        ctx.quadraticCurveTo(rectX, rectY + rectH, rectX, rectY + rectH - r);
        ctx.lineTo(rectX, rectY + r);
        ctx.quadraticCurveTo(rectX, rectY, rectX + r, rectY);
        ctx.closePath();
      }
      ctx.stroke();
    } catch (error) {
      console.error('Error drawing selection highlight:', error);
    }
  }
  
  /**
   * Store a reference to this task's position for drawing
   */
  setPositionRef(positionRef: { x: number, y: number }) {
    this._positionRef = positionRef;
  }
} 
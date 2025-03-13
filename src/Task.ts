import { Trades, Trade } from './Trades';

export interface TaskConfig {
  id: string;
  name: string;
  startDate: Date;
  duration: number; // in business days
  crewSize: number;
  color: string;
  tradeId?: string; // ID of the trade this task belongs to
  dependencies?: string[]; // IDs of tasks that must complete before this one can start
  progress?: number; // 0-100
  status?: 'not-started' | 'in-progress' | 'completed' | 'blocked';
  xerTaskId?: string; // ID used when exporting to XER format
  workOnSaturday?: boolean; // Whether this task includes Saturday as a workday
  workOnSunday?: boolean; // Whether this task includes Sunday as a workday
}

export class Task {
  readonly id: string;
  name: string;
  startDate: Date;
  duration: number;
  crewSize: number;
  color: string;
  tradeId: string;
  dependencies: string[];
  progress: number;
  status: 'not-started' | 'in-progress' | 'completed' | 'blocked';
  workOnSaturday: boolean;
  workOnSunday: boolean;
  private readonly height: number = 60; // Increased height for better visibility
  private isHovered: boolean = false;
  
  // Property for XER export
  xerTaskId?: string;

  constructor(config: TaskConfig) {
    this.id = config.id || crypto.randomUUID();
    this.name = config.name;
    this.startDate = config.startDate;
    
    // Ensure minimum duration of 1 day
    this.duration = Math.max(1, config.duration);
    
    this.crewSize = config.crewSize || 1;
    this.color = config.color || '#3b82f6';
    
    // Handle trade assignment
    this.tradeId = config.tradeId || '';
    
    // If tradeId is not specified but color is, try to find the trade by color
    if (!this.tradeId && this.color) {
      const trade = Trades.getTradeByColor(this.color);
      if (trade) {
        this.tradeId = trade.id;
      }
    }
    
    // If a trade was found, ensure color matches the trade
    if (this.tradeId) {
      const trade = Trades.getTradeById(this.tradeId);
      if (trade) {
        this.color = trade.color;
      }
    }
    
    this.dependencies = config.dependencies || [];
    this.progress = config.progress || 0;
    this.status = config.status || 'not-started';
    this.height = 40;
    this.isHovered = false;
    
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

  draw(ctx: CanvasRenderingContext2D, timeAxis: any, y: number): boolean {
    const startX = timeAxis.dateToWorld(this.startDate);
    const endX = timeAxis.dateToWorld(this.getEndDate());
    
    // Improved culling with a much wider range to ensure tasks are visible
    // This fixes the issue where tasks after May 1st disappear
    const canvasWidth = ctx.canvas.width * 10; // Significantly increased culling range
    const visibleLeft = -canvasWidth;
    const visibleRight = canvasWidth * 2;
    
    if (startX > visibleRight || endX < visibleLeft) {
      return false;
    }
    
    // Ensure minimum width for the card
    const width = Math.max(endX - startX, 80); // Increased minimum width
    const radius = 8; 
    
    // Save current canvas state
    ctx.save();
    
    // Draw shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
    ctx.shadowBlur = this.isHovered ? 16 : 10;
    ctx.shadowOffsetY = 3;
    
    // Create a white background for the card
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.roundRect(startX, y, width, this.height, radius);
    ctx.fill();
    
    ctx.restore();
    
    // Get trade information - we'll only use this for color
    const trade = this.getTrade();
    
    // Draw colored top border (6px) for trade indication
    ctx.fillStyle = this.isHovered 
      ? Task.adjustColor(this.color, 1.1) // Lighten on hover
      : this.color;
    ctx.beginPath();
    ctx.roundRect(startX, y, width, 6, [radius, radius, 0, 0]);
    ctx.fill();
    
    // Draw very subtle background tint
    ctx.fillStyle = `${this.color}10`; // 10% opacity of the trade color
    ctx.beginPath();
    ctx.roundRect(startX, y + 6, width, this.height - 6, [0, 0, radius, radius]);
    ctx.fill();
    
    // Draw card border
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(startX, y, width, this.height, radius);
    ctx.stroke();
    
    // Only proceed with inner content if card is wide enough
    if (width > 70) {
      // Set text alignment properties explicitly
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      
      // Significant horizontal padding from the edge of the card
      const textPadding = 8;
      
      // Calculate text start position with fixed inset from card edge
      const textX = Math.floor(startX) + textPadding + 8; // Added more padding and ensure whole pixel
      
      // Draw name
      ctx.font = '600 12px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#1a1a1a';
      
      // Calculate available width for text
      const availableTextWidth = width - (textPadding * 2) - 16;
      const taskName = this.truncateText(ctx, this.name, availableTextWidth);
      
      // Draw the task name - moved higher for better spacing
      ctx.fillText(taskName, textX, y + 12);
      
      // Draw details
      ctx.font = '400 10px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#666666';
      
      const extraInfo = `${this.duration}d, ${this.crewSize} crew`;
      ctx.fillText(extraInfo, textX, y + this.height - 10); // More space between name and details
      
      // Draw status if necessary
      if (this.status && this.status !== 'not-started') {
        const statusColors = {
          'in-progress': '#3b82f6', // Blue
          'completed': '#10b981',   // Green
          'blocked': '#ef4444'      // Red
        };
        
        const statusLabels = {
          'in-progress': 'In Progress',
          'completed': 'Complete',
          'blocked': 'Blocked'
        };
        
        const statusColor = statusColors[this.status] || '#666666';
        const statusLabel = statusLabels[this.status] || this.status;
        
        ctx.font = '500 9px Inter, system-ui, -apple-system, sans-serif';
        ctx.fillStyle = statusColor;
        ctx.fillText(statusLabel, textX, y + this.height - 2); // Status text at the very bottom
      }
      
      // Draw progress bar if necessary
      if (this.progress > 0) {
        const progressBarHeight = 4;
        const progressBarY = y + this.height - progressBarHeight - 2;
        const progressBarWidth = width - (textPadding * 2) - 16;
        
        // Background track
        ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
        ctx.beginPath();
        ctx.roundRect(textX, progressBarY, progressBarWidth, progressBarHeight, 2);
        ctx.fill();
        
        // Progress fill
        const progressWidth = progressBarWidth * (this.progress / 100);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.roundRect(textX, progressBarY, progressWidth, progressBarHeight, 2);
        ctx.fill();
      }
    } else if (width > 10) {
      // For very narrow cards, just draw a colored indicator
      ctx.fillStyle = this.color;
      ctx.fillRect(startX + 4, y + 8, width - 8, this.height - 16);
    }

    return true;
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
} 
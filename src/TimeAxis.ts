import { Camera } from './Camera';
import { Logger } from './utils/logger';

export interface TimeScale {
  unit: 'hour' | 'day' | 'week' | 'month' | 'year';
  pixelsPerUnit: number;
  format: (date: Date) => string;
}

export class TimeAxis {
  private startDate: Date;
  private readonly dayWidth: number = 50; // Width of a day in world units
  private readonly headerHeight: number = 50; // Height of the header in pixels
  
  // Optimization: Cache for date conversions
  private dateToWorldCache: Map<string, number> = new Map();
  private worldToDateCache: Map<number, Date> = new Map();
  private cacheLimit: number = 5000; // Limit cache size to prevent memory issues

  constructor(startDate: Date) {
    this.startDate = new Date(startDate);
    this.startDate.setHours(0, 0, 0, 0);
  }

  /**
   * Converts a date to a world X coordinate
   */
  dateToWorld(date: Date): number {
    if (!date) return NaN;
    
    try {
      // Create a date key for caching, round to day precision
      const dateObj = new Date(date);
      dateObj.setHours(0, 0, 0, 0);
      const dateKey = dateObj.getTime().toString();
      
      // Check cache first
      if (this.dateToWorldCache.has(dateKey)) {
        return this.dateToWorldCache.get(dateKey)!;
      }
      
      // Calculate days difference with high precision
      const timeDiff = dateObj.getTime() - this.startDate.getTime();
      const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
      
      // Calculate world position
      const x = Math.round(daysDiff * this.dayWidth * 100) / 100; // Round to reduce floating point errors
      
      // Cache the result
      this.dateToWorldCache.set(dateKey, x);
      
      // Trim cache if it gets too large
      if (this.dateToWorldCache.size > this.cacheLimit) {
        const oldestKey = this.dateToWorldCache.keys().next().value;
        this.dateToWorldCache.delete(oldestKey);
      }
      
      return x;
    } catch (error) {
      console.error("Error in dateToWorld conversion:", error);
      return NaN;
    }
  }

  /**
   * Converts a world X coordinate to a date
   */
  worldToDate(x: number): Date {
    try {
      // Round to nearest pixel to improve caching
      const roundedX = Math.round(x);
      
      // Check cache first
      if (this.worldToDateCache.has(roundedX)) {
        return new Date(this.worldToDateCache.get(roundedX)!);
      }
      
      // Calculate days from x position
      const days = x / this.dayWidth;
      
      // Calculate milliseconds
      const milliseconds = days * 24 * 60 * 60 * 1000;
      
      // Create new date (copying to avoid modifying the original)
      const resultDate = new Date(this.startDate.getTime() + milliseconds);
      
      // Cache the result
      this.worldToDateCache.set(roundedX, new Date(resultDate));
      
      // Trim cache if it gets too large
      if (this.worldToDateCache.size > this.cacheLimit) {
        const oldestKey = this.worldToDateCache.keys().next().value;
        this.worldToDateCache.delete(oldestKey);
      }
      
      return resultDate;
    } catch (error) {
      console.error("Error in worldToDate conversion:", error);
      return new Date(); // Return current date as fallback
    }
  }

  /**
   * Gets the position of today's date
   */
  getTodayPosition(): number {
    return this.dateToWorld(new Date());
  }

  /**
   * Get the header height
   */
  getHeaderHeight(): number {
    return this.headerHeight;
  }

  /**
   * Draw the time axis
   */
  draw(ctx: CanvasRenderingContext2D, camera: Camera) {
    // Save current transform
    ctx.save();
    Logger.log('Drawing time axis', { camera });
    
    // Calculate which dates are visible
    const viewportStartX = camera.x - (ctx.canvas.width / 2 / camera.zoom);
    const viewportEndX = camera.x + (ctx.canvas.width / 2 / camera.zoom);
    const startDayOffset = Math.floor(viewportStartX / this.dayWidth);
    const endDayOffset = Math.ceil(viewportEndX / this.dayWidth);
    
    // Draw time axis header with background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, ctx.canvas.width, this.headerHeight);
    
    // Draw bottom border of header
    ctx.strokeStyle = 'rgba(200, 200, 200, 0.5)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, this.headerHeight);
    ctx.lineTo(ctx.canvas.width, this.headerHeight);
    ctx.stroke();
    
    // Calculate scale for month labels and day ticks
    const effectivePixelsPerDay = this.dayWidth * camera.zoom;
    const showDayLabels = effectivePixelsPerDay > 15;
    const showWeekLabels = effectivePixelsPerDay > 5; 
    
    // Calculate custom transform for time header (centered zoom from current camera position)
    ctx.translate(ctx.canvas.width / 2, 0);
    ctx.scale(camera.zoom, 1);
    ctx.translate(-camera.x, 0);
    
    ctx.font = '10px Arial';
    
    // Today marker
    const todayX = this.getTodayPosition();
    ctx.fillStyle = '#ff6b6b';
    ctx.fillRect(todayX - 1, 0, 2, this.headerHeight);
    
    // Optimize date rendering by reusing date objects and just stepping days
    let currentDate = new Date(this.startDate);
    currentDate.setDate(currentDate.getDate() + startDayOffset);

    // Draw days and months
    for (let dayOffset = startDayOffset; dayOffset <= endDayOffset; dayOffset++) {
      const x = dayOffset * this.dayWidth;
      
      // Draw day tick
      const day = currentDate.getDate();
      const isFirstOfMonth = day === 1;
      const isWeekend = currentDate.getDay() === 0 || currentDate.getDay() === 6;
      const isWeekStart = currentDate.getDay() === 1; // Monday
      
      // Draw different markers based on date type
      if (isFirstOfMonth) {
        // First day of month - draw month name
        ctx.fillStyle = '#333';
        ctx.textAlign = 'center';
        
        if (effectivePixelsPerDay >= 3) {
          const month = currentDate.toLocaleDateString('en-US', { month: 'short' });
          const year = currentDate.getFullYear();
          ctx.fillText(`${month} ${year}`, x, 15);
        } else if (effectivePixelsPerDay >= 1.5) {
          const month = currentDate.toLocaleDateString('en-US', { month: 'short' });
          ctx.fillText(month, x, 15);  
        }
        
        // Draw taller line for month start
        ctx.strokeStyle = 'rgba(100, 100, 100, 0.5)';
        ctx.beginPath();
        ctx.moveTo(x, 22);
        ctx.lineTo(x, this.headerHeight);
        ctx.stroke();
      } else if (isWeekStart && showWeekLabels) {
        // Week start - draw week marker
        ctx.strokeStyle = 'rgba(200, 200, 200, 0.3)';
        ctx.beginPath();
        ctx.moveTo(x, 25);
        ctx.lineTo(x, this.headerHeight);
        ctx.stroke();
      } 
      
      // Weekend highlighting
      if (isWeekend) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
        ctx.fillRect(x, 0, this.dayWidth, this.headerHeight);
      }
      
      // Day number
      if (showDayLabels) {
        if (isWeekend) {
          ctx.fillStyle = '#999';
        } else {
          ctx.fillStyle = '#666';
        }
        ctx.textAlign = 'center';
        ctx.fillText(day.toString(), x + this.dayWidth / 2, 35);
      }
      
      // Advance to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Restore original transform
    ctx.restore();
  }

  private getTimeScale(zoom: number): TimeScale {
    const effectivePixelsPerDay = this.dayWidth * zoom;

    // Always show month context at the top
    const monthScale: TimeScale = {
      unit: 'month',
      pixelsPerUnit: effectivePixelsPerDay * 30,
      format: (date: Date) => date.toLocaleString('default', { month: 'long', year: 'numeric' })
    };

    // Determine the detail scale based on zoom level
    let detailScale: TimeScale;
    
    // Limit minimum scale to 1 day (when effectivePixelsPerDay >= 50)
    if (effectivePixelsPerDay >= 50) {
      detailScale = {
        unit: 'day',
        pixelsPerUnit: effectivePixelsPerDay,
        format: (date: Date) => date.getDate().toString()
      };
    } else if (effectivePixelsPerDay >= 10) {
      detailScale = {
        unit: 'week',
        pixelsPerUnit: effectivePixelsPerDay * 7,
        format: (date: Date) => 'W' + Math.ceil((date.getDate() + date.getDay()) / 7)
      };
    } else {
      detailScale = {
        unit: 'month',
        pixelsPerUnit: effectivePixelsPerDay * 30,
        format: (date: Date) => date.toLocaleString('default', { month: 'short' })
      };
    }

    return detailScale;
  }

  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
  }

  private drawWeekendShading(ctx: CanvasRenderingContext2D, camera: { x: number; y: number; zoom: number; width: number; height: number }) {
    // Calculate visible date range
    const leftDate = this.worldToDate(camera.x - camera.width / (2 * camera.zoom));
    const rightDate = this.worldToDate(camera.x + camera.width / (2 * camera.zoom));

    // Start from the beginning of the left date
    let currentDate = new Date(leftDate);
    currentDate.setHours(0, 0, 0, 0);

    // Save current transform state
    ctx.save();
    
    // Apply camera transform
    ctx.translate(camera.width / 2, 0);
    ctx.scale(camera.zoom, 1);
    ctx.translate(-camera.x, 0);

    // Set weekend shading style
    ctx.fillStyle = 'rgba(0, 0, 0, 0.02)'; // Very subtle gray

    while (currentDate <= rightDate) {
      if (this.isWeekend(currentDate)) {
        const x = this.dateToWorld(currentDate);
        
        // Draw weekend shading
        ctx.fillRect(
          x,
          this.headerHeight,
          this.dayWidth,
          camera.height - this.headerHeight
        );
      }
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    ctx.restore();
  }

  private roundToUnit(date: Date, unit: TimeScale['unit']): Date {
    const result = new Date(date);
    switch (unit) {
      case 'hour':
        result.setMinutes(0, 0, 0);
        break;
      case 'day':
        result.setHours(0, 0, 0, 0);
        break;
      case 'week':
        result.setDate(result.getDate() - result.getDay());
        result.setHours(0, 0, 0, 0);
        break;
      case 'month':
        result.setDate(1);
        result.setHours(0, 0, 0, 0);
        break;
      case 'year':
        result.setMonth(0, 1);
        result.setHours(0, 0, 0, 0);
        break;
    }
    return result;
  }

  private advanceByUnit(date: Date, unit: TimeScale['unit']): Date {
    const result = new Date(date);
    switch (unit) {
      case 'hour':
        result.setHours(result.getHours() + 1);
        break;
      case 'day':
        result.setDate(result.getDate() + 1);
        break;
      case 'week':
        result.setDate(result.getDate() + 7);
        break;
      case 'month':
        result.setMonth(result.getMonth() + 1);
        break;
      case 'year':
        result.setFullYear(result.getFullYear() + 1);
        break;
    }
    return result;
  }
} 
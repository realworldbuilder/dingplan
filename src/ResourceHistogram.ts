import { TimeAxis } from './TimeAxis';
import { Camera } from './Camera';
import { Task } from './Task';

interface TradeResource {
  color: string;
  value: number;
}

interface AggregatedResources {
  total: number;
  byColor: Map<string, number>;
}

enum TimeScale {
  Day,
  Week,
  Month
}

export class ResourceHistogram {
  private readonly height: number = 100; // Height of the histogram
  private readonly marginTop: number = 20; // Margin from the bottom of the tasks
  private dailyResources: Map<string, Map<string, number>> = new Map(); // Date string -> Map<color, crew size>
  private weeklyResources: Map<string, Map<string, number>> = new Map();
  private monthlyResources: Map<string, Map<string, number>> = new Map();
  private maxDailyResource: number = 0;
  private maxWeeklyResource: number = 0;
  private maxMonthlyResource: number = 0;
  private tradeFilters: Map<string, boolean> = new Map(); // Store which trades should be displayed

  constructor(private timeAxis: TimeAxis) {
    // Initialize all trade filters to true (show all)
  }
  
  // Set trade filters for visualization
  setTradeFilters(filters: Map<string, boolean>): void {
    // Create a fresh copy of the filters to ensure proper change detection
    this.tradeFilters = new Map(filters);
    
    // Log filter update for debugging
    console.log("Trade filters updated in ResourceHistogram:", 
      Array.from(this.tradeFilters.entries())
        .map(([color, visible]) => `${color}: ${visible}`)
        .join(', ')
    );
    
    // Recalculate resources after filtering
    // Since this is typically called with tasks already provided,
    // we need to wait for the next calculateResources call
  }

  /**
   * Calculate resource usage based on tasks
   * @param tasks Array of tasks to consider
   * @param startDate Optional date to start calculations from
   * @param endDate Optional date to end calculations at
   */
  calculateResources(tasks: any[], startDate?: Date, endDate?: Date) {
    // Reset resource data
    this.dailyResources = new Map();
    this.weeklyResources = new Map();
    this.monthlyResources = new Map();
    this.maxDailyResource = 0;
    this.maxWeeklyResource = 0;
    this.maxMonthlyResource = 0;
    
    if (!tasks || tasks.length === 0) {
      return;
    }
    
    // Group tasks by trade
    const tasksByTrade: Map<string, any[]> = new Map();
    
    tasks.forEach(task => {
      if (!task.tradeId) return;
      
      // Skip if task is outside date range (if provided)
      if (startDate && endDate) {
        if (task.endDate < startDate || task.startDate > endDate) {
          return;
        }
      }
      
      const tradeTasks = tasksByTrade.get(task.tradeId) || [];
      tradeTasks.push(task);
      tasksByTrade.set(task.tradeId, tradeTasks);
    });
    
    // Calculate resources by day for each trade
    tasksByTrade.forEach((tradeTasks, tradeId) => {
      // Get the overall date range for all tasks in this trade
      let minDate = startDate || new Date();
      let maxDate = endDate || new Date();
      
      // If no date range provided, calculate it from the tasks
      if (!startDate || !endDate) {
        tradeTasks.forEach(task => {
          if (!minDate || task.startDate < minDate) {
            minDate = new Date(task.startDate);
          }
          
          if (!maxDate || task.endDate > maxDate) {
            maxDate = new Date(task.endDate);
          }
        });
      }
      
      // Ensure we have valid dates
      minDate = new Date(Math.min(minDate.getTime(), Date.now()));
      maxDate = new Date(Math.max(maxDate.getTime(), Date.now() + 86400000)); // at least tomorrow
      
      // For each day, calculate resource usage
      const currentDate = new Date(minDate);
      while (currentDate <= maxDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const dayResourceCount = this.calculateResourcesForDay(tradeTasks, currentDate);
        
        if (dayResourceCount > 0) {
          // Store resource data by trade and date
          const tradeData = this.dailyResources.get(dateKey) || new Map();
          tradeData.set(tradeId, dayResourceCount);
          this.dailyResources.set(dateKey, tradeData);
          
          // Update max resource count if needed
          this.maxDailyResource = Math.max(this.maxDailyResource, dayResourceCount);
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });

    // Calculate max values for scaling
    this.calculateMaxResources();
    
    // Average out weekly and monthly values
    this.averageWeeklyAndMonthlyResources();
  }

  private calculateMaxResources(): void {
    // Calculate maximums for scaling
    this.maxDailyResource = 0;
    this.maxWeeklyResource = 0;
    this.maxMonthlyResource = 0;
    
    this.dailyResources.forEach(colorMap => {
      let totalForDate = 0;
      colorMap.forEach((value, color) => {
        // Only count this color if it's not filtered out
        if (!this.tradeFilters.has(color) || this.tradeFilters.get(color)) {
          totalForDate += value;
        }
      });
      this.maxDailyResource = Math.max(this.maxDailyResource, totalForDate);
    });

    this.weeklyResources.forEach(colorMap => {
      let totalForWeek = 0;
      colorMap.forEach((value, color) => {
        // Only count this color if it's not filtered out
        if (!this.tradeFilters.has(color) || this.tradeFilters.get(color)) {
          totalForWeek += value;
        }
      });
      this.maxWeeklyResource = Math.max(this.maxWeeklyResource, totalForWeek);
    });

    this.monthlyResources.forEach(colorMap => {
      let totalForMonth = 0;
      colorMap.forEach((value, color) => {
        // Only count this color if it's not filtered out
        if (!this.tradeFilters.has(color) || this.tradeFilters.get(color)) {
          totalForMonth += value;
        }
      });
      this.maxMonthlyResource = Math.max(this.maxMonthlyResource, totalForMonth);
    });
  }

  private averageWeeklyAndMonthlyResources(): void {
    // Helper to count days in a week
    const countDaysInWeek = (weekKey: string): number => {
      const [year, week] = weekKey.split('-W').map(n => parseInt(n));
      let count = 0;
      // Count business days in this week
      const startDate = this.getDateOfISOWeek(week, year);
      for (let i = 0; i < 7; i++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + i);
        if (!this.isWeekend(currentDate)) {
          count++;
        }
      }
      return count;
    };

    // Helper to count business days in a month
    const countDaysInMonth = (monthKey: string): number => {
      const [year, month] = monthKey.split('-').map(n => parseInt(n));
      let count = 0;
      const lastDay = new Date(year, month, 0).getDate();
      for (let day = 1; day <= lastDay; day++) {
        const date = new Date(year, month - 1, day);
        if (!this.isWeekend(date)) {
          count++;
        }
      }
      return count;
    };

    // Average out weekly resources
    this.weeklyResources.forEach((colorMap, weekKey) => {
      const daysInWeek = countDaysInWeek(weekKey);
      if (daysInWeek > 0) {
        colorMap.forEach((value, color) => {
          const avgValue = Math.round(value / daysInWeek);
          colorMap.set(color, avgValue);
        });
      }
    });

    // Average out monthly resources
    this.monthlyResources.forEach((colorMap, monthKey) => {
      const daysInMonth = countDaysInMonth(monthKey);
      if (daysInMonth > 0) {
        colorMap.forEach((value, color) => {
          const avgValue = Math.round(value / daysInMonth);
          colorMap.set(color, avgValue);
        });
      }
    });

    // Recalculate maximums after averaging
    this.maxWeeklyResource = 0;
    this.maxMonthlyResource = 0;
    
    this.weeklyResources.forEach(colorMap => {
      let totalForWeek = 0;
      colorMap.forEach((value, color) => {
        // Only count this color if it's not filtered out
        if (!this.tradeFilters.has(color) || this.tradeFilters.get(color)) {
          totalForWeek += value;
        }
      });
      this.maxWeeklyResource = Math.max(this.maxWeeklyResource, totalForWeek);
    });

    this.monthlyResources.forEach(colorMap => {
      let totalForMonth = 0;
      colorMap.forEach((value, color) => {
        // Only count this color if it's not filtered out
        if (!this.tradeFilters.has(color) || this.tradeFilters.get(color)) {
          totalForMonth += value;
        }
      });
      this.maxMonthlyResource = Math.max(this.maxMonthlyResource, totalForMonth);
    });
  }

  private isWeekend(date: Date): boolean {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
  }

  private formatDailyKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }

  private formatWeeklyKey(date: Date): string {
    const week = this.getWeekNumber(date);
    return `${date.getFullYear()}-W${week}`;
  }

  private formatMonthlyKey(date: Date): string {
    return `${date.getFullYear()}-${date.getMonth() + 1}`;
  }

  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  private getDateOfISOWeek(week: number, year: number): Date {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dayOfWeek = simple.getDay();
    const ISOweekStart = simple;
    if (dayOfWeek <= 4) {
      ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    } else {
      ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    }
    return ISOweekStart;
  }

  private getMonthStart(monthKey: string): Date {
    const [year, month] = monthKey.split('-').map(n => parseInt(n));
    return new Date(year, month - 1, 1);
  }

  getHeight(): number {
    return this.height + this.marginTop;
  }

  private getTimeScale(zoom: number): TimeScale {
    const effectivePixelsPerDay = 50 * zoom; // 50 pixels per day is the base scale
    
    if (effectivePixelsPerDay >= 30) {
      return TimeScale.Day;
    } else if (effectivePixelsPerDay >= 10) {
      return TimeScale.Week;
    } else {
      return TimeScale.Month;
    }
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera, canvasHeight: number): void {
    const timeScale = this.getTimeScale(camera.zoom);
    
    // Select appropriate resource map and max value based on time scale
    let resourceMap: Map<string, Map<string, number>>;
    let maxResource: number;
    
    switch (timeScale) {
      case TimeScale.Day:
        resourceMap = this.dailyResources;
        maxResource = this.maxDailyResource;
        break;
      case TimeScale.Week:
        resourceMap = this.weeklyResources;
        maxResource = this.maxWeeklyResource;
        break;
      case TimeScale.Month:
        resourceMap = this.monthlyResources;
        maxResource = this.maxMonthlyResource;
        break;
    }
    
    if (maxResource === 0) return; // No resources to draw
    
    const histogramY = canvasHeight - this.height;
    const maxBarHeight = this.height - 30; // Leave room for labels
    
    // Draw background
    ctx.fillStyle = 'rgba(245, 245, 245, 0.9)';
    ctx.fillRect(0, histogramY, ctx.canvas.width, this.height);
    
    // Draw horizontal lines and labels
    const lineCount = 5; // Number of horizontal lines
    ctx.strokeStyle = '#ddd';
    ctx.fillStyle = '#666';
    ctx.font = '10px Inter, system-ui, -apple-system, sans-serif';
    
    for (let i = 0; i <= lineCount; i++) {
      const y = histogramY + 25 + ((lineCount - i) / lineCount) * maxBarHeight;
      const value = Math.round((i / lineCount) * maxResource);
      
      // Draw line
      ctx.beginPath();
      ctx.moveTo(40, y);
      ctx.lineTo(ctx.canvas.width - 40, y);
      ctx.stroke();
      
      // Draw label on the RIGHT side
      ctx.textAlign = 'left';
      ctx.fillText(value.toString(), ctx.canvas.width - 35, y + 3);
    }
    
    // Calculate visible date range
    const leftWorldX = camera.x - (ctx.canvas.width / (2 * camera.zoom));
    const rightWorldX = camera.x + (ctx.canvas.width / (2 * camera.zoom));
    const leftDate = this.timeAxis.worldToDate(leftWorldX);
    const rightDate = this.timeAxis.worldToDate(rightWorldX);
    
    // Determine bar width based on time scale
    let barWidth: number;
    switch (timeScale) {
      case TimeScale.Day:
        barWidth = 48; // Default for day view
        break;
      case TimeScale.Week:
        barWidth = 48 * 5; // Width of a business week (5 days)
        break;
      case TimeScale.Month:
        barWidth = 48 * 20; // Width of a business month (approx. 20 days)
        break;
    }

    // Draw stacked bars based on the time scale
    if (timeScale === TimeScale.Day) {
      this.drawDailyBars(ctx, camera, histogramY, maxBarHeight, maxResource, leftDate, rightDate);
    } else if (timeScale === TimeScale.Week) {
      this.drawWeeklyBars(ctx, camera, histogramY, maxBarHeight, maxResource, leftDate, rightDate);
    } else {
      this.drawMonthlyBars(ctx, camera, histogramY, maxBarHeight, maxResource, leftDate, rightDate);
    }
  }

  private drawDailyBars(
    ctx: CanvasRenderingContext2D, 
    camera: Camera, 
    histogramY: number, 
    maxBarHeight: number, 
    maxResource: number,
    leftDate: Date,
    rightDate: Date
  ): void {
    // Set bar width for daily view
    const barWidth = 48;
    
    // Start from the beginning of the left date
    let currentDate = new Date(leftDate);
    currentDate.setHours(0, 0, 0, 0);
    
    // Draw stacked bars for each day
    while (currentDate <= rightDate) {
      // Skip weekends
      if (!this.isWeekend(currentDate)) {
        const dateKey = this.formatDailyKey(currentDate);
        const colorMap = this.dailyResources.get(dateKey);
        
        if (colorMap && colorMap.size > 0) {
          // Calculate bar position
          const x = this.timeAxis.dateToWorld(currentDate);
          const screenX = (x - camera.x) * camera.zoom + ctx.canvas.width / 2;
          
          // Calculate total for this date (only including non-filtered trades)
          let totalForDate = 0;
          colorMap.forEach((value, color) => {
            // Only count this color if it's not filtered out
            if (!this.tradeFilters.has(color) || this.tradeFilters.get(color)) {
              totalForDate += value;
            }
          });
          
          // Sort the trades by color for consistent rendering
          const sortedTrades: [string, number][] = [];
          colorMap.forEach((value, color) => {
            // Only include this color if it's not filtered out
            if (!this.tradeFilters.has(color) || this.tradeFilters.get(color)) {
              sortedTrades.push([color, value]);
            }
          });
          sortedTrades.sort((a, b) => a[0].localeCompare(b[0]));
          
          // Draw stacked bars
          let currentY = histogramY + 25 + maxBarHeight;
          let currentTotal = 0;
          
          sortedTrades.forEach(([color, value]) => {
            const barHeight = (value / maxResource) * maxBarHeight;
            currentY -= barHeight;
            
            // Draw bar segment
            ctx.fillStyle = color;
            ctx.fillRect(screenX - barWidth/2, currentY, barWidth, barHeight);
            
            // Add a subtle border
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(screenX - barWidth/2, currentY, barWidth, barHeight);
            
            currentTotal += value;
          });
          
          // Draw total value on top of the bar if there's enough room
          const totalBarHeight = (totalForDate / maxResource) * maxBarHeight;
          if (totalBarHeight > 15) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Inter, system-ui, -apple-system, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(totalForDate.toString(), screenX, currentY + 12);
          }
          
          // Removed date labels per user request
        }
      }
      
      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  private drawWeeklyBars(
    ctx: CanvasRenderingContext2D, 
    camera: Camera, 
    histogramY: number, 
    maxBarHeight: number, 
    maxResource: number,
    leftDate: Date,
    rightDate: Date
  ): void {
    // Get week number of left date to start from beginning of week
    let currentDate = new Date(leftDate);
    const startWeek = this.getWeekNumber(currentDate);
    const startYear = currentDate.getFullYear();
    
    // Start from the beginning of that week
    currentDate = this.getDateOfISOWeek(startWeek, startYear);
    
    // Calculate bar width based on business days in a week
    const barWidth = 48 * 5; // 5 business days per week
    
    // Continue until we're past the right date
    while (currentDate <= rightDate) {
      const weekKey = this.formatWeeklyKey(currentDate);
      const colorMap = this.weeklyResources.get(weekKey);
      
      if (colorMap && colorMap.size > 0) {
        // For weekly view, position bar in middle of week
        const weekMiddle = new Date(currentDate);
        weekMiddle.setDate(currentDate.getDate() + 2); // Wednesday
        
        const x = this.timeAxis.dateToWorld(weekMiddle);
        const screenX = (x - camera.x) * camera.zoom + ctx.canvas.width / 2;
        
        // Calculate total for this week (only including non-filtered trades)
        let totalForWeek = 0;
        colorMap.forEach((value, color) => {
          // Only count this color if it's not filtered out
          if (!this.tradeFilters.has(color) || this.tradeFilters.get(color)) {
            totalForWeek += value;
          }
        });
        
        // Sort the trades by color for consistent rendering
        const sortedTrades: [string, number][] = [];
        colorMap.forEach((value, color) => {
          // Only include this color if it's not filtered out
          if (!this.tradeFilters.has(color) || this.tradeFilters.get(color)) {
            sortedTrades.push([color, value]);
          }
        });
        sortedTrades.sort((a, b) => a[0].localeCompare(b[0]));
        
        // Draw stacked bars
        let currentY = histogramY + 25 + maxBarHeight;
        
        sortedTrades.forEach(([color, value]) => {
          const barHeight = (value / maxResource) * maxBarHeight;
          currentY -= barHeight;
          
          // Draw bar segment
          ctx.fillStyle = color;
          ctx.fillRect(screenX - barWidth/2, currentY, barWidth, barHeight);
          
          // Add a subtle border
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(screenX - barWidth/2, currentY, barWidth, barHeight);
        });
        
        // Draw total value on top of the bar if there's enough room
        const totalBarHeight = (totalForWeek / maxResource) * maxBarHeight;
        if (totalBarHeight > 15) {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px Inter, system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(totalForWeek.toString(), screenX, currentY + 12);
        }
        
        // Removed week label per user request
      }
      
      // Move to next week
      currentDate.setDate(currentDate.getDate() + 7);
    }
  }

  private drawMonthlyBars(
    ctx: CanvasRenderingContext2D, 
    camera: Camera, 
    histogramY: number, 
    maxBarHeight: number, 
    maxResource: number,
    leftDate: Date,
    rightDate: Date
  ): void {
    // Start from the beginning of the month of left date
    let currentDate = new Date(leftDate.getFullYear(), leftDate.getMonth(), 1);
    
    // Calculate bar width (approx 20 business days per month)
    const barWidth = 48 * 20;
    
    // Continue until we're past the right date
    while (currentDate <= rightDate) {
      const monthKey = this.formatMonthlyKey(currentDate);
      const colorMap = this.monthlyResources.get(monthKey);
      
      if (colorMap && colorMap.size > 0) {
        // Position bar in middle of month
        const monthMiddle = new Date(currentDate);
        monthMiddle.setDate(15); // Middle of month
        
        const x = this.timeAxis.dateToWorld(monthMiddle);
        const screenX = (x - camera.x) * camera.zoom + ctx.canvas.width / 2;
        
        // Calculate total for this month (only including non-filtered trades)
        let totalForMonth = 0;
        colorMap.forEach((value, color) => {
          // Only count this color if it's not filtered out
          if (!this.tradeFilters.has(color) || this.tradeFilters.get(color)) {
            totalForMonth += value;
          }
        });
        
        // Sort the trades by color for consistent rendering
        const sortedTrades: [string, number][] = [];
        colorMap.forEach((value, color) => {
          // Only include this color if it's not filtered out
          if (!this.tradeFilters.has(color) || this.tradeFilters.get(color)) {
            sortedTrades.push([color, value]);
          }
        });
        sortedTrades.sort((a, b) => a[0].localeCompare(b[0]));
        
        // Draw stacked bars
        let currentY = histogramY + 25 + maxBarHeight;
        
        sortedTrades.forEach(([color, value]) => {
          const barHeight = (value / maxResource) * maxBarHeight;
          currentY -= barHeight;
          
          // Draw bar segment
          ctx.fillStyle = color;
          ctx.fillRect(screenX - barWidth/2, currentY, barWidth, barHeight);
          
          // Add a subtle border
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
          ctx.lineWidth = 1;
          ctx.strokeRect(screenX - barWidth/2, currentY, barWidth, barHeight);
        });
        
        // Draw total value on top of the bar if there's enough room
        const totalBarHeight = (totalForMonth / maxResource) * maxBarHeight;
        if (totalBarHeight > 15) {
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 10px Inter, system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(totalForMonth.toString(), screenX, currentY + 12);
        }
        
        // Removed month label per user request
      }
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  }

  /**
   * Calculate resource usage for a specific day
   * @param tasks Array of tasks to consider
   * @param day Date to calculate resources for
   * @returns Total resource count for the day
   */
  private calculateResourcesForDay(tasks: any[], day: Date): number {
    const dayFormatted = day.toISOString().split('T')[0];
    let totalResources = 0;
    
    tasks.forEach(task => {
      // Skip if task doesn't overlap with the day
      const taskStart = new Date(task.startDate);
      const taskEnd = new Date(task.endDate);
      
      // Format dates to compare just the date part
      const taskStartFormatted = taskStart.toISOString().split('T')[0];
      const taskEndFormatted = taskEnd.toISOString().split('T')[0];
      
      if (dayFormatted < taskStartFormatted || dayFormatted > taskEndFormatted) {
        return;
      }
      
      // Only count weekdays unless the task is configured to work on weekends
      const dayOfWeek = day.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      if (isWeekend && !(task.workOnSaturday || task.workOnSunday)) {
        return;
      }
      
      // Add resources from this task
      totalResources += task.crewSize || 1;
    });
    
    return totalResources;
  }
} 
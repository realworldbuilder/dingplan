import jsPDF from 'jspdf';
import { Task } from './Task';
import { TaskManager } from './TaskManager';

/**
 * PdfExporter class handles exporting project data to PDF format
 * 
 * Features:
 * - Clean Gantt chart view with colored task bars
 * - Project name header and date range
 * - Summary table with task details
 * - Dependencies shown as arrows
 * - Landscape orientation for better timeline view
 */
export class PdfExporter {
  private pdf: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;
  private chartHeight: number = 150;
  private tableHeight: number = 100;
  
  constructor() {
    // Create PDF in landscape mode (A4 or Letter)
    this.pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4'
    });
    
    // Get page dimensions
    this.pageWidth = this.pdf.internal.pageSize.getWidth();
    this.pageHeight = this.pdf.internal.pageSize.getHeight();
  }
  
  /**
   * Export project data to PDF
   */
  public exportProject(
    taskManager: TaskManager, 
    projectName: string = 'Construction Schedule',
    projectDate: Date = new Date()
  ): void {
    const tasks = taskManager.getAllTasks();
    if (tasks.length === 0) {
      alert('No tasks to export');
      return;
    }
    
    // Calculate project timeline
    const timeline = this.calculateTimeline(tasks);
    
    // Add header
    this.addHeader(projectName, timeline.startDate, timeline.endDate);
    
    // Add Gantt chart
    this.addGanttChart(tasks, timeline);
    
    // Add summary table
    this.addSummaryTable(tasks);
    
    // Download the PDF
    const filename = `${projectName.replace(/[^a-zA-Z0-9]/g, '_')}_${this.formatDate(projectDate)}.pdf`;
    this.pdf.save(filename);
  }
  
  /**
   * Calculate project timeline and dimensions
   */
  private calculateTimeline(tasks: Task[]): {
    startDate: Date;
    endDate: Date;
    durationDays: number;
  } {
    let minStart = new Date();
    let maxEnd = new Date();
    
    if (tasks.length > 0) {
      minStart = new Date(Math.min(...tasks.map(t => t.startDate.getTime())));
      maxEnd = new Date(Math.max(...tasks.map(t => t.getEndDate().getTime())));
    }
    
    // Add some padding to the timeline
    minStart.setDate(minStart.getDate() - 2);
    maxEnd.setDate(maxEnd.getDate() + 2);
    
    const durationDays = Math.ceil((maxEnd.getTime() - minStart.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      startDate: minStart,
      endDate: maxEnd,
      durationDays
    };
  }
  
  /**
   * Add header with project name and date range
   */
  private addHeader(projectName: string, startDate: Date, endDate: Date): void {
    // Project title
    this.pdf.setFontSize(18);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text(projectName, this.margin, this.margin + 10);
    
    // Date range
    this.pdf.setFontSize(12);
    this.pdf.setFont('helvetica', 'normal');
    const dateRange = `${this.formatDate(startDate)} - ${this.formatDate(endDate)}`;
    this.pdf.text(`Project Timeline: ${dateRange}`, this.margin, this.margin + 20);
    
    // Generated timestamp
    this.pdf.setFontSize(10);
    this.pdf.text(`Generated on: ${this.formatDate(new Date())}`, this.pageWidth - 60, this.margin + 10);
  }
  
  /**
   * Add Gantt chart visualization
   */
  private addGanttChart(tasks: Task[], timeline: any): void {
    const chartStartY = this.margin + 35;
    const chartWidth = this.pageWidth - (this.margin * 2);
    const rowHeight = 8;
    const maxRows = Math.floor(this.chartHeight / rowHeight);
    
    // Chart title
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.text('Gantt Chart', this.margin, chartStartY);
    
    // Draw timeline header
    this.drawTimelineHeader(timeline, chartStartY + 10, chartWidth);
    
    // Group tasks by swimlane/trade for better organization
    const groupedTasks = this.groupTasksByTrade(tasks);
    
    let currentY = chartStartY + 25;
    let taskIndex = 0;
    
    for (const [tradeName, tradeTasks] of groupedTasks) {
      // Trade header
      if (taskIndex > 0) {
        currentY += 3; // Add space between trade groups
      }
      
      this.pdf.setFontSize(10);
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(60, 60, 60);
      this.pdf.text(`${tradeName} (${tradeTasks.length} tasks)`, this.margin, currentY);
      currentY += 5;
      
      // Draw tasks for this trade
      for (const task of tradeTasks) {
        if (taskIndex >= maxRows) break; // Prevent overflow
        
        this.drawTaskBar(task, timeline, currentY, chartWidth);
        currentY += rowHeight;
        taskIndex++;
      }
      
      if (taskIndex >= maxRows) break;
    }
    
    // Draw chart border
    this.pdf.setDrawColor(200, 200, 200);
    this.pdf.rect(this.margin, chartStartY + 10, chartWidth, this.chartHeight);
  }
  
  /**
   * Draw timeline header with dates
   */
  private drawTimelineHeader(timeline: any, startY: number, chartWidth: number): void {
    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(80, 80, 80);
    
    const dayWidth = chartWidth / timeline.durationDays;
    const current = new Date(timeline.startDate);
    
    // Draw week markers
    for (let day = 0; day < timeline.durationDays; day += 7) {
      const x = this.margin + (day * dayWidth);
      
      // Week line
      this.pdf.setDrawColor(180, 180, 180);
      this.pdf.line(x, startY, x, startY + this.chartHeight);
      
      // Week label
      if (day < timeline.durationDays - 7) {
        const weekDate = new Date(current);
        weekDate.setDate(weekDate.getDate() + day);
        this.pdf.text(this.formatShortDate(weekDate), x + 2, startY - 2);
      }
    }
  }
  
  /**
   * Draw individual task bar
   */
  private drawTaskBar(task: Task, timeline: any, y: number, chartWidth: number): void {
    // Calculate task position and width
    const dayWidth = chartWidth / timeline.durationDays;
    const taskStartDay = Math.floor((task.startDate.getTime() - timeline.startDate.getTime()) / (1000 * 60 * 60 * 24));
    const taskWidth = task.duration * dayWidth;
    const taskX = this.margin + (taskStartDay * dayWidth);
    const barHeight = 5;
    
    // Task name (truncated if too long)
    this.pdf.setFontSize(8);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setTextColor(40, 40, 40);
    const maxNameWidth = 80;
    const taskName = task.name.length > 25 ? task.name.substring(0, 22) + '...' : task.name;
    this.pdf.text(taskName, this.margin, y - 1, { maxWidth: maxNameWidth });
    
    // Task bar
    const color = this.hexToRgb(task.color || '#3B82F6');
    this.pdf.setFillColor(color.r, color.g, color.b);
    this.pdf.setDrawColor(color.r * 0.8, color.g * 0.8, color.b * 0.8);
    this.pdf.rect(taskX, y - 4, taskWidth, barHeight, 'FD'); // F = fill, D = draw border
    
    // Task duration text on bar (if bar is wide enough)
    if (taskWidth > 15) {
      this.pdf.setFontSize(7);
      this.pdf.setTextColor(255, 255, 255);
      this.pdf.text(`${task.duration}d`, taskX + 2, y - 1);
    }
  }
  
  /**
   * Group tasks by trade for organized display
   */
  private groupTasksByTrade(tasks: Task[]): Map<string, Task[]> {
    const grouped = new Map<string, Task[]>();
    
    tasks.forEach(task => {
      const tradeName = task.tradeId || 'General';
      if (!grouped.has(tradeName)) {
        grouped.set(tradeName, []);
      }
      grouped.get(tradeName)!.push(task);
    });
    
    // Sort tasks within each trade by start date
    grouped.forEach(tradeTasks => {
      tradeTasks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    });
    
    return grouped;
  }
  
  /**
   * Add summary table with task details
   */
  private addSummaryTable(tasks: Task[]): void {
    const tableStartY = this.margin + 40 + this.chartHeight + 20;
    
    // Table title
    this.pdf.setFontSize(14);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setTextColor(0, 0, 0);
    this.pdf.text('Task Summary', this.margin, tableStartY);
    
    // Table headers
    const headers = ['Task Name', 'Trade', 'Start Date', 'End Date', 'Duration', 'Predecessors'];
    const colWidths = [60, 30, 25, 25, 20, 35]; // Column widths in mm
    let currentX = this.margin;
    let currentY = tableStartY + 10;
    
    // Draw header row
    this.pdf.setFontSize(9);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFillColor(240, 240, 240);
    this.pdf.rect(this.margin, currentY - 5, this.pageWidth - (this.margin * 2), 7, 'F');
    
    headers.forEach((header, index) => {
      this.pdf.text(header, currentX + 2, currentY);
      currentX += colWidths[index];
    });
    
    currentY += 10;
    
    // Draw data rows
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(8);
    
    tasks.slice(0, 20).forEach((task, rowIndex) => { // Limit to 20 tasks to prevent overflow
      currentX = this.margin;
      
      // Alternating row colors
      if (rowIndex % 2 === 0) {
        this.pdf.setFillColor(250, 250, 250);
        this.pdf.rect(this.margin, currentY - 4, this.pageWidth - (this.margin * 2), 6, 'F');
      }
      
      // Task data
      const rowData = [
        task.name.length > 30 ? task.name.substring(0, 27) + '...' : task.name,
        task.tradeId || 'General',
        this.formatDate(task.startDate),
        this.formatDate(task.getEndDate()),
        `${task.duration}d`,
        task.dependencies.length > 0 ? task.dependencies.length + ' deps' : '-'
      ];
      
      this.pdf.setTextColor(40, 40, 40);
      rowData.forEach((data, colIndex) => {
        this.pdf.text(data, currentX + 2, currentY, { maxWidth: colWidths[colIndex] - 4 });
        currentX += colWidths[colIndex];
      });
      
      currentY += 7;
    });
    
    // Table border
    this.pdf.setDrawColor(200, 200, 200);
    this.pdf.rect(this.margin, tableStartY + 5, this.pageWidth - (this.margin * 2), (tasks.length + 1) * 7);
    
    // Add note if tasks were truncated
    if (tasks.length > 20) {
      this.pdf.setFontSize(8);
      this.pdf.setTextColor(100, 100, 100);
      this.pdf.text(`Note: Showing first 20 of ${tasks.length} tasks`, this.margin, currentY + 5);
    }
  }
  
  /**
   * Format date as MM/DD/YYYY
   */
  private formatDate(date: Date): string {
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
  }
  
  /**
   * Format date as MM/DD for timeline header
   */
  private formatShortDate(date: Date): string {
    return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
  }
  
  /**
   * Convert hex color to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 59, g: 130, b: 246 }; // Default blue
  }
}
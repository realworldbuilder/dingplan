import { Task } from './Task';
import { TaskManager } from './TaskManager';

/**
 * XerExporter class handles exporting project data to Primavera P6 XER format
 * 
 * XER is a tab-delimited text file with specific sections and tables:
 * - ERMHDR: Header with metadata
 * - Tables with %T, %F (field names), and %R (rows) markers
 * - %E marker at the end
 */
export class XerExporter {
  private version: string;
  private username: string;
  private exportDate: string;
  private currency: string;
  private tables: Map<string, { columns: string[], rows: string[][] }>;
  
  private readonly ENCODING = 'cp1252'; // Standard encoding for XER files
  
  constructor(
    version: string = '19.12',
    username: string = 'ConstructionPlanner'
  ) {
    this.version = version;
    this.username = username;
    this.exportDate = this.formatDate(new Date());
    this.currency = 'USD';
    this.tables = new Map();
  }
  
  /**
   * Add a table definition with column names
   */
  public addTable(tableName: string, columns: string[]): void {
    this.tables.set(tableName, { columns, rows: [] });
  }
  
  /**
   * Add a row to a specified table
   */
  public addRow(tableName: string, rowData: any[]): void {
    const table = this.tables.get(tableName);
    if (!table) {
      throw new Error(`Table ${tableName} does not exist`);
    }
    
    if (rowData.length !== table.columns.length) {
      throw new Error(`Row data does not match column count for table ${tableName}`);
    }
    
    // Convert all values to strings and handle special cases (dates, etc.)
    const processedRow = rowData.map(value => {
      if (value instanceof Date) {
        return this.formatXerDate(value);
      }
      return value !== null && value !== undefined ? String(value) : '';
    });
    
    table.rows.push(processedRow);
  }
  
  /**
   * Generate XER file content from the configured tables
   */
  public generateXer(): string {
    const lines: string[] = [];
    
    // Add header
    const header = `ERMHDR\t${this.version}\t${this.exportDate}\t\t${this.username}\t\t\t${this.currency}`;
    lines.push(header);
    
    // Add tables
    this.tables.forEach((tableData, tableName) => {
      // Table header
      lines.push(`%T\t${tableName}`);
      
      // Column headers
      lines.push(`%F\t${tableData.columns.join('\t')}`);
      
      // Rows
      tableData.rows.forEach(row => {
        lines.push(`%R\t${row.join('\t')}`);
      });
    });
    
    // End marker
    lines.push('%E');
    
    return lines.join('\n');
  }
  
  /**
   * Format date to XER standard format (YYYY-MM-DD HH:MM)
   */
  private formatXerDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  }
  
  /**
   * Format date as YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
  }
  
  /**
   * Export project data from TaskManager to XER format
   */
  public exportProject(
    taskManager: TaskManager, 
    projectName: string = 'Construction Project',
    projectShortName: string = 'CP001'
  ): string {
    // Initialize required tables
    this.setupRequiredTables();
    
    // Generate unique IDs for XER
    const projectId = '1'; // Simple ID for now
    
    // Add project data
    this.addProjectData(projectId, projectName, projectShortName);
    
    // Add WBS structure (swimlanes)
    this.addWbsData(projectId, taskManager);
    
    // Add tasks
    this.addTaskData(projectId, taskManager);
    
    // Add task dependencies
    this.addTaskDependencies(taskManager);
    
    // Generate the XER content
    return this.generateXer();
  }
  
  /**
   * Set up the required tables for XER export
   */
  private setupRequiredTables(): void {
    // CALENDAR table
    this.addTable('CALENDAR', [
      'clndr_id', 'clndr_name', 'clndr_type', 'default_flag', 
      'clndr_data', 'day_hr_cnt', 'week_hr_cnt'
    ]);
    
    // Add a standard calendar
    this.addRow('CALENDAR', [
      '1', 'Standard', 'CA_Base', 'Y', 
      // Calendar data: workdays Mon-Fri (0=Sun, 1=Mon, etc.)
      '(0||1(0800|1700|0|0)|1(0800|1700|0|0)|1(0800|1700|0|0)|1(0800|1700|0|0)|1(0800|1700|0|0)|0||)',
      '8', '40'
    ]);
    
    // CURRTYPE table - currency settings
    this.addTable('CURRTYPE', [
      'curr_id', 'curr_short_name', 'curr_symbol', 'decimal_digit_cnt',
      'curr_type', 'curr_format', 'decimal_symbol', 'digit_group_symbol'
    ]);
    
    // Add USD currency
    this.addRow('CURRTYPE', [
      '1', 'USD', '$', '2', 'CT_Base', '$1,000.00', '.', ','
    ]);
    
    // PROJECT table
    this.addTable('PROJECT', [
      'proj_id', 'proj_short_name', 'proj_name', 'clndr_id',
      'plan_start_date', 'plan_end_date', 'last_recalc_date'
    ]);
    
    // PROJWBS table
    this.addTable('PROJWBS', [
      'wbs_id', 'parent_wbs_id', 'proj_id', 'seq_num', 
      'wbs_short_name', 'wbs_name', 'wbs_level_cnt'
    ]);
    
    // TASK table
    this.addTable('TASK', [
      'task_id', 'proj_id', 'wbs_id', 'clndr_id', 
      'task_type', 'task_code', 'task_name', 'task_status',
      'target_start_date', 'target_end_date', 
      'target_drtn_hr_cnt', 'remain_drtn_hr_cnt'
    ]);
    
    // TASKPRED table
    this.addTable('TASKPRED', [
      'task_pred_id', 'task_id', 'pred_task_id', 'pred_type', 'lag_hr_cnt'
    ]);
  }
  
  /**
   * Add project data to PROJECT table
   */
  private addProjectData(
    projectId: string, 
    projectName: string,
    projectShortName: string
  ): void {
    const now = new Date();
    // Calculate project dates (use today as data date and add 1 year for end date)
    const endDate = new Date(now);
    endDate.setFullYear(endDate.getFullYear() + 1);
    
    this.addRow('PROJECT', [
      projectId,
      projectShortName,
      projectName,
      '1', // Calendar ID
      this.formatXerDate(now), // Plan start date
      this.formatXerDate(endDate), // Plan end date
      this.formatXerDate(now) // Last recalc date (data date)
    ]);
  }
  
  /**
   * Add WBS structure based on swimlanes
   */
  private addWbsData(projectId: string, taskManager: TaskManager): void {
    // Add root WBS node
    this.addRow('PROJWBS', [
      'WBS1', // WBS ID for root
      '', // Parent WBS ID (empty for root)
      projectId,
      '1000', // Sequence number
      'ROOT', // Short name
      'Project Root', // Name
      '1' // Level
    ]);
    
    // Add swimlanes as WBS nodes
    taskManager.swimlanes.forEach((swimlane, index) => {
      const wbsId = `WBS${index + 2}`; // Start from WBS2
      
      this.addRow('PROJWBS', [
        wbsId,
        'WBS1', // Parent is the root
        projectId,
        String((index + 1) * 1000), // Sequence number
        swimlane.id.toUpperCase(), // Short name
        swimlane.name, // Name
        '2' // Level
      ]);
      
      // Store mapping of swimlane ID to WBS ID for tasks
      swimlane.wbsId = wbsId;
    });
  }
  
  /**
   * Add tasks to TASK table
   */
  private addTaskData(projectId: string, taskManager: TaskManager): void {
    let taskIdCounter = 1;
    
    taskManager.swimlanes.forEach(swimlane => {
      swimlane.tasks.forEach(task => {
        const xerTaskId = String(taskIdCounter++);
        task.xerTaskId = xerTaskId; // Store for dependencies
        
        // Calculate duration in hours (8 hours per workday)
        const durationHours = task.duration * 8;
        
        // Map task status to P6 status codes
        let taskStatus = 'TK_NotStart'; // Default
        if (task.status === 'in-progress') {
          taskStatus = 'TK_Active';
        } else if (task.status === 'completed') {
          taskStatus = 'TK_Complete';
        }
        
        this.addRow('TASK', [
          xerTaskId,
          projectId,
          swimlane.wbsId, // WBS ID
          '1', // Calendar ID
          'TT_Task', // Task type (normal task)
          task.id.substring(0, 8), // Task code (shorten UUID)
          task.name,
          taskStatus,
          this.formatXerDate(task.startDate),
          this.formatXerDate(task.getEndDate()),
          String(durationHours), // Target duration in hours
          task.status === 'completed' ? '0' : String(durationHours) // Remaining duration
        ]);
      });
    });
  }
  
  /**
   * Add task dependencies to TASKPRED table
   */
  private addTaskDependencies(taskManager: TaskManager): void {
    let predIdCounter = 1;
    
    // Process all tasks to find dependencies
    taskManager.getAllTasks().forEach(task => {
      // For each dependency
      task.dependencies.forEach(predId => {
        const predTask = taskManager.getTask(predId);
        
        if (predTask && predTask.xerTaskId && task.xerTaskId) {
          this.addRow('TASKPRED', [
            String(predIdCounter++), // Unique ID for this relationship
            task.xerTaskId, // Successor task ID
            predTask.xerTaskId, // Predecessor task ID
            'FS', // Finish-to-Start relationship
            '0' // No lag
          ]);
        }
      });
    });
  }
  
  /**
   * Save XER content to a file for download
   */
  public downloadXer(filename: string, xerContent: string): void {
    const blob = new Blob([xerContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename.endsWith('.xer') ? filename : `${filename}.xer`;
    document.body.appendChild(a);
    a.click();
    
    // Cleanup
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  }
} 
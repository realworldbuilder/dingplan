import { Task, TaskConfig } from './Task';
import { TaskManager } from './TaskManager';
import { generateUUID } from './utils';
import { Trades } from './Trades';

/**
 * XerImporter class handles importing Primavera P6 XER format files
 * 
 * XER is a tab-delimited text file with specific sections:
 * - ERMHDR: Header with metadata
 * - Tables with %T (table name), %F (field names), and %R (rows) markers
 * - %E marker at the end
 * 
 * Key tables:
 * - PROJWBS: Work Breakdown Structure (maps to swimlanes)
 * - TASK: Activities/tasks
 * - TASKPRED: Task relationships/dependencies
 * - CALENDAR: Working calendars
 */
export class XerImporter {
  private fileContent: string = '';
  private tables: Map<string, { columns: string[], rows: string[][] }> = new Map();
  private projectId: string = '';
  private tasks: Map<string, any> = new Map(); // Map XER task ID to task data
  private wbsMap: Map<string, string> = new Map(); // Map WBS ID to name
  
  constructor() {}
  
  /**
   * Import XER file and return task configurations for DingPlan
   */
  public async importXerFile(file: File): Promise<{
    tasks: TaskConfig[],
    swimlanes: { id: string; name: string }[]
  }> {
    try {
      this.fileContent = await this.readFileContent(file);
      this.parseXerContent();
      
      const result = this.convertToTaskConfigs();
      
      console.log('XER import successful:', {
        tasks: result.tasks.length,
        swimlanes: result.swimlanes.length
      });
      
      return result;
    } catch (error) {
      console.error('XER import failed:', error);
      throw new Error(`XER import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  /**
   * Read file content as text
   */
  private readFileContent(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read file content'));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('File reading error'));
      };
      
      // Try different encodings for XER files
      try {
        reader.readAsText(file, 'UTF-8');
      } catch (error) {
        try {
          reader.readAsText(file, 'windows-1252'); // Common for XER files
        } catch (fallbackError) {
          reader.readAsText(file); // Default encoding
        }
      }
    });
  }
  
  /**
   * Parse XER content into tables
   */
  private parseXerContent(): void {
    const lines = this.fileContent.split('\n').map(line => line.trim());
    
    let currentTable = '';
    let currentColumns: string[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (!line || line.startsWith('//')) {
        continue; // Skip empty lines and comments
      }
      
      if (line.startsWith('ERMHDR')) {
        // Parse header for basic info
        const parts = line.split('\t');
        if (parts.length > 4) {
          console.log('XER version:', parts[1]);
          console.log('Export date:', parts[2]);
          console.log('Username:', parts[4]);
        }
        continue;
      }
      
      if (line.startsWith('%T\t')) {
        // Table header
        currentTable = line.substring(3).trim();
        currentColumns = [];
        this.tables.set(currentTable, { columns: [], rows: [] });
        continue;
      }
      
      if (line.startsWith('%F\t')) {
        // Field names
        currentColumns = line.substring(3).split('\t');
        const table = this.tables.get(currentTable);
        if (table) {
          table.columns = currentColumns;
        }
        continue;
      }
      
      if (line.startsWith('%R\t')) {
        // Row data
        const rowData = line.substring(3).split('\t');
        const table = this.tables.get(currentTable);
        if (table) {
          table.rows.push(rowData);
        }
        continue;
      }
      
      if (line === '%E') {
        // End of file
        break;
      }
    }
    
    console.log('Parsed XER tables:', Array.from(this.tables.keys()));
  }
  
  /**
   * Convert parsed XER data to DingPlan task configurations
   */
  private convertToTaskConfigs(): {
    tasks: TaskConfig[],
    swimlanes: { id: string; name: string }[]
  } {
    // Parse WBS structure first
    this.parseWBS();
    
    // Parse tasks
    this.parseTasks();
    
    // Parse dependencies
    this.parseDependencies();
    
    // Convert to DingPlan format
    const tasks: TaskConfig[] = [];
    const swimlaneSet = new Set<string>();
    
    this.tasks.forEach((taskData, taskId) => {
      // Skip summary/milestone tasks
      if (taskData.task_type === 'TT_WBS' || taskData.task_type === 'TT_Mile') {
        return;
      }
      
      try {
        const taskConfig: TaskConfig = {
          id: generateUUID(),
          name: this.cleanTaskName(taskData.task_name),
          startDate: this.parseXerDate(taskData.target_start_date),
          duration: this.parseXerDuration(taskData.target_drtn_hr_cnt),
          crewSize: 1, // Default crew size
          color: this.getTradeColor(taskData.wbs_name || 'General'),
          tradeId: this.mapToTradeId(taskData.wbs_name || 'General'),
          dependencies: taskData.dependencies || [],
          xerTaskId: taskId // Store for reference
        };
        
        tasks.push(taskConfig);
        
        // Add WBS to swimlanes
        const wbsName = taskData.wbs_name || 'General';
        swimlaneSet.add(wbsName);
        
      } catch (error) {
        console.warn('Skipping invalid task:', taskData.task_name, error);
      }
    });
    
    const swimlanes = Array.from(swimlaneSet).map((name, index) => ({
      id: `swimlane-${index + 1}`,
      name: name
    }));
    
    return { tasks, swimlanes };
  }
  
  /**
   * Parse WBS structure from PROJWBS table
   */
  private parseWBS(): void {
    const wbsTable = this.tables.get('PROJWBS');
    if (!wbsTable) return;
    
    wbsTable.rows.forEach(row => {
      const wbsId = this.getColumnValue(wbsTable, row, 'wbs_id');
      const wbsName = this.getColumnValue(wbsTable, row, 'wbs_name') || 
                     this.getColumnValue(wbsTable, row, 'wbs_short_name') ||
                     'General';
      
      if (wbsId) {
        this.wbsMap.set(wbsId, wbsName);
      }
    });
    
    console.log('Parsed WBS:', Array.from(this.wbsMap.entries()));
  }
  
  /**
   * Parse tasks from TASK table
   */
  private parseTasks(): void {
    const taskTable = this.tables.get('TASK');
    if (!taskTable) {
      throw new Error('No TASK table found in XER file');
    }
    
    taskTable.rows.forEach(row => {
      const taskId = this.getColumnValue(taskTable, row, 'task_id');
      if (!taskId) return;
      
      const wbsId = this.getColumnValue(taskTable, row, 'wbs_id');
      const wbsName = this.wbsMap.get(wbsId) || 'General';
      
      const taskData = {
        task_id: taskId,
        task_name: this.getColumnValue(taskTable, row, 'task_name') || 'Unnamed Task',
        task_type: this.getColumnValue(taskTable, row, 'task_type'),
        task_status: this.getColumnValue(taskTable, row, 'task_status'),
        target_start_date: this.getColumnValue(taskTable, row, 'target_start_date') ||
                          this.getColumnValue(taskTable, row, 'act_start_date'),
        target_end_date: this.getColumnValue(taskTable, row, 'target_end_date') ||
                        this.getColumnValue(taskTable, row, 'act_end_date'),
        target_drtn_hr_cnt: this.getColumnValue(taskTable, row, 'target_drtn_hr_cnt') ||
                          this.getColumnValue(taskTable, row, 'act_work_qty'),
        remain_drtn_hr_cnt: this.getColumnValue(taskTable, row, 'remain_drtn_hr_cnt'),
        wbs_id: wbsId,
        wbs_name: wbsName,
        dependencies: [] as string[]
      };
      
      this.tasks.set(taskId, taskData);
    });
    
    console.log('Parsed tasks:', this.tasks.size);
  }
  
  /**
   * Parse dependencies from TASKPRED table
   */
  private parseDependencies(): void {
    const predTable = this.tables.get('TASKPRED');
    if (!predTable) return;
    
    predTable.rows.forEach(row => {
      const taskId = this.getColumnValue(predTable, row, 'task_id');
      const predTaskId = this.getColumnValue(predTable, row, 'pred_task_id');
      const predType = this.getColumnValue(predTable, row, 'pred_type') || 'FS';
      
      if (taskId && predTaskId && this.tasks.has(taskId)) {
        const taskData = this.tasks.get(taskId);
        if (taskData && this.tasks.has(predTaskId)) {
          // Map XER task ID to DingPlan UUID (will be resolved after import)
          taskData.dependencies.push(predTaskId);
        }
      }
    });
    
    console.log('Processed dependencies');
  }
  
  /**
   * Get column value from row by column name
   */
  private getColumnValue(table: { columns: string[], rows: string[][] }, row: string[], columnName: string): string {
    const index = table.columns.findIndex(col => 
      col.toLowerCase() === columnName.toLowerCase()
    );
    
    if (index === -1 || index >= row.length) {
      return '';
    }
    
    return row[index]?.trim() || '';
  }
  
  /**
   * Parse XER date format to JavaScript Date
   */
  private parseXerDate(dateStr: string): Date {
    if (!dateStr) {
      return new Date(); // Default to today
    }
    
    // XER dates can be in various formats:
    // YYYY-MM-DD HH:MM
    // DD-MMM-YY
    // MM/DD/YY
    
    try {
      // Try ISO format first (YYYY-MM-DD)
      if (dateStr.includes('-') && dateStr.length >= 8) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      
      // Try US format (MM/DD/YY or MM/DD/YYYY)
      if (dateStr.includes('/')) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
      
      // Try DD-MMM-YY format
      if (dateStr.includes('-')) {
        const parts = dateStr.split('-');
        if (parts.length === 3) {
          const day = parseInt(parts[0], 10);
          const monthAbbr = parts[1].toLowerCase();
          let year = parseInt(parts[2], 10);
          
          // Convert 2-digit year to 4-digit
          if (year < 50) {
            year += 2000;
          } else if (year < 100) {
            year += 1900;
          }
          
          const monthMap: { [key: string]: number } = {
            'jan': 0, 'feb': 1, 'mar': 2, 'apr': 3, 'may': 4, 'jun': 5,
            'jul': 6, 'aug': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dec': 11
          };
          
          const month = monthMap[monthAbbr];
          if (month !== undefined && day >= 1 && day <= 31) {
            return new Date(year, month, day);
          }
        }
      }
      
      // Fallback: try direct parsing
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        return date;
      }
      
    } catch (error) {
      console.warn('Failed to parse date:', dateStr);
    }
    
    // Ultimate fallback
    return new Date();
  }
  
  /**
   * Parse XER duration (in hours) to days
   */
  private parseXerDuration(durationStr: string): number {
    if (!durationStr) return 1;
    
    try {
      const hours = parseFloat(durationStr);
      if (isNaN(hours) || hours <= 0) {
        return 1;
      }
      
      // Convert hours to days (8 hours = 1 day)
      const days = Math.max(1, Math.round(hours / 8));
      return days;
      
    } catch (error) {
      console.warn('Failed to parse duration:', durationStr);
      return 1;
    }
  }
  
  /**
   * Clean and standardize task names
   */
  private cleanTaskName(taskName: string): string {
    if (!taskName) return 'Unnamed Task';
    
    return taskName
      .trim()
      .replace(/\s+/g, ' ') // Normalize whitespace
      .substring(0, 100); // Limit length
  }
  
  /**
   * Map WBS name to trade color
   */
  private getTradeColor(wbsName: string): string {
    const lowerName = wbsName.toLowerCase();
    
    // Map common construction terms to trade colors
    const colorMappings: { [key: string]: string } = {
      'concrete': '#8B4513',
      'foundation': '#8B4513',
      'slab': '#8B4513',
      'structural': '#4682B4',
      'steel': '#4682B4',
      'framing': '#4682B4',
      'electrical': '#FFD700',
      'power': '#FFD700',
      'lighting': '#FFD700',
      'mechanical': '#32CD32',
      'hvac': '#32CD32',
      'plumbing': '#1E90FF',
      'piping': '#1E90FF',
      'roofing': '#8B0000',
      'roof': '#8B0000',
      'drywall': '#DDA0DD',
      'painting': '#FF69B4',
      'flooring': '#D2691E',
      'finish': '#DDA0DD',
      'excavation': '#8B4513',
      'site': '#228B22',
      'landscaping': '#228B22',
      'demolition': '#DC143C'
    };
    
    for (const [term, color] of Object.entries(colorMappings)) {
      if (lowerName.includes(term)) {
        return color;
      }
    }
    
    // Default color
    return '#3B82F6';
  }
  
  /**
   * Map WBS name to trade ID
   */
  private mapToTradeId(wbsName: string): string {
    const lowerName = wbsName.toLowerCase();
    const allTrades = Trades.getAllTrades();
    
    // Try to find a matching trade
    const matchingTrade = allTrades.find(trade => 
      lowerName.includes(trade.name.toLowerCase()) ||
      trade.name.toLowerCase().includes(lowerName)
    );
    
    if (matchingTrade) {
      return matchingTrade.id;
    }
    
    // Map common terms to trade IDs
    const tradeMappings: { [key: string]: string } = {
      'concrete': 'concrete',
      'foundation': 'concrete',
      'slab': 'concrete',
      'structural': 'framing',
      'steel': 'framing',
      'framing': 'framing',
      'electrical': 'electrical',
      'power': 'electrical',
      'lighting': 'electrical',
      'mechanical': 'hvac',
      'hvac': 'hvac',
      'plumbing': 'plumbing',
      'piping': 'plumbing',
      'roofing': 'roofing',
      'roof': 'roofing',
      'drywall': 'drywall',
      'painting': 'painting',
      'flooring': 'flooring',
      'finish': 'finishing',
      'excavation': 'demolition',
      'site': 'finishing',
      'landscaping': 'finishing',
      'demolition': 'demolition'
    };
    
    for (const [term, tradeId] of Object.entries(tradeMappings)) {
      if (lowerName.includes(term)) {
        return tradeId;
      }
    }
    
    // Default trade
    return 'general';
  }
  
  /**
   * Show file picker and import XER file
   */
  public static showImportDialog(): Promise<{
    tasks: TaskConfig[],
    swimlanes: { id: string; name: string }[]
  }> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xer,.XER';
      input.style.display = 'none';
      
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) {
          reject(new Error('No file selected'));
          return;
        }
        
        try {
          const importer = new XerImporter();
          const result = await importer.importXerFile(file);
          document.body.removeChild(input);
          resolve(result);
        } catch (error) {
          document.body.removeChild(input);
          reject(error);
        }
      };
      
      input.oncancel = () => {
        document.body.removeChild(input);
        reject(new Error('File selection cancelled'));
      };
      
      document.body.appendChild(input);
      input.click();
    });
  }
}
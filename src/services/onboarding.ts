import { generateUUID } from '../utils';

export interface Task {
  id: string;
  name: string;
  startDate: Date;
  duration: number;
  crewSize: number;
  color: string;
  tradeId: string;
  dependencies: string[];
  swimlaneId: string;
  workOnSaturday?: boolean;
  workOnSunday?: boolean;
}

export interface Swimlane {
  id: string;
  name: string;
  color: string;
}

export function checkFirstVisit(): boolean {
  return !localStorage.getItem('dingplan_has_visited');
}

export function markVisited(): void {
  localStorage.setItem('dingplan_has_visited', 'true');
}

export function createWelcomeProject(canvas: any): void {
  if (!checkFirstVisit()) return;

  // Create swimlanes for the demo project
  const swimlanes: Swimlane[] = [
    { id: 'demolition', name: 'Demolition', color: '#ef4444' },
    { id: 'rough-in', name: 'Rough-In', color: '#f97316' },
    { id: 'drywall-insulation', name: 'Drywall & Insulation', color: '#eab308' },
    { id: 'finishes', name: 'Finishes', color: '#22c55e' },
    { id: 'mep-trim', name: 'MEP Trim', color: '#3b82f6' },
    { id: 'closeout', name: 'Closeout', color: '#8b5cf6' }
  ];

  // Set today as the start date
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Helper function to calculate start dates based on dependencies
  const calculateStartDate = (baseDate: Date, dependentTasks: string[], allTasks: Task[]): Date => {
    if (dependentTasks.length === 0) return new Date(baseDate);
    
    let latestEndDate = new Date(baseDate);
    dependentTasks.forEach(depId => {
      const depTask = allTasks.find(t => t.id === depId);
      if (depTask) {
        const depEndDate = new Date(depTask.startDate);
        depEndDate.setDate(depEndDate.getDate() + depTask.duration);
        if (depEndDate > latestEndDate) {
          latestEndDate = depEndDate;
        }
      }
    });
    return latestEndDate;
  };

  // Create demo tasks with proper dependencies
  const tasks: Task[] = [];
  
  // Define tasks with their dependencies (by position in array for now)
  const taskDefinitions = [
    { name: 'Demolition', duration: 5, swimlaneId: 'demolition', tradeId: 'demo', color: '#ef4444', deps: [] },
    { name: 'Framing Layout', duration: 3, swimlaneId: 'rough-in', tradeId: 'carpentry', color: '#d97706', deps: [0] },
    { name: 'MEP Rough-In', duration: 10, swimlaneId: 'rough-in', tradeId: 'mep', color: '#dc2626', deps: [1] },
    { name: 'Electrical Rough-In', duration: 8, swimlaneId: 'rough-in', tradeId: 'electrical', color: '#fbbf24', deps: [1] },
    { name: 'Fire Protection', duration: 5, swimlaneId: 'rough-in', tradeId: 'fire-protection', color: '#f87171', deps: [2] },
    { name: 'Insulation', duration: 3, swimlaneId: 'drywall-insulation', tradeId: 'insulation', color: '#34d399', deps: [2, 3] },
    { name: 'Drywall Hang', duration: 5, swimlaneId: 'drywall-insulation', tradeId: 'drywall', color: '#60a5fa', deps: [4, 5] },
    { name: 'Drywall Finish', duration: 5, swimlaneId: 'drywall-insulation', tradeId: 'drywall', color: '#60a5fa', deps: [6] },
    { name: 'Prime & Paint', duration: 5, swimlaneId: 'finishes', tradeId: 'paint', color: '#a78bfa', deps: [7] },
    { name: 'Flooring', duration: 4, swimlaneId: 'finishes', tradeId: 'flooring', color: '#fb7185', deps: [8] },
    { name: 'Ceiling Grid', duration: 3, swimlaneId: 'finishes', tradeId: 'ceiling', color: '#fbbf24', deps: [7] },
    { name: 'MEP Trim-Out', duration: 5, swimlaneId: 'mep-trim', tradeId: 'mep', color: '#dc2626', deps: [8, 10] },
    { name: 'Electrical Trim', duration: 3, swimlaneId: 'mep-trim', tradeId: 'electrical', color: '#fbbf24', deps: [8, 10] },
    { name: 'Punch List', duration: 3, swimlaneId: 'closeout', tradeId: 'gc', color: '#6b7280', deps: [9, 11, 12] },
    { name: 'Final Clean & Turnover', duration: 2, swimlaneId: 'closeout', tradeId: 'gc', color: '#6b7280', deps: [13] }
  ];

  // First pass: create tasks with initial dates
  taskDefinitions.forEach((taskDef, index) => {
    const task: Task = {
      id: generateUUID(),
      name: taskDef.name,
      startDate: new Date(today),
      duration: taskDef.duration,
      crewSize: 4,
      color: taskDef.color,
      tradeId: taskDef.tradeId,
      dependencies: [],
      swimlaneId: taskDef.swimlaneId,
      workOnSaturday: false,
      workOnSunday: false
    };
    tasks.push(task);
  });

  // Second pass: calculate proper start dates and set dependencies
  taskDefinitions.forEach((taskDef, index) => {
    const task = tasks[index];
    const depTaskIds = taskDef.deps.map(depIndex => tasks[depIndex].id);
    task.dependencies = depTaskIds;
    task.startDate = calculateStartDate(today, depTaskIds, tasks);
  });

  // Set the project name
  localStorage.setItem('dingplan-project-name', 'Tenant Improvement — Suite 200');

  // Set swimlanes and add tasks to the canvas
  if (canvas && canvas.taskManager) {
    // Clear existing content
    const existingTasks = canvas.taskManager.getAllTasks();
    existingTasks.forEach((task: any) => {
      canvas.taskManager.removeTask(task.id);
    });

    // Set swimlanes
    canvas.taskManager.swimlanes = swimlanes;

    // Add tasks
    tasks.forEach(task => {
      canvas.taskManager.addTask(task);
    });

    // Update project name in UI
    const nameInput = document.querySelector('#left-project-name') as HTMLInputElement;
    if (nameInput) {
      nameInput.value = 'Tenant Improvement — Suite 200';
    }

    // Render the canvas
    canvas.render();
  }

  // Mark as visited
  markVisited();

  console.log('Welcome demo project loaded: Tenant Improvement — Suite 200');
}
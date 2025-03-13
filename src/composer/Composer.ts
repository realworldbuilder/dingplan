import { Canvas } from '../Canvas';
import { getTemplate, getTemplateNames, findTemplateMatches, TEMPLATES } from './Templates';
import crypto from 'crypto';

interface ComposerConfig {
  apiKey?: string;
  model?: string;
  canvas: Canvas;
}

interface FunctionCall {
  name: string;
  arguments: string;
}

interface ChatResponse {
  choices: {
    message: {
      function_call?: FunctionCall;
      content?: string;
    };
  }[];
}

class Composer {
  private apiKey: string;
  private model: string;
  private canvas: Canvas;
  private functions: any[];
  private debugMode: boolean = true; // Enable debug mode

  constructor(config: ComposerConfig) {
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gpt-3.5-turbo';
    this.canvas = config.canvas;
    
    // Define the functions the LLM can call
    this.functions = [
      {
        name: "createTask",
        description: "Create a new task in the construction plan",
        parameters: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the task"
            },
            duration: {
              type: "integer",
              description: "Duration in days"
            },
            startDate: {
              type: "string",
              description: "Start date in YYYY-MM-DD format, defaults to today if not specified"
            },
            tradeId: {
              type: "string",
              description: "The trade performing this task"
            },
            crewSize: {
              type: "integer",
              description: "Number of crew members assigned to this task"
            },
            color: {
              type: "string",
              description: "Color for the task (hex code)"
            },
            swimlaneId: {
              type: "string",
              description: "ID of the swimlane/zone to place the task in (e.g., 'zone1', 'zone2', 'zone3')"
            }
          },
          required: ["name", "duration"]
        }
      },
      {
        name: "createMultipleTasks",
        description: "Create multiple tasks at once",
        parameters: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: {
                    type: "string",
                    description: "Name of the task"
                  },
                  duration: {
                    type: "integer",
                    description: "Duration in days"
                  },
                  startDate: {
                    type: "string",
                    description: "Start date in YYYY-MM-DD format"
                  },
                  tradeId: {
                    type: "string",
                    description: "The trade performing this task"
                  },
                  crewSize: {
                    type: "integer",
                    description: "Number of crew members assigned to this task"
                  },
                  color: {
                    type: "string",
                    description: "Color for the task (hex code)"
                  },
                  swimlaneId: {
                    type: "string",
                    description: "ID of the swimlane/zone to place the task in (e.g., 'zone1', 'zone2', 'zone3')"
                  }
                },
                required: ["name", "duration"]
              }
            }
          },
          required: ["tasks"]
        }
      },
      {
        name: "createTaskSequence",
        description: "Create a sequence of related tasks with dependencies",
        parameters: {
          type: "object",
          properties: {
            sequenceName: {
              type: "string",
              description: "Overall name for the sequence"
            },
            startDate: {
              type: "string",
              description: "Start date for the first task in the sequence (YYYY-MM-DD), defaults to today if not specified"
            },
            location: {
              type: "string",
              description: "Optional location identifier for the sequence (e.g., 'Main Bathroom', 'Kitchen 1')"
            },
            swimlaneId: {
              type: "string",
              description: "ID of the swimlane/zone to place tasks in (e.g., 'zone1', 'zone2', 'zone3')"
            },
            tasks: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { 
                    type: "string",
                    description: "Name of the task"
                  },
                  duration: { 
                    type: "integer",
                    description: "Duration in days"
                  },
                  tradeId: { 
                    type: "string",
                    description: "Trade responsible for the task"
                  },
                  crewSize: { 
                    type: "integer",
                    description: "Number of people in the crew"
                  },
                  dependsOnPrevious: { 
                    type: "boolean",
                    description: "Whether this task depends on the completion of the previous task"
                  }
                },
                required: ["name", "duration"]
              }
            }
          },
          required: ["sequenceName", "tasks"]
        }
      },
      {
        name: "createFromTemplate",
        description: "Create a set of tasks from a predefined template",
        parameters: {
          type: "object",
          properties: {
            templateName: {
              type: "string",
              description: `Name of the template to use. Must be exactly one of these: ${getTemplateNames().join(", ")}`
            },
            startDate: { 
              type: "string",
              description: "Start date for the sequence (YYYY-MM-DD), defaults to today if not specified"
            },
            location: { 
              type: "string",
              description: "Optional location identifier (e.g., 'Master Bathroom')"
            },
            swimlaneId: {
              type: "string",
              description: "ID of the swimlane/zone to place tasks in (e.g., 'zone1', 'zone2', 'zone3')"
            },
            scaleFactor: { 
              type: "number",
              description: "Scale factor to apply to standard durations (e.g., 1.5 makes everything take 50% longer)"
            },
            inAllSwimlanes: {
              type: "boolean",
              description: "Whether to create the template in all swimlanes"
            }
          },
          required: ["templateName"]
        }
      },
      {
        name: "addDependency",
        description: "Add a dependency between two tasks",
        parameters: {
          type: "object",
          properties: {
            predecessorId: {
              type: "string",
              description: "ID of the predecessor task"
            },
            successorId: {
              type: "string",
              description: "ID of the successor task"
            }
          },
          required: ["predecessorId", "successorId"]
        }
      },
      {
        name: "listTasks",
        description: "List all tasks or tasks matching a filter",
        parameters: {
          type: "object",
          properties: {
            tradeId: {
              type: "string",
              description: "Filter tasks by trade ID"
            },
            startDateAfter: {
              type: "string",
              description: "Filter tasks that start after this date (YYYY-MM-DD)"
            },
            startDateBefore: {
              type: "string",
              description: "Filter tasks that start before this date (YYYY-MM-DD)"
            },
            swimlaneId: {
              type: "string",
              description: "Filter tasks by swimlane/zone ID"
            }
          }
        }
      },
      {
        name: "deleteTask",
        description: "Delete a task by ID",
        parameters: {
          type: "object",
          properties: {
            taskId: {
              type: "string",
              description: "ID of the task to delete"
            }
          },
          required: ["taskId"]
        }
      },
      {
        name: "listTemplates",
        description: "List all available construction sequence templates",
        parameters: {
          type: "object",
          properties: {}
        }
      },
      {
        name: "listSwimlanes",
        description: "List all available swimlanes/zones in the plan",
        parameters: {
          type: "object",
          properties: {}
        }
      }
    ];
  }

  async processPrompt(userInput: string): Promise<string> {
    try {
      this.debug(`Processing prompt: "${userInput}"`);
      
      if (!this.apiKey) {
        return "API key not configured. Please set your OpenAI API key.";
      }

      // Check if this is clearly a single task request vs a template request
      const isExplicitTaskRequest = userInput.toLowerCase().includes('task that') || 
                                    userInput.toLowerCase().includes('single task') ||
                                    userInput.toLowerCase().includes('one task');
      
      // Check if the input is explicitly requesting a template
      if (!isExplicitTaskRequest && (
          userInput.toLowerCase().includes('template') || 
          userInput.toLowerCase().includes('mep') || 
          userInput.toLowerCase().includes('rough') || 
          userInput.toLowerCase().includes('foundation') || 
          userInput.toLowerCase().includes('kitchen') || 
          userInput.toLowerCase().includes('bathroom') || 
          userInput.toLowerCase().includes('framing') ||
          userInput.toLowerCase().includes('institutional') ||
          userInput.toLowerCase().includes('industrial') ||
          userInput.toLowerCase().includes('specialized') ||
          userInput.toLowerCase().includes('school') ||
          userInput.toLowerCase().includes('hospital') ||
          userInput.toLowerCase().includes('warehouse') ||
          userInput.toLowerCase().includes('factory') ||
          userInput.toLowerCase().includes('stadium') ||
          userInput.toLowerCase().includes('arena') ||
          userInput.toLowerCase().includes('parking') ||
          userInput.toLowerCase().includes('healthcare') ||
          userInput.toLowerCase().includes('education') ||
          userInput.toLowerCase().includes('manufacturing') ||
          userInput.toLowerCase().includes('plant') ||
          userInput.toLowerCase().includes('data center'))) {
        
        // Extract the potential template name
        let templateWords = [];
        
        // Basic building components
        if (userInput.toLowerCase().includes('mep')) {
          templateWords.push('mep');
        }
        
        if (userInput.toLowerCase().includes('rough')) {
          templateWords.push('rough-in');
        }
        
        if (userInput.toLowerCase().includes('foundation')) {
          templateWords.push('foundation');
        }
        
        if (userInput.toLowerCase().includes('framing')) {
          templateWords.push('framing');
        }
        
        if (userInput.toLowerCase().includes('bathroom')) {
          templateWords.push('bathroom');
        }
        
        if (userInput.toLowerCase().includes('kitchen')) {
          templateWords.push('kitchen');
        }
        
        // New building categories
        if (userInput.toLowerCase().includes('institutional') || 
            userInput.toLowerCase().includes('school') || 
            userInput.includes('hospital') ||
            userInput.toLowerCase().includes('healthcare') ||
            userInput.toLowerCase().includes('education')) {
          templateWords.push('institutionalbuilding');
        }
        
        if (userInput.toLowerCase().includes('industrial') || 
            userInput.toLowerCase().includes('warehouse') || 
            userInput.toLowerCase().includes('factory') ||
            userInput.toLowerCase().includes('manufacturing') ||
            userInput.toLowerCase().includes('plant') ||
            userInput.toLowerCase().includes('data center')) {
          templateWords.push('industrialbuilding');
        }
        
        if (userInput.toLowerCase().includes('specialized') || 
            userInput.toLowerCase().includes('stadium') || 
            userInput.toLowerCase().includes('arena') ||
            userInput.toLowerCase().includes('parking') ||
            userInput.toLowerCase().includes('garage') ||
            userInput.toLowerCase().includes('sports') ||
            userInput.toLowerCase().includes('transportation')) {
          templateWords.push('specializedstructure');
        }
        
        // If we don't have specific matches, try to infer from context
        if (templateWords.length === 0) {
          // Try to match based on full content using all template keys
          const allTemplateKeys = getTemplateNames();
          for (const key of allTemplateKeys) {
            if (userInput.toLowerCase().includes(key.toLowerCase())) {
              templateWords.push(key);
            }
          }
        }
        
        // Check if "zones" or "each zone" is in the request
        const inAllSwimlanes = userInput.toLowerCase().includes('all swimlane') || 
                           userInput.toLowerCase().includes('each swimlane') ||
                           userInput.toLowerCase().includes('every swimlane');
        
        // If we found potential template words, try direct template matching
        if (templateWords.length > 0) {
          this.debug(`Potential template keywords: ${templateWords.join(', ')}`);
          
          // Try each keyword
          for (const keyword of templateWords) {
            const matches = findTemplateMatches(keyword);
            
            if (matches.length === 1) {
              this.debug(`Direct match found for keyword "${keyword}": ${matches[0]}`);
              
              // We found a direct match! Use it.
              return this.createFromTemplate({
                templateName: matches[0],
                inAllSwimlanes: inAllSwimlanes
              });
            }
          }
        }
      }

      // Add the isExplicitTask parameter to the user message
      const llmRequest = {
        userInput,
        isExplicitTaskRequest
      };
      
      try {
        const response = await this.callLLM(JSON.stringify(llmRequest));
        
        if (response.choices && response.choices.length > 0) {
          const choice = response.choices[0];
          
          // Store the content for later use (if there is any)
          const textContent = choice.message.content || "";
          
          if (choice.message.function_call) {
            const functionCall = choice.message.function_call;
            
            // Parse the function arguments and add the isExplicitTask flag if it's a createTask call
            if (functionCall.name === 'createTask') {
              try {
                const args = JSON.parse(functionCall.arguments);
                args.isExplicitTask = isExplicitTaskRequest;
                functionCall.arguments = JSON.stringify(args);
              } catch (e) {
                this.debug('Error modifying function call arguments', e);
              }
            }
            
            // Execute the function call
            const functionResult = await this.handleFunctionCall(functionCall);
            
            // If there's content from the LLM, include it as part of the response
            if (textContent && textContent.trim().length > 0) {
              return textContent + "\n\n" + functionResult;
            }
            
            return functionResult;
          } else if (textContent) {
            return textContent;
          }
        }
        
        return "I didn't understand that command. Could you try again with different wording?";
      } catch (error: unknown) {
        if (error instanceof Error) {
          // Try a direct foundation template creation if the API fails and we're trying to create a foundation-related task
          if (userInput.toLowerCase().includes('foundation') && userInput.toLowerCase().includes('task')) {
            this.debug('API call failed, attempting direct template creation for foundation');
            
            // Extract duration if present
            const durationMatch = userInput.match(/(\d+)\s*days?/i);
            const duration = durationMatch ? parseInt(durationMatch[1]) : 7; // Default to 7 days if no duration specified
            
            return this.createFromTemplate({
              templateName: 'foundation',
              startDate: new Date(),
              scaleFactor: duration / 20 // Scale the 20-day template to match requested duration
            });
          }
          
          return `Error during processing command: ${error.message}`;
        }
        return `Error during processing command: ${String(error)}`;
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        return `Error processing command: ${error.message}`;
      }
      return `Error processing command: ${String(error)}`;
    }
  }

  private async callLLM(userInput: string): Promise<ChatResponse> {
    try {
      this.debug('Calling LLM API', userInput);
      
      // Parse request if it's a JSON string
      let normalizedInput = userInput;
      let isExplicitTaskRequest = false;
      
      try {
        const parsedInput = JSON.parse(userInput);
        if (parsedInput && typeof parsedInput === 'object') {
          normalizedInput = parsedInput.userInput || userInput;
          isExplicitTaskRequest = parsedInput.isExplicitTaskRequest || false;
        }
      } catch (e) {
        // Not a JSON string, use as is
        normalizedInput = userInput;
      }
      
      // Get available templates for the prompt
      const availableTemplates = getTemplateNames();
      
      const requestBody = {
        model: this.model,
        messages: [
          {
            role: "system",
            content: `You are a commercial construction sequence planning assistant that helps users plan large-scale construction projects such as high-rise buildings, data centers, and industrial facilities.

TEMPLATES:
The app has predefined commercial construction sequence templates. Each template represents a typical construction sequence that can be placed within your project schedule. Use the createFromTemplate function with the exact template name from this list: ${availableTemplates.join(", ")}

Templates are designed for:
- Commercial/Industrial construction (not residential)
- Large-scale projects
- Modular construction sequences 
- Professional construction teams

ASSISTANT BEHAVIOR:
- When a user mentions any templates or related terms, use the createFromTemplate function.
- HOWEVER, you should also provide helpful guidance along with executing functions:
  * Offer brief explanations of what you're doing and why
  * Suggest related templates or next steps that might be useful
  * Ask clarifying questions when the user's request is ambiguous
  * Provide tips on how to make better use of the available templates
  * Recommend best practices for construction sequencing

RESPONSE FORMAT:
Your responses should have two parts:
1. GUIDANCE: A brief message to help the user understand what you're doing or to ask for clarification
2. FUNCTION: The function call to execute the user's request

For example, if a user asks for a "foundation template," your response might be:
"I'll create a foundation sequence for you. This includes excavation, formwork, reinforcement, and concrete pouring. Consider adding underground utilities next. Which zone would you like to place this sequence in?"
[followed by the createFromTemplate function call]

${isExplicitTaskRequest ? "NOTE: The user has explicitly requested a single task, not a template." : ""}

Focus on being practical and helpful while prioritizing function execution for construction planning.

DATE HANDLING:
I can understand various date expressions. You can use phrases like "today", "tomorrow", "yesterday", "next Monday", "this Monday", "in X days", "X days from now", etc.`
          },
          {
            role: "user",
            content: normalizedInput
          }
        ],
        functions: this.functions,
        function_call: "auto"
      };
      
      this.debug('LLM API request body prepared', requestBody);
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API request failed: ${response.status} ${errorText}`);
      }

      const responseData = await response.json();
      this.debug('LLM API response received', responseData);
      return responseData;
    } catch (error: unknown) {
      console.error("Error calling LLM API:", error);
      throw error;
    }
  }

  private async handleFunctionCall(functionCall: FunctionCall): Promise<string> {
    try {
      this.debug('Handling function call', functionCall);
      
      const functionName = functionCall.name;
      const args = JSON.parse(functionCall.arguments);

      switch (functionName) {
        case 'createTask':
          return this.createTask(args);
        case 'createMultipleTasks':
          return this.createMultipleTasks(args);
        case 'createTaskSequence':
          return this.createTaskSequence(args);
        case 'createFromTemplate':
          return this.createFromTemplate(args);
        case 'addDependency':
          return this.addDependency(args);
        case 'listTasks':
          return this.listTasks(args);
        case 'deleteTask':
          return this.deleteTask(args);
        case 'listTemplates':
          return this.listTemplates();
        case 'listSwimlanes':
          return this.listSwimlanes();
        default:
          return `Unknown function: ${functionName}`;
      }
    } catch (error: unknown) {
      return this.handleError('handling function call', error);
    }
  }

  // Helper method to parse various date expressions
  private parseDateExpression(dateExpression: string): Date | null {
    if (!dateExpression) return null;
    
    const today = new Date();
    const normalizedExpression = dateExpression.toLowerCase().trim();
    
    // Handle "today", "tomorrow", "yesterday"
    if (normalizedExpression === 'today') {
      return today;
    } else if (normalizedExpression === 'tomorrow') {
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      return tomorrow;
    } else if (normalizedExpression === 'yesterday') {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return yesterday;
    }
    
    // Handle "next Monday", "next Tuesday", etc.
    const nextDayMatch = normalizedExpression.match(/next\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    if (nextDayMatch) {
      const dayName = nextDayMatch[1].toLowerCase();
      const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDayIndex = daysOfWeek.indexOf(dayName);
      
      if (targetDayIndex !== -1) {
        const result = new Date(today);
        const currentDayIndex = result.getDay();
        let daysToAdd = targetDayIndex - currentDayIndex;
        
        // If today is the target day or we've already passed it this week, go to next week
        if (daysToAdd <= 0) {
          daysToAdd += 7;
        }
        
        result.setDate(result.getDate() + daysToAdd);
        return result;
      }
    }
    
    // Handle "this Monday", "this Tuesday", etc.
    const thisDayMatch = normalizedExpression.match(/this\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    if (thisDayMatch) {
      const dayName = thisDayMatch[1].toLowerCase();
      const daysOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const targetDayIndex = daysOfWeek.indexOf(dayName);
      
      if (targetDayIndex !== -1) {
        const result = new Date(today);
        const currentDayIndex = result.getDay();
        let daysToAdd = targetDayIndex - currentDayIndex;
        
        // If we've already passed this day this week, roll over to next week
        if (daysToAdd < 0) {
          daysToAdd += 7;
        }
        
        result.setDate(result.getDate() + daysToAdd);
        return result;
      }
    }
    
    // Handle "in X days/weeks/months"
    const inTimeMatch = normalizedExpression.match(/in\s+(\d+)\s+(day|days|week|weeks|month|months)/i);
    if (inTimeMatch) {
      const amount = parseInt(inTimeMatch[1], 10);
      const unit = inTimeMatch[2].toLowerCase();
      const result = new Date(today);
      
      if (unit === 'day' || unit === 'days') {
        result.setDate(result.getDate() + amount);
      } else if (unit === 'week' || unit === 'weeks') {
        result.setDate(result.getDate() + (amount * 7));
      } else if (unit === 'month' || unit === 'months') {
        result.setMonth(result.getMonth() + amount);
      }
      
      return result;
    }
    
    // Handle "X days/weeks/months from now"
    const fromNowMatch = normalizedExpression.match(/(\d+)\s+(day|days|week|weeks|month|months)\s+from\s+now/i);
    if (fromNowMatch) {
      const amount = parseInt(fromNowMatch[1], 10);
      const unit = fromNowMatch[2].toLowerCase();
      const result = new Date(today);
      
      if (unit === 'day' || unit === 'days') {
        result.setDate(result.getDate() + amount);
      } else if (unit === 'week' || unit === 'weeks') {
        result.setDate(result.getDate() + (amount * 7));
      } else if (unit === 'month' || unit === 'months') {
        result.setMonth(result.getMonth() + amount);
      }
      
      return result;
    }
    
    // Try parsing standard date formats as a fallback
    try {
      const date = new Date(dateExpression);
      // Check if date is valid
      if (!isNaN(date.getTime())) {
        return date;
      }
    } catch (e) {
      // Parsing failed, return null
    }
    
    return null;
  }

  // Helper method to generate random colors for tasks
  private getRandomColor(): string {
    // List of pleasant colors for tasks
    const colors = [
      '#4285F4', // Google Blue
      '#EA4335', // Google Red
      '#FBBC05', // Google Yellow
      '#34A853', // Google Green
      '#8E44AD', // Purple
      '#3498DB', // Blue
      '#1ABC9C', // Turquoise
      '#F39C12', // Orange
      '#D35400', // Pumpkin
      '#27AE60', // Nephritis
      '#2980B9', // Belize Hole
      '#E74C3C'  // Alizarin
    ];
    
    return colors[Math.floor(Math.random() * colors.length)];
  }

  createTask(args: any): string {
    try {
      this.debug('Creating task', args);
      
      // Check if this looks like a template request mistakenly parsed as a task
      if (!args.isExplicitTask && 
          (args.name.toLowerCase().includes('template') || 
           args.name.toLowerCase().includes('sequence') ||
           args.name.toLowerCase().includes('foundation') ||
           args.name.toLowerCase().includes('mep') ||
           args.name.toLowerCase().includes('framing') ||
           args.name.toLowerCase().includes('kitchen') ||
           args.name.toLowerCase().includes('bathroom'))) {
        
        // This might be a template request, let's try to interpret it as such
        const potentialTemplate = args.name.toLowerCase();
        
        if (potentialTemplate.includes('foundation')) {
          return this.createFromTemplate({ templateName: 'foundation', swimlaneId: args.swimlaneId });
        } else if (potentialTemplate.includes('framing')) {
          return this.createFromTemplate({ templateName: 'framing', swimlaneId: args.swimlaneId });
        } else if (potentialTemplate.includes('mep') || potentialTemplate.includes('mechanical') || potentialTemplate.includes('electrical')) {
          return this.createFromTemplate({ templateName: 'mep', swimlaneId: args.swimlaneId });
        } else if (potentialTemplate.includes('kitchen')) {
          return this.createFromTemplate({ templateName: 'kitchen', swimlaneId: args.swimlaneId });
        } else if (potentialTemplate.includes('bathroom')) {
          return this.createFromTemplate({ templateName: 'bathroom', swimlaneId: args.swimlaneId });
        }
      }
      
      // Use the parseDateExpression method to parse the start date
      let startDate: Date;
      if (args.startDate) {
        // Try to parse using our parseDateExpression method
        const parsedDate = this.parseDateExpression(args.startDate);
        if (parsedDate) {
          startDate = parsedDate;
          this.debug(`Parsed date expression "${args.startDate}" to ${startDate.toISOString()}`);
        } else {
          // Fall back to standard date parsing
          startDate = new Date(args.startDate);
          
          // If that fails too, use current date
          if (isNaN(startDate.getTime())) {
            this.debug(`Invalid date format "${args.startDate}", using current date`);
            startDate = new Date();
          }
        }
      } else {
        startDate = new Date();
      }
      
      // Generate a unique ID for the task
      const taskId = crypto.randomUUID();
      
      // Determine the swimlane ID (default to zone1 if not specified)
      let swimlaneId = args.swimlaneId || 'zone1';
      
      // Normalize swimlane ID format - ensure we have the standard format
      if (swimlaneId.toLowerCase() === 'zone 1' || swimlaneId.toLowerCase() === 'zone1') {
        swimlaneId = 'zone1';
      } else if (swimlaneId.toLowerCase() === 'zone 2' || swimlaneId.toLowerCase() === 'zone2') {
        swimlaneId = 'zone2';
      } else if (swimlaneId.toLowerCase() === 'zone 3' || swimlaneId.toLowerCase() === 'zone3') {
        swimlaneId = 'zone3';
      }
      
      // Check if the swimlane exists
      const allSwimlanes = this.canvas.taskManager.swimlanes;
      const swimlaneExists = allSwimlanes.some((s: any) => s.id === swimlaneId);
      if (!swimlaneExists) {
        this.debug(`Warning: Swimlane "${swimlaneId}" does not exist. Available swimlanes: ${allSwimlanes.map((s: any) => s.id).join(', ')}`);
        
        // Use the first available swimlane as a fallback
        if (allSwimlanes.length > 0) {
          swimlaneId = allSwimlanes[0].id;
          this.debug(`Falling back to swimlane "${swimlaneId}"`);
        } else {
          return `Error creating task: No swimlanes available to place the task in.`;
        }
      }
      
      // Create the task data structure
      const taskData = {
        id: taskId,
        name: args.name,
        duration: args.duration || 1,
        startDate: startDate,
        tradeId: args.tradeId || 'general',
        crewSize: args.crewSize || 1,
        color: args.color || this.getRandomColor(),
        notes: args.notes || '',
        swimlaneId: swimlaneId
      };
      
      // Add the task to the canvas task manager
      this.debug(`Adding task to swimlane "${swimlaneId}"`, taskData);
      const addedTask = this.canvas.taskManager.addTask(taskData);
      
      if (!addedTask) {
        return `Error creating task: Failed to add task to the canvas.`;
      }
      
      // Check if the task was actually added to the specified swimlane
      const addedTaskCheck = this.canvas.taskManager.getTask(taskId);
      if (!addedTaskCheck) {
        this.debug(`Warning: Task was not found after adding.`);
      } else if ((addedTaskCheck as any).swimlaneId !== swimlaneId) {
        this.debug(`Warning: Task was added but to swimlane "${(addedTaskCheck as any).swimlaneId}" instead of "${swimlaneId}".`);
      } else {
        this.debug(`Task successfully added to swimlane "${swimlaneId}".`);
      }
      
      return `Task created: "${args.name}" (ID: ${taskId}) in ${swimlaneId}, starting on ${startDate.toLocaleDateString()}`;
    } catch (error: unknown) {
      if (error instanceof Error) {
        return `Error creating task: ${error.message}`;
      }
      return `Error creating task: ${String(error)}`;
    }
  }

  private createMultipleTasks(args: any): string {
    try {
      this.debug('Creating multiple tasks', args);
      
      if (!args.tasks || !Array.isArray(args.tasks) || args.tasks.length === 0) {
        return "No tasks provided to create";
      }

      const taskIds: string[] = [];

      for (const taskData of args.tasks) {
        // Parse start date or use current date
        let startDate = new Date();
        if (taskData.startDate) {
          startDate = new Date(taskData.startDate);
        }

        // Generate a UUID for the task
        const id = this.generateUUID();
        taskIds.push(id);
        
        const swimlaneId = taskData.swimlaneId || args.swimlaneId || 'zone1';
        this.debug(`Creating task "${taskData.name}" in ${swimlaneId}`);

        // Create the task in the specified swimlane
        const fullTaskData = {
          id,
          name: taskData.name,
          startDate,
          duration: taskData.duration,
          crewSize: taskData.crewSize || 1,
          color: taskData.color || '#3B82F6',
          tradeId: taskData.tradeId || '',
          dependencies: []
        };

        this.canvas.taskManager.addTask(fullTaskData, swimlaneId);
      }
      
      // Force a render to ensure all tasks are displayed
      this.canvas.render();
      
      // Get task details for better feedback
      const taskDetails = args.tasks.map((taskData: any, index: number) => {
        const swimlaneId = taskData.swimlaneId || args.swimlaneId || 'zone1';
        const swimlane = this.canvas.taskManager.swimlanes.find(s => s.id === swimlaneId);
        const swimlaneName = swimlane ? swimlane.name : swimlaneId;
        
        const startDateInfo = taskData.startDate ? 
          new Date(taskData.startDate).toLocaleDateString() : 
          "current date";
          
        return `${index + 1}. "${taskData.name}" in ${swimlaneName} starting on ${startDateInfo}`;
      }).join('\n');
      
      return `Created ${args.tasks.length} tasks:\n${taskDetails}\n\nIf you don't see them, try scrolling to their dates or checking if any trade filters are active.`;
    } catch (error: unknown) {
      return this.handleError('creating multiple tasks', error);
    }
  }

  private createTaskSequence(args: any): string {
    try {
      const { sequenceName, startDate, location, tasks, swimlaneId } = args;
      
      if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        return "No tasks provided for sequence creation";
      }
      
      const locationInfo = location ? ` for ${location}` : '';
      const targetSwimlane = swimlaneId || 'zone1';
      
      // Use date provided or default to today
      const baseDate = startDate ? new Date(startDate) : new Date();
      
      this.debug(`Creating sequence "${sequenceName}" with ${tasks.length} tasks in swimlane ${targetSwimlane}`);
      
      // Reset position before adding tasks to ensure they're laid out appropriately
      this.canvas.taskManager.resetTaskPositionsInSwimlane(targetSwimlane);
      
      // Create each task in sequence with appropriate dependencies
      let previousTaskId: string | null = null;
      
      for (const [index, taskInfo] of tasks.entries()) {
        // Deep copy to avoid modifying the original template
        const taskData: any = { ...taskInfo.taskData };
        
        // Calculate start date based on dependencies
        let taskStartDate = new Date(baseDate);
        
        if (previousTaskId && taskInfo.dependsOnPrevious) {
          // If this task depends on the previous one, find that task and use its end date
          const previousTask = this.canvas.taskManager.getTask(previousTaskId);
          if (previousTask) {
            taskStartDate = new Date(previousTask.getEndDate());
          }
        } else if (index > 0 && taskInfo.startsAfterPrevious) {
          // If task should start after previous but not depend on it
          const previousTask = previousTaskId ? this.canvas.taskManager.getTask(previousTaskId) : null;
          if (previousTask) {
            taskStartDate = new Date(previousTask.getEndDate());
          }
        } else if (taskInfo.offsetDays) {
          // Apply offset from base date if specified
          taskStartDate.setDate(taskStartDate.getDate() + taskInfo.offsetDays);
        }
        
        // Update the task data with calculated start date
        taskData.startDate = taskStartDate;
        
        // Update name if location is provided
        if (location && taskData.name && !taskData.name.includes(location)) {
          taskData.name = `${taskData.name} - ${location}`;
        }
        
        // Create the task
        this.debug(`Creating task "${taskData.name}" in ${targetSwimlane}`);
        const task = this.canvas.taskManager.addTask(taskData, targetSwimlane);
        
        // Store the task ID to use for dependencies
        previousTaskId = task.id;
      }
      
      // Force a canvas render to update the view
      this.canvas.render();
      
      const zoneInfo = swimlaneId ? ` in ${swimlaneId}` : '';
      return `Created ${tasks.length} tasks in the "${sequenceName}"${locationInfo} sequence${zoneInfo}`;
    } catch (error: unknown) {
      return this.handleError('creating task sequence', error);
    }
  }

  private createFromTemplate(args: any): string {
    try {
      const { templateName, startDate, location, swimlaneId, scaleFactor, inAllSwimlanes } = args;
      
      if (!templateName) {
        this.debug('No template name provided');
        return this.listTemplates() + "\n\nPlease specify a template name from the list above, or describe what kind of construction sequence you'd like to create.";
      }
      
      this.debug(`Attempting to find template: "${templateName}"`);
      
      // First try direct template lookup
      let template = getTemplate(templateName);
      
      // If not found, try the more advanced matching
      if (!template) {
        const possibleMatches = findTemplateMatches(templateName);
        this.debug(`Found ${possibleMatches.length} possible matches for "${templateName}": ${possibleMatches.join(', ')}`);
        
        if (possibleMatches.length === 1) {
          // Found exactly one match
          this.debug(`Using best match: ${possibleMatches[0]}`);
          const key = possibleMatches[0];
          template = getTemplate(key);
          
          // If we matched something different from what the user asked for, let them know
          if (key !== templateName) {
            const matchedTemplate = getTemplate(key);
            const introMsg = `I found a template that matches what you're looking for: "${matchedTemplate?.name}". `;
            const taskInfo = `This template includes ${matchedTemplate?.tasks.length} tasks such as ${matchedTemplate?.tasks.slice(0,3).map(t => t.name).join(", ")}, and more. `;
            const followupMsg = `\n\nAfter this, you might want to consider adding ${this.getRecommendedNextTemplate(key)}.`;
            
            const result = this.createTemplateSequence(args, key);
            return introMsg + taskInfo + result + followupMsg;
          }
        } else if (possibleMatches.length > 1) {
          // Multiple matches - give the user options with descriptions
          const options = possibleMatches.map((key: string) => {
            const t = getTemplate(key);
            return `- ${key}: ${t?.description} (${t?.tasks.length} tasks)`;
          }).join('\n');
          
          return `I found multiple templates that could match what you're looking for. Could you please specify which one you'd like to use?\n\n${options}\n\nYou can say something like "Use the ${possibleMatches[0]} template" or ask for more details about any specific template.`;
        }
      }
      
      if (!template) {
        // No matches found - show available templates with categories
        const categorizedTemplates = this.getCategorizedTemplates();
        const templatesByCategory = Object.entries(categorizedTemplates)
          .map(([category, templates]) => {
            return `\n${category}:\n` + templates.map(t => `- ${t}`).join('\n');
          }).join('\n');
          
        return `I couldn't find a template matching "${templateName}". Here are the available templates by category:${templatesByCategory}\n\nPlease try again with one of these templates or describe what you're trying to build in more detail.`;
      }
      
      this.debug(`Using template: ${template.name} with ${template.tasks.length} tasks`);
      
      // Create sequence with template
      const result = this.createTemplateSequence(args, templateName);
      
      // Add helpful follow-up suggestions
      const followupSuggestion = `\n\nNext steps: Consider ${this.getRecommendedNextTemplate(templateName)} to continue building your sequence.`;
      
      return `Created a ${template.name} sequence with ${template.tasks.length} tasks including ${template.tasks.slice(0,3).map(t => t.name).join(", ")}, and more.` + result + followupSuggestion;
    } catch (error: unknown) {
      return this.handleError('creating from template', error);
    }
  }
  
  // Helper method to create the actual template sequence
  private createTemplateSequence(args: any, templateName: string): string {
    const { startDate, location, swimlaneId, scaleFactor, inAllSwimlanes } = args;
    const template = getTemplate(templateName);
    
    if (!template) {
      return "Template not found.";
    }
    
    const sequenceName = template.name;
    const scale = scaleFactor || 1.0;
    
    // Convert template tasks to the proper format for createTaskSequence
    const formattedTasks = template.tasks.map(task => ({
      taskData: {
        name: task.name,
        duration: Math.max(1, Math.round(task.duration * scale)),
        crewSize: task.crewSize,
        tradeId: task.tradeId || '',
      },
      dependsOnPrevious: task.dependsOnPrevious
    }));
    
    // Add special handling for "to each zone" or "in all zones" in the request
    if (inAllSwimlanes === true || templateName.toLowerCase().includes("each swimlane") || 
        templateName.toLowerCase().includes("all swimlanes")) {
      
      this.debug("User requested template in all swimlanes");
      
      try {
        const swimlanes = this.getSwimlaneIds();
        let tasksCreated = 0;
        
        this.debug(`Creating template in all swimlanes: ${swimlanes.join(', ')}`);
        
        for (const swimlaneId of swimlanes) {
          const sequenceArgs = {
            sequenceName,
            startDate,
            location,
            swimlaneId: swimlaneId,
            tasks: [...formattedTasks] // Make a copy to avoid issues
          };
          
          // Create the sequence in this swimlane
          const result = this.createTaskSequence(sequenceArgs);
          this.debug(`Created sequence in ${swimlaneId}: ${result}`);
          tasksCreated += formattedTasks.length;
        }
        
        // Force a render to update the view
        this.canvas.render();
        
        const locationInfo = location ? ` for ${location}` : '';
        return `Created ${tasksCreated} tasks from "${template.name}"${locationInfo} template in all swimlanes`;
      } catch (err) {
        return this.handleError('creating in all swimlanes', err);
      }
    } else {
      // Create in just one specified swimlane
      const sequenceArgs = {
        sequenceName,
        startDate,
        location,
        swimlaneId: swimlaneId || 'zone1',
        tasks: formattedTasks
      };
      
      this.debug('Creating sequence in single zone', sequenceArgs);
      return this.createTaskSequence(sequenceArgs);
    }
  }
  
  // Helper method to get a recommended next template based on the current template
  private getRecommendedNextTemplate(currentTemplate: string): string {
    // Logic to recommend what template might logically come next
    if (currentTemplate.includes('site') || currentTemplate.includes('prep') || currentTemplate.includes('clearing')) {
      return "a foundation or deep foundations template";
    } else if (currentTemplate.includes('foundation')) {
      return "a structural steel or framing template";
    } else if (currentTemplate.includes('steel') || currentTemplate.includes('structure') || currentTemplate.includes('framing')) {
      return "a building envelope or facade template";
    } else if (currentTemplate.includes('envelope') || currentTemplate.includes('facade')) {
      return "an MEP rough-in template";
    } else if (currentTemplate.includes('mep')) {
      return "interior finishes or specialty systems templates";
    } else if (currentTemplate.includes('interior') || currentTemplate.includes('finishes')) {
      return "commissioning and completion templates";
    } else {
      return "related templates for other building systems";
    }
  }
  
  // Helper method to organize templates by category for better presentation
  private getCategorizedTemplates(): Record<string, string[]> {
    const templates = getTemplateNames();
    const categorized: Record<string, string[]> = {
      "Industrial Building Templates": [],
      "Specialized Structure Templates": [],
      "General Construction Templates": []
    };
    
    for (const template of templates) {
      if (template.startsWith('industrial_')) {
        categorized["Industrial Building Templates"].push(template);
      } else if (template.startsWith('specialized_')) {
        categorized["Specialized Structure Templates"].push(template);
      } else {
        categorized["General Construction Templates"].push(template);
      }
    }
    
    return categorized;
  }

  private listTemplates(): string {
    try {
      this.debug('Listing available templates');
      
      const templateList = Object.entries(TEMPLATES).map(([key, template]) => {
        // Show aliases if available
        const aliasText = template.aliases && template.aliases.length > 0 
          ? ` (also: ${template.aliases.join(', ')})` 
          : '';
          
        return `- ${key}: ${template.description} - ${template.tasks.length} tasks${aliasText}`;
      }).join('\n');
      
      return `Available templates:\n${templateList}`;
    } catch (error: unknown) {
      return this.handleError('listing templates', error);
    }
  }

  private addDependency(args: any): string {
    try {
      this.debug('Adding dependency', args);
      
      const { predecessorId, successorId } = args;
      
      if (!predecessorId || !successorId) {
        return "Both predecessor and successor task IDs are required";
      }

      // Check if both tasks exist
      const predecessor = this.canvas.taskManager.getAllTasks().find(task => task.id === predecessorId);
      const successor = this.canvas.taskManager.getAllTasks().find(task => task.id === successorId);

      if (!predecessor) {
        return `Predecessor task with ID ${predecessorId} not found`;
      }

      if (!successor) {
        return `Successor task with ID ${successorId} not found`;
      }

      // Add the dependency
      successor.dependencies.push(predecessorId);
      
      // Refresh the canvas
      this.canvas.render();

      return `Added dependency: "${predecessor.name}" -> "${successor.name}"`;
    } catch (error: unknown) {
      return this.handleError('adding dependency', error);
    }
  }

  private listTasks(args: any): string {
    try {
      this.debug('Listing tasks with filters', args);
      
      // First, get all tasks
      let allTasks = this.canvas.taskManager.getAllTasks();
      
      // Apply date and trade filters
      if (args.tradeId) {
        allTasks = allTasks.filter(task => task.tradeId === args.tradeId);
      }
      
      if (args.startDateAfter) {
        const afterDate = new Date(args.startDateAfter);
        allTasks = allTasks.filter(task => task.startDate >= afterDate);
      }
      
      if (args.startDateBefore) {
        const beforeDate = new Date(args.startDateBefore);
        allTasks = allTasks.filter(task => task.startDate <= beforeDate);
      }
      
      // Filter by swimlane if specified
      let tasks = allTasks;
      if (args.swimlaneId) {
        // Get all swimlanes
        const swimlanes = this.canvas.taskManager.swimlanes;
        
        // Find the specified swimlane
        const targetSwimlane = swimlanes.find(lane => lane.id === args.swimlaneId);
        
        if (targetSwimlane) {
          // Filter tasks to only those in the specified swimlane
          tasks = allTasks.filter(task => targetSwimlane.tasks.includes(task));
        } else {
          return `Swimlane with ID ${args.swimlaneId} not found`;
        }
      }
      
      if (tasks.length === 0) {
        return "No tasks found matching your criteria.";
      }
      
      // Format the task list
      const taskList = tasks.map(task => {
        const startDateStr = task.startDate.toLocaleDateString();
        
        // Find which swimlane this task belongs to
        const swimlanes = this.canvas.taskManager.swimlanes;
        const swimlane = swimlanes.find(lane => lane.tasks.includes(task));
        const swimlaneInfo = swimlane ? swimlane.id : 'None';
        
        return `- ${task.name} (ID: ${task.id}): ${startDateStr}, ${task.duration} days, Trade: ${task.tradeId || 'None'}, Swimlane: ${swimlaneInfo}`;
      }).join('\n');
      
      return `Found ${tasks.length} tasks:\n${taskList}`;
    } catch (error: unknown) {
      return this.handleError('listing tasks', error);
    }
  }

  private deleteTask(args: any): string {
    try {
      this.debug('Deleting task', args);
      
      const { taskId } = args;
      
      if (!taskId) {
        return "Task ID is required";
      }

      // Check if the task exists
      const task = this.canvas.taskManager.getAllTasks().find(task => task.id === taskId);
      
      if (!task) {
        return `Task with ID ${taskId} not found`;
      }

      // Store the name for the response
      const taskName = task.name;
      
      // Delete the task
      this.canvas.taskManager.removeTask(taskId);
      
      return `Deleted task "${taskName}" with ID ${taskId}`;
    } catch (error: unknown) {
      return this.handleError('deleting task', error);
    }
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  private listSwimlanes(): string {
    try {
      this.debug('Listing swimlanes');
      
      const swimlanes = this.canvas.taskManager.swimlanes;
      if (!swimlanes || swimlanes.length === 0) {
        return "No swimlanes found in the plan.";
      }
      
      const swimlaneList = swimlanes.map(lane => 
        `- ${lane.name} (ID: ${lane.id}): ${lane.tasks.length} tasks`
      ).join('\n');
      
      return `Available swimlanes/zones:\n${swimlaneList}`;
    } catch (error: unknown) {
      return this.handleError('listing swimlanes', error);
    }
  }

  // Helper method to get all swimlane IDs
  private getSwimlaneIds(): string[] {
    try {
      const swimlanes = this.canvas.taskManager.swimlanes;
      return swimlanes.map(lane => lane.id);
    } catch (error) {
      console.error("Error getting swimlane IDs:", error);
      return ['swimlane1', 'swimlane2', 'swimlane3']; // Fallback to default swimlanes
    }
  }

  // Method to set the API key after initialization
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }
  
  // Method to toggle debug mode
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled;
  }
  
  // Debug utility method
  private debug(message: string, data?: any): void {
    if (this.debugMode) {
      if (data) {
        console.log(`[Composer Debug] ${message}`, data);
      } else {
        console.log(`[Composer Debug] ${message}`);
      }
    }
  }
  
  // Error handling utility
  private handleError(operation: string, error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Composer Error] ${operation}: ${errorMessage}`, error);
    return `Error during ${operation}: ${errorMessage}`;
  }
}

export { Composer };
export type { ComposerConfig }; 
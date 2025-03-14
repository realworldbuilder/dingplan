import { Canvas } from '../Canvas';
import { getTemplate, getTemplateNames, findTemplateMatches, TEMPLATES } from './Templates';
import { WBSTemplate, getWBSTemplate, getWBSTemplateIds, getWBSTemplateNames, findBestMatchingWBSTemplate, getAllWBSTemplates } from './WBSTemplates';
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
      },
      {
        name: "createSwimlane",
        description: "Create a new swimlane/zone for organizing tasks",
        parameters: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "Unique identifier for the swimlane"
            },
            name: {
              type: "string",
              description: "Display name for the swimlane"
            },
            color: {
              type: "string",
              description: "Color for the swimlane (hex code)"
            }
          },
          required: ["id", "name", "color"]
        }
      },
      {
        name: "updateSwimlane",
        description: "Update an existing swimlane properties",
        parameters: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "ID of the swimlane to update"
            },
            name: {
              type: "string",
              description: "New name for the swimlane"
            },
            color: {
              type: "string",
              description: "New color for the swimlane (hex code)"
            }
          },
          required: ["id"]
        }
      },
      {
        name: "reorderSwimlanes",
        description: "Change the order of swimlanes in the plan",
        parameters: {
          type: "object",
          properties: {
            swimlaneIds: {
              type: "array",
              description: "Array of swimlane IDs in the desired order",
              items: {
                type: "string"
              }
            }
          },
          required: ["swimlaneIds"]
        }
      },
      {
        name: "adjustPlan",
        description: "Make high-level adjustments to the construction plan",
        parameters: {
          type: "object",
          properties: {
            action: {
              type: "string",
              description: "Type of adjustment to make",
              enum: ["shiftDates", "scaleDurations", "addBuffer", "optimizeSequence"]
            },
            affectedTaskIds: {
              type: "array",
              description: "IDs of tasks to adjust (empty for all tasks)",
              items: {
                type: "string"
              }
            },
            startDate: {
              type: "string",
              description: "New start date for shifting (YYYY-MM-DD)"
            },
            endDate: {
              type: "string",
              description: "Target end date for adjustments (YYYY-MM-DD)"
            },
            scaleFactor: {
              type: "number",
              description: "Factor to scale durations by (e.g., 0.8 for 20% shorter)"
            },
            bufferDays: {
              type: "integer",
              description: "Number of buffer days to add between tasks"
            }
          },
          required: ["action"]
        }
      },
      {
        name: "listWBSTemplates",
        description: "List available Work Breakdown Structure templates for construction projects",
        parameters: {
          type: "object",
          properties: {
            projectType: { type: "string", description: "Optional project type to filter templates (e.g., 'commercial', 'residential', 'industrial')" }
          },
          required: []
        }
      },
      {
        name: "applyWBSTemplate",
        description: "Apply a Work Breakdown Structure template to create swimlanes for a construction project",
        parameters: {
          type: "object",
          properties: {
            templateId: { type: "string", description: "ID of the WBS template to apply, or a project type to find a matching template" },
            clearExisting: { type: "boolean", description: "Whether to clear existing swimlanes before applying the template (default: false)" },
            customNames: { type: "array", items: { type: "string" }, description: "Optional custom names to override the default category names" }
          },
          required: ["templateId"]
        }
      },
      {
        name: "customizeSwimlaneTemplate",
        description: "Customize swimlanes by adding, removing, or reordering categories",
        parameters: {
          type: "object",
          properties: {
            action: { type: "string", description: "Action to perform: 'add', 'remove', 'rename', or 'reorder'" },
            category: { type: "string", description: "For add/remove/rename: The category name to act upon" },
            newName: { type: "string", description: "For rename: The new name for the category" },
            position: { type: "number", description: "For add: Position to insert (0-based index, -1 for end)" },
            newOrder: { type: "array", items: { type: "string" }, description: "For reorder: New order of category names" }
          },
          required: ["action"]
        }
      }
    ];
  }

  async processPrompt(userInput: string): Promise<string> {
    try {
      this.debug(`Processing prompt: "${userInput}"`);
      
      // Special case for healthcare template which seems to be causing issues
      if (userInput.toLowerCase().includes('healthcare') && 
          (userInput.toLowerCase().includes('template') || userInput.toLowerCase().includes('wbs'))) {
        
        // Apply the healthcare WBS template directly
        const healthcare = getWBSTemplate("healthcare_facility");
        if (healthcare) {
          this.debug("Detected healthcare template request, applying directly");
          
          // Apply the template
          try {
            // Create swimlanes based on healthcare template
            const swimlanes = this.canvas.taskManager.swimlanes;
            
            // Clear existing swimlanes if needed
            if (swimlanes.length > 0) {
              // Make a copy since we'll be modifying during iteration
              const toRemove = [...swimlanes];
              for (const swimlane of toRemove) {
                const index = this.canvas.taskManager.swimlanes.findIndex(s => s.id === swimlane.id);
                if (index >= 0) {
                  this.canvas.taskManager.swimlanes.splice(index, 1);
                }
              }
            }
            
            // Add new swimlanes from the template
            for (const category of healthcare.categories) {
              const id = category.toLowerCase()
                .replace(/&/g, 'and')
                .replace(/[^a-z0-9]+/g, '_')
                .trim();
              
              const color = this.getRandomColor();
              this.canvas.taskManager.addSwimlane(id, category, color);
            }
            
            // Update the display
            this.canvas.render();
            
            return `Successfully applied the Healthcare Facility WBS template with ${healthcare.categories.length} categories: ${healthcare.categories.join(", ")}`;
          } catch (err) {
            return `Error applying healthcare template: ${err.message}`;
          }
        }
      }
      
      // Continue with normal processing
      
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
      const wbsTemplates = getWBSTemplateNames();
      
      const requestBody = {
        model: this.model,
        messages: [
          {
            role: "system",
            content: `You are a friendly, conversational construction planning assistant for Dingplan, an interactive construction planning tool. You help users create and manage construction project timelines for commercial and industrial projects.

YOUR CAPABILITIES:
1. Create individual tasks or entire construction sequences
2. Apply predefined construction templates
3. Manage project zones (swimlanes) for organizing work areas
4. Make high-level plan adjustments and optimizations
5. Provide expert guidance on construction planning

SWIMLANE/ZONE IMPORTANCE:
Swimlanes (also called zones) are the fundamental organizational structure for all tasks in a plan. They represent physical areas or logical divisions of work (e.g., building sections, phases, or work breakdown structure).
- Every task MUST be assigned to a swimlane
- Current swimlanes are named 'zone1', 'zone2', 'zone3' internally by default
- When creating tasks or sequences, always specify a swimlane using the swimlaneId parameter
- If a user mentions a specific area or section, try to match it to an appropriate swimlane
- If no swimlane is mentioned, intelligently place tasks in appropriate swimlanes or use 'zone1' as default

WORK BREAKDOWN STRUCTURE (WBS) TEMPLATES:
The app now supports industry-standard Work Breakdown Structure templates that can be used to organize swimlanes according to construction best practices. Available templates include: ${wbsTemplates.join(", ")}.
- Use listWBSTemplates to show available WBS templates
- Use applyWBSTemplate to create swimlanes based on a specific WBS template
- Use customizeSwimlaneTemplate to customize the swimlanes to match project-specific needs
- Proactively suggest appropriate WBS templates based on the type of project the user is discussing

When users are starting a new project, recommend they begin by applying an appropriate WBS template to organize their swimlanes according to industry standards.

TEMPLATES:
The app has predefined commercial construction sequence templates representing typical construction phases. Use createFromTemplate with these templates: ${availableTemplates.join(", ")}

SWIMLANE MANAGEMENT:
You can help users organize their project by:
- Creating new swimlanes (zones) with the createSwimlane function
- Updating existing swimlane properties with updateSwimlane
- Reordering swimlanes with reorderSwimlanes
- Suggesting logical organization of project elements into swimlanes
- Always use the swimlaneId parameter with values like 'zone1', 'zone2', 'zone3' or newly created IDs

PLAN ADJUSTMENTS:
You can help optimize construction plans through:
- Shifting project dates (e.g., to accommodate delays)
- Scaling task durations (to accelerate or extend timelines)
- Adding buffer time between tasks for risk management
- Optimizing sequences to minimize trade switching

CONVERSATION STYLE:
- Be warm and approachable, using natural conversational language
- Ask clarifying questions when information is missing
- Offer suggestions and alternatives beyond what the user explicitly requests
- Explain construction concepts in clear, accessible terms
- Anticipate the user's needs and suggest next steps
- Reference specific construction best practices when relevant

GUIDANCE APPROACH:
- First address the user's immediate request
- Then provide helpful context about what you've done
- Suggest logical next steps in their planning process
- Highlight any risks or considerations they should be aware of
- Offer specific recommendations based on construction industry standards

${isExplicitTaskRequest ? "NOTE: The user has explicitly requested a single task, not a template." : ""}

Always strive to be both helpful and educational, balancing efficient task execution with providing valuable planning insights.`
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
      const functionName = functionCall.name;
      let args = {};
      
      try {
        args = JSON.parse(functionCall.arguments);
      } catch (error) {
        return `Error parsing function arguments: ${error}`;
      }
      
      // Log the function call for debugging
      this.debug(`Function call: ${functionName}`, args);
      
      switch (functionName) {
        case "createTask":
          return this.createTask(args);
        case "createMultipleTasks":
          return this.createMultipleTasks(args);
        case "createTaskSequence":
          return this.createTaskSequence(args);
        case "createFromTemplate":
          return await this.createFromTemplate(args);
        case "listTemplates":
          return this.listTemplates();
        case "addDependency":
          return this.addDependency(args);
        case "listTasks":
          return this.listTasks(args);
        case "deleteTask":
          return this.deleteTask(args);
        case "listSwimlanes":
          return this.listSwimlanes();
        case "createSwimlane":
          return this.createSwimlane(args);
        case "updateSwimlane":
          return this.updateSwimlane(args);
        case "reorderSwimlanes":
          return this.reorderSwimlanes(args);
        case "adjustPlan":
          return this.adjustPlan(args);
        case "listWBSTemplates":
          return this.listWBSTemplates(args);
        case "applyWBSTemplate":
          return await this.applyWBSTemplate(args);
        case "customizeSwimlaneTemplate":
          return await this.customizeSwimlaneTemplate(args);
        default:
          return `Unknown function: ${functionName}`;
      }
    } catch (error) {
      return this.handleError("executing function", error);
    }
  }
  
  // Fix the customizeSwimlaneTemplate method to avoid accessing private properties
  async customizeSwimlaneTemplate(args: any): Promise<string> {
    try {
      const action = args.action?.toLowerCase();
      const category = args.category;
      const newName = args.newName;
      const position = args.position !== undefined ? args.position : -1;
      const newOrder = args.newOrder || [];
      
      // Get existing swimlanes
      const swimlanes = this.canvas.taskManager.swimlanes;
      
      switch (action) {
        case 'add':
          if (!category) {
            return "Please provide a category name to add.";
          }
          
          // Create a safe ID from the category name
          let baseId = category.toLowerCase()
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9]+/g, '_')
            .trim();
          
          // Ensure uniqueness
          let id = baseId;
          let counter = 1;
          const existingIds = swimlanes.map(s => s.id);
          while (existingIds.includes(id)) {
            id = `${baseId}_${counter}`;
            counter++;
          }
          
          // Add the swimlane - color parameter is required
          const color = this.getRandomColor();
          this.canvas.taskManager.addSwimlane(id, category, color);
          
          // If position specified, handle reordering manually
          if (position >= 0 && position < swimlanes.length) {
            // Get the current swimlanes after adding the new one
            const currentSwimlanes = this.canvas.taskManager.swimlanes;
            // Find the index of the newly added swimlane
            const newIndex = currentSwimlanes.findIndex(s => s.id === id);
            
            if (newIndex >= 0 && newIndex !== position) {
              // Create a copy of the swimlanes array
              const reorderedSwimlanes = [...currentSwimlanes];
              // Remove the swimlane from its current position
              const [swimlane] = reorderedSwimlanes.splice(newIndex, 1);
              // Insert it at the desired position
              reorderedSwimlanes.splice(position, 0, swimlane);
              
              // Update all swimlane y positions
              reorderedSwimlanes.forEach((s, i) => {
                s.y = i * this.canvas.taskManager.SWIMLANE_HEIGHT;
              });
              
              // Replace the swimlanes array
              this.canvas.taskManager.swimlanes.length = 0;
              reorderedSwimlanes.forEach(s => this.canvas.taskManager.swimlanes.push(s));
              
              // Render the canvas to show changes
              this.canvas.render();
            }
            
            return `Added category "${category}" at position ${position}.`;
          }
          
          return `Added category "${category}" to the end of the swimlanes.`;
          
        case 'remove':
          if (!category) {
            return "Please provide a category name to remove.";
          }
          
          // Find swimlane by name
          const swimlaneToRemove = swimlanes.find(s => 
            s.name.toLowerCase() === category.toLowerCase()
          );
          
          if (!swimlaneToRemove) {
            return `No swimlane found with the name "${category}".`;
          }
          
          // Check if swimlane has tasks using swimlane's tasks array
          // Access swimlane.tasks directly instead of taskManager.tasks
          if (swimlaneToRemove.tasks && swimlaneToRemove.tasks.length > 0) {
            return `Cannot remove swimlane "${category}" as it contains ${swimlaneToRemove.tasks.length} tasks. Please move or delete these tasks first.`;
          }
          
          // Remove the swimlane
          const index = swimlanes.findIndex(s => s.id === swimlaneToRemove.id);
          if (index >= 0) {
            swimlanes.splice(index, 1);
            // Recalculate Y positions for remaining swimlanes
            swimlanes.forEach((swimlane, i) => {
              swimlane.y = i * this.canvas.taskManager.SWIMLANE_HEIGHT;
            });
            this.canvas.render();
          }
          
          return `Removed swimlane "${category}".`;
          
        case 'rename':
          if (!category || !newName) {
            return "Please provide both a category name to rename and a new name.";
          }
          
          // Find swimlane by name
          const swimlaneToRename = swimlanes.find(s => 
            s.name.toLowerCase() === category.toLowerCase()
          );
          
          if (!swimlaneToRename) {
            return `No swimlane found with the name "${category}".`;
          }
          
          // Update the swimlane directly since there's no updateSwimlane method
          swimlaneToRename.name = newName;
          this.canvas.render();
          
          return `Renamed swimlane from "${category}" to "${newName}".`;
          
        case 'reorder':
          if (!newOrder || newOrder.length === 0) {
            return "Please provide a new order for the swimlanes.";
          }
          
          // Validate that all category names exist
          const missingCategories = newOrder.filter(name => 
            !swimlanes.some(s => s.name.toLowerCase() === name.toLowerCase())
          );
          
          if (missingCategories.length > 0) {
            return `The following categories do not exist: ${missingCategories.join(", ")}`;
          }
          
          // Map category names to IDs
          const reorderedSwimlanes = newOrder.map(name => {
            return swimlanes.find(s => s.name.toLowerCase() === name.toLowerCase());
          }).filter(s => s !== undefined) as any[];
          
          // Check if all swimlanes are included
          if (reorderedSwimlanes.length !== swimlanes.length) {
            return `New order must include all ${swimlanes.length} swimlanes, but only ${reorderedSwimlanes.length} were provided.`;
          }
          
          // Update all swimlane y positions
          reorderedSwimlanes.forEach((swimlane, i) => {
            swimlane.y = i * this.canvas.taskManager.SWIMLANE_HEIGHT;
          });
          
          // Replace the swimlanes array
          this.canvas.taskManager.swimlanes.length = 0;
          reorderedSwimlanes.forEach(s => this.canvas.taskManager.swimlanes.push(s));
          
          // Render the canvas to show changes
          this.canvas.render();
          
          return `Reordered swimlanes to: ${newOrder.join(", ")}`;
          
        default:
          return `Unsupported action: "${action}". Supported actions are "add", "remove", "rename", and "reorder".`;
      }
    } catch (error) {
      console.error("Error customizing swimlane template:", error);
      return "Failed to customize swimlane template due to an error.";
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

  // Helper method to intelligently find the best matching swimlane
  private findBestMatchingSwimlane(swimlaneNameOrId: string): string | null {
    try {
      if (!swimlaneNameOrId) return null;
      
      const swimlanes = this.canvas.taskManager.swimlanes;
      if (!swimlanes || swimlanes.length === 0) return null;
      
      // Normalize input for better matching
      const normalizedInput = swimlaneNameOrId.toLowerCase().trim();
      
      // First, try exact match on ID
      const exactIdMatch = swimlanes.find(lane => lane.id.toLowerCase() === normalizedInput);
      if (exactIdMatch) return exactIdMatch.id;
      
      // Then, try exact match on name
      const exactNameMatch = swimlanes.find(lane => lane.name.toLowerCase() === normalizedInput);
      if (exactNameMatch) return exactNameMatch.id;
      
      // Handle common zone naming patterns
      if (normalizedInput.includes('zone') || normalizedInput.includes('area') || normalizedInput.includes('section')) {
        // Extract numbers from input
        const numbers = normalizedInput.match(/\d+/);
        if (numbers && numbers.length > 0) {
          const zoneNumber = numbers[0];
          const potentialZoneId = `zone${zoneNumber}`;
          
          // Check if this zone exists
          const zoneMatch = swimlanes.find(lane => lane.id.toLowerCase() === potentialZoneId.toLowerCase());
          if (zoneMatch) return zoneMatch.id;
        }
      }
      
      // Handle swimlane references
      if (normalizedInput.includes('swimlane')) {
        // Extract numbers from input
        const numbers = normalizedInput.match(/\d+/);
        if (numbers && numbers.length > 0) {
          const laneNumber = numbers[0];
          // Convert to zone format
          const potentialZoneId = `zone${laneNumber}`;
          
          // Check if this zone exists
          const zoneMatch = swimlanes.find(lane => lane.id.toLowerCase() === potentialZoneId.toLowerCase());
          if (zoneMatch) return zoneMatch.id;
        }
      }
      
      // Try partial matches on ID
      const partialIdMatch = swimlanes.find(lane => lane.id.toLowerCase().includes(normalizedInput) || 
                                               normalizedInput.includes(lane.id.toLowerCase()));
      if (partialIdMatch) return partialIdMatch.id;
      
      // Try partial matches on name
      const partialNameMatch = swimlanes.find(lane => lane.name.toLowerCase().includes(normalizedInput) || 
                                                normalizedInput.includes(lane.name.toLowerCase()));
      if (partialNameMatch) return partialNameMatch.id;
      
      // Check if input is a descriptive name like "site prep" that might match a swimlane
      for (const lane of swimlanes) {
        // Check for common variations and alternatives
        const laneNameLower = lane.name.toLowerCase();
        const laneIdLower = lane.id.toLowerCase();
        
        // Handle common synonyms and variations
        if ((normalizedInput.includes('site') && (laneNameLower.includes('site') || laneNameLower.includes('prep'))) ||
            (normalizedInput.includes('prep') && (laneNameLower.includes('site') || laneNameLower.includes('prep'))) ||
            (normalizedInput.includes('foundation') && (laneNameLower.includes('foundation') || laneIdLower.includes('foundation'))) ||
            (normalizedInput.includes('structure') && (laneNameLower.includes('structure') || laneIdLower.includes('structure'))) ||
            (normalizedInput.includes('interior') && (laneNameLower.includes('interior') || laneIdLower.includes('interior'))) ||
            (normalizedInput.includes('exterior') && (laneNameLower.includes('exterior') || laneIdLower.includes('exterior'))) ||
            (normalizedInput.includes('finish') && (laneNameLower.includes('finish') || laneIdLower.includes('finish'))) ||
            (normalizedInput.includes('floor') && (laneNameLower.includes('floor') || laneIdLower.includes('floor'))) ||
            (normalizedInput.includes('section') && (laneNameLower.includes('section') || laneIdLower.includes('section'))) ||
            (normalizedInput.includes('phase') && (laneNameLower.includes('phase') || laneIdLower.includes('phase'))) ||
            (normalizedInput.includes('wing') && (laneNameLower.includes('wing') || laneIdLower.includes('wing'))) ||
            (normalizedInput.includes('building') && (laneNameLower.includes('building') || laneIdLower.includes('building')))) {
          return lane.id;
        }
      }
      
      // If no match found, return the first swimlane as fallback
      this.debug(`No swimlane match found for "${swimlaneNameOrId}", using first swimlane as fallback: ${swimlanes[0].id}`);
      return swimlanes[0].id;
    } catch (error) {
      this.debug(`Error finding matching swimlane: ${error}`);
      return null;
    }
  }

  // New method to suggest swimlanes based on task context
  private suggestSwimlane(taskName: string, tradeId?: string): string {
    try {
      // First, get all available swimlanes
      const swimlanes = this.canvas.taskManager.swimlanes;
      if (!swimlanes || swimlanes.length === 0) {
        return 'zone1'; // Default fallback
      }
      
      // Normalize task name for analysis
      const normalizedTaskName = taskName.toLowerCase();
      
      // Check if task name contains any location hints
      const locationKeywords = {
        'zone1': ['main', 'primary', 'central', 'core', 'first area', 'area 1', 'section 1', 'phase 1'],
        'zone2': ['secondary', 'second area', 'area 2', 'section 2', 'phase 2', 'support', 'auxiliary'],
        'zone3': ['tertiary', 'third area', 'area 3', 'section 3', 'phase 3', 'exterior', 'outdoor']
      };
      
      // Check for building components that are typically in specific zones
      const buildingComponents = {
        'zone1': ['foundation', 'basement', 'ground floor', 'structural', 'core', 'lobby'],
        'zone2': ['interior', 'floor', 'wall', 'ceiling', 'mechanical', 'electrical', 'plumbing', 'hvac'],
        'zone3': ['roof', 'facade', 'landscape', 'parking', 'exterior', 'finishing', 'site work']
      };
      
      // Trade-based suggestions
      const tradeSuggestions: {[key: string]: string} = {
        'concrete': 'zone1',
        'foundation': 'zone1',
        'structural': 'zone1',
        'framing': 'zone1',
        'steel': 'zone1',
        'demolition': 'zone1',
        'plumbing': 'zone2',
        'electrical': 'zone2',
        'mechanical': 'zone2',
        'hvac': 'zone2',
        'drywall': 'zone2',
        'interior': 'zone2',
        'roofing': 'zone3',
        'landscape': 'zone3',
        'painting': 'zone2',
        'finishing': 'zone3',
        'siding': 'zone3',
        'exterior': 'zone3',
        'management': 'zone1'
      };
      
      // Check location keywords first
      for (const [zoneId, keywords] of Object.entries(locationKeywords)) {
        for (const keyword of keywords) {
          if (normalizedTaskName.includes(keyword)) {
            return zoneId;
          }
        }
      }
      
      // Check building components
      for (const [zoneId, components] of Object.entries(buildingComponents)) {
        for (const component of components) {
          if (normalizedTaskName.includes(component)) {
            return zoneId;
          }
        }
      }
      
      // Check trade-based suggestions if tradeId is provided
      if (tradeId && tradeSuggestions[tradeId]) {
        return tradeSuggestions[tradeId];
      }
      
      // Look at existing tasks to see if there are patterns
      let mostPopulatedZone = swimlanes[0].id;
      let maxTasks = 0;
      
      for (const swimlane of swimlanes) {
        if (swimlane.tasks.length > maxTasks) {
          maxTasks = swimlane.tasks.length;
          mostPopulatedZone = swimlane.id;
        }
      }
      
      // Fallback to most populated zone or zone1
      return maxTasks > 0 ? mostPopulatedZone : 'zone1';
    } catch (error) {
      this.debug(`Error suggesting swimlane: ${error}`);
      return 'zone1'; // Default fallback
    }
  }

  // Update the createTask method to use the suggestSwimlane function
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
      
      // Determine the swimlane ID with intelligent matching
      let swimlaneId;
      if (args.swimlaneId) {
        // User explicitly specified a swimlane
        swimlaneId = this.findBestMatchingSwimlane(args.swimlaneId);
      } else {
        // No swimlane specified, use our suggestion logic
        swimlaneId = this.suggestSwimlane(args.name, args.tradeId);
        this.debug(`Suggested swimlane based on task context: ${swimlaneId}`);
      }
      
      // Final fallback
      if (!swimlaneId) {
        swimlaneId = 'zone1'; // Default fallback
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
      // Keep track of which tasks go to which swimlanes
      const swimlaneAssignments: {[key: string]: number} = {};

      for (const taskData of args.tasks) {
        // Parse start date or use current date
        let startDate = new Date();
        if (taskData.startDate) {
          startDate = new Date(taskData.startDate);
        }

        // Generate a UUID for the task
        const id = this.generateUUID();
        taskIds.push(id);
        
        // Use intelligent swimlane matching or suggestion
        let swimlaneId;
        const requestedSwimlaneId = taskData.swimlaneId || args.swimlaneId;
        
        if (requestedSwimlaneId) {
          // User specified a swimlane
          swimlaneId = this.findBestMatchingSwimlane(requestedSwimlaneId);
        } else {
          // Use our suggestion logic based on task context
          swimlaneId = this.suggestSwimlane(taskData.name, taskData.tradeId);
        }
        
        // Fallback if needed
        if (!swimlaneId) {
          swimlaneId = 'zone1';
        }
          
        this.debug(`Creating task "${taskData.name}" in ${swimlaneId} (requested: ${requestedSwimlaneId || 'auto-suggested'})`);
        
        // Track assignments
        if (!swimlaneAssignments[swimlaneId]) {
          swimlaneAssignments[swimlaneId] = 1;
        } else {
          swimlaneAssignments[swimlaneId]++;
        }

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
        // Use intelligent swimlane matching for each task
        const requestedSwimlaneId = taskData.swimlaneId || args.swimlaneId;
        let swimlaneId;
        
        if (requestedSwimlaneId) {
          swimlaneId = this.findBestMatchingSwimlane(requestedSwimlaneId);
        } else {
          swimlaneId = this.suggestSwimlane(taskData.name, taskData.tradeId);
        }
        
        if (!swimlaneId) swimlaneId = 'zone1';
          
        const swimlane = this.canvas.taskManager.swimlanes.find(s => s.id === swimlaneId);
        const swimlaneName = swimlane ? swimlane.name : swimlaneId;
        
        const startDateInfo = taskData.startDate ? 
          new Date(taskData.startDate).toLocaleDateString() : 
          "current date";
          
        return `${index + 1}. "${taskData.name}" in ${swimlaneName} starting on ${startDateInfo}`;
      }).join('\n');
      
      // Add swimlane distribution info
      const swimlaneDistribution = Object.entries(swimlaneAssignments)
        .map(([id, count]) => {
          const swimlane = this.canvas.taskManager.swimlanes.find(s => s.id === id);
          return `${swimlane ? swimlane.name : id}: ${count} tasks`;
        })
        .join(', ');
      
      return `Created ${args.tasks.length} tasks across swimlanes (${swimlaneDistribution}):\n${taskDetails}\n\nIf you don't see them, try scrolling to their dates or checking if any trade filters are active.`;
    } catch (error: unknown) {
      return this.handleError('creating multiple tasks', error);
    }
  }

  private createTaskSequence(args: any): string {
    try {
      const { sequenceName, startDate, location, tasks } = args;
      let { swimlaneId } = args;
      
      // Determine the best swimlane based on the sequence name if not specified
      if (!swimlaneId) {
        // No swimlane provided, try to suggest based on sequence name
        swimlaneId = this.suggestSwimlane(sequenceName || "Task Sequence", 
          // Look at trades of first few tasks if available
          tasks && tasks.length > 0 ? tasks[0].tradeId : undefined);
        this.debug(`Auto-suggested swimlane for sequence "${sequenceName}": ${swimlaneId}`);
      } else {
        // Use intelligent swimlane matching for provided ID
        swimlaneId = this.findBestMatchingSwimlane(swimlaneId);
        this.debug(`Matched swimlane "${args.swimlaneId}" to "${swimlaneId}"`);
      }
      
      // Final fallback
      if (!swimlaneId) {
        swimlaneId = 'zone1'; // Default fallback
        this.debug(`No matching swimlane found, using default: ${swimlaneId}`);
      }
      
      if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
        return "No tasks provided for sequence creation";
      }
      
      const locationInfo = location ? ` for ${location}` : '';
      
      // Use date provided or default to today
      const baseDate = startDate ? new Date(startDate) : new Date();
      
      this.debug(`Creating sequence "${sequenceName}" with ${tasks.length} tasks in swimlane ${swimlaneId}`);
      
      // Reset position before adding tasks to ensure they're laid out appropriately
      this.canvas.taskManager.resetTaskPositionsInSwimlane(swimlaneId);
      
      // Create each task in sequence with appropriate dependencies
      let previousTaskId: string | null = null;
      const createdTasks: any[] = [];
      
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
        this.debug(`Creating task "${taskData.name}" in ${swimlaneId}`);
        const task = this.canvas.taskManager.addTask(taskData, swimlaneId);
        createdTasks.push(task);
        
        // Store the task ID to use for dependencies
        previousTaskId = task.id;
      }
      
      // Force a canvas render to update the view
      this.canvas.render();
      
      // Create a detailed summary of what was created
      const taskSummary = createdTasks.length > 0 
        ? `\n\nTasks include: ${createdTasks.slice(0, 3).map(t => t.name).join(", ")}${createdTasks.length > 3 ? `, and ${createdTasks.length - 3} more` : ""}`
        : "";
      
      // Find the swimlane name for better feedback
      const swimlane = this.canvas.taskManager.swimlanes.find(s => s.id === swimlaneId);
      const swimlaneName = swimlane ? swimlane.name : swimlaneId;
      
      // Update user feedback to show both the requested and matched swimlane names
      if (args.swimlaneId && args.swimlaneId !== swimlaneId) {
        return `Created ${tasks.length} tasks in the "${sequenceName}"${locationInfo} sequence in "${swimlaneName}" (matched from your request for "${args.swimlaneId}")${taskSummary}`;
      } else if (!args.swimlaneId) {
        return `Created ${tasks.length} tasks in the "${sequenceName}"${locationInfo} sequence in "${swimlaneName}" (auto-selected based on sequence content)${taskSummary}`;
      } else {
        return `Created ${tasks.length} tasks in the "${sequenceName}"${locationInfo} sequence in ${swimlaneName}${taskSummary}`;
      }
    } catch (error: unknown) {
      return this.handleError('creating task sequence', error);
    }
  }

  private async createFromTemplate(args: any): Promise<string> {
    try {
      const { templateName, startDate, location, scaleFactor, inAllSwimlanes } = args;
      
      // Check if this might actually be a request for a WBS template
      if (templateName) {
        // See if it explicitly mentions WBS
        const isWBSRequest = templateName.toLowerCase().includes('wbs');
        
        // Or see if it mentions a project type that matches a WBS template
        const wbsTemplates = getAllWBSTemplates();
        const matchingWBSTemplate = wbsTemplates.find(template => 
          template.projectTypes.some(type => 
            templateName.toLowerCase().includes(type.toLowerCase())
          )
        );
        
        if (isWBSRequest || matchingWBSTemplate) {
          const templateId = matchingWBSTemplate ? matchingWBSTemplate.id : templateName;
          this.debug(`User seems to be requesting a WBS template: ${templateId}`);
          return await this.applyWBSTemplate({ templateId });
        }
      }
      
      // If no template name provided, suggest available templates
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
    const { startDate, location, inAllSwimlanes } = args;
    let { swimlaneId, scaleFactor } = args;
    
    // Convert scaleFactor to a number if it's not already
    if (scaleFactor && typeof scaleFactor !== 'number') {
      scaleFactor = parseFloat(scaleFactor);
      if (isNaN(scaleFactor)) scaleFactor = 1.0;
    }
    
    // Default to scale factor of 1.0 if not specified
    if (!scaleFactor) scaleFactor = 1.0;
    
    // Get the template
    const template = getTemplate(templateName);
    if (!template) {
      return `Template "${templateName}" not found. Available templates: ${getTemplateNames().join(", ")}`;
    }
    
    // For certain templates, suggest an appropriate swimlane if none was specified
    if (!swimlaneId) {
      swimlaneId = this.suggestSwimlane(template.name, 
        // Use the first task's trade if available for better matching
        template.tasks.length > 0 ? template.tasks[0].tradeId : undefined);
      this.debug(`Auto-suggested swimlane for template "${template.name}": ${swimlaneId}`);
    } else {
      // Match the provided swimlane ID
      swimlaneId = this.findBestMatchingSwimlane(swimlaneId);
    }
    
    // Final fallback
    if (!swimlaneId) {
      swimlaneId = 'zone1';
    }
    
    if (inAllSwimlanes) {
      // Check if we have swimlanes to work with
      const swimlanes = this.canvas.taskManager.swimlanes;
      if (!swimlanes || swimlanes.length === 0) {
        return "No swimlanes found to create template in.";
      }
      
      // Create the template in each swimlane
      const results: string[] = [];
      for (const swimlane of swimlanes) {
        const sequenceArgs = {
          sequenceName: `${template.name} - ${swimlane.name}`,
          startDate: startDate || new Date(),
          location,
          swimlaneId: swimlane.id,
          scaleFactor
        };
        
        // Create the sequence with the template
        const result = this.createTaskSequence(sequenceArgs);
        results.push(result);
      }
      
      return `Created ${template.name} in all swimlanes:\n${results.join('\n')}`;
    } else {
      // Create a wrapper sequence for the template
      const sequenceArgs = {
        sequenceName: template.name,
        startDate: startDate || new Date(),
        location,
        swimlaneId,
        scaleFactor
      };
      
      // Create the sequence with the template
      const result = this.createTaskSequence(sequenceArgs);
      
      // Add helpful follow-up suggestions
      const followupSuggestion = `\n\nNext steps: Consider ${this.getRecommendedNextTemplate(templateName)} to continue building your sequence.`;
      
      return result + followupSuggestion;
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
      if (!swimlanes || swimlanes.length === 0) {
        return ['zone1', 'zone2', 'zone3']; // Fallback to default swimlanes
      }
      
      return swimlanes.map(lane => lane.id);
    } catch (error) {
      console.error("Error getting swimlane IDs:", error);
      return ['zone1', 'zone2', 'zone3']; // Fallback to default swimlanes
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

  // Add new methods for swimlane management
  
  private createSwimlane(args: any): string {
    try {
      const { id, name, color } = args;
      
      // Check if a swimlane with this ID already exists
      const existingSwimlaneIds = this.getSwimlaneIds();
      if (existingSwimlaneIds.includes(id)) {
        return `A swimlane with ID '${id}' already exists. Please use a different ID.`;
      }
      
      // Add the new swimlane
      this.canvas.taskManager.addSwimlane(id, name, color);
      
      return `Successfully created a new swimlane '${name}' with ID '${id}'.`;
    } catch (error) {
      return this.handleError("creating swimlane", error);
    }
  }
  
  private updateSwimlane(args: any): string {
    try {
      const { id, name, color } = args;
      
      // Check if swimlane exists
      const existingSwimlaneIds = this.getSwimlaneIds();
      if (!existingSwimlaneIds.includes(id)) {
        return `Swimlane with ID '${id}' not found. Available swimlanes: ${existingSwimlaneIds.join(', ')}`;
      }
      
      // Update the swimlane - this method would need to be implemented in TaskManager
      const swimlanes = this.canvas.taskManager.swimlanes;
      const swimlaneIndex = swimlanes.findIndex(s => s.id === id);
      
      if (swimlaneIndex >= 0) {
        if (name) {
          swimlanes[swimlaneIndex].name = name;
        }
        if (color) {
          swimlanes[swimlaneIndex].color = color;
        }
        
        // Trigger a re-render
        this.canvas.render();
        
        return `Successfully updated swimlane '${id}'.`;
      } else {
        return `Could not update swimlane '${id}'.`;
      }
    } catch (error) {
      return this.handleError("updating swimlane", error);
    }
  }
  
  private reorderSwimlanes(args: any): string {
    try {
      const { swimlaneIds } = args;
      
      // Check if all provided IDs exist
      const existingSwimlaneIds = this.getSwimlaneIds();
      const missingIds = swimlaneIds.filter((id: string) => !existingSwimlaneIds.includes(id));
      
      if (missingIds.length > 0) {
        return `The following swimlane IDs were not found: ${missingIds.join(', ')}`;
      }
      
      // Ensure all existing swimlanes are included
      const missingExistingIds = existingSwimlaneIds.filter(id => !swimlaneIds.includes(id));
      if (missingExistingIds.length > 0) {
        return `The following existing swimlanes are missing from your order: ${missingExistingIds.join(', ')}`;
      }
      
      // Reorder swimlanes - this functionality would need to be implemented in TaskManager
      const reorderedSwimlanes = swimlaneIds.map((id: string) => 
        this.canvas.taskManager.swimlanes.find(s => s.id === id)!
      );
      
      // Update the swimlanes array and recalculate Y positions
      this.canvas.taskManager.swimlanes.length = 0;
      
      reorderedSwimlanes.forEach((swimlane, index) => {
        swimlane.y = index * this.canvas.taskManager.SWIMLANE_HEIGHT;
        this.canvas.taskManager.swimlanes.push(swimlane);
      });
      
      // Trigger a re-render
      this.canvas.render();
      
      return `Successfully reordered the swimlanes.`;
    } catch (error) {
      return this.handleError("reordering swimlanes", error);
    }
  }
  
  private adjustPlan(args: any): string {
    try {
      const { action, affectedTaskIds, startDate, endDate, scaleFactor, bufferDays } = args;
      
      // Get tasks to modify
      let tasksToModify: any[] = [];
      if (affectedTaskIds && affectedTaskIds.length > 0) {
        // Use specified tasks
        tasksToModify = affectedTaskIds.map((id: string) => this.canvas.taskManager.getTask(id))
          .filter((task: any) => task !== undefined);
        
        if (tasksToModify.length === 0) {
          return "None of the specified tasks were found.";
        }
      } else {
        // Use all tasks
        tasksToModify = this.canvas.taskManager.getAllTasks();
      }
      
      switch (action) {
        case "shiftDates":
          if (!startDate) {
            return "startDate is required for shifting dates.";
          }
          
          const newStartDate = new Date(startDate);
          
          // Find the earliest task
          const earliestTask = tasksToModify.reduce((earliest, task) => {
            return !earliest || task.startDate < earliest.startDate ? task : earliest;
          }, null);
          
          if (earliestTask) {
            // Calculate offset
            const offset = newStartDate.getTime() - earliestTask.startDate.getTime();
            
            // Shift all tasks
            tasksToModify.forEach(task => {
              const taskNewDate = new Date(task.startDate.getTime() + offset);
              task.startDate = taskNewDate;
            });
            
            this.canvas.render();
            return `Successfully shifted ${tasksToModify.length} tasks to start from ${newStartDate.toLocaleDateString()}.`;
          }
          break;
          
        case "scaleDurations":
          if (!scaleFactor) {
            return "scaleFactor is required for scaling durations.";
          }
          
          tasksToModify.forEach(task => {
            task.duration = Math.max(1, Math.round(task.duration * scaleFactor));
          });
          
          this.canvas.render();
          return `Successfully scaled durations of ${tasksToModify.length} tasks by a factor of ${scaleFactor}.`;
          
        case "addBuffer":
          if (!bufferDays) {
            return "bufferDays is required for adding buffer.";
          }
          
          // Sort tasks by start date
          const sortedTasks = [...tasksToModify].sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
          
          // Add buffer days between tasks (skip the first task)
          for (let i = 1; i < sortedTasks.length; i++) {
            const task = sortedTasks[i];
            const offset = bufferDays * i * 24 * 60 * 60 * 1000; // Convert days to milliseconds
            const newStartDate = new Date(task.startDate.getTime() + offset);
            task.startDate = newStartDate;
          }
          
          this.canvas.render();
          return `Successfully added ${bufferDays} buffer days between ${tasksToModify.length} tasks.`;
          
        case "optimizeSequence":
          // Sort tasks by trade to minimize trade switches
          // This would implement a basic optimization to group tasks by trade
          
          // Group tasks by trade
          const tasksByTrade: {[key: string]: any[]} = {};
          tasksToModify.forEach(task => {
            if (!tasksByTrade[task.tradeId]) {
              tasksByTrade[task.tradeId] = [];
            }
            tasksByTrade[task.tradeId].push(task);
          });
          
          // Sort tasks within each trade group by start date
          Object.values(tasksByTrade).forEach(tasks => {
            tasks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
          });
          
          // Flatten the groups back into a sequence
          const optimizedTasks = Object.values(tasksByTrade).flat();
          
          // Now resequence the tasks with minimal trade switches
          let currentDate = optimizedTasks[0].startDate;
          
          for (let i = 0; i < optimizedTasks.length; i++) {
            const task = optimizedTasks[i];
            task.startDate = new Date(currentDate);
            
            // Calculate end date
            const endDate = task.getEndDate();
            
            // Set next task to start after this one
            currentDate = new Date(endDate);
          }
          
          this.canvas.render();
          return `Successfully optimized the sequence of ${tasksToModify.length} tasks to minimize trade switches.`;
          
        default:
          return `Unknown action: ${action}. Supported actions: shiftDates, scaleDurations, addBuffer, optimizeSequence.`;
      }
      
      return "Adjustment completed.";
    } catch (error) {
      return this.handleError("adjusting plan", error);
    }
  }

  /**
   * List available WBS templates
   */
  private listWBSTemplates(args: any): string {
    try {
      const wbsTemplates = getAllWBSTemplates();
      const projectType = args.projectType?.toLowerCase();
      
      // If project type specified, filter templates
      let templates = wbsTemplates;
      if (projectType) {
        templates = wbsTemplates.filter(template => 
          template.projectTypes.some(type => type.toLowerCase().includes(projectType) || 
                                            projectType.includes(type.toLowerCase()))
        );
      }
      
      if (templates.length === 0) {
        if (projectType) {
          return `No WBS templates found for "${projectType}". Available templates include: ${getWBSTemplateNames().join(", ")}`;
        } else {
          return "No WBS templates found.";
        }
      }
      
      // Format the response
      let response = projectType 
        ? `Available WBS templates for "${projectType}" projects:\n\n` 
        : "Available Work Breakdown Structure templates:\n\n";
      
      templates.forEach(template => {
        response += `- ${template.name} (ID: ${template.id})\n  ${template.description}\n  Categories: ${template.categories.length}\n\n`;
      });
      
      return response;
    } catch (error) {
      console.error("Error listing WBS templates:", error);
      return "Failed to list WBS templates due to an error.";
    }
  }
  
  /**
   * Apply a WBS template to create swimlanes
   */
  async applyWBSTemplate(args: any): Promise<string> {
    try {
      const templateIdOrType = args.templateId;
      const clearExisting = args.clearExisting === true;
      const customNames = args.customNames || [];
      
      // Find the template
      let template = getWBSTemplate(templateIdOrType);
      
      // If not found by ID, try to find by matching project type
      if (!template) {
        template = findBestMatchingWBSTemplate(templateIdOrType);
      }
      
      if (!template) {
        return `No WBS template found matching "${templateIdOrType}". Use listWBSTemplates to see available templates.`;
      }
      
      // Clear existing swimlanes if requested
      if (clearExisting) {
        // Get existing swimlanes and remove them
        const swimlanes = this.canvas.taskManager.swimlanes;
        // Make a copy since we'll be modifying the array during iteration
        const swimlanesToRemove = [...swimlanes];
        swimlanesToRemove.forEach(swimlane => {
          const index = this.canvas.taskManager.swimlanes.findIndex(s => s.id === swimlane.id);
          if (index >= 0) {
            this.canvas.taskManager.swimlanes.splice(index, 1);
          }
        });
      }
      
      // Get existing swimlane IDs to avoid duplicates
      const existingSwimlaneIds = this.canvas.taskManager.swimlanes.map(s => s.id);
      
      // Create swimlanes based on the template categories
      const createdSwimlanes = [];
      const categories = customNames.length > 0 && customNames.length === template.categories.length 
        ? customNames 
        : template.categories;
      
      for (let i = 0; i < categories.length; i++) {
        const category = categories[i];
        // Create a safe ID from the category name
        let baseId = category.toLowerCase()
          .replace(/&/g, 'and')
          .replace(/[^a-z0-9]+/g, '_')
          .trim();
        
        // Ensure uniqueness
        let id = baseId;
        let counter = 1;
        while (existingSwimlaneIds.includes(id)) {
          id = `${baseId}_${counter}`;
          counter++;
        }
        
        // Add the swimlane - color parameter is required
        const color = this.getRandomColor();
        this.canvas.taskManager.addSwimlane(id, category, color);
        createdSwimlanes.push({ id, name: category });
      }
      
      return `Successfully applied the "${template.name}" WBS template. Created ${createdSwimlanes.length} swimlanes: ${createdSwimlanes.map(s => s.name).join(", ")}.`;
    } catch (error) {
      console.error("Error applying WBS template:", error);
      return "Failed to apply WBS template due to an error.";
    }
  }
}

export { Composer };
export type { ComposerConfig }; 
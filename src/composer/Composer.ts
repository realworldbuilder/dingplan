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
  private maxTokens: number;
  // Add static property for tracking last suggested template
  private static lastSuggestedTemplate: string = '';

  constructor(config: ComposerConfig) {
    this.apiKey = config.apiKey || '';
    this.model = config.model || 'gpt-4o';
    this.canvas = config.canvas;
    
    // Define the functions the LLM can call
    this.functions = [
      {
        name: "createSwimlane",
        description: "Create a new swimlane/phase. Do this FIRST before creating tasks.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "Simple lowercase ID (e.g., 'demo', 'framing', 'mep-rough')" },
            name: { type: "string", description: "Display name (e.g., 'MEP Rough-In')" },
            color: { type: "string", description: "Hex color code" }
          },
          required: ["id", "name"]
        }
      },
      {
        name: "createTask",
        description: "Create a task. Use the exact swimlaneId from createSwimlane.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string", description: "Task name" },
            duration: { type: "integer", description: "Duration in working days" },
            swimlaneId: { type: "string", description: "Swimlane ID to place task in (must match a created swimlane)" },
            tradeId: { type: "string", description: "Trade performing this task" },
            crewSize: { type: "integer", description: "Crew size (default 4)" },
            color: { type: "string", description: "Hex color" },
            startDate: { type: "string", description: "Start date YYYY-MM-DD (default: today)" }
          },
          required: ["name", "duration", "swimlaneId"]
        }
      },
      {
        name: "addDependency",
        description: "Link two tasks. Predecessor must finish/start before successor can finish/start.",
        parameters: {
          type: "object",
          properties: {
            predecessorName: { type: "string", description: "Name of predecessor task" },
            successorName: { type: "string", description: "Name of successor task" }
          },
          required: ["predecessorName", "successorName"]
        }
      },
      {
        name: "deleteTask",
        description: "Delete a task by name or ID. Use for reworking sections.",
        parameters: {
          type: "object",
          properties: {
            taskId: { type: "string", description: "Task ID or name to delete" }
          },
          required: ["taskId"]
        }
      },
      {
        name: "listTasks",
        description: "List current tasks, optionally filtered by swimlane",
        parameters: {
          type: "object",
          properties: {
            swimlaneId: { type: "string", description: "Filter by swimlane ID" }
          }
        }
      },
      {
        name: "adjustPlan",
        description: "Bulk adjust the schedule",
        parameters: {
          type: "object",
          properties: {
            action: { type: "string", enum: ["shiftDates", "scaleDurations", "addBuffer", "optimizeSequence"] },
            scaleFactor: { type: "number", description: "e.g., 0.8 for 20% shorter" },
            bufferDays: { type: "integer", description: "Buffer days between tasks" },
            startDate: { type: "string", description: "New start date YYYY-MM-DD" }
          },
          required: ["action"]
        }
      }
    ];
    
    // Automatically load the default WBS template if no swimlanes exist
    this.initializeDefaultTemplate();
  }
  
  // Initialize the default template if needed
  private async initializeDefaultTemplate() {
    try {
      // Check if any swimlanes already exist
      const swimlanes = this.canvas.taskManager.swimlanes;
      
      if (!swimlanes || swimlanes.length === 0) {
        this.debug("No swimlanes found. Automatically loading default WBS template...");
        
        // Apply the default template immediately - no delay
        try {
          // Use the default Commercial Building template
          const defaultTemplateId = 'commercial_building';
          
          // Get the template
          const template = getWBSTemplate(defaultTemplateId);
          if (!template) {
            this.debug("Error: Default template not found");
            return;
          }
          
          // Create swimlanes from template categories
          const categories = template.categories;
          
          for (let i = 0; i < categories.length; i++) {
            const category = categories[i];
            // Create a safe ID from the category name - no 'zone' prefix
            let baseId = category.toLowerCase()
              .replace(/&/g, 'and')
              .replace(/[^a-z0-9]+/g, '_')
              .trim();
            
            // Add the swimlane with proper name and category
            const color = this.getRandomColor();
            this.canvas.taskManager.addSwimlane(baseId, category, color);
          }
          
          this.debug("Default WBS template loaded automatically");
          
          // Force a render to show the changes
          this.canvas.render();
        } catch (error) {
          this.debug("Error loading default template:", error);
        }
      } else {
        this.debug(`Found ${swimlanes.length} existing swimlanes. Not loading default template.`);
      }
    } catch (error) {
      this.debug("Error during initialization:", error);
    }
  }

  async processPrompt(userInput: string, imageBase64?: string): Promise<string> {
    try {
      if (userInput.startsWith('/')) {
        return this.handleDebugCommand(userInput);
      }

      if (!this.apiKey) {
        return 'Please sign in or add your OpenAI API key in Settings to use AI Composer.';
      }

      // Everything goes to GPT — no template matching
      const userMessage = imageBase64 ? {
        role: 'user',
        content: [
          { type: 'text', text: userInput || 'What do you see in this image? Generate a construction schedule based on it.' },
          { type: 'image_url', image_url: { url: imageBase64 } }
        ]
      } : { role: 'user', content: userInput };
      
      const messages = [
        { role: 'system', content: this.getSystemPrompt() },
        userMessage
      ];

      let response = await this.callLLMWithFunctions(messages);
      let results: string[] = [];

      // Loop to handle multiple function calls
      while (response.choices[0].message.function_call) {
        const fc = response.choices[0].message.function_call;
        const result = await this.handleFunctionCall(fc);
        results.push(result);
        
        // Add the function result to conversation and call again
        messages.push({ role: 'assistant', content: null, function_call: fc });
        messages.push({ role: 'function', name: fc.name, content: result });
        response = await this.callLLMWithFunctions(messages);
      }

      // Final text response from GPT
      const finalMessage = response.choices[0].message.content || '';
      
      // Auto-schedule: forward pass to stagger tasks based on dependencies
      if (results.length > 0) {
        this.autoSchedule();
      }
      
      // Render the canvas
      this.canvas.render();
      
      if (results.length > 0) {
        return `${finalMessage}\n\nCreated ${results.length} items in your schedule.`;
      }
      return finalMessage;
    } catch (error: any) {
      return `Error: ${error.message}`;
    }
  }
  
  private getSystemPrompt(): string {
    const currentTasks = this.canvas.taskManager.getAllTasks();
    const currentSwimlanes = this.canvas.taskManager.swimlanes;
    const hasExistingSchedule = currentTasks.length > 0;
    
    const existingContext = hasExistingSchedule ? `
CURRENT SCHEDULE STATE:
- ${currentSwimlanes.length} swimlanes: ${currentSwimlanes.map((s: any) => `"${s.name}" (id: ${s.id})`).join(', ')}
- ${currentTasks.length} tasks: ${currentTasks.slice(0, 15).map((t: any) => `"${t.name}" [${t.duration}d, swimlane: ${t.swimlaneId}]`).join(', ')}${currentTasks.length > 15 ? `... and ${currentTasks.length - 15} more` : ''}

You can MODIFY this schedule: add tasks, delete tasks (deleteTask), adjust durations, add/remove dependencies, add swimlanes, or rework sections. Reference existing task IDs when adding dependencies.` : '';

    return `You are a senior construction scheduler and scheduling COACH. You help users build professional CPM schedules step by step.

YOUR PERSONALITY:
- You're a helpful scheduling mentor, not just a task generator
- Guide users through building their schedule systematically
- Ask clarifying questions: project type, size (SF), number of floors, scope
- Suggest what to build next based on what exists
- If the schedule looks wrong, say so and offer to fix it

CONVERSATION APPROACH:
- If user gives a vague prompt ("build me a schedule"), ask: What type of project? Approximate size? New construction or renovation?
- If a schedule already exists, offer to refine it: "I see you have ${currentTasks.length} tasks. Want me to add more detail to any phase, adjust durations, or add dependencies?"
- Encourage building WBS-first: "Let's start with your swimlanes (phases), then fill in tasks for each one"
- After building a section, ask: "Want me to flesh out the next phase?" or "Should I add more detail to MEP rough-in?"
- If asked to rework: delete the old tasks and rebuild that section properly

REWORK CAPABILITIES:
- "Make it shorter" → compress durations, add more SS/FF relationships for concurrent work
- "Add more detail to [phase]" → break tasks into subtasks (e.g., "Electrical Rough" → panel install, conduit run, wire pull, terminate)
- "This is wrong" → ask what's wrong, delete bad tasks, rebuild correctly
- "Compress the schedule" → look for activities that can overlap (SS relationships)
- "Add [trade/phase]" → create new swimlane + tasks, link to existing schedule
- "Remove [section]" → delete those tasks and re-link dependencies

${existingContext}

WHEN BUILDING NEW SCHEDULES:
1. Create swimlanes first (by trade/phase)
2. Create tasks with REALISTIC durations
3. Link with dependencies (use all 4 types: FS, SS, FF, SF)

CONSTRUCTION SEQUENCING (non-negotiable):
- Foundations before structure. Underground MEP before slab.
- Rough-in order: fire protection → HVAC duct → plumbing → electrical
- Insulation inspection BEFORE drywall hang
- Drywall: hang → tape/mud → sand → prime (separate tasks)
- Paint before flooring. Ceiling grid before fixtures. MEP trim after paint.
- Commissioning/TAB before punch list. Fire alarm test before TCO.

DURATION GUIDELINES (scale to project size):
- Small TI (5K SF): Demo 3-5d, framing 5d, MEP rough 8-10d, drywall 5-7d
- Medium commercial (25K SF): Foundation 15-20d, structure 20-30d, MEP rough 25-30d
- Large (100K+ SF): Foundation 30-45d, structure 45-60d, MEP rough 45-60d
- Residential: Foundation 5-7d, framing 10-15d, MEP rough 8-10d

DEPENDENCY TYPES:
- FS: Most common. Framing finish → drywall start.
- SS: Concurrent rough-ins (plumbing SS+2d to HVAC)
- FF: Punchlist finishes when all corrections finish
- SF: Rare. Switchovers only.

SWIMLANE ID RULES:
- Use simple lowercase IDs: "demo", "framing", "mep-rough", "drywall", "finishes", "trim", "closeout"
- In createTask, use the EXACT swimlaneId from createSwimlane

CREW SIZES: 4-6 typical, 8-12 concrete/steel, 2-3 specialties

AVAILABLE TEMPLATES: ${getAllWBSTemplates().map(t => t.name).join(', ')}
TASK TEMPLATES: ${getTemplateNames().join(', ')}`;
  }

  private async callLLMWithFunctions(messages: any[]): Promise<ChatResponse> {
    try {
      if (!this.apiKey) {
        throw new Error("API key not configured");
      }
      
      // Check if we're using an Anthropic or OpenAI model
      const isAnthropicModel = this.model.toLowerCase().includes('claude');
      
      let response;
      
      if (isAnthropicModel) {
        // Anthropic API format
        const requestBody = {
          model: this.model,
          messages: messages,
          tools: this.functions,
          temperature: 0.7,
          max_tokens: this.maxTokens || 4000
        };
        
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(requestBody)
        });
      } else {
        // OpenAI API format
        const requestBody = {
          model: this.model,
          messages: messages,
          functions: this.functions,
          temperature: 0.7,
          max_tokens: this.maxTokens || 2000,
          function_call: "auto"
        };
        
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(requestBody)
        });
      }
      
      // Retry on rate limit
      if (response.status === 429) {
        this.debug('Rate limited, retrying in 2s...');
        await new Promise(r => setTimeout(r, 2000));
        return this.callLLMWithFunctions(messages);
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }
      
      const jsonResponse = await response.json();
      
      // Convert Anthropic response format to OpenAI format if needed
      if (isAnthropicModel) {
        if (jsonResponse.tool_calls && jsonResponse.tool_calls.length > 0) {
          return {
            choices: [{
              message: {
                function_call: {
                  name: jsonResponse.tool_calls[0].name,
                  arguments: JSON.stringify(jsonResponse.tool_calls[0].parameters)
                }
              }
            }]
          };
        } else if (jsonResponse.content && jsonResponse.content.length > 0) {
          return {
            choices: [{
              message: {
                content: jsonResponse.content[0].text
              }
            }]
          };
        } else {
          return {
            choices: [{
              message: {
                content: "The AI model didn't provide a valid response."
              }
            }]
          };
        }
      }
      
      return jsonResponse;
    } catch (error) {
      this.debug('LLM call error', error);
      throw error;
    }
  }

  // Add a debug command handler
  private handleDebugCommand(command: string): string {
    const parts = command.substring(1).split(' ');
    const cmd = parts[0].toLowerCase();
    
    switch (cmd) {
      case 'debug':
        this.setDebugMode(!this.debugMode);
        return `Debug mode ${this.debugMode ? 'enabled' : 'disabled'}`;
        
      case 'list':
        if (parts[1] === 'templates') {
          return this.listTemplates();
        } else if (parts[1] === 'wbs') {
          return this.listWBSTemplates({});
        } else if (parts[1] === 'swimlanes') {
          return this.listSwimlanes();
        } else if (parts[1] === 'tasks') {
          return this.listTasks({});
        }
        return 'Available list commands: templates, wbs, swimlanes, tasks';
      
      case 'explain':
        if (parts[1] === 'templates') {
          return this.explainTemplateTypes();
        }
        return 'Available explain commands: templates';
        
      case 'help':
        return `
Debug Commands:
/debug - Toggle debug mode
/list templates - List available task templates
/list wbs - List available WBS templates
/list swimlanes - List current swimlanes
/list tasks - List all tasks
/explain templates - Explain the difference between template types
/help - Show this help message
`;
        
      default:
        return `Unknown debug command: ${cmd}. Type /help for available commands.`;
    }
  }
  
  // Update callLLM to better handle standard input
  private async callLLM(userInput: string): Promise<ChatResponse> {
    try {
      if (!this.apiKey) {
        throw new Error("API key not configured");
      }
      
      // Check if this is clearly a single task request vs a template request
      const isExplicitTaskRequest = userInput.toLowerCase().includes('task that') || 
                                   userInput.toLowerCase().includes('single task') ||
                                   userInput.toLowerCase().includes('one task');
      
      // Get available templates for the prompt
      const availableTemplates = getTemplateNames();
      const wbsTemplates = getWBSTemplateNames();
      
      // Check if the request is directly about WBS templates
      const isWBSRequest = userInput.toLowerCase().includes('wbs') || 
                          userInput.toLowerCase().includes('template') ||
                          userInput.toLowerCase().includes('breakdown structure');
      
      // If this is a WBS template-related request, enhance the system message
      const wbsSpecificGuidance = isWBSRequest ? `
TEMPLATE REQUEST DETECTION: I detect that you're asking about Work Breakdown Structure templates.

IMPORTANT GUIDELINES FOR WBS REQUESTS:
1. When users ask for a specific industry template, first check if we have an exact match.
2. If not, suggest the closest alternative template (e.g., industrial_facility for data centers).
3. For vague requests, present available options clearly formatted with line breaks between templates.
4. When a user confirms they want to use a template with "yes" or similar, use the applyWBSTemplate function.
5. Remember, applying a template creates the swimlane structure but doesn't add tasks.

The user appears to be requesting WBS template information. Please respond with clear, well-formatted information.` : '';
      
      const currentSwimlanes = this.canvas.taskManager.swimlanes;
      const currentTasks = this.canvas.taskManager.getAllTasks();
      const hasSchedule = currentTasks.length > 0;
      
      const stateInfo = hasSchedule 
        ? `CURRENT SCHEDULE: ${currentSwimlanes.length} swimlanes (${currentSwimlanes.map((s: any) => `${s.name} [id:${s.id}]`).join(', ')}), ${currentTasks.length} tasks. You can modify, add to, or rework this schedule.`
        : `No schedule yet. ${currentSwimlanes.length > 0 ? `Swimlanes exist: ${currentSwimlanes.map((s: any) => `${s.name} [id:${s.id}]`).join(', ')}. Add tasks to these.` : 'Start by creating swimlanes.'}`;

      const systemMessage = `You are a senior construction scheduling COACH. Build and refine schedules by calling functions.

${stateInfo}

${hasSchedule ? `REWORK MODE: The user may want to modify the existing schedule. You can:
- Add tasks to existing swimlanes (use their IDs above)
- Delete tasks with deleteTask
- Add new swimlanes + tasks for missing phases
- Adjust by adding/removing dependencies
- Break down vague tasks into proper subtasks
If the user says "rework", "fix", "more detail", "compress" — modify what exists, don't start over unless asked.` : `BUILD MODE: Guide the user. If their request is vague, ask about project type, size, and scope. Encourage building WBS-first (swimlanes), then filling in tasks phase by phase.`}

RULES:
- Distribute tasks across ALL swimlanes
- Use EXACT swimlane IDs (simple lowercase: "demo", "framing", "mep-rough", etc.)
- Realistic durations scaled to project size
- All 4 dep types: FS (common), SS (concurrent rough-ins), FF (punchlist), SF (rare)

SEQUENCING: foundations→structure→rough-in (FP→HVAC→plumb→elec)→insulation→drywall (hang/tape/sand/prime)→paint→flooring→ceiling→MEP trim→commissioning→punch→TCO

After building a section, suggest what to do next. Be a coach, not just a generator.`;
      
      // Check if we're using an Anthropic or OpenAI model
      const isAnthropicModel = this.model.toLowerCase().includes('claude');
      
      let response;
      
      if (isAnthropicModel) {
        // Anthropic API format
        const requestBody = {
          model: this.model,
          messages: [
            {
              role: "system",
              content: systemMessage
            },
            {
              role: "user",
              content: userInput
            }
          ],
          tools: this.functions,
          temperature: 0.7,
          max_tokens: this.maxTokens || 4000
        };
        
        response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(requestBody)
        });
      } else {
        // OpenAI API format
        const requestBody = {
          model: this.model,
          messages: [
            {
              role: "system",
              content: systemMessage
            },
            {
              role: "user",
              content: userInput
            }
          ],
          functions: this.functions,
          temperature: 0.7,
          max_tokens: this.maxTokens || 2000,
          function_call: "auto"
        };
        
        response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          body: JSON.stringify(requestBody)
        });
      }
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API request failed: ${response.status} - ${errorText}`);
      }
      
      const jsonResponse = await response.json();
      
      // Debug the raw response to help diagnose issues
      this.debug('Raw LLM response:', jsonResponse);
      
      // Convert Anthropic response format to OpenAI format if needed
      if (isAnthropicModel) {
        // Adapt Anthropic response to match OpenAI format expected by our code
        if (jsonResponse.tool_calls && jsonResponse.tool_calls.length > 0) {
          return {
            choices: [{
              message: {
                function_call: {
                  name: jsonResponse.tool_calls[0].name,
                  arguments: JSON.stringify(jsonResponse.tool_calls[0].parameters)
                }
              }
            }]
          };
        } else if (jsonResponse.content && jsonResponse.content.length > 0) {
          return {
            choices: [{
              message: {
                content: jsonResponse.content[0].text
              }
            }]
          };
        } else {
          return {
            choices: [{
              message: {
                content: "The AI model didn't provide a valid response."
              }
            }]
          };
        }
      }
      
      return jsonResponse;
    } catch (error) {
      this.debug('LLM call error', error);
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
          return await this.createTask(args);
        case "createMultipleTasks":
          return await this.createMultipleTasks(args);
        case "createTaskSequence":
          return await this.createTaskSequence(args);
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
  private parseDateExpression(dateExpression: string | any): Date | null {
    if (!dateExpression) return null;
    
    // Check if dateExpression is a string before calling toLowerCase
    if (typeof dateExpression !== 'string') {
      console.warn('parseDateExpression received non-string value:', dateExpression);
      return null;
    }
    
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
      
      // Debug swimlane list
      this.debug(`Available swimlanes: ${swimlanes.map(lane => `${lane.id}: ${lane.name}`).join(', ')}`);
      
      // Handle ordinal references like "first", "second", etc.
      if (normalizedInput.includes('first') || normalizedInput.includes('1st')) {
        if (swimlanes.length > 0) return swimlanes[0].id;
      }
      if (normalizedInput.includes('second') || normalizedInput.includes('2nd')) {
        if (swimlanes.length > 1) return swimlanes[1].id;
      }
      if (normalizedInput.includes('third') || normalizedInput.includes('3rd')) {
        if (swimlanes.length > 2) return swimlanes[2].id;
      }
      if (normalizedInput.includes('fourth') || normalizedInput.includes('4th')) {
        if (swimlanes.length > 3) return swimlanes[3].id;
      }
      if (normalizedInput.includes('fifth') || normalizedInput.includes('5th')) {
        if (swimlanes.length > 4) return swimlanes[4].id;
      }
      
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
      
      // Handle partial matches on name - improved for common swimlane names
      // This is especially important for matching composite names like "Site Preparation & Foundations"
      for (const lane of swimlanes) {
        const laneNameLower = lane.name.toLowerCase();
        const laneIdLower = lane.id.toLowerCase();
        
        // Check for site preparation variations
        if ((normalizedInput.includes('site') && laneNameLower.includes('site')) ||
            (normalizedInput.includes('prep') && laneNameLower.includes('prep'))) {
          this.debug(`Found matching swimlane for site preparation: ${lane.name}`);
          return lane.id;
        }
        
        // Check for other common variations
        if ((normalizedInput.includes('found') && laneNameLower.includes('found')) ||
            (normalizedInput.includes('civil') && laneNameLower.includes('civil')) ||
            (normalizedInput.includes('struct') && laneNameLower.includes('struct')) ||
            (normalizedInput.includes('mech') && laneNameLower.includes('mech')) ||
            (normalizedInput.includes('elec') && laneNameLower.includes('elec')) ||
            (normalizedInput.includes('interior') && laneNameLower.includes('interior')) ||
            (normalizedInput.includes('exterior') && laneNameLower.includes('exterior')) ||
            (normalizedInput.includes('finish') && laneNameLower.includes('finish'))) {
          this.debug(`Found matching swimlane for ${normalizedInput}: ${lane.name}`);
          return lane.id;
        }
        
        // Handle common synonyms and variations (from original code)
        if ((normalizedInput.includes('floor') && (laneNameLower.includes('floor') || laneIdLower.includes('floor'))) ||
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
        return this.getFirstAvailableSwimlaneId() || ''; // Use helper or empty string if null
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
      
      // Fallback to most populated zone or first available
      return maxTasks > 0 ? mostPopulatedZone : this.getFirstAvailableSwimlaneId();
    } catch (error) {
      this.debug(`Error suggesting swimlane: ${error}`);
      return this.getFirstAvailableSwimlaneId() || ''; // Use helper or empty string if null
    }
  }

  // Helper to get the first available swimlane ID or null if none exists
  private getFirstAvailableSwimlaneId(): string | null {
    try {
      const swimlanes = this.canvas.taskManager.swimlanes;
      return swimlanes.length > 0 ? swimlanes[0].id : null;
    } catch (error) {
      console.error("Error getting first available swimlane:", error);
      return null;
    }
  }

  // Helper to check if a swimlane exists, and get first available if not
  private getValidSwimlaneId(swimlaneId?: string): string {
    try {
      const swimlanes = this.canvas.taskManager.swimlanes;
      
      // If no swimlane provided, use the first available
      if (!swimlaneId && swimlanes.length > 0) {
        return swimlanes[0].id;
      }
      
      // If the provided swimlane exists, use it
      if (swimlaneId && swimlanes.find(s => s.id === swimlaneId)) {
        return swimlaneId;
      }
      
      // Otherwise, use the first available or throw if none exist
      if (swimlanes.length > 0) {
        return swimlanes[0].id;
      }
      
      throw new Error("No swimlanes are available. Please create a swimlane first.");
    } catch (error) {
      console.error("Error validating swimlane ID:", error);
      throw new Error("Could not validate swimlane ID. Please try again.");
    }
  }

  // Update the createTask method to be async
  async createTask(args: any): Promise<string> {
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
          return await this.createFromTemplate({ templateName: 'foundation', swimlaneId: args.swimlaneId });
        } else if (potentialTemplate.includes('framing')) {
          return await this.createFromTemplate({ templateName: 'framing', swimlaneId: args.swimlaneId });
        } else if (potentialTemplate.includes('mep') || potentialTemplate.includes('mechanical') || potentialTemplate.includes('electrical')) {
          return await this.createFromTemplate({ templateName: 'mep', swimlaneId: args.swimlaneId });
        } else if (potentialTemplate.includes('kitchen')) {
          return await this.createFromTemplate({ templateName: 'kitchen', swimlaneId: args.swimlaneId });
        } else if (potentialTemplate.includes('bathroom')) {
          return await this.createFromTemplate({ templateName: 'bathroom', swimlaneId: args.swimlaneId });
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
      const taskId = self.crypto && self.crypto.randomUUID ? 
                    self.crypto.randomUUID() : 
                    'task-' + Math.random().toString(36).substring(2, 15);
      
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
      
      // Use the valid swimlane helper instead of defaulting to 'zone1'
      swimlaneId = this.getValidSwimlaneId(swimlaneId);
      
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
      
      // Force the canvas to refresh to show the new task
      this.canvas.render();
      
      return `Task created: "${args.name}" (ID: ${taskId}) in ${swimlaneId}, starting on ${startDate.toLocaleDateString()}`;
    } catch (error: unknown) {
      if (error instanceof Error) {
        return `Error creating task: ${error.message}`;
      }
      return `Error creating task: ${String(error)}`;
    }
  }

  private async createMultipleTasks(args: any): Promise<string> {
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
        
        // Use the valid swimlane helper instead of defaulting to 'zone1'
        swimlaneId = this.getValidSwimlaneId(swimlaneId);
        
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
      
      // Add summary of what was created
      const totalTasks = taskIds.length;
      const swimlaneSummary = Object.entries(swimlaneAssignments)
        .map(([swimlane, count]) => `${count} in ${swimlane}`)
        .join(', ');
      
      // Force the canvas to refresh to show the new tasks
      this.canvas.render();
      
      return `Created ${totalTasks} tasks (${swimlaneSummary})`;
    } catch (error: unknown) {
      return this.handleError('creating multiple tasks', error);
    }
  }

  // Simplify task sequence response
  private async createTaskSequence(args: any): Promise<string> {
    try {
      const { tasks, 
              name = "Task Sequence", 
              swimlaneId = null,
              startDate = null, 
              dependencies = [] } = args;
      
      // Find best matching swimlane or default to 'zone1'
      let resolvedSwimlaneId = this.findBestMatchingSwimlane(swimlaneId) || 'zone1';
      
      this.debug(`Creating task sequence "${name}" in swimlane ${resolvedSwimlaneId}`);
      
      // If no tasks provided, check if it's a domain-specific request
      if (!tasks || tasks.length === 0) {
        // Handle potential template requests
        if (name && typeof name === 'string') {
          const potentialTemplate = name.toLowerCase();
          
          if (potentialTemplate.includes('foundation')) {
            return await this.createFromTemplate({ templateName: 'foundation', swimlaneId: args.swimlaneId });
          } else if (potentialTemplate.includes('framing')) {
            return await this.createFromTemplate({ templateName: 'framing', swimlaneId: args.swimlaneId });
          } else if (potentialTemplate.includes('mep') || potentialTemplate.includes('mechanical') || potentialTemplate.includes('electrical')) {
            return await this.createFromTemplate({ templateName: 'mep', swimlaneId: args.swimlaneId });
          } else if (potentialTemplate.includes('kitchen')) {
            return await this.createFromTemplate({ templateName: 'kitchen', swimlaneId: args.swimlaneId });
          } else if (potentialTemplate.includes('bathroom')) {
            return await this.createFromTemplate({ templateName: 'bathroom', swimlaneId: args.swimlaneId });
          }
        }
        
        return "No tasks provided for sequence creation";
      }
      
      // Set up start date, either from args or current date
      let currentDate: Date;
      if (startDate) {
        const parsedDate = this.parseDateExpression(startDate);
        currentDate = parsedDate || new Date();
      } else {
        currentDate = new Date();
      }
      
      // Keep track of created tasks for dependency management
      const createdTaskIds: string[] = [];
      const taskDetails: any[] = [];
      
      // Process each task in the sequence
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        
        // Generate a unique ID using browser's crypto API instead of Node.js crypto
        const taskId = self.crypto && self.crypto.randomUUID ? 
                      self.crypto.randomUUID() : 
                      'task-' + Math.random().toString(36).substring(2, 15);
        createdTaskIds.push(taskId);
        
        // Set up dependencies
        const taskDependencies: string[] = [];
        
        // Add dependency on previous task if specified
        if (i > 0 && task.dependsOnPrevious) {
          taskDependencies.push(createdTaskIds[i-1]);
        }
        
        // Add any additional dependencies
        if (dependencies && dependencies.length > 0) {
          dependencies.forEach((dep: any) => {
            if (dep.successorIndex === i && dep.predecessorIndex < i) {
              taskDependencies.push(createdTaskIds[dep.predecessorIndex]);
            }
          });
        }
        
        // Create task data
        const taskData = {
          id: taskId,
          name: task.name,
          duration: task.duration || 1,
          startDate: new Date(currentDate),
          tradeId: task.tradeId || 'general',
          crewSize: task.crewSize || 1,
          color: task.color || this.getRandomColor(),
          dependencies: taskDependencies,
          swimlaneId: resolvedSwimlaneId
        };
        
        // Add task to canvas
        this.canvas.taskManager.addTask(taskData);
        
        // Store task details for the response
        taskDetails.push({
          id: taskId,
          name: task.name,
          startDate: new Date(currentDate),
          duration: task.duration
        });
        
        // If this task has dependencies, we need to calculate its actual start date
        // based on when the predecessors finish
        if (taskDependencies.length > 0) {
          // Find the latest end date of all predecessors
          let latestEndDate = new Date(currentDate);
          
          for (const depId of taskDependencies) {
            const depTask = this.canvas.taskManager.getTask(depId);
            if (depTask) {
              // Calculate end date of dependent task
              const depEndDate = new Date(depTask.startDate);
              depEndDate.setDate(depEndDate.getDate() + depTask.duration);
              
              if (depEndDate > latestEndDate) {
                latestEndDate = new Date(depEndDate);
              }
            }
          }
          
          // Update the task's start date to be after all dependencies
          const taskObj = this.canvas.taskManager.getTask(taskId);
          if (taskObj) {
            taskObj.startDate = latestEndDate;
            taskDetails[i].startDate = latestEndDate;
          }
        }
        
        // Move the current date pointer forward for the next sequential task
        // (if not depending on other tasks)
        if (taskDependencies.length === 0) {
          currentDate = new Date(currentDate);
          currentDate.setDate(currentDate.getDate() + (task.duration || 1));
        }
      }
      
      // Return summary of what was created
      const swimlaneName = this.canvas.taskManager.swimlanes.find(s => s.id === resolvedSwimlaneId)?.name || 'unknown swimlane';
      
      // Make sure to render the canvas to show the new tasks
      this.canvas.render();
      
      return `Created task sequence "${name}" with ${tasks.length} tasks in ${swimlaneName}`;
    } catch (error) {
      return this.handleError("creating task sequence", error);
    }
  }
  
  // Complete implementation of template sequence creation
  private async createTemplateSequence(args: any, templateNameOverride?: string): Promise<string> {
    try {
      // Extract arguments
      const { templateName, startDate, location, inAllSwimlanes } = args;
      let { swimlaneId, scaleFactor } = args;
      
      // Use override template name if provided
      const effectiveTemplateName = templateNameOverride || templateName;
      
      // Convert scaleFactor to number if it's a string
      let scale = parseFloat(scaleFactor || "1.0");
      if (isNaN(scale) || scale <= 0) {
        scale = 1.0;
      }
      
      // If no swimlane provided, use the first available
      if (!swimlaneId) {
        swimlaneId = this.getValidSwimlaneId();
      }
      
      const template = getTemplate(effectiveTemplateName);
      if (!template) {
        return `Template "${effectiveTemplateName}" not found.`;
      }
      
      // Parse startDate or use current date
      let sequenceStartDate: Date;
      if (startDate) {
        // Try to parse the date expression
        const parsedDate = this.parseDateExpression(startDate);
        if (parsedDate) {
          sequenceStartDate = parsedDate;
        } else {
          // Fall back to standard date parsing
          sequenceStartDate = new Date(startDate);
          
          // If that fails too, use current date
          if (isNaN(sequenceStartDate.getTime())) {
            sequenceStartDate = new Date();
          }
        }
      } else {
        sequenceStartDate = new Date();
      }
      
      // Create a task sequence from the template
      const taskSequenceArgs = {
        name: `${template.name} Sequence`,
        tasks: template.tasks.map(task => ({
          ...task,
          duration: task.duration ? Math.ceil(task.duration * scale) : 1
        })),
        swimlaneId: swimlaneId,
        startDate: sequenceStartDate
      };
      
      // If inAllSwimlanes is true, create the template in all swimlanes
      if (inAllSwimlanes) {
        const swimlanes = this.canvas.taskManager.swimlanes;
        if (swimlanes.length > 0) {
          const responses = [];
          
          for (const swimlane of swimlanes) {
            const swimlaneArgs = {
              ...taskSequenceArgs,
              swimlaneId: swimlane.id
            };
            
            const result = await this.createTaskSequence(swimlaneArgs);
            responses.push(`• ${swimlane.name}: ${result}`);
          }
          
          return `Created ${template.name} in all swimlanes:\n${responses.join('\n')}`;
        }
      }
      
      // Create in single swimlane
      const result = await this.createTaskSequence(taskSequenceArgs);
      
      // Get the swimlane name for the response
      const swimlane = this.canvas.taskManager.swimlanes.find(s => s.id === swimlaneId);
      const swimlaneName = swimlane ? swimlane.name : swimlaneId;
      
      // Generate a more friendly response with location if provided
      const locationText = location ? ` for ${location}` : '';
      const scaleText = scale !== 1.0 ? ` (scaled by ${scale.toFixed(1)})` : '';
      
      // Make sure to render the canvas to show the new tasks
      this.canvas.render();
      
      return `Created ${template.name} sequence${locationText} in ${swimlaneName}${scaleText}. ${template.tasks.length} tasks added.`;
    } catch (error) {
      const name = templateNameOverride || (args && args.templateName) || 'unknown';
      return this.handleError(`creating template sequence for "${name}"`, error);
    }
  }

  private async createFromTemplate(args: any): Promise<string> {
    try {
      const { templateName, startDate, location, scaleFactor, inAllSwimlanes } = args;
      let { swimlaneId } = args;
      
      // Ensure we have a template name
      if (!templateName) {
        return "Please specify a template name. Try foundation, framing, mep, site_prep, or use listTemplates to see all options.";
      }
      
      // If no swimlane provided, use the first available
      if (!swimlaneId) {
        swimlaneId = this.getValidSwimlaneId();
      }
      
      // Check if this might actually be a WBS template
      const wbsTemplateIds = getWBSTemplateIds();
      if (wbsTemplateIds.includes(templateName)) {
        return this.applyWBSTemplate({ templateId: templateName });
      }
      
      // Handle potential partial matches
      const exactTemplate = getTemplate(templateName);
      if (!exactTemplate) {
        // Try to find matches
        const matches = findTemplateMatches(templateName);
        
        if (matches.length === 0) {
          // No matches found, list available templates
          const templatesList = getTemplateNames().join(", ");
          return `Template "${templateName}" not found. Available templates: ${templatesList}`;
        } else if (matches.length === 1) {
          // Single match found, use it
          const matchName = matches[0];
          this.debug(`Using matched template: ${matchName} instead of ${templateName}`);
          
          // Forward to createTemplateSequence with the matched template
          return this.createTemplateSequence({
            templateName: matchName,
            startDate,
            location,
            swimlaneId,
            scaleFactor,
            inAllSwimlanes
          });
        } else {
          // Multiple matches, suggest options
          const matchOptions = matches.join(", ");
          return `Multiple matching templates found for "${templateName}". Please specify one of: ${matchOptions}`;
        }
      }
      
      // We have an exact template match, proceed with creation
      return this.createTemplateSequence({
        templateName,
        startDate,
        location,
        swimlaneId,
        scaleFactor,
        inAllSwimlanes
      });
    } catch (error) {
      return this.handleError(`creating from template "${args?.templateName || 'unknown'}"`, error);
    } finally {
      // Ensure the canvas is rendered after template creation
      this.canvas.render();
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
      
      // Get all templates
      const templates = Object.entries(TEMPLATES);
      
      // Simplified response
      const templateList = templates.map(([key, template]) => key).join(", ");
      
      return `Available TASK templates (these create tasks, not swimlanes): ${templateList}`;
    } catch (error: unknown) {
      return this.handleError('listing templates', error);
    }
  }

  private addDependency(args: any): string {
    try {
      this.debug('Adding dependency', args);
      
      const { predecessorName, successorName } = args;
      
      if (!predecessorName || !successorName) {
        return "Both predecessor and successor task names are required";
      }

      // Find tasks by name
      const allTasks = this.canvas.taskManager.getAllTasks();
      const predecessor = allTasks.find(task => task.name.toLowerCase() === predecessorName.toLowerCase());
      const successor = allTasks.find(task => task.name.toLowerCase() === successorName.toLowerCase());

      if (!predecessor) {
        return `Predecessor task "${predecessorName}" not found`;
      }

      if (!successor) {
        return `Successor task "${successorName}" not found`;
      }

      // Add the dependency using task ID
      successor.dependencies.push(predecessor.id);
      
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
          return `Swimlane ${args.swimlaneId} not found`;
        }
      }
      
      if (tasks.length === 0) {
        return "No tasks found";
      }
      
      // Format the task list with simple one-line items
      const taskList = tasks.map(task => {
        const startDateStr = task.startDate.toLocaleDateString('en-US', {month: 'short', day: 'numeric'});
        return `• ${task.name} - ${startDateStr}, ${task.duration}d`;
      }).join('\n');
      
      return `${tasks.length} tasks:\n${taskList}`;
    } catch (error: unknown) {
      return "Error listing tasks";
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
      const swimlanes = this.canvas.taskManager.swimlanes;
      if (!swimlanes || swimlanes.length === 0) {
        return "No swimlanes found";
      }
      
      const swimlaneList = swimlanes.map(lane => 
        `• ${lane.name} (${lane.tasks.length} tasks)`
      ).join('\n');
      
      return `Swimlanes:\n${swimlaneList}`;
    } catch (error: unknown) {
      return "Error listing swimlanes";
    }
  }

  // Helper method to get all swimlane IDs
  /**
   * Forward-pass scheduler: calculates start dates based on dependencies.
   * Tasks with no predecessors start on today. Tasks with predecessors start
   * after the latest predecessor ends.
   */
  private autoSchedule(): void {
    try {
      const tasks = this.canvas.taskManager.getAllTasks();
      if (!tasks || tasks.length === 0) return;

      // Build dependency graph
      const taskMap = new Map<string, any>();
      tasks.forEach((t: any) => taskMap.set(t.id, t));

      // Topological sort + forward pass
      const visited = new Set<string>();
      const scheduled = new Set<string>();
      
      const scheduleTask = (task: any) => {
        if (scheduled.has(task.id)) return;
        if (visited.has(task.id)) return; // cycle protection
        visited.add(task.id);

        // Schedule predecessors first
        if (task.dependencies && task.dependencies.length > 0) {
          task.dependencies.forEach((depId: string) => {
            const dep = taskMap.get(depId);
            if (dep) scheduleTask(dep);
          });
        }

        // Calculate start date
        if (task.dependencies && task.dependencies.length > 0) {
          let latestEnd = new Date(0);
          task.dependencies.forEach((depId: string) => {
            const dep = taskMap.get(depId);
            if (dep) {
              const depEnd = new Date(dep.startDate);
              depEnd.setDate(depEnd.getDate() + (dep.duration || 1));
              if (depEnd > latestEnd) latestEnd = depEnd;
            }
          });
          if (latestEnd.getTime() > 0) {
            task.startDate = latestEnd;
          }
        }
        // Tasks with no dependencies keep their current start date (today)
        
        scheduled.add(task.id);
      };

      tasks.forEach((t: any) => scheduleTask(t));
      this.debug(`Auto-scheduled ${scheduled.size} tasks`);
    } catch (error) {
      console.error('Auto-schedule error:', error);
    }
  }

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
  
  // Make error handling more conversational
  private handleError(operation: string, error: unknown): string {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Composer Error] ${operation}: ${errorMessage}`, error);
    
    // More conversational error messages
    const genericOperations = [
      "creating task", 
      "creating multiple tasks", 
      "creating task sequence", 
      "creating from template",
      "creating template sequence",
      "applying WBS template"
    ];
    
    if (genericOperations.some(op => operation.includes(op))) {
      return `Sorry, I couldn't complete that. Please try again with a different approach.`;
    }
    
    if (operation.includes("listing")) {
      return `I couldn't get that information right now.`;
    }
    
    // Fallback for other errors
    return `That didn't work. Let's try something else.`;
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
      
      // Use provided color or generate a random one
      const swimlaneColor = color || this.getRandomColor();
      
      // Add the new swimlane
      this.canvas.taskManager.addSwimlane(id, name, swimlaneColor);
      
      return `Created swimlane "${name}" with id="${id}". Use swimlaneId="${id}" when creating tasks for this swimlane.`;
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

  // Simplify WBS template listing response
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
          return `No templates for "${projectType}" found. Available templates:\n${getWBSTemplateNames().join(", ")}`;
        } else {
          return "No templates found.";
        }
      }
      
      // Format as a simple comma-separated list
      const templateNames = templates.map(t => t.name).join(", ");
      
      return projectType 
        ? `WBS templates for "${projectType}" (these create SWIMLANES, not tasks): ${templateNames}` 
        : `Available WBS templates (these create SWIMLANES, not tasks): ${templateNames}`;
    } catch (error) {
      console.error("Error listing WBS templates:", error);
      return "Failed to list templates. Please try again.";
    }
  }
  
  // Simplify WBS template application response
  async applyWBSTemplate(args: any): Promise<string> {
    try {
      const templateIdOrType = args.templateId;
      const clearExisting = args.clearExisting === true;
      const customNames = args.customNames || [];
      
      this.debug(`Applying WBS template: ${templateIdOrType}, clear existing: ${clearExisting}`);
      
      // Find the template
      let template = getWBSTemplate(templateIdOrType);
      
      // If not found by ID, try to find by matching project type
      if (!template) {
        template = findBestMatchingWBSTemplate(templateIdOrType);
      }
      
      if (!template) {
        const availableTemplates = getWBSTemplateNames().map(name => `• ${name}`).join('\n');
        return `No template found for "${templateIdOrType}".\n\nAvailable templates:\n${availableTemplates}`;
      }
      
      // Clear existing swimlanes if requested
      if (clearExisting) {
        // Get existing swimlanes and remove them
        const swimlanes = this.canvas.taskManager.swimlanes;
        // Make a copy since we'll be modifying the array during iteration
        const swimlanesToRemove = [...swimlanes];
        this.debug(`Clearing ${swimlanesToRemove.length} existing swimlanes`);
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
      
      // Force a render to ensure UI is updated
      this.canvas.render();
      
      // Create a more detailed and helpful response
      const numSwimlanes = createdSwimlanes.length;
      let response = `✅ Successfully applied the ${template.name} template with ${numSwimlanes} swimlanes:\n\n`;
      
      // Add the list of created swimlanes (first 5, then an indicator for more)
      const displayCount = Math.min(5, createdSwimlanes.length);
      const swimlaneList = createdSwimlanes.slice(0, displayCount)
        .map((lane, index) => `${index + 1}. ${lane.name}`)
        .join('\n');
      
      response += swimlaneList;
      
      // Indicate if there are more swimlanes
      if (createdSwimlanes.length > displayCount) {
        response += `\n... and ${createdSwimlanes.length - displayCount} more`;
      }
      
      // Add next steps guidance
      response += `\n\nNext steps:
1. Add tasks using templates: "Add site preparation sequence to ${createdSwimlanes[0]?.name || 'first swimlane'}"
2. Or add specific tasks: "Create excavation task in ${createdSwimlanes[0]?.name || 'first swimlane'}"`;
      
      // Add project-specific recommendations
      if (template.id.includes('commercial')) {
        response += `\n\nFor commercial buildings, I recommend starting with foundation and structural sequences.`;
      } else if (template.id.includes('healthcare')) {
        response += `\n\nFor healthcare facilities, consider MEP and specialized medical systems sequences.`;
      } else if (template.id.includes('industrial')) {
        response += `\n\nFor industrial facilities, heavy equipment installation and process system sequences are key.`;
      }
      
      return response;
    } catch (error) {
      console.error("Error applying WBS template:", error);
      return "Failed to apply template. Please try again.";
    }
  }

  // Add a method to apply a default template
  async applyDefaultWBSTemplate(): Promise<string> {
    // The commercial building template is a versatile default
    const defaultTemplateId = 'commercial_building';
    
    // Apply the default template
    const result = await this.applyWBSTemplate({ templateId: defaultTemplateId });
    
    // Add a simple explanation of what we did, but keep it conversational
    return `Applied the default Commercial Building WBS template. This creates swimlanes for organizing your project, not tasks. To add tasks, try "Create a foundation sequence" or "Add MEP tasks".`;
  }

  // Add a method to explain template types
  private explainTemplateTypes(): string {
    return `There are two types of templates in this system:

1. WBS Templates - These create swimlanes (categories) for organizing your project. Examples: Commercial Building WBS, Healthcare Facility WBS.

2. Task Templates - These create actual tasks within swimlanes. Examples: foundation, steel_structure, mep_systems.

To get started:
1. First apply a WBS template: "Apply Commercial Building WBS"
2. Then add task sequences: "Add foundation sequence to Site Preparation swimlane"`;
  }

  // Add a helper method to create a site preparation sequence
  private async createSitePreparationSequence(swimlaneId?: string): Promise<string> {
    try {
      this.debug(`Creating site preparation sequence in swimlane: ${swimlaneId || 'auto-detected'}`);
      
      // Find the best matching swimlane for site preparation
      let resolvedSwimlaneId: string | null;
      
      if (swimlaneId) {
        // Try to find the swimlane by the provided ID or name
        resolvedSwimlaneId = this.findBestMatchingSwimlane(swimlaneId);
        if (!resolvedSwimlaneId) {
          // If not found, provide a more helpful message with available swimlanes
          const swimlanes = this.canvas.taskManager.swimlanes;
          if (!swimlanes || swimlanes.length === 0) {
            return "No swimlanes found. Please create a swimlane first.";
          }
          
          const swimlaneList = swimlanes.map(s => `"${s.name}" (ID: ${s.id})`).join(", ");
          return `Swimlane "${swimlaneId}" not found. Available swimlanes are: ${swimlaneList}`;
        }
      } else {
        // Auto-detect the most appropriate swimlane
        resolvedSwimlaneId = this.findSitePreparationSwimlane();
        
        // If no site prep swimlane found, use the first available
        if (!resolvedSwimlaneId) {
          resolvedSwimlaneId = this.getFirstAvailableSwimlaneId();
          
          if (!resolvedSwimlaneId) {
            return "No swimlanes available. Please create a swimlane first.";
          }
        }
      }
      
      // Look for templates related to site preparation in order of preference
      const templateNames = [
        'specialized_siteclearing', 
        'industrial_siteprep', 
        'foundation'   // Fallback option
      ];
      
      // Try each template until one works
      for (const templateName of templateNames) {
        const template = getTemplate(templateName);
        if (template) {
          this.debug(`Using site preparation template: ${templateName}`);
          
          // Add the template to the resolved swimlane
          const result = await this.createTemplateSequence({ 
            templateName, 
            swimlaneId: resolvedSwimlaneId
          }, templateName);
          
          // Get the swimlane name for the response
          const swimlane = this.canvas.taskManager.swimlanes.find(s => s.id === resolvedSwimlaneId);
          const swimlaneName = swimlane ? swimlane.name : resolvedSwimlaneId;
          
          return `${result}\n\nTip: You can add more specific site preparation tasks by saying "Add excavation to ${swimlaneName}" or "Create foundation in ${swimlaneName}".`;
        }
      }
      
      return "I couldn't find any site preparation templates. Please try creating a foundation or excavation sequence instead.";
    } catch (error) {
      return this.handleError("creating site preparation sequence", error);
    }
  }
  
  // Enhanced helper method to find a swimlane suitable for site preparation
  private findSitePreparationSwimlane(): string | null {
    const swimlanes = this.canvas.taskManager.swimlanes;
    if (!swimlanes || swimlanes.length === 0) return null;
    
    // Define arrays of keywords for better matching
    const directMatches = [
      'site', 'prep', 'preparation', 'civil', 'preliminary', 'excavation', 
      'grading', 'clearing', 'sitework', 'site work', 'earthwork', 'foundation', 
      'groundwork', 'ground work'
    ];
    
    const secondaryMatches = [
      'initial', 'begin', 'start', 'first', 'phase 1', 'phase one',
      'mobilization', 'pre-construction', 'preconstruction'
    ];

    // First look for direct matches - these are highest priority
    for (const lane of swimlanes) {
      const laneNameLower = lane.name.toLowerCase();
      
      for (const keyword of directMatches) {
        if (laneNameLower.includes(keyword)) {
          this.debug(`Found site preparation swimlane by direct match: ${lane.name} (matched: ${keyword})`);
          return lane.id;
        }
      }
    }
    
    // Then look for secondary matches - these are lower priority
    for (const lane of swimlanes) {
      const laneNameLower = lane.name.toLowerCase();
      
      for (const keyword of secondaryMatches) {
        if (laneNameLower.includes(keyword)) {
          this.debug(`Found site preparation swimlane by secondary match: ${lane.name} (matched: ${keyword})`);
          return lane.id;
        }
      }
    }
    
    // If we have a swimlane that mentions "foundation" and it's the first one, use that
    const foundationLane = swimlanes.find(lane => 
      lane.name.toLowerCase().includes('foundation')
    );
    
    if (foundationLane) {
      this.debug(`Found foundation swimlane as fallback: ${foundationLane.name}`);
      return foundationLane.id;
    }
    
    // Default to the first swimlane
    this.debug(`No specialized site preparation swimlane found, using first available: ${swimlanes[0].name}`);
    return swimlanes[0].id;
  }
}

export { Composer };
export type { ComposerConfig }; 
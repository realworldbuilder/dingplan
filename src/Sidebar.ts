import { Task } from './Task';
import { Trades } from './Trades';
import { Composer } from './composer/Composer';

export type SidebarView = 'details' | 'composer' | 'options' | 'add-task' | 'edit-swimlanes';

export class Sidebar {
  private width: number = 360;
  private isVisible: boolean = false;
  private element: HTMLElement;
  private currentView: SidebarView = 'details';
  private task: Task | null = null;
  private currentSwimlane: { id: string; name: string; color: string } | null = null;
  private tradeFilters: Map<string, boolean> = new Map(); // Store trade filter states
  
  // Use trades from central definition
  private trades = Trades.getAllTrades();
  
  // Callback for when trades are filtered
  private onTradeFilterChange: ((filters: Map<string, boolean>) => void) | null = null;
  
  // Composer instance
  private composer: Composer | null = null;
  private composerResponseArea: HTMLElement | null = null;
  private apiKeyInput: HTMLInputElement | null = null;

  constructor() {
    this.element = document.createElement('div');
    this.setupStyles();
    this.createContent();
    document.body.appendChild(this.element);
    this.setupEventListeners();
    
    // Initialize all trades as visible
    this.trades.forEach(trade => {
      this.tradeFilters.set(trade.color, true);
    });
  }

  private setupStyles() {
    this.element.style.position = 'fixed';
    this.element.style.top = '0';
    this.element.style.right = '0';
    this.element.style.width = `${this.width}px`;
    this.element.style.height = '100%';
    this.element.style.backgroundColor = '#ffffff';
    this.element.style.boxShadow = '-4px 0 25px rgba(0, 0, 0, 0.1)';
    this.element.style.display = 'none';
    this.element.style.zIndex = '1000';
    this.element.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
    this.element.style.borderLeft = '1px solid rgba(0, 0, 0, 0.1)';
    this.element.style.flexDirection = 'column';
    this.element.style.overflow = 'hidden';
    this.element.style.transition = 'transform 0.3s ease';
    this.element.style.transform = `translateX(${this.width}px)`;

    // Add styles for form elements
    const style = document.createElement('style');
    style.textContent = `
      .sidebar {
        height: 100%;
        display: flex;
        flex-direction: column;
      }
      .sidebar-header {
        background: #ffffff;
        padding: 16px 20px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        flex-shrink: 0;
      }
      .sidebar-title {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: #1a1a1a;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .sidebar-close {
        border: none;
        background: none;
        font-size: 20px;
        cursor: pointer;
        padding: 8px;
        margin: -8px;
        color: #666;
        border-radius: 6px;
        transition: all 0.2s ease;
      }
      .sidebar-close:hover {
        background: rgba(0, 0, 0, 0.05);
        color: #333;
      }
      .sidebar-content {
        padding: 24px 20px;
        overflow-y: auto;
        flex-grow: 1;
      }
      .sidebar-nav {
        display: flex;
        gap: 8px;
        padding: 0 20px;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1);
        background: #f8f9fa;
      }
      .sidebar-nav-item {
        padding: 12px 16px;
        color: #666;
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        border: none;
        background: none;
        border-bottom: 2px solid transparent;
        transition: all 0.2s ease;
      }
      .sidebar-nav-item:hover {
        color: #333;
      }
      .sidebar-nav-item.active {
        color: #2196F3;
        border-bottom-color: #2196F3;
      }
      .view {
        display: none;
        height: 100%;
      }
      .view.active {
        display: block;
      }
      .ai-composer {
        display: flex;
        flex-direction: column;
        height: 100%;
        gap: 16px;
      }
      .ai-composer-input {
        flex-grow: 1;
        border: 1px solid rgba(0, 0, 0, 0.1);
        border-radius: 8px;
        padding: 12px;
        font-family: inherit;
        font-size: 14px;
        resize: none;
        background: #f8f9fa;
      }
      .ai-composer-input:focus {
        outline: none;
        border-color: #2196F3;
        box-shadow: 0 0 0 3px rgba(33, 150, 243, 0.1);
      }
      .ai-composer-button {
        padding: 12px 20px;
        background: #2196F3;
        color: white;
        border: none;
        border-radius: 8px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .ai-composer-button:hover {
        background: #1976D2;
        transform: translateY(-1px);
      }
      .ai-composer-button:active {
        transform: translateY(0);
      }
      .trade-filter-container {
        background: #f8f9fa;
        border-radius: 12px;
        padding: 16px;
        margin-top: 12px;
      }
      .trade-filter-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 16px;
      }
      .trade-filter-actions {
        display: flex;
        gap: 8px;
      }
      .trade-filter-action {
        font-size: 12px;
        color: #2196F3;
        background: none;
        border: none;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
      }
      .trade-filter-action:hover {
        background: rgba(33, 150, 243, 0.1);
      }
      .trade-filter-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .trade-filter-item {
        display: flex;
        align-items: center;
        padding: 10px 12px;
        background: white;
        border-radius: 8px;
        border: 1px solid #eee;
        transition: all 0.2s;
      }
      .trade-filter-item:hover {
        border-color: #ddd;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05);
      }
      .trade-filter-item.disabled {
        opacity: 0.5;
        background: #f5f5f5;
      }
      .trade-filter-color {
        width: 20px;
        height: 20px;
        border-radius: 4px;
        margin-right: 12px;
        border: 1px solid rgba(0,0,0,0.1);
      }
      .trade-filter-name {
        flex-grow: 1;
        font-size: 14px;
        color: #333;
      }
      .trade-filter-toggle {
        width: 36px;
        height: 20px;
        background: #e0e0e0;
        border-radius: 20px;
        position: relative;
        transition: background-color 0.2s;
        cursor: pointer;
      }
      .trade-filter-toggle.active {
        background: #4CAF50;
      }
      .trade-filter-toggle:before {
        content: '';
        position: absolute;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: white;
        top: 2px;
        left: 2px;
        transition: transform 0.2s;
      }
      .trade-filter-toggle.active:before {
        transform: translateX(16px);
      }
      .plan-options-section {
        margin-bottom: 24px;
      }
      .plan-options-title {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 16px;
        color: #333;
      }
      
      /* New form styles */
      .sidebar h3 {
        margin-top: 0;
        margin-bottom: 20px;
        font-size: 18px;
        font-weight: 600;
        color: #333;
      }
      .form-group {
        margin-bottom: 16px;
      }
      .form-group label {
        display: block;
        margin-bottom: 8px;
        font-size: 14px;
        font-weight: 500;
        color: #444;
      }
      .form-group input, .form-group select {
        width: 100%;
        padding: 10px 14px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        font-size: 14px;
        font-family: inherit;
        background-color: #f8f9fa;
        transition: all 0.2s ease;
      }
      .form-group input:focus, .form-group select:focus {
        border-color: #4CAF50;
        box-shadow: 0 0 0 3px rgba(76, 175, 80, 0.1);
        background-color: #fff;
        outline: none;
      }
      .checkbox-group {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
      }
      .checkbox-group label {
        margin-bottom: 0;
        margin-left: 8px;
        cursor: pointer;
      }
      .checkbox-group input[type="checkbox"] {
        width: auto;
        margin-right: 8px;
        cursor: pointer;
      }
      .form-actions {
        display: flex;
        gap: 12px;
        margin-top: 24px;
        padding-top: 16px;
        border-top: 1px solid #f0f0f0;
      }
      .btn-primary {
        padding: 10px 16px;
        border: none;
        border-radius: 8px;
        background-color: #4CAF50;
        color: white;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      .btn-primary:hover {
        background-color: #3d9140;
      }
      .btn-secondary {
        padding: 10px 16px;
        border: 1px solid #e0e0e0;
        border-radius: 8px;
        background-color: white;
        color: #555;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      .btn-secondary:hover {
        background-color: #f5f5f5;
      }
      #sidebar-swimlane-list {
        margin-bottom: 16px;
      }
      .swimlane-item {
        display: flex;
        align-items: center;
        margin-bottom: 8px;
        padding: 12px;
        background-color: #f8f9fa;
        border-radius: 8px;
        border: 1px solid #f0f0f0;
      }
      .swimlane-color {
        width: 16px;
        height: 16px;
        border-radius: 4px;
        margin-right: 12px;
      }
      .swimlane-name-input {
        flex-grow: 1;
        padding: 8px 12px;
        border: 1px solid #e0e0e0;
        border-radius: 6px;
        font-size: 14px;
        background: white;
      }
      .swimlane-actions {
        display: flex;
        margin-left: 8px;
      }
      .swimlane-actions button {
        padding: 6px;
        background: none;
        border: none;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s;
      }
      .swimlane-actions button:hover {
        opacity: 1;
      }
      /* Composer View Styles */
      .ai-composer {
        padding: 10px 15px;
      }
      
      .composer-section-title {
        font-size: 18px;
        margin-bottom: 15px;
        color: #2a5885;
      }
      
      .composer-guide-link {
        margin-bottom: 15px;
        text-align: center;
      }
      
      .guide-link {
        display: inline-block;
        padding: 8px 15px;
        background-color: #f5f9ff;
        border: 1px solid #c0d7e9;
        border-radius: 4px;
        color: #2a5885;
        text-decoration: none;
        font-size: 14px;
        transition: all 0.2s ease;
      }
      
      .guide-link:hover {
        background-color: #e5f0fa;
        border-color: #98c1e0;
      }
      
      .guide-icon {
        margin-right: 5px;
      }
      
      .api-key-section {
    `;
    document.head.appendChild(style);
  }

  private createContent() {
    this.element.innerHTML = `
      <div class="sidebar">
        <div class="sidebar-header">
          <h2 class="sidebar-title">
            <span class="view-icon">📋</span>
            <span class="view-title">Details</span>
          </h2>
          <button class="sidebar-close">×</button>
        </div>
        <div class="sidebar-nav">
          <button class="sidebar-nav-item active" data-view="details">Details</button>
          <button class="sidebar-nav-item" data-view="composer">Composer</button>
          <button class="sidebar-nav-item" data-view="options">Options</button>
        </div>
        <div class="sidebar-content">
          <div id="details-view" class="view active">
            <!-- Task details content will be injected here -->
          </div>
          <div id="composer-view" class="view">
            <div class="ai-composer">
              <div class="api-key-section" style="margin-top: 5px; font-size: 12px;">
                <label for="api-key-input" style="font-size: 12px; display: inline-block; margin-bottom: 3px;">OpenAI API Key:</label>
                <div class="api-key-input-container">
                  <input type="password" id="api-key-input" class="api-key-input" placeholder="Enter your OpenAI API key" style="font-size: 12px; padding: 4px; height: 24px;">
                  <button class="api-key-save-button" style="font-size: 12px; padding: 4px 8px; height: 24px;">Save</button>
                </div>
                <p class="api-key-help" style="font-size: 10px; margin-top: 2px; color: #777;">Your API key is stored in your browser's local storage.</p>
              </div>
              
              <div class="composer-response-area" style="margin-top: 10px;">
                <p class="composer-initial-message">Composer is ready. Enter a prompt below.</p>
              </div>
              
              <textarea 
                class="ai-composer-input" 
                placeholder="plan, search, build. LFG."
              ></textarea>
              <button class="ai-composer-button">
                Send Request
              </button>
              
              <div class="composer-guide-link" style="text-align: left; margin-top: 10px; font-size: 12px;">
                <a href="/composer-guide.html" target="_blank" class="guide-link" style="padding: 3px 6px; font-size: 12px;">
                  <span class="guide-icon">📖</span> Guide
                </a>
              </div>
            </div>
          </div>
          <div id="options-view" class="view">
            <div class="plan-options-section">
              <h3 class="plan-options-title">Trade Management</h3>
              <p>Manage trades and their visibility across the plan:</p>
              
              <div class="trade-filter-container">
                <div class="trade-filter-header">
                  <span>Trades & Visibility</span>
                  <div class="trade-filter-actions">
                    <button class="trade-filter-action" id="select-all-trades">Select All</button>
                    <button class="trade-filter-action" id="clear-all-trades">Clear All</button>
                    <button class="trade-filter-action" id="add-new-trade">+ Add</button>
                  </div>
                </div>
                <div class="trade-filter-list">
                  ${this.trades.map(trade => `
                    <div class="trade-filter-item" data-color="${trade.color}">
                      <div class="trade-filter-color" style="background-color: ${trade.color}"></div>
                      <input type="text" class="trade-filter-name" value="${trade.name}" data-original="${trade.name}">
                      <div class="trade-filter-toggle active" data-color="${trade.color}"></div>
                      <button class="trade-filter-delete" data-color="${trade.color}">×</button>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>
          </div>
          <div id="add-task-view" class="view">
            <!-- Add Task form will be here -->
            <div class="add-task-form">
              <h3>Add New Task</h3>
              <form id="sidebar-add-task-form">
                <div class="form-group">
                  <label for="sidebar-task-name">Task Name</label>
                  <input type="text" id="sidebar-task-name" name="name" required>
                </div>
                <div class="form-group">
                  <label for="sidebar-task-trade">Trade</label>
                  <select id="sidebar-task-trade" name="trade" required>
                    <option value="" disabled selected>Select a trade</option>
                    <!-- Trade options will be populated dynamically -->
                  </select>
                </div>
                <div class="form-group">
                  <label for="sidebar-task-zone">Zone</label>
                  <select id="sidebar-task-zone" name="zone" required>
                    <option value="" disabled selected>Select a zone</option>
                    <!-- Zone options will be populated dynamically -->
                  </select>
                </div>
                <div class="form-group">
                  <label for="sidebar-task-start-date">Start Date</label>
                  <input type="date" id="sidebar-task-start-date" name="startDate" required>
                </div>
                <div class="form-group">
                  <label for="sidebar-task-duration">Duration (days)</label>
                  <input type="number" id="sidebar-task-duration" name="duration" min="1" value="1" required>
                </div>
                <div class="form-group">
                  <label for="sidebar-task-crew-size">Crew Size</label>
                  <input type="number" id="sidebar-task-crew-size" name="crewSize" min="1" value="1" required>
                </div>
                <div class="form-group">
                  <label>Work Schedule</label>
                  <div class="checkbox-group">
                    <input type="checkbox" id="sidebar-work-saturday" name="workOnSaturday">
                    <label for="sidebar-work-saturday">Work on Saturdays</label>
                  </div>
                  <div class="checkbox-group">
                    <input type="checkbox" id="sidebar-work-sunday" name="workOnSunday">
                    <label for="sidebar-work-sunday">Work on Sundays</label>
                  </div>
                </div>
                <div class="form-actions">
                  <button type="submit" class="btn-primary">Add Task</button>
                  <button type="button" class="btn-secondary" id="sidebar-add-another">Add & Create Another</button>
                </div>
              </form>
            </div>
          </div>
          <div id="edit-swimlanes-view" class="view">
            <!-- Edit Swimlanes form will be here -->
            <div class="edit-swimlanes-form">
              <h3>Edit Swimlanes</h3>
              <div id="sidebar-swimlane-list">
                <!-- Swimlanes will be populated dynamically -->
              </div>
              <button id="sidebar-add-swimlane" class="btn-secondary">Add Swimlane</button>
              <div class="form-actions">
                <button id="sidebar-save-swimlanes" class="btn-primary">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add additional styles for the sidebar components
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      .trade-filter-name {
        flex-grow: 1;
        font-size: 14px;
        color: #333;
        border: none;
        background: transparent;
        font-family: inherit;
        padding: 4px;
        border-radius: 4px;
      }
      .trade-filter-name:focus {
        outline: none;
        background: #f0f0f0;
      }
      .trade-filter-delete {
        background: none;
        border: none;
        color: #ccc;
        font-size: 18px;
        cursor: pointer;
        padding: 0 8px;
        opacity: 0.5;
        transition: all 0.2s ease;
      }
      .trade-filter-delete:hover {
        opacity: 1;
        color: #ff4444;
      }
      .color-picker-dialog {
        position: absolute;
        background: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        padding: 12px;
        z-index: 1001;
      }
      .color-swatch {
        width: 24px;
        height: 24px;
        border-radius: 4px;
        margin: 4px;
        cursor: pointer;
        display: inline-block;
        border: 1px solid rgba(0,0,0,0.1);
        transition: transform 0.1s ease;
      }
      .color-swatch:hover {
        transform: scale(1.1);
      }
      
      /* Composer styles */
      .composer-section-title {
        font-size: 16px;
        margin: 0 0 12px 0;
        color: #333;
      }
      
      .api-key-section {
        margin-bottom: 16px;
      }
      
      .api-key-input-container {
        display: flex;
        gap: 8px;
        margin: 6px 0;
      }
      
      .api-key-input {
        flex-grow: 1;
        padding: 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        font-size: 14px;
      }
      
      .api-key-save-button {
        padding: 8px 12px;
        background-color: #4CAF50;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
      }
      
      .api-key-help {
        font-size: 12px;
        color: #666;
        margin: 4px 0 0 0;
      }
      
      .composer-response-area {
        height: 150px;
        overflow-y: auto;
        padding: 12px;
        background-color: #f9f9f9;
        border-radius: 4px;
        margin-bottom: 12px;
        border: 1px solid #eee;
        font-size: 14px;
      }
      
      .composer-message {
        margin-bottom: 8px;
        padding: 5px 0;
        border-bottom: 1px solid #eee;
      }
      
      .user-message {
        color: #3B82F6;
        font-weight: bold;
      }
      
      .ai-composer-input {
        width: 100%;
        height: 80px;
        padding: 8px;
        margin-bottom: 8px;
        border: 1px solid #ccc;
        border-radius: 4px;
        resize: vertical;
        font-family: inherit;
        font-size: 14px;
      }
      
      .ai-composer-button {
        width: 100%;
        padding: 10px;
        background-color: #3B82F6;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
      }
      
      .ai-composer-button:hover {
        background-color: #2563EB;
      }
      
      .command-examples {
        margin-top: 16px;
      }
      
      .command-examples h4 {
        font-size: 14px;
        margin: 0 0 8px 0;
        color: #333;
      }
      
      .command-examples ul {
        list-style-type: none;
        padding: 0;
        margin: 0;
      }
      
      .command-examples li {
        margin-bottom: 6px;
      }
      
      .example-command {
        color: #3B82F6;
        text-decoration: none;
        font-size: 13px;
      }
      
      .example-command:hover {
        text-decoration: underline;
      }
    `;
    document.head.appendChild(styleElement);
    
    // Store references to composer elements
    this.composerResponseArea = this.element.querySelector('.composer-response-area');
    this.apiKeyInput = this.element.querySelector('#api-key-input') as HTMLInputElement;
    
    // Check for stored API key
    const storedApiKey = localStorage.getItem('constructionPlannerApiKey');
    if (storedApiKey && this.apiKeyInput) {
      this.apiKeyInput.value = storedApiKey;
    }
  }

  private setupEventListeners() {
    // Close button
    const closeButton = this.element.querySelector('.sidebar-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => this.hide());
    }

    // Navigation
    const navItems = this.element.querySelectorAll('.sidebar-nav-item');
    navItems.forEach(item => {
      item.addEventListener('click', (e) => {
        const view = (e.target as HTMLElement).dataset.view as SidebarView;
        this.switchView(view);
      });
    });

    // AI Composer button
    const aiButton = this.element.querySelector('.ai-composer-button');
    if (aiButton) {
      aiButton.addEventListener('click', () => {
        const input = this.element.querySelector('.ai-composer-input') as HTMLTextAreaElement;
        if (input.value.trim()) {
          this.handleAIComposerSubmit(input.value);
        }
      });
    }
    
    // API key save button
    const saveKeyButton = this.element.querySelector('.api-key-save-button');
    if (saveKeyButton && this.apiKeyInput) {
      saveKeyButton.addEventListener('click', () => {
        const apiKey = this.apiKeyInput?.value.trim() || '';
        if (apiKey) {
          localStorage.setItem('constructionPlannerApiKey', apiKey);
          if (this.composer) {
            this.composer.setApiKey(apiKey);
          }
          this.addComposerMessage('API key saved successfully!');
        } else {
          this.addComposerMessage('Please enter a valid API key.');
        }
      });
    }
    
    // Trade filter toggles - Improved event handling with propagation stopping
    const tradeToggles = this.element.querySelectorAll('.trade-filter-toggle');
    tradeToggles.forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent bubbling
        
        const toggleElement = e.currentTarget as HTMLElement;
        const color = toggleElement.dataset.color;
        const isActive = toggleElement.classList.contains('active');
        
        // Toggle active state
        toggleElement.classList.toggle('active');
        
        // Update parent item style
        const parentItem = toggleElement.closest('.trade-filter-item');
        if (parentItem) {
          parentItem.classList.toggle('disabled', isActive);
        }
        
        if (color) {
          // Update filter state - create a new map to ensure event fires
          this.tradeFilters.set(color, !isActive);
          
          // Ensure filter changes are propagated
          this.notifyFilterChanged();
        }
      });
    });
    
    // Make color square clickable to change color
    const colorSquares = this.element.querySelectorAll('.trade-filter-color');
    colorSquares.forEach(square => {
      square.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showColorPicker(e.currentTarget as HTMLElement);
      });
    });
    
    // Handle editable trade names
    const tradeNameInputs = this.element.querySelectorAll('.trade-filter-name');
    tradeNameInputs.forEach(input => {
      // Save original value to detect changes
      (input as HTMLInputElement).dataset.originalValue = (input as HTMLInputElement).value;
      
      input.addEventListener('change', (e) => {
        const inputElement = e.currentTarget as HTMLInputElement;
        const tradeItem = inputElement.closest('.trade-filter-item');
        const color = tradeItem?.getAttribute('data-color');
        
        if (color) {
          // Update trade name in the trades array
          const trade = this.trades.find(t => t.color === color);
          if (trade) {
            trade.name = inputElement.value;
          }
        }
      });
    });
    
    // Add delete trade button event listener
    const deleteButtons = this.element.querySelectorAll('.trade-filter-delete');
    deleteButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = (e.currentTarget as HTMLElement).dataset.color;
        this.deleteTrade(color);
      });
    });
    
    // Add new trade button handler
    const addTradeButton = this.element.querySelector('#add-new-trade');
    if (addTradeButton) {
      addTradeButton.addEventListener('click', () => {
        this.addNewTrade();
      });
    }
    
    // "Select All" button - Ensure we create a new map when sending event
    const selectAllButton = this.element.querySelector('#select-all-trades');
    if (selectAllButton) {
      selectAllButton.addEventListener('click', () => {
        const toggles = this.element.querySelectorAll('.trade-filter-toggle');
        toggles.forEach(toggle => {
          const color = (toggle as HTMLElement).dataset.color;
          if (color) {
            // Update toggle UI
            toggle.classList.add('active');
            
            // Update item style
            const parentItem = toggle.closest('.trade-filter-item');
            if (parentItem) {
              parentItem.classList.remove('disabled');
            }
            
            // Update filter state
            this.tradeFilters.set(color, true);
          }
        });
        
        // Notify about filter change with new map instance
        this.notifyFilterChanged();
      });
    }
    
    // "Clear All" button - Ensure we create a new map when sending event
    const clearAllButton = this.element.querySelector('#clear-all-trades');
    if (clearAllButton) {
      clearAllButton.addEventListener('click', () => {
        const toggles = this.element.querySelectorAll('.trade-filter-toggle');
        toggles.forEach(toggle => {
          const color = (toggle as HTMLElement).dataset.color;
          if (color) {
            // Update toggle UI
            toggle.classList.remove('active');
            
            // Update item style
            const parentItem = toggle.closest('.trade-filter-item');
            if (parentItem) {
              parentItem.classList.add('disabled');
            }
            
            // Update filter state
            this.tradeFilters.set(color, false);
          }
        });
        
        // Notify about filter change with new map instance
        this.notifyFilterChanged();
      });
    }
  }

  private switchView(view: SidebarView) {
    this.currentView = view;
    
    // Update navigation
    const navItems = this.element.querySelectorAll('.sidebar-nav-item');
    navItems.forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-view') === view);
    });

    // Update views
    const views = this.element.querySelectorAll('.view');
    views.forEach(v => {
      v.classList.toggle('active', v.id === `${view}-view`);
    });

    // Update header
    const viewTitle = this.element.querySelector('.view-title');
    const viewIcon = this.element.querySelector('.view-icon');
    if (viewTitle && viewIcon) {
      switch (view) {
        case 'details':
          viewTitle.textContent = 'Details';
          viewIcon.textContent = '📋';
          break;
        case 'composer':
          viewTitle.textContent = 'Composer';
          viewIcon.textContent = '🤖';
          break;
        case 'options':
          viewTitle.textContent = 'Plan Options';
          viewIcon.textContent = '⚙️';
          break;
      }
    }
  }

  private async handleAIComposerSubmit(prompt: string) {
    // Display user input
    this.addComposerMessage(prompt, true);
    
    // Get reference to input and button
    const input = this.element.querySelector('.ai-composer-input') as HTMLTextAreaElement;
    const button = this.element.querySelector('.ai-composer-button') as HTMLButtonElement;
    
    if (!this.composer) {
      this.addComposerMessage('Composer not initialized. Please refresh the page.');
      return;
    }
    
    // Check for API key
    const apiKey = localStorage.getItem('constructionPlannerApiKey');
    if (!apiKey) {
      // No API key stored
      input.disabled = true;
      button.disabled = true;
      this.addComposerMessage('Please add your OpenAI API key before sending prompts.');
      return;
    }
    
    try {
      // Disable input and button while processing
      input.disabled = true;
      button.disabled = true;
      button.textContent = 'Processing...';
      
      // Try to process the prompt
      const response = await this.composer.processPrompt(prompt);
      
      // Show the response
      this.addComposerMessage(response);
    } catch (error: unknown) {
      // Display error
      this.addComposerMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      // Re-enable input and button
      input.disabled = false;
      button.disabled = false;
      button.textContent = 'Send Request';
      
      // Clear input field
      input.value = '';
      input.focus();
    }
  }

  show(view: SidebarView = 'details', canvasInstance?: any) {
    this.isVisible = true;
    this.element.style.display = 'flex';
    this.element.style.transform = 'translateX(0)';
    this.switchView(view);
    
    // Populate the forms when showing related views
    if (view === 'add-task' && canvasInstance) {
      this.populateAddTaskForm(canvasInstance);
    } else if (view === 'edit-swimlanes' && canvasInstance) {
      this.populateSwimlanesForm(canvasInstance);
    }
  }

  hide() {
    this.isVisible = false;
    this.element.style.transform = `translateX(${this.width}px)`;
    setTimeout(() => {
      if (!this.isVisible) {
        this.element.style.display = 'none';
      }
    }, 300);
  }

  getWidth(): number {
    return this.width;
  }

  isOpen(): boolean {
    return this.isVisible;
  }

  getCurrentView(): SidebarView {
    return this.currentView;
  }

  // Register a callback for trade filter changes
  onTradeFiltersChanged(callback: (filters: Map<string, boolean>) => void) {
    this.onTradeFilterChange = callback;
  }
  
  // Get the current trade filters
  getTradeFilters(): Map<string, boolean> {
    return new Map(this.tradeFilters);
  }

  private showColorPicker(colorElement: HTMLElement) {
    // Get the current color
    const oldColor = colorElement.style.backgroundColor;
    
    // Create the color picker dialog
    const colorPicker = document.createElement('div');
    colorPicker.className = 'color-picker-dialog';
    colorPicker.style.left = `${colorElement.getBoundingClientRect().left}px`;
    colorPicker.style.top = `${colorElement.getBoundingClientRect().bottom + window.scrollY + 5}px`;
    
    // Add common color swatches
    const colors = [
      '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', 
      '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
      '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#795548', '#9E9E9E'
    ];
    
    colors.forEach(colorHex => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = colorHex;
      
      // When a color is clicked
      swatch.addEventListener('click', () => {
        // Update color in UI
        colorElement.style.backgroundColor = colorHex;
        
        // Get the trade item containing this color element
        const tradeItem = colorElement.closest('.trade-filter-item');
        if (!tradeItem) return;
        
        // Get original color from the data attribute
        const color = tradeItem.getAttribute('data-color');
        if (!color) return;
        
        // Update the data-color attribute
        tradeItem.setAttribute('data-color', colorHex);
        
        // Also update the toggle data-color
        const toggle = tradeItem.querySelector('.trade-filter-toggle');
        if (toggle) {
          toggle.setAttribute('data-color', colorHex);
        }
        
        // Update in the delete button
        const deleteBtn = tradeItem.querySelector('.trade-filter-delete');
        if (deleteBtn) {
          deleteBtn.setAttribute('data-color', colorHex);
        }
        
        // Update the trade in the trades array
        const tradeName = (tradeItem.querySelector('.trade-filter-name') as HTMLInputElement).value;
        const index = this.trades.findIndex(t => t.color === color);
        
        if (index !== -1) {
          // Update in our filters map
          const isVisible = this.tradeFilters.get(color) || false;
          this.tradeFilters.delete(color);
          this.tradeFilters.set(colorHex, isVisible);
          
          // Update in the trades array - keep the existing ID or generate a new one
          const existingId = this.trades[index].id || this.generateTradeId(tradeName, colorHex);
          this.trades[index] = { 
            id: existingId,
            name: tradeName, 
            color: colorHex 
          };
          
          // Notify about filter change
          this.notifyFilterChanged();
        }
        
        // Remove the color picker
        colorPicker.remove();
      });
      
      colorPicker.appendChild(swatch);
    });
    
    // Add to DOM
    document.body.appendChild(colorPicker);
    
    // Add click outside handler to close
    const closePickerHandler = (e: MouseEvent) => {
      if (!colorPicker.contains(e.target as Node) && e.target !== colorElement) {
        colorPicker.remove();
        document.removeEventListener('click', closePickerHandler);
      }
    };
    
    // Use setTimeout to avoid immediate trigger
    setTimeout(() => {
      document.addEventListener('click', closePickerHandler);
    }, 10);
  }
  
  private deleteTrade(color: string | undefined) {
    if (!color) return;
    
    // Confirm deletion
    const confirmDelete = confirm('Are you sure you want to remove this trade?');
    if (!confirmDelete) return;
    
    // Find the trade
    const index = this.trades.findIndex(t => t.color === color);
    if (index === -1) return;
    
    // Remove from trades array
    this.trades.splice(index, 1);
    
    // Remove from filters map
    this.tradeFilters.delete(color);
    
    // Notify about filter change
    this.notifyFilterChanged();
    
    // Update UI
    this.updateTradeList();
  }
  
  private addNewTrade() {
    // Generate random color
    const randomColor = this.getRandomColor();
    const tradeName = "New Trade";
    
    // Generate an ID for the new trade
    const tradeId = this.generateTradeId(tradeName, randomColor);
    
    // Add new trade to array with the required id property
    this.trades.push({ 
      id: tradeId,
      name: tradeName, 
      color: randomColor 
    });
    
    // Add to filters map (default to visible)
    this.tradeFilters.set(randomColor, true);
    
    // Update UI
    this.updateTradeList();
    
    // Notify about filter change
    this.notifyFilterChanged();
  }
  
  private getRandomColor(): string {
    const letters = '0123456789ABCDEF';
    let color = '#';
    
    // Get existing trade colors to avoid duplication
    const existingColors = new Set(this.trades.map(t => t.color.toUpperCase()));
    
    // Generate a new color that doesn't exist yet
    do {
      color = '#';
      for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
      }
    } while (existingColors.has(color));
    
    return color;
  }
  
  private updateTradeList() {
    const tradeList = this.element.querySelector('.trade-filter-list');
    if (!tradeList) return;
    
    tradeList.innerHTML = this.trades.map(trade => `
      <div class="trade-filter-item" data-color="${trade.color}">
        <div class="trade-filter-color" style="background-color: ${trade.color}"></div>
        <input type="text" class="trade-filter-name" value="${trade.name}" data-original="${trade.name}">
        <div class="trade-filter-toggle ${this.tradeFilters.get(trade.color) ? 'active' : ''}" data-color="${trade.color}"></div>
        <button class="trade-filter-delete" data-color="${trade.color}">×</button>
      </div>
    `).join('');
    
    // Re-attach event listeners
    this.setupTradeListEventListeners();
  }
  
  private setupTradeListEventListeners() {
    // Color square click listener
    const colorSquares = this.element.querySelectorAll('.trade-filter-color');
    colorSquares.forEach(square => {
      square.addEventListener('click', (e) => {
        e.stopPropagation();
        this.showColorPicker(e.currentTarget as HTMLElement);
      });
    });
    
    // Trade filter toggles
    const tradeToggles = this.element.querySelectorAll('.trade-filter-toggle');
    tradeToggles.forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        
        const toggleElement = e.currentTarget as HTMLElement;
        const color = toggleElement.dataset.color;
        const isActive = toggleElement.classList.contains('active');
        
        // Toggle active state
        toggleElement.classList.toggle('active');
        
        // Update parent item style
        const parentItem = toggleElement.closest('.trade-filter-item');
        if (parentItem) {
          parentItem.classList.toggle('disabled', isActive);
        }
        
        if (color) {
          // Update filter state
          this.tradeFilters.set(color, !isActive);
          
          // Ensure filter changes are propagated
          this.notifyFilterChanged();
        }
      });
    });
    
    // Handle editable trade names
    const tradeNameInputs = this.element.querySelectorAll('.trade-filter-name');
    tradeNameInputs.forEach(input => {
      // Save original value to detect changes
      (input as HTMLInputElement).dataset.originalValue = (input as HTMLInputElement).value;
      
      input.addEventListener('change', (e) => {
        const inputElement = e.currentTarget as HTMLInputElement;
        const tradeItem = inputElement.closest('.trade-filter-item');
        const color = tradeItem?.getAttribute('data-color');
        
        if (color) {
          // Update trade name in the trades array
          const trade = this.trades.find(t => t.color === color);
          if (trade) {
            trade.name = inputElement.value;
          }
        }
      });
    });
    
    // Delete trade buttons
    const deleteButtons = this.element.querySelectorAll('.trade-filter-delete');
    deleteButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        e.stopPropagation();
        const color = (e.currentTarget as HTMLElement).dataset.color;
        this.deleteTrade(color);
      });
    });
  }
  
  // Helper method to notify about filter changes
  private notifyFilterChanged() {
    if (this.onTradeFilterChange) {
      // Always create a new Map instance to ensure change detection
      const filtersCopy = new Map(this.tradeFilters);
      
      console.log("Notifying filter change:", Array.from(filtersCopy.entries())
        .map(([color, visible]) => `${color}: ${visible}`)
        .join(', '));
      
      this.onTradeFilterChange(filtersCopy);
    }
  }

  // Initialize the Composer with the Canvas instance
  initializeComposer(canvasInstance: any) {
    this.composer = new Composer({
      canvas: canvasInstance
    });
    
    // Set API key if available
    const storedApiKey = localStorage.getItem('constructionPlannerApiKey');
    if (storedApiKey && this.composer) {
      this.composer.setApiKey(storedApiKey);
      this.addComposerMessage('Composer initialized with stored API key.');
    } else {
      this.addComposerMessage('Please add your OpenAI API key to use the Composer.');
    }
  }
  
  private addComposerMessage(message: string, isUserInput = false) {
    if (!this.composerResponseArea) return;
    
    const messageElement = document.createElement('div');
    messageElement.className = `composer-message ${isUserInput ? 'user-message' : ''}`;
    messageElement.textContent = isUserInput ? `You: ${message}` : message;
    
    this.composerResponseArea.appendChild(messageElement);
    this.composerResponseArea.scrollTop = this.composerResponseArea.scrollHeight;
  }

  // Function to generate a simple ID for trades based on their name and color
  private generateTradeId(name: string, color: string): string {
    // Convert name to lowercase, remove spaces and special characters
    const nameId = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    // Take first 6 characters of color hex (without #)
    const colorId = color.replace('#', '').substring(0, 6);
    // Create a unique ID combining name and color
    return `${nameId}-${colorId}`;
  }

  // Add task-related methods
  populateAddTaskForm(canvasInstance: any) {
    // This method is called when the add-task view is shown
    // Populate the form with trades and swimlanes

    const tradeSelect = document.getElementById('sidebar-task-trade') as HTMLSelectElement;
    const zoneSelect = document.getElementById('sidebar-task-zone') as HTMLSelectElement;
    const startDateInput = document.getElementById('sidebar-task-start-date') as HTMLInputElement;

    // Clear existing options
    tradeSelect.innerHTML = '<option value="" disabled selected>Select a trade</option>';
    zoneSelect.innerHTML = '<option value="" disabled selected>Select a zone</option>';

    // Add trade options
    this.trades.forEach(trade => {
      const option = document.createElement('option');
      option.value = trade.id;
      option.textContent = trade.name;
      option.dataset.color = trade.color;
      tradeSelect.appendChild(option);
    });

    // Add swimlane options
    if (canvasInstance && canvasInstance.taskManager) {
      canvasInstance.taskManager.swimlanes.forEach((swimlane: any) => {
        const option = document.createElement('option');
        option.value = swimlane.id;
        option.textContent = swimlane.name;
        zoneSelect.appendChild(option);
      });
    }

    // Set default date to today
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    startDateInput.value = formattedDate;

    // Add form submit event handler
    const form = document.getElementById('sidebar-add-task-form') as HTMLFormElement;
    const addAnotherButton = document.getElementById('sidebar-add-another') as HTMLButtonElement;

    form.onsubmit = (e) => {
      e.preventDefault();
      this.handleAddTaskSubmit(canvasInstance, false);
    };

    addAnotherButton.onclick = () => {
      this.handleAddTaskSubmit(canvasInstance, true);
    };
  }

  handleAddTaskSubmit(canvasInstance: any, createAnother: boolean) {
    const form = document.getElementById('sidebar-add-task-form') as HTMLFormElement;
    const nameInput = document.getElementById('sidebar-task-name') as HTMLInputElement;
    const tradeSelect = document.getElementById('sidebar-task-trade') as HTMLSelectElement;
    const zoneSelect = document.getElementById('sidebar-task-zone') as HTMLSelectElement;
    const startDateInput = document.getElementById('sidebar-task-start-date') as HTMLInputElement;
    const durationInput = document.getElementById('sidebar-task-duration') as HTMLInputElement;
    const crewSizeInput = document.getElementById('sidebar-task-crew-size') as HTMLInputElement;
    const workSaturdayInput = document.getElementById('sidebar-work-saturday') as HTMLInputElement;
    const workSundayInput = document.getElementById('sidebar-work-sunday') as HTMLInputElement;

    // Validate form
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    // Get selected trade color
    const selectedOption = tradeSelect.options[tradeSelect.selectedIndex];
    const tradeColor = selectedOption ? selectedOption.dataset.color || '#cccccc' : '#cccccc';

    // Create task config
    const taskConfig = {
      id: this.generateUUID(),
      name: nameInput.value,
      tradeId: tradeSelect.value,
      color: tradeColor,
      swimlaneId: zoneSelect.value,
      startDate: new Date(startDateInput.value),
      duration: parseInt(durationInput.value),
      crewSize: parseInt(crewSizeInput.value),
      workOnSaturday: workSaturdayInput.checked,
      workOnSunday: workSundayInput.checked
    };

    // Add task through canvas
    if (canvasInstance && canvasInstance.addTask) {
      canvasInstance.addTask(taskConfig);
    }

    // Reset form or close sidebar
    if (createAnother) {
      nameInput.value = '';
      nameInput.focus();
    } else {
      this.hide();
    }
  }

  // Swimlane-related methods
  populateSwimlanesForm(canvasInstance: any) {
    // This method is called when the edit-swimlanes view is shown
    const swimlaneListContainer = document.getElementById('sidebar-swimlane-list');
    if (!swimlaneListContainer) return;

    // Clear existing swimlanes
    swimlaneListContainer.innerHTML = '';

    // Populate swimlanes
    if (canvasInstance && canvasInstance.taskManager) {
      canvasInstance.taskManager.swimlanes.forEach((swimlane: any, index: number) => {
        const swimlaneItem = document.createElement('div');
        swimlaneItem.className = 'swimlane-item';
        swimlaneItem.innerHTML = `
          <div class="swimlane-color" style="background-color: ${swimlane.color}"></div>
          <input type="text" class="swimlane-name-input" value="${swimlane.name}" data-lane-id="${swimlane.id}">
          <div class="swimlane-actions">
            ${index > 0 ? `<button class="move-up-btn" data-lane-id="${swimlane.id}">⬆️</button>` : '<div style="width: 28px;"></div>'}
            ${index < canvasInstance.taskManager.swimlanes.length - 1 ? `<button class="move-down-btn" data-lane-id="${swimlane.id}">⬇️</button>` : '<div style="width: 28px;"></div>'}
            <button class="delete-lane-btn" data-lane-id="${swimlane.id}">🗑️</button>
          </div>
        `;
        swimlaneListContainer.appendChild(swimlaneItem);
      });
    }

    // Add event listeners
    this.setupSwimlanesEventListeners(canvasInstance);
  }

  setupSwimlanesEventListeners(canvasInstance: any) {
    const swimlaneListContainer = document.getElementById('sidebar-swimlane-list');
    const addSwimlanesButton = document.getElementById('sidebar-add-swimlane');
    const saveButton = document.getElementById('sidebar-save-swimlanes');

    if (!swimlaneListContainer || !addSwimlanesButton || !saveButton) return;

    // Add swimlane
    addSwimlanesButton.onclick = () => {
      const newItem = document.createElement('div');
      newItem.className = 'swimlane-item';
      const laneId = this.generateUUID();
      const randomColor = this.getRandomHexColor();
      
      newItem.innerHTML = `
        <div class="swimlane-color" style="background-color: ${randomColor}"></div>
        <input type="text" class="swimlane-name-input" value="New Swimlane" data-lane-id="${laneId}">
        <div class="swimlane-actions">
          <button class="move-up-btn" data-lane-id="${laneId}">⬆️</button>
          <button class="move-down-btn" data-lane-id="${laneId}">⬇️</button>
          <button class="delete-lane-btn" data-lane-id="${laneId}">🗑️</button>
        </div>
      `;
      
      swimlaneListContainer.appendChild(newItem);
      
      // Focus the new swimlane's input
      const input = newItem.querySelector('input');
      if (input) input.focus();
      
      // Re-bind event handlers for new buttons
      this.bindSwimlaneMoveButtons(canvasInstance);
    };
    
    // Save swimlanes
    saveButton.onclick = () => {
      this.saveSwimlanesChanges(canvasInstance);
    };
    
    // Delete, move up, move down buttons
    this.bindSwimlaneMoveButtons(canvasInstance);
  }
  
  bindSwimlaneMoveButtons(canvasInstance: any) {
    const deleteButtons = document.querySelectorAll('.delete-lane-btn');
    const moveUpButtons = document.querySelectorAll('.move-up-btn');
    const moveDownButtons = document.querySelectorAll('.move-down-btn');
    
    // Delete handlers
    deleteButtons.forEach(btn => {
      (btn as HTMLButtonElement).addEventListener('click', (e: MouseEvent) => {
        const button = e.target as HTMLElement;
        const item = button.closest('.swimlane-item');
        if (item && item.parentNode) {
          item.parentNode.removeChild(item);
        }
      });
    });
    
    // Move up handlers
    moveUpButtons.forEach(btn => {
      (btn as HTMLButtonElement).addEventListener('click', (e: MouseEvent) => {
        const button = e.target as HTMLElement;
        const item = button.closest('.swimlane-item');
        if (item && item.previousElementSibling) {
          item.parentNode?.insertBefore(item, item.previousElementSibling);
        }
      });
    });
    
    // Move down handlers
    moveDownButtons.forEach(btn => {
      (btn as HTMLButtonElement).addEventListener('click', (e: MouseEvent) => {
        const button = e.target as HTMLElement;
        const item = button.closest('.swimlane-item');
        if (item && item.nextElementSibling) {
          item.parentNode?.insertBefore(item.nextElementSibling, item);
        }
      });
    });
  }
  
  saveSwimlanesChanges(canvasInstance: any) {
    const swimlaneInputs = document.querySelectorAll('.swimlane-name-input');
    
    // Get existing swimlanes and tasks from the task manager
    if (!canvasInstance || !canvasInstance.taskManager) return;
    
    const existingSwimlanesMap = new Map();
    canvasInstance.taskManager.swimlanes.forEach((swimlane: any) => {
      existingSwimlanesMap.set(swimlane.id, swimlane);
    });
    
    // Create updated swimlanes array
    const updatedSwimlanes: any[] = [];
    
    swimlaneInputs.forEach(input => {
      const inputEl = input as HTMLInputElement;
      const laneId = inputEl.dataset.laneId || '';
      const name = inputEl.value;
      
      // If swimlane exists, preserve its tasks, positions, and original hex color
      if (existingSwimlanesMap.has(laneId)) {
        const existingSwimlane = existingSwimlanesMap.get(laneId);
        updatedSwimlanes.push({
          id: laneId,
          name: name,
          // Preserve original color instead of getting from DOM
          color: existingSwimlane.color,
          // We'll recalculate y position after all swimlanes are collected
          y: 0, // Temporary value, will be updated below
          height: existingSwimlane.height || canvasInstance.taskManager.SWIMLANE_HEIGHT,
          tasks: existingSwimlane.tasks || [],
          taskPositions: existingSwimlane.taskPositions || new Map(),
          wbsId: existingSwimlane.wbsId
        });
      } else {
        // New swimlane - get color from DOM
        const colorDiv = inputEl.closest('.swimlane-item')?.querySelector('.swimlane-color') as HTMLElement;
        let color = colorDiv?.style.backgroundColor || '#cccccc';
        
        // Convert RGB to hex if needed
        if (color.startsWith('rgb')) {
          // Parse RGB values
          const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (rgbMatch) {
            const r = parseInt(rgbMatch[1]);
            const g = parseInt(rgbMatch[2]);
            const b = parseInt(rgbMatch[3]);
            // Convert to hex
            color = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
          }
        }
        
        updatedSwimlanes.push({
          id: laneId,
          name: name,
          color: color,
          // We'll recalculate y position after all swimlanes are collected
          y: 0, // Temporary value, will be updated below
          height: canvasInstance.taskManager.SWIMLANE_HEIGHT,
          tasks: [],
          taskPositions: new Map()
        });
      }
    });
    
    // Now recalculate y positions based on the new order
    const laneSpacing = 20; // Space between swimlanes
    updatedSwimlanes.forEach((swimlane, index) => {
      swimlane.y = index * (canvasInstance.taskManager.SWIMLANE_HEIGHT + laneSpacing);
    });
    
    // Update swimlanes in task manager
    if (canvasInstance && canvasInstance.taskManager) {
      canvasInstance.taskManager.swimlanes.length = 0; // Clear the array without losing reference
      updatedSwimlanes.forEach(swimlane => canvasInstance.taskManager.swimlanes.push(swimlane));
      canvasInstance.render(); // Redraw the canvas
    }
    
    // Close the sidebar
    this.hide();
  }
  
  private getRandomHexColor(): string {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
      color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
  }

  // Helper function for generating UUIDs
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
} 
import { Task } from './Task';
import { Trades } from './Trades';
import { Composer } from './composer/Composer';
import { clearLocalStorage } from './utils/localStorage';
import { XerImporter } from './XerImporter';
import { authService } from './services/authService';
import { 
  loadProject, listProjects, saveProject, deleteProject, downloadProjectJSON
} from './services/projectService';
import { WBS_TEMPLATES } from './composer/WBSTemplates';
import { generateUUID } from './utils';

export type SidebarView = 'details' | 'composer' | 'options' | 'add-task' | 'edit-swimlanes' | 'manage-trades';

const LEFT_PANEL_WIDTH = 260;
const RIGHT_PANEL_WIDTH = 380;

export class Sidebar {
  private isVisible: boolean = false;
  public element: HTMLElement; // right detail panel
  private leftPanel: HTMLElement;
  private currentView: SidebarView = 'details';
  private task: Task | null = null;
  private tradeFilters: Map<string, boolean> = new Map();
  private trades = Trades.getAllTrades();
  private onTradeFilterChange: ((filters: Map<string, boolean>) => void) | null = null;
  private composer: Composer | null = null;
  private composerResponseArea: HTMLElement | null = null;
  private canvas: any = null;
  private activeNavItem: string | null = null;
  private leftPanelVisible: boolean = false;

  constructor() {
    // Create LEFT panel (starts hidden, toggled by hamburger)
    this.leftPanel = document.createElement('div');
    this.setupLeftPanel();
    const container = document.getElementById('left-panel');
    if (container) {
      container.appendChild(this.leftPanel);
    } else {
      document.body.appendChild(this.leftPanel);
    }

    // Create RIGHT detail panel (slide-out)
    this.element = document.createElement('div');
    this.setupRightPanel();
    this.createRightPanelContent();
    document.body.appendChild(this.element);

    this.setupEventListeners();
    this.updateStatusBanner();
    
    this.trades.forEach(trade => {
      this.tradeFilters.set(trade.id, true);
    });
    
    // Listen for auth state changes to update banner
    authService.onAuthStateChange(() => {
      this.updateStatusBanner();
    });
  }

  private setupLeftPanel() {
    const lp = this.leftPanel;
    lp.style.cssText = `
      width: ${LEFT_PANEL_WIDTH}px; height: 100%; background: #ffffff;
      border-right: 1px solid #e5e7eb; display: flex; flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      overflow-y: auto; user-select: none;
      transform: translateX(-${LEFT_PANEL_WIDTH}px); transition: transform 0.3s ease;
    `;

    lp.innerHTML = `
      <div style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0; text-align: center;">
        <img src="/logo.png" alt="DingPlan" style="width: 90%; max-width: 220px; object-fit: contain;">
      </div>

      <!-- Status banner -->
      <div id="sidebar-status-banner" style="padding: 8px 16px; border-bottom: 1px solid #dcfce7; font-size: 12px; display: flex; align-items: center; gap: 6px;">
        <!-- Will be updated dynamically based on auth state -->
      </div>

      <!-- Project section -->
      <div style="padding: 12px 16px; border-bottom: 1px solid #f0f0f0;">
        <div style="font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Current Project</div>
        <input id="left-project-name" type="text" value="My Project" placeholder="Project Name"
          style="width: 100%; border: 1px solid #e5e7eb; background: #f9fafb; font-size: 14px; font-weight: 600; color: #333; padding: 8px 10px; border-radius: 6px; font-family: inherit; outline: none; box-sizing: border-box;"
          onfocus="this.style.borderColor='#3b82f6'; this.style.background='#fff'"
          onblur="this.style.borderColor='#e5e7eb'; this.style.background='#f9fafb'">
        <div style="display: flex; gap: 6px; margin-top: 8px;">
          <button class="left-nav-btn-sm" data-action="new-project">+ New</button>
          <button class="left-nav-btn-sm" data-action="open-project">Open</button>
          <button class="left-nav-btn-sm" data-action="delete-project" style="color: #dc2626;">Delete</button>
        </div>
      </div>

      <!-- Saved projects list (collapsible) -->
      <div id="projects-list-section" style="display: none; padding: 8px 16px; border-bottom: 1px solid #f0f0f0; max-height: 200px; overflow-y: auto;">
        <div id="projects-list"></div>
      </div>

      <div class="left-nav" style="padding: 8px 0; flex: 1;">
        <div style="padding: 4px 20px 4px; font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">Schedule</div>
        <div class="nav-section" style="padding: 0 8px;">
          <button class="left-nav-btn" data-action="add-task">➕ Add Task</button>
          <button class="left-nav-btn" data-action="edit-swimlanes">🏗️ Swimlanes</button>
          <button class="left-nav-btn" data-action="manage-trades">🛠️ Trades</button>
          <button class="left-nav-btn" data-action="go-to-today">📅 Go to Today</button>
          <button class="left-nav-btn" data-action="toggle-deps">🔗 Dependencies</button>
        </div>
        <div style="height: 1px; background: #f0f0f0; margin: 8px 16px;"></div>
        <div class="nav-section" style="padding: 0 8px;">
          <button class="left-nav-btn" data-action="composer">🤖 AI Composer</button>
        </div>
        <div style="height: 1px; background: #f0f0f0; margin: 8px 16px;"></div>
        <div style="padding: 4px 20px 4px; font-size: 11px; font-weight: 600; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">Import / Export</div>
        <div class="nav-section" style="padding: 0 8px;">
          <button class="left-nav-btn" data-action="import-xer">📥 Import XER</button>
          <button class="left-nav-btn" data-action="export-pdf">📄 Export PDF</button>
          <button class="left-nav-btn" data-action="export-json">💾 Export JSON</button>
          <button class="left-nav-btn" data-action="import-json">📂 Import JSON</button>
          <button class="left-nav-btn" data-action="share-link">🔗 Share Link</button>
        </div>
        <div style="height: 1px; background: #f0f0f0; margin: 8px 16px;"></div>
        <div class="nav-section" style="padding: 0 8px;">
          <button class="left-nav-btn" data-action="settings">⚙️ Settings</button>
        </div>
      </div>
    `;

    // Add nav button styles
    const style = document.createElement('style');
    style.textContent = `
      .left-nav-btn {
        display: block; width: 100%; text-align: left; padding: 9px 12px;
        border: none; background: none; font-size: 14px; color: #374151;
        cursor: pointer; border-radius: 6px; font-family: inherit;
        transition: background 0.15s;
      }
      .left-nav-btn:hover { background: #f3f4f6; }
      .left-nav-btn-sm {
        flex: 1; padding: 6px 8px; border: 1px solid #e5e7eb; background: #fff;
        font-size: 12px; font-weight: 500; color: #374151; cursor: pointer;
        border-radius: 6px; font-family: inherit; transition: all 0.15s; text-align: center;
      }
      .left-nav-btn-sm:hover { background: #f3f4f6; border-color: #d1d5db; }
      .project-item {
        display: flex; align-items: center; justify-content: space-between; padding: 8px 10px;
        border-radius: 6px; cursor: pointer; font-size: 13px; color: #374151; transition: background 0.15s;
      }
      .project-item:hover { background: #f3f4f6; }
      .project-item.active { background: #eff6ff; color: #1d4ed8; font-weight: 600; }
      .project-item-date { font-size: 11px; color: #9ca3af; }
      .left-nav-btn.active { background: #e8f0fe; color: #1a56db; }
    `;
    document.head.appendChild(style);
  }

  private setupRightPanel() {
    this.element.style.cssText = `
      position: fixed; top: 0; right: 0; width: ${RIGHT_PANEL_WIDTH}px; height: 100%;
      background: #ffffff; box-shadow: -4px 0 25px rgba(0,0,0,0.1);
      display: none; z-index: 1000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      border-left: 1px solid rgba(0,0,0,0.1); flex-direction: column;
      overflow: hidden; transition: transform 0.3s ease;
      transform: translateX(${RIGHT_PANEL_WIDTH}px);
    `;

    // Add right panel styles
    const style = document.createElement('style');
    style.textContent = `
      /* ===== Right Panel Design System ===== */
      .rp-header {
        padding: 18px 20px; display: flex; justify-content: space-between;
        align-items: center; border-bottom: 1px solid #e8e8e8; flex-shrink: 0;
      }
      .rp-title { margin: 0; font-size: 16px; font-weight: 600; color: #1a1a1a; letter-spacing: -0.01em; }
      .rp-close {
        border: none; background: none; font-size: 18px; cursor: pointer;
        padding: 6px 8px; margin: -6px -8px; color: #9ca3af; border-radius: 8px;
        transition: all 0.15s ease; line-height: 1;
      }
      .rp-close:hover { background: #f5f5f5; color: #1a1a1a; }
      .rp-body { padding: 20px; overflow-y: auto; flex-grow: 1; display: flex; flex-direction: column; }
      .rp-view { display: none; }
      .rp-view.active { display: flex; flex-direction: column; }

      /* Form groups */
      .form-group { margin-bottom: 20px; }
      .form-group label {
        display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500;
        color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;
      }
      .form-group input, .form-group select {
        width: 100%; padding: 10px 12px; border: 1px solid #e8e8e8; border-radius: 8px;
        font-size: 14px; font-family: inherit; background: #fff; color: #1a1a1a;
        transition: border-color 0.15s, box-shadow 0.15s; box-sizing: border-box; height: 40px;
      }
      .form-group input:focus, .form-group select:focus {
        border-color: #1a1a1a; box-shadow: 0 0 0 3px rgba(26,26,26,0.08);
        outline: none;
      }

      /* Custom checkboxes */
      .checkbox-group { display: flex; align-items: center; margin-bottom: 10px; }
      .checkbox-group label {
        margin-bottom: 0; margin-left: 10px; cursor: pointer;
        font-size: 14px; color: #374151; text-transform: none; letter-spacing: 0; font-weight: 400;
      }
      .checkbox-group input[type="checkbox"] {
        width: 18px; height: 18px; margin-right: 0; cursor: pointer;
        accent-color: #1a1a1a; border-radius: 4px;
      }

      /* Buttons */
      .form-actions { display: flex; gap: 10px; margin-top: 28px; padding-top: 20px; border-top: 1px solid #f0f0f0; }
      .btn-primary {
        padding: 10px 20px; border: none; border-radius: 8px; background: #1a1a1a;
        color: white; font-size: 14px; font-weight: 500; cursor: pointer;
        height: 40px; transition: all 0.15s ease; font-family: inherit;
      }
      .btn-primary:hover { background: #333; transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
      .btn-secondary {
        padding: 10px 20px; border: 1px solid #e8e8e8; border-radius: 8px;
        background: white; color: #374151; font-size: 14px; font-weight: 500; cursor: pointer;
        height: 40px; transition: all 0.15s ease; font-family: inherit;
      }
      .btn-secondary:hover { background: #fafafa; border-color: #d1d5db; }
      .btn-danger {
        padding: 10px 20px; border: 1px solid #fecaca; border-radius: 8px; background: white;
        color: #dc2626; font-size: 14px; font-weight: 500; cursor: pointer;
        height: 40px; transition: all 0.15s ease; font-family: inherit;
      }
      .btn-danger:hover { background: #fef2f2; }

      /* Swimlane items — card with color left border */
      .swimlane-item {
        display: flex; align-items: center; margin-bottom: 8px; padding: 12px 14px;
        background: #fafafa; border-radius: 10px; border: 1px solid #f0f0f0;
        border-left: 4px solid #9ca3af; transition: box-shadow 0.15s ease;
      }
      .swimlane-item:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
      .swimlane-color { display: none; }
      .swimlane-name-input {
        flex-grow: 1; padding: 8px 10px; border: 1px solid transparent;
        border-radius: 6px; font-size: 14px; background: transparent; color: #1a1a1a;
        font-family: inherit; transition: all 0.15s ease;
      }
      .swimlane-name-input:hover { background: #fff; }
      .swimlane-name-input:focus {
        outline: none; background: #fff; border-color: #e8e8e8;
        box-shadow: 0 0 0 3px rgba(26,26,26,0.06);
      }
      .swimlane-actions { display: flex; margin-left: 4px; gap: 2px; }
      .swimlane-actions button {
        padding: 4px 6px; background: none; border: none; cursor: pointer;
        opacity: 0.4; font-size: 14px; border-radius: 6px; transition: all 0.15s;
      }
      .swimlane-actions button:hover { opacity: 1; background: #f0f0f0; }

      /* Trade management */
      .trade-filter-container { background: transparent; border-radius: 0; padding: 0; margin-top: 8px; }
      .trade-filter-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #f0f0f0;
      }
      .trade-filter-header > span { font-size: 13px; font-weight: 500; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px; }
      .trade-filter-actions { display: flex; gap: 4px; }
      .trade-filter-action {
        font-size: 12px; color: #6b7280; background: none; border: none; cursor: pointer;
        padding: 4px 8px; border-radius: 6px; font-weight: 500; transition: all 0.15s; font-family: inherit;
      }
      .trade-filter-action:hover { background: #f5f5f5; color: #1a1a1a; }
      .trade-filter-list { display: flex; flex-direction: column; gap: 6px; }
      .trade-filter-item {
        display: flex; align-items: center; padding: 10px 12px; background: #fafafa;
        border-radius: 10px; border: 1px solid #f0f0f0; transition: all 0.15s ease;
      }
      .trade-filter-item:hover { border-color: #e8e8e8; background: #fff; }
      .trade-filter-item.disabled { opacity: 0.45; }
      .trade-filter-color {
        width: 22px; height: 22px; border-radius: 6px; margin-right: 12px; flex-shrink: 0;
        border: 2px solid transparent; cursor: pointer; transition: all 0.15s ease;
      }
      .trade-filter-color:hover { border-color: rgba(0,0,0,0.15); transform: scale(1.1); }
      .trade-filter-name {
        flex-grow: 1; font-size: 14px; color: #1a1a1a; border: none; background: transparent;
        font-family: inherit; padding: 4px 6px; border-radius: 6px; font-weight: 450;
      }
      .trade-filter-name:focus { outline: none; background: #fff; box-shadow: 0 0 0 2px rgba(26,26,26,0.08); }
      .trade-filter-toggle {
        width: 40px; height: 22px; background: #d1d5db; border-radius: 22px;
        position: relative; cursor: pointer; transition: background 0.2s ease; border: none; padding: 0;
        flex-shrink: 0; margin-left: 8px;
      }
      .trade-filter-toggle.active { background: #22c55e; }
      .trade-filter-toggle::before {
        content: ''; position: absolute; width: 18px; height: 18px; border-radius: 50%;
        background: white; top: 2px; left: 2px; transition: transform 0.2s ease;
        box-shadow: 0 1px 3px rgba(0,0,0,0.15);
      }
      .trade-filter-toggle.active::before { transform: translateX(18px); }
      .trade-filter-delete {
        background: none; border: none; color: #d1d5db; font-size: 16px;
        cursor: pointer; padding: 0 4px 0 8px; transition: color 0.15s; line-height: 1;
      }
      .trade-filter-delete:hover { color: #ef4444; }

      /* Color picker */
      .color-picker-dialog {
        position: absolute; background: white; border-radius: 12px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05);
        padding: 14px; z-index: 1001; display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px;
      }
      .color-swatch {
        width: 28px; height: 28px; border-radius: 6px; cursor: pointer;
        display: inline-block; border: 2px solid transparent; transition: all 0.15s;
      }
      .color-swatch:hover { transform: scale(1.15); border-color: rgba(0,0,0,0.1); }

      /* AI Composer — chat-style */
      .composer-response-area {
        height: 320px; max-height: 55vh; overflow-y: auto;
        border: none; border-radius: 10px; padding: 16px;
        background: #1a1a1a; font-size: 14px; line-height: 1.6; white-space: pre-wrap;
        color: #e5e7eb; margin-bottom: 16px;
      }
      .composer-response-area p { color: #6b7280; }
      .composer-message {
        margin-bottom: 12px; padding: 10px 14px; border-radius: 8px;
        background: rgba(255,255,255,0.06); border-left: none; color: #e5e7eb; font-size: 13px;
      }
      .composer-message.user-message {
        background: rgba(255,255,255,0.12); color: #fff;
        border-left: 3px solid rgba(255,255,255,0.3); margin-left: 0;
      }
      .ai-composer-input {
        width: 100%; height: 80px; padding: 10px 12px; margin-bottom: 10px;
        border: 1px solid #e8e8e8; border-radius: 8px; resize: vertical;
        font-family: inherit; font-size: 14px; color: #1a1a1a; background: #fff;
        transition: border-color 0.15s, box-shadow 0.15s; box-sizing: border-box;
      }
      .ai-composer-input:focus { border-color: #1a1a1a; box-shadow: 0 0 0 3px rgba(26,26,26,0.08); outline: none; }
      .ai-composer-button {
        width: 100%; padding: 10px; background: #1a1a1a; color: white;
        border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500;
        font-family: inherit; height: 42px; transition: all 0.15s ease;
      }
      .ai-composer-button:hover { background: #333; transform: translateY(-1px); box-shadow: 0 2px 8px rgba(0,0,0,0.12); }
      .ai-composer-button:disabled { background: #9ca3af; transform: none; box-shadow: none; cursor: not-allowed; }
    `;
    document.head.appendChild(style);
  }

  private createRightPanelContent() {
    this.element.innerHTML = `
      <div style="display:flex;flex-direction:column;height:100%">
        <div class="rp-header">
          <h2 class="rp-title">Details</h2>
          <button class="rp-close">×</button>
        </div>
        <div class="rp-body">
          <div id="details-view" class="rp-view active"></div>
          <div id="composer-view" class="rp-view" style="flex:1; overflow:hidden;">
            <div class="ai-composer" style="display:flex; flex-direction:column; height:100%;">
              <p style="font-size:13px; color:#6b7280; margin:0 0 16px; line-height:1.5;">Describe your project and the AI will generate a schedule with tasks, dependencies, and trade assignments.</p>
              <div class="composer-response-area" style="flex:1; margin-bottom:16px;">
                <p style="color:#6b7280; font-size:13px;">Describe your project to get started...</p>
              </div>
              <textarea class="ai-composer-input" placeholder="e.g. 5-story office building, 18 months, concrete structure with curtain wall..."></textarea>
              <button class="ai-composer-button">Generate Schedule</button>
              <p class="composer-hint" style="font-size:12px; color:#9ca3af; margin-top:10px; line-height:1.4;">Sign in to use AI Composer, or add your own API key in Settings.</p>
            </div>
          </div>
          <div id="add-task-view" class="rp-view">
            <form id="sidebar-add-task-form">
              <div class="form-group">
                <label for="sidebar-task-name">Task Name</label>
                <input type="text" id="sidebar-task-name" name="name" required>
              </div>
              <div class="form-group">
                <label for="sidebar-task-trade">Trade</label>
                <select id="sidebar-task-trade" name="trade" required>
                  <option value="" disabled selected>Select a trade</option>
                </select>
              </div>
              <div class="form-group">
                <label for="sidebar-task-zone">Swimlane</label>
                <select id="sidebar-task-zone" name="zone" required>
                  <option value="" disabled selected>Select a swimlane</option>
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
                <div style="background:#fafafa; border:1px solid #f0f0f0; border-radius:10px; padding:14px;">
                  <div class="checkbox-group">
                    <input type="checkbox" id="sidebar-work-saturday" name="workOnSaturday">
                    <label for="sidebar-work-saturday">Work on Saturdays</label>
                  </div>
                  <div class="checkbox-group" style="margin-bottom:0;">
                    <input type="checkbox" id="sidebar-work-sunday" name="workOnSunday">
                    <label for="sidebar-work-sunday">Work on Sundays</label>
                  </div>
                </div>
              </div>
              <div class="form-actions">
                <button type="submit" class="btn-primary">Add Task</button>
                <button type="button" class="btn-secondary" id="sidebar-add-another">Add & Create Another</button>
              </div>
            </form>
          </div>
          <div id="edit-swimlanes-view" class="rp-view">
            <p style="font-size:13px; color:#6b7280; margin:0 0 16px; line-height:1.5;">Organize your schedule into swimlanes — phases, zones, or areas.</p>
            <div id="sidebar-swimlane-list"></div>
            <button id="sidebar-add-swimlane" class="btn-secondary" style="width:100%; margin-top:4px;">+ Add Swimlane</button>
            <div class="form-actions">
              <button id="sidebar-save-swimlanes" class="btn-primary">Save Changes</button>
            </div>
          </div>
          <div id="manage-trades-view" class="rp-view">
            <p style="font-size:13px; color:#6b7280; margin:0 0 16px; line-height:1.5;">Toggle visibility and customize colors. Trades are assigned to tasks for color-coding and filtering.</p>
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
                ${this.renderTradeList()}
              </div>
            </div>
            <div class="form-actions">
              <button id="save-trades-button" class="btn-primary">Save Changes</button>
            </div>
          </div>
          <div id="settings-view" class="rp-view">
            <div style="background:#fafafa; border:1px solid #f0f0f0; border-radius:10px; padding:16px; margin-bottom:20px;">
              <h4 style="margin:0 0 6px; font-size:14px; font-weight:600; color:#1a1a1a;">About</h4>
              <p style="font-size:13px; color:#6b7280; margin:0 0 4px; line-height:1.5;">DingPlan — Free construction scheduling for subcontractors.</p>
              <p style="font-size:12px; color:#9ca3af; margin:0;">Open source · No account required · All data stored locally</p>
            </div>
            <div style="background:#fafafa; border:1px solid #f0f0f0; border-radius:10px; padding:16px; margin-bottom:20px;">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                <span style="font-size:16px;">🔒</span>
                <h4 style="margin:0; font-size:14px; font-weight:600; color:#1a1a1a;">AI Composer Key</h4>
              </div>
              <p style="font-size:13px; color:#6b7280; margin:0 0 12px; line-height:1.5;">Enter your OpenAI API key to use the AI Composer. Stored locally in your browser.</p>
              <div style="display:flex; gap:8px;">
                <input type="password" id="settings-api-key" placeholder="sk-..." 
                  style="flex:1; padding:10px 12px; border:1px solid #e8e8e8; border-radius:8px; font-size:14px; font-family:inherit; background:#fff; height:40px; box-sizing:border-box; transition: border-color 0.15s, box-shadow 0.15s;"
                  onfocus="this.style.borderColor='#1a1a1a'; this.style.boxShadow='0 0 0 3px rgba(26,26,26,0.08)'"
                  onblur="this.style.borderColor='#e8e8e8'; this.style.boxShadow='none'">
                <button id="save-api-key" class="btn-primary" style="padding:10px 16px; font-size:14px; white-space:nowrap;">Save</button>
              </div>
            </div>
            <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:10px; padding:16px;">
              <h4 style="margin:0 0 8px; font-size:14px; font-weight:600; color:#dc2626;">Danger Zone</h4>
              <p style="font-size:13px; color:#6b7280; margin:0 0 12px; line-height:1.5;">
                Clears all projects, tasks, and settings from your browser. This cannot be undone.
              </p>
              <button id="clear-local-storage" class="btn-danger" style="font-size:14px;">Reset All Data</button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.composerResponseArea = this.element.querySelector('.composer-response-area');
  }

  private renderTradeList(): string {
    return this.trades.map(trade => `
      <div class="trade-filter-item" data-color="${trade.color}" data-id="${trade.id}">
        <div class="trade-filter-color" style="background-color: ${trade.color}"></div>
        <input type="text" class="trade-filter-name" value="${trade.name}" data-original="${trade.name}">
        <div class="trade-filter-toggle active" data-id="${trade.id}"></div>
        <button class="trade-filter-delete" data-id="${trade.id}">×</button>
      </div>
    `).join('');
  }

  private setupEventListeners() {
    // LEFT panel nav buttons
    this.leftPanel.querySelectorAll('.left-nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        if (!action) return;
        this.handleNavAction(action);
      });
    });

    // Project name auto-save
    // Project name auto-save
    const nameInput = this.leftPanel.querySelector('#left-project-name') as HTMLInputElement;
    if (nameInput) {
      nameInput.addEventListener('change', () => {
        localStorage.setItem('dingplan-project-name', nameInput.value);
      });
      const saved = localStorage.getItem('dingplan-project-name');
      if (saved) nameInput.value = saved;
    }

    // Project management buttons
    this.leftPanel.querySelectorAll('.left-nav-btn-sm').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        if (action === 'new-project') this.handleNewProject();
        if (action === 'open-project') this.toggleProjectsList();
        if (action === 'delete-project') this.handleDeleteProject();
      });
    });

    // RIGHT panel close
    const closeBtn = this.element.querySelector('.rp-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.hide());

    // Composer button
    const aiButton = this.element.querySelector('.ai-composer-button');
    if (aiButton) {
      aiButton.addEventListener('click', () => {
        const input = this.element.querySelector('.ai-composer-input') as HTMLTextAreaElement;
        if (input.value.trim()) this.handleAIComposerSubmit(input.value);
      });
    }

    // Trade toggles, color pickers, delete, select/clear all, add new
    this.setupTradeListEventListeners();

    const selectAll = this.element.querySelector('#select-all-trades');
    if (selectAll) selectAll.addEventListener('click', () => {
      this.element.querySelectorAll('.trade-filter-toggle').forEach(t => {
        t.classList.add('active');
        t.closest('.trade-filter-item')?.classList.remove('disabled');
        const id = (t as HTMLElement).dataset.id;
        if (id) this.tradeFilters.set(id, true);
      });
      this.notifyFilterChanged();
    });

    const clearAll = this.element.querySelector('#clear-all-trades');
    if (clearAll) clearAll.addEventListener('click', () => {
      this.element.querySelectorAll('.trade-filter-toggle').forEach(t => {
        t.classList.remove('active');
        t.closest('.trade-filter-item')?.classList.add('disabled');
        const id = (t as HTMLElement).dataset.id;
        if (id) this.tradeFilters.set(id, false);
      });
      this.notifyFilterChanged();
    });

    const addTrade = this.element.querySelector('#add-new-trade');
    if (addTrade) addTrade.addEventListener('click', () => this.addNewTrade());

    const saveTrades = this.element.querySelector('#save-trades-button');
    if (saveTrades) saveTrades.addEventListener('click', () => {
      this.notifyFilterChanged();
      this.hide();
    });

    // Settings: API key save
    const apiKeyInput = this.element.querySelector('#settings-api-key') as HTMLInputElement;
    const saveApiKeyBtn = this.element.querySelector('#save-api-key');
    if (apiKeyInput) {
      const stored = localStorage.getItem('dingPlanApiKey');
      if (stored) apiKeyInput.value = stored;
    }
    if (saveApiKeyBtn) saveApiKeyBtn.addEventListener('click', () => {
      const key = apiKeyInput?.value?.trim();
      if (key) {
        localStorage.setItem('dingPlanApiKey', key);
        if (this.composer) this.composer.setApiKey(key);
        alert('API key saved!');
      }
    });

    // Settings: reset
    const clearBtn = this.element.querySelector('#clear-local-storage');
    if (clearBtn) clearBtn.addEventListener('click', () => {
      if (confirm('Delete ALL projects, tasks, and settings? This cannot be undone.')) {
        clearLocalStorage();
        window.location.reload();
      }
    });
  }

  private handleNavAction(action: string) {
    // Update active state on left nav
    this.leftPanel.querySelectorAll('.left-nav-btn').forEach(b => b.classList.remove('active'));
    const activeBtn = this.leftPanel.querySelector(`[data-action="${action}"]`);

    // Ensure left panel is open when user interacts with it
    if (!this.leftPanelVisible) {
      this.showLeftPanel();
      if ((window as any).__setLeftPanelOpen) (window as any).__setLeftPanelOpen(true);
    }

    // Actions that don't need a right panel
    if (action === 'go-to-today') {
      if (window.canvasApp) {
        const x = window.canvasApp.timeAxis.getTodayPosition();
        window.canvasApp.camera.x = x;
        window.canvasApp.render();
      }
      return;
    }
    if (action === 'toggle-deps') {
      if (window.canvasApp) {
        window.canvasApp.taskManager.areDependenciesVisible = !window.canvasApp.taskManager.areDependenciesVisible;
        window.canvasApp.render();
      }
      return;
    }
    if (action === 'export-pdf') {
      if (window.canvasApp) window.canvasApp.exportToPDF();
      return;
    }
    if (action === 'export-json') {
      this.handleExportJSON();
      return;
    }
    if (action === 'import-json') {
      this.handleImportJSON();
      return;
    }
    if (action === 'share-link') {
      this.handleCopyShareLink();
      return;
    }
    if (action === 'import-xer') {
      this.handleImportXER();
      return;
    }

    // Actions that open the right panel
    activeBtn?.classList.add('active');
    const viewMap: Record<string, SidebarView> = {
      'add-task': 'add-task',
      'edit-swimlanes': 'edit-swimlanes',
      'manage-trades': 'manage-trades',
      'composer': 'composer',
      'settings': 'options',
    };
    const view = viewMap[action];
    if (view) this.show(view, window.canvasApp);
  }

  private handleNewProject() {
    this.showTemplatePickerModal();
  }

  private showTemplatePickerModal() {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0, 0, 0, 0.8); display: flex;
      align-items: center; justify-content: center; z-index: 10000;
    `;

    // Create modal content
    const content = document.createElement('div');
    content.style.cssText = `
      background: #1a1a1a; border-radius: 12px; padding: 32px;
      width: 90%; max-width: 600px; max-height: 80vh; overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    `;

    content.innerHTML = `
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: white; margin: 0 0 8px 0; font-size: 24px; font-weight: 600;">Choose a Template</h2>
        <p style="color: #888; margin: 0; font-size: 14px;">Start with a template or create a blank project</p>
      </div>
      
      <div id="template-grid" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;">
        <!-- Blank project card -->
        <div class="template-card blank-project" data-template="blank" style="
          background: #2a2a2a; border: 2px solid #333; border-radius: 10px;
          padding: 20px; cursor: pointer; transition: all 0.2s;
        ">
          <h3 style="color: white; margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">📋 Blank Project</h3>
          <p style="color: #888; margin: 0; font-size: 13px; line-height: 1.4;">Start with an empty canvas and build your schedule from scratch</p>
        </div>
        
        ${WBS_TEMPLATES.map(template => `
          <div class="template-card" data-template="${template.id}" style="
            background: #1a1a1a; border: 2px solid transparent; border-radius: 10px;
            padding: 20px; cursor: pointer; transition: all 0.2s;
          ">
            <h3 style="color: white; margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">${template.name}</h3>
            <p style="color: #888; margin: 0 0 12px 0; font-size: 13px; line-height: 1.4;">${template.description}</p>
            <div style="color: #666; font-size: 12px;">${template.categories.length} swimlanes</div>
          </div>
        `).join('')}
      </div>
      
      <div style="text-align: center;">
        <button id="template-cancel" style="
          background: #333; border: none; color: white; padding: 10px 20px;
          border-radius: 8px; font-size: 14px; cursor: pointer; font-family: inherit;
        ">Cancel</button>
      </div>
    `;

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Add hover effects
    const style = document.createElement('style');
    style.textContent = `
      .template-card:hover {
        border-color: #0066cc !important;
        transform: translateY(-2px);
        box-shadow: 0 4px 20px rgba(0, 102, 204, 0.2);
      }
      .template-card.blank-project:hover {
        border-color: #22c55e !important;
        box-shadow: 0 4px 20px rgba(34, 197, 94, 0.2);
      }
    `;
    document.head.appendChild(style);

    // Event listeners
    content.querySelectorAll('.template-card').forEach(card => {
      card.addEventListener('click', () => {
        const templateId = (card as HTMLElement).dataset.template;
        if (templateId) {
          this.createProjectFromTemplate(templateId);
          document.body.removeChild(modal);
          document.head.removeChild(style);
        }
      });
    });

    const cancelBtn = content.querySelector('#template-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        document.body.removeChild(modal);
        document.head.removeChild(style);
      });
    }

    // Close on outside click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
        document.head.removeChild(style);
      }
    });
  }

  private createProjectFromTemplate(templateId: string) {
    const name = prompt('Project name:');
    if (!name) return;

    // Save current project first
    if (window.canvasApp) window.canvasApp.saveToLocalStorage();

    // Clear canvas
    if (window.canvasApp && window.canvasApp.taskManager) {
      const tasks = window.canvasApp.taskManager.getAllTasks();
      tasks.forEach((t: any) => window.canvasApp.taskManager.removeTask(t.id));
      window.canvasApp.render();
    }

    // Update project name
    const nameInput = this.leftPanel.querySelector('#left-project-name') as HTMLInputElement;
    if (nameInput) nameInput.value = name;
    localStorage.setItem('dingplan-project-name', name);
    localStorage.removeItem('dingplan_current_project_id');

    // Create swimlanes from template
    if (templateId !== 'blank' && window.canvasApp && window.canvasApp.taskManager) {
      const template = WBS_TEMPLATES.find(t => t.id === templateId);
      if (template) {
        const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
        const swimlanes = template.categories.map((category, index) => ({
          id: generateUUID(),
          name: category,
          color: colors[index % colors.length]
        }));
        window.canvasApp.taskManager.swimlanes = swimlanes;
        window.canvasApp.render();
      }
    }
  }

  private handleDeleteProject() {
    const currentId = localStorage.getItem('dingplan_current_project_id');
    if (!currentId) {
      if (confirm('Clear all current tasks? This cannot be undone.')) {
        if (window.canvasApp && window.canvasApp.taskManager) {
          const tasks = window.canvasApp.taskManager.getAllTasks();
          tasks.forEach((t: any) => window.canvasApp.taskManager.removeTask(t.id));
          window.canvasApp.render();
        }
      }
      return;
    }
    if (confirm('Delete this project? This cannot be undone.')) {
      deleteProject(currentId);
      localStorage.removeItem('dingplan_current_project_id');
      window.location.reload();
    }
  }

  private toggleProjectsList() {
    const section = this.leftPanel.querySelector('#projects-list-section') as HTMLElement;
    if (!section) return;
    const isVisible = section.style.display !== 'none';
    if (isVisible) {
      section.style.display = 'none';
      return;
    }
    // Populate list
    const projects = listProjects();
    const listEl = this.leftPanel.querySelector('#projects-list') as HTMLElement;
    const currentId = localStorage.getItem('dingplan_current_project_id');
    if (projects.length === 0) {
      listEl.innerHTML = '<div style="font-size: 13px; color: #9ca3af; padding: 8px 0;">No saved projects yet. Your current work is auto-saved to the browser.</div>';
    } else {
      listEl.innerHTML = projects.map(p => `
        <div class="project-item ${p.id === currentId ? 'active' : ''}" data-project-id="${p.id}">
          <span>${p.name}</span>
          <span class="project-item-date">${new Date(p.updatedAt).toLocaleDateString()}</span>
        </div>
      `).join('');
      // Click to load project
      listEl.querySelectorAll('.project-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = (item as HTMLElement).dataset.projectId;
          if (!id) return;
          if (window.canvasApp) window.canvasApp.saveToLocalStorage();
          const project = loadProject(id);
          if (project && window.canvasApp && window.canvasApp.taskManager) {
            const tasks = window.canvasApp.taskManager.getAllTasks();
            tasks.forEach((t: any) => window.canvasApp.taskManager.removeTask(t.id));
            if (project.tasks) {
              project.tasks.forEach((taskData: any) => {
                try { window.canvasApp.taskManager.addTask(taskData); } catch(e) { console.error(e); }
              });
            }
            window.canvasApp.render();
            localStorage.setItem('dingplan_current_project_id', id);
            localStorage.setItem('dingplan-project-name', project.name);
            const nameInput = this.leftPanel.querySelector('#left-project-name') as HTMLInputElement;
            if (nameInput) nameInput.value = project.name;
            section.style.display = 'none';
          }
        });
      });
    }
    section.style.display = 'block';
  }

  private async handleImportXER() {
    try {
      const result = await XerImporter.showImportDialog();
      if (this.canvas && this.canvas.taskManager) {
        const existingTasks = this.canvas.taskManager.getAllTasks();
        existingTasks.forEach((task: any) => this.canvas.taskManager.removeTask(task.id));
        result.tasks.forEach((taskConfig: any) => this.canvas.taskManager.addTask(taskConfig));
        if (this.canvas.render) this.canvas.render();
        alert(`Successfully imported ${result.tasks.length} tasks from XER file`);
      }
    } catch (error) {
      console.error('XER import failed:', error);
      alert(`XER import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private switchView(view: SidebarView) {
    this.currentView = view;
    // Map view to element id
    const viewIdMap: Record<string, string> = {
      'details': 'details-view',
      'composer': 'composer-view',
      'add-task': 'add-task-view',
      'edit-swimlanes': 'edit-swimlanes-view',
      'manage-trades': 'manage-trades-view',
      'options': 'settings-view',
    };

    this.element.querySelectorAll('.rp-view').forEach(v => v.classList.remove('active'));
    const targetId = viewIdMap[view];
    if (targetId) {
      const el = this.element.querySelector(`#${targetId}`);
      if (el) el.classList.add('active');
    }

    // Update header title
    const titleEl = this.element.querySelector('.rp-title');
    if (titleEl) {
      const titles: Record<string, string> = {
        'details': 'Details',
        'composer': 'AI Composer',
        'add-task': 'Add Task',
        'edit-swimlanes': 'Swimlanes',
        'manage-trades': 'Trades',
        'options': 'Settings',
      };
      titleEl.textContent = titles[view] || 'Details';
    }
  }

  private async handleAIComposerSubmit(prompt: string) {
    this.addComposerMessage(prompt, true);
    const input = this.element.querySelector('.ai-composer-input') as HTMLTextAreaElement;
    const button = this.element.querySelector('.ai-composer-button') as HTMLButtonElement;
    
    if (!this.composer) {
      this.addComposerMessage('Composer not initialized. Please refresh the page.');
      return;
    }
    
    const userKey = localStorage.getItem('dingPlanApiKey');
    const builtInKey = (import.meta.env.VITE_OPENAI_KEY as string) || '';
    const isLoggedIn = !!authService.getCurrentUser();
    const apiKey = userKey || (isLoggedIn ? builtInKey : '');
    if (!apiKey) {
      this.addComposerMessage(isLoggedIn ? 'AI Composer error — please try again.' : 'Sign in or add your OpenAI API key in Settings to use AI Composer.');
      return;
    }
    if (this.composer) this.composer.setApiKey(apiKey);
    
    try {
      input.disabled = true;
      button.disabled = true;
      button.textContent = 'Processing...';
      const response = await this.composer.processPrompt(prompt);
      this.addComposerMessage(response);
    } catch (error: unknown) {
      this.addComposerMessage(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
    } finally {
      input.disabled = false;
      button.disabled = false;
      button.textContent = 'Send Request';
      input.value = '';
      input.focus();
    }
  }

  show(view: SidebarView = 'details', canvasInstance?: any) {
    this.isVisible = true;
    this.element.style.display = 'flex';
    // Force reflow before transition
    this.element.offsetHeight;
    this.element.style.transform = 'translateX(0)';
    this.switchView(view);
    
    if (view === 'add-task' && canvasInstance) {
      this.populateAddTaskForm(canvasInstance);
    } else if (view === 'edit-swimlanes' && canvasInstance) {
      this.populateSwimlanesForm(canvasInstance);
    }
  }

  hide() {
    this.isVisible = false;
    this.element.style.transform = `translateX(${RIGHT_PANEL_WIDTH}px)`;
    // Clear active nav
    this.leftPanel.querySelectorAll('.left-nav-btn').forEach(b => b.classList.remove('active'));
    setTimeout(() => {
      if (!this.isVisible) this.element.style.display = 'none';
    }, 300);
  }

  showLeftPanel() {
    this.leftPanelVisible = true;
    this.leftPanel.style.transform = 'translateX(0)';
  }

  hideLeftPanel() {
    this.leftPanelVisible = false;
    this.leftPanel.style.transform = `translateX(-${LEFT_PANEL_WIDTH}px)`;
  }

  isLeftPanelOpen(): boolean { return this.leftPanelVisible; }

  private updateStatusBanner() {
    const banner = this.leftPanel.querySelector('#sidebar-status-banner');
    if (!banner) return;

    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      banner.innerHTML = '<span>☁️</span> <span>Synced to cloud</span>';
      banner.style.background = '#f0fdf4';
      banner.style.color = '#166534';
    } else {
      banner.innerHTML = `
        <span>💾</span> 
        <span>Saves to your browser — <span id="sidebar-sign-in-link" style="color: #3b82f6; cursor: pointer; text-decoration: underline;">sign in to sync</span></span>
      `;
      banner.style.background = '#fef3c7';
      banner.style.color = '#92400e';
      
      // Wire up the sign in link
      const signInLink = banner.querySelector('#sidebar-sign-in-link');
      if (signInLink) {
        signInLink.addEventListener('click', () => {
          const authUI = (window as any).authUI;
          if (authUI) authUI.show();
        });
      }
    }
  }

  getWidth(): number { return RIGHT_PANEL_WIDTH; }
  isOpen(): boolean { return this.isVisible; }
  getCurrentView(): SidebarView { return this.currentView; }

  onTradeFiltersChanged(callback: (filters: Map<string, boolean>) => void) {
    this.onTradeFilterChange = callback;
  }
  
  getTradeFilters(): Map<string, boolean> { return new Map(this.tradeFilters); }

  private notifyFilterChanged() {
    if (this.onTradeFilterChange) {
      this.onTradeFilterChange(new Map(this.tradeFilters));
    }
  }

  initializeComposer(canvasInstance: any) {
    this.canvas = canvasInstance;
    this.composer = new Composer({ canvas: canvasInstance });
    const userKey = localStorage.getItem('dingPlanApiKey');
    const builtInKey = (import.meta.env.VITE_OPENAI_KEY as string) || '';
    const isLoggedIn = !!authService.getCurrentUser();
    const apiKey = userKey || (isLoggedIn ? builtInKey : '');
    if (apiKey && this.composer) {
      this.composer.setApiKey(apiKey);
      this.addComposerMessage('AI Composer ready. Describe your project to generate a schedule.');
    } else {
      this.addComposerMessage(isLoggedIn ? 'AI Composer initializing...' : 'Sign in or add your OpenAI API key in Settings to use AI Composer.');
    }
  }
  
  private addComposerMessage(message: string, isUserInput = false) {
    if (!this.composerResponseArea) return;
    const el = document.createElement('div');
    el.className = `composer-message ${isUserInput ? 'user-message' : ''}`;
    el.textContent = isUserInput ? `You: ${message}` : message;
    this.composerResponseArea.appendChild(el);
    this.composerResponseArea.scrollTop = this.composerResponseArea.scrollHeight;
  }

  // ---- Trade management ----

  private showColorPicker(colorElement: HTMLElement) {
    const colorPicker = document.createElement('div');
    colorPicker.className = 'color-picker-dialog';
    colorPicker.style.left = `${colorElement.getBoundingClientRect().left}px`;
    colorPicker.style.top = `${colorElement.getBoundingClientRect().bottom + window.scrollY + 5}px`;
    
    const colors = [
      '#F44336', '#E91E63', '#9C27B0', '#673AB7', '#3F51B5', '#2196F3', 
      '#03A9F4', '#00BCD4', '#009688', '#4CAF50', '#8BC34A', '#CDDC39',
      '#FFEB3B', '#FFC107', '#FF9800', '#FF5722', '#795548', '#9E9E9E'
    ];
    
    colors.forEach(hex => {
      const swatch = document.createElement('div');
      swatch.className = 'color-swatch';
      swatch.style.backgroundColor = hex;
      swatch.addEventListener('click', () => {
        colorElement.style.backgroundColor = hex;
        const tradeItem = colorElement.closest('.trade-filter-item');
        const tradeId = tradeItem?.getAttribute('data-id');
        if (tradeId) {
          const trade = this.trades.find(t => t.id === tradeId);
          if (trade) trade.color = hex;
          this.notifyFilterChanged();
        }
        colorPicker.remove();
      });
      colorPicker.appendChild(swatch);
    });
    
    document.body.appendChild(colorPicker);
    setTimeout(() => {
      const handler = (e: MouseEvent) => {
        if (!colorPicker.contains(e.target as Node) && e.target !== colorElement) {
          colorPicker.remove();
          document.removeEventListener('click', handler);
        }
      };
      document.addEventListener('click', handler);
    }, 10);
  }

  private deleteTrade(tradeId: string | undefined) {
    if (!tradeId) return;
    if (!confirm('Remove this trade?')) return;
    const idx = this.trades.findIndex(t => t.id === tradeId);
    if (idx === -1) return;
    this.trades.splice(idx, 1);
    this.tradeFilters.delete(tradeId);
    this.notifyFilterChanged();
    this.updateTradeList();
  }

  private addNewTrade() {
    const color = this.getRandomColor();
    const name = "New Trade";
    const id = this.generateTradeId(name, color);
    this.trades.push({ id, name, color });
    this.tradeFilters.set(id, true);
    this.updateTradeList();
    this.notifyFilterChanged();
  }

  private getRandomColor(): string {
    const letters = '0123456789ABCDEF';
    const existing = new Set(this.trades.map(t => t.color.toUpperCase()));
    let color: string;
    do {
      color = '#';
      for (let i = 0; i < 6; i++) color += letters[Math.floor(Math.random() * 16)];
    } while (existing.has(color));
    return color;
  }

  private updateTradeList() {
    const list = this.element.querySelector('.trade-filter-list');
    if (!list) return;
    list.innerHTML = this.trades.map(trade => `
      <div class="trade-filter-item" data-color="${trade.color}" data-id="${trade.id}">
        <div class="trade-filter-color" style="background-color: ${trade.color}"></div>
        <input type="text" class="trade-filter-name" value="${trade.name}" data-original="${trade.name}">
        <div class="trade-filter-toggle ${this.tradeFilters.get(trade.id) ? 'active' : ''}" data-id="${trade.id}"></div>
        <button class="trade-filter-delete" data-id="${trade.id}">×</button>
      </div>
    `).join('');
    this.setupTradeListEventListeners();
  }

  private setupTradeListEventListeners() {
    this.element.querySelectorAll('.trade-filter-color').forEach(sq => {
      sq.addEventListener('click', (e) => { e.stopPropagation(); this.showColorPicker(e.currentTarget as HTMLElement); });
    });
    this.element.querySelectorAll('.trade-filter-toggle').forEach(toggle => {
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const el = e.currentTarget as HTMLElement;
        const id = el.dataset.id;
        const wasActive = el.classList.contains('active');
        el.classList.toggle('active');
        el.closest('.trade-filter-item')?.classList.toggle('disabled', wasActive);
        if (id) { this.tradeFilters.set(id, !wasActive); this.notifyFilterChanged(); }
      });
    });
    this.element.querySelectorAll('.trade-filter-name').forEach(input => {
      input.addEventListener('change', (e) => {
        const el = e.currentTarget as HTMLInputElement;
        const id = el.closest('.trade-filter-item')?.getAttribute('data-id');
        if (id) { const t = this.trades.find(t => t.id === id); if (t) t.name = el.value; }
      });
    });
    this.element.querySelectorAll('.trade-filter-delete').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.deleteTrade((e.currentTarget as HTMLElement).dataset.id); });
    });
  }

  private generateTradeId(name: string, color: string): string {
    const nameId = name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const colorId = color.replace('#', '').substring(0, 6);
    return `${nameId}-${colorId}`;
  }

  // ---- Add Task ----

  populateAddTaskForm(canvasInstance: any) {
    const tradeSelect = document.getElementById('sidebar-task-trade') as HTMLSelectElement;
    const zoneSelect = document.getElementById('sidebar-task-zone') as HTMLSelectElement;
    const startDateInput = document.getElementById('sidebar-task-start-date') as HTMLInputElement;

    tradeSelect.innerHTML = '<option value="" disabled selected>Select a trade</option>';
    zoneSelect.innerHTML = '<option value="" disabled selected>Select a swimlane</option>';

    this.trades.forEach(trade => {
      const opt = document.createElement('option');
      opt.value = trade.id;
      opt.textContent = trade.name;
      opt.dataset.color = trade.color;
      tradeSelect.appendChild(opt);
    });

    if (canvasInstance && canvasInstance.taskManager) {
      canvasInstance.taskManager.swimlanes.forEach((sl: any) => {
        const opt = document.createElement('option');
        opt.value = sl.id;
        opt.textContent = sl.name;
        zoneSelect.appendChild(opt);
      });
    }

    startDateInput.value = new Date().toISOString().split('T')[0];

    const form = document.getElementById('sidebar-add-task-form') as HTMLFormElement;
    const addAnother = document.getElementById('sidebar-add-another') as HTMLButtonElement;
    form.onsubmit = (e) => { e.preventDefault(); this.handleAddTaskSubmit(canvasInstance, false); };
    addAnother.onclick = () => this.handleAddTaskSubmit(canvasInstance, true);
  }

  handleAddTaskSubmit(canvasInstance: any, createAnother: boolean) {
    const form = document.getElementById('sidebar-add-task-form') as HTMLFormElement;
    const nameInput = document.getElementById('sidebar-task-name') as HTMLInputElement;
    const tradeSelect = document.getElementById('sidebar-task-trade') as HTMLSelectElement;
    const zoneSelect = document.getElementById('sidebar-task-zone') as HTMLSelectElement;
    const startDateInput = document.getElementById('sidebar-task-start-date') as HTMLInputElement;
    const durationInput = document.getElementById('sidebar-task-duration') as HTMLInputElement;
    const crewSizeInput = document.getElementById('sidebar-task-crew-size') as HTMLInputElement;
    const workSat = document.getElementById('sidebar-work-saturday') as HTMLInputElement;
    const workSun = document.getElementById('sidebar-work-sunday') as HTMLInputElement;

    if (!form.checkValidity()) { form.reportValidity(); return; }

    const selectedOpt = tradeSelect.options[tradeSelect.selectedIndex];
    const tradeColor = selectedOpt?.dataset.color || '#cccccc';

    const taskConfig = {
      id: this.generateUUID(),
      name: nameInput.value,
      tradeId: tradeSelect.value,
      color: tradeColor,
      swimlaneId: zoneSelect.value,
      startDate: new Date(startDateInput.value),
      duration: parseInt(durationInput.value),
      crewSize: parseInt(crewSizeInput.value),
      workOnSaturday: workSat.checked,
      workOnSunday: workSun.checked
    };

    if (canvasInstance && canvasInstance.addTask) canvasInstance.addTask(taskConfig);
    if (createAnother) { nameInput.value = ''; nameInput.focus(); }
    else this.hide();
  }

  // ---- Swimlanes ----

  populateSwimlanesForm(canvasInstance: any) {
    const container = document.getElementById('sidebar-swimlane-list');
    if (!container) return;
    container.innerHTML = '';

    if (canvasInstance && canvasInstance.taskManager) {
      canvasInstance.taskManager.swimlanes.forEach((sl: any, i: number) => {
        const item = document.createElement('div');
        item.className = 'swimlane-item';
        item.style.borderLeftColor = sl.color;
        item.innerHTML = `
          <div class="swimlane-color" style="background-color: ${sl.color}"></div>
          <input type="text" class="swimlane-name-input" value="${sl.name}" data-lane-id="${sl.id}">
          <div class="swimlane-actions">
            ${i > 0 ? `<button class="move-up-btn" data-lane-id="${sl.id}" title="Move up">↑</button>` : '<div style="width:28px"></div>'}
            ${i < canvasInstance.taskManager.swimlanes.length - 1 ? `<button class="move-down-btn" data-lane-id="${sl.id}" title="Move down">↓</button>` : '<div style="width:28px"></div>'}
            <button class="delete-lane-btn" data-lane-id="${sl.id}" title="Delete">×</button>
          </div>
        `;
        container.appendChild(item);
      });
    }
    this.setupSwimlanesEventListeners(canvasInstance);
  }

  setupSwimlanesEventListeners(canvasInstance: any) {
    const container = document.getElementById('sidebar-swimlane-list');
    const addBtn = document.getElementById('sidebar-add-swimlane');
    const saveBtn = document.getElementById('sidebar-save-swimlanes');
    if (!container || !addBtn || !saveBtn) return;

    addBtn.onclick = () => {
      const item = document.createElement('div');
      item.className = 'swimlane-item';
      const id = this.generateUUID();
      const color = this.getRandomHexColor();
      item.style.borderLeftColor = color;
      item.innerHTML = `
        <div class="swimlane-color" style="background-color: ${color}"></div>
        <input type="text" class="swimlane-name-input" value="New Swimlane" data-lane-id="${id}">
        <div class="swimlane-actions">
          <button class="move-up-btn" data-lane-id="${id}" title="Move up">↑</button>
          <button class="move-down-btn" data-lane-id="${id}" title="Move down">↓</button>
          <button class="delete-lane-btn" data-lane-id="${id}" title="Delete">×</button>
        </div>
      `;
      container.appendChild(item);
      item.querySelector('input')?.focus();
      this.bindSwimlaneMoveButtons(canvasInstance);
    };

    saveBtn.onclick = () => this.saveSwimlanesChanges(canvasInstance);
    this.bindSwimlaneMoveButtons(canvasInstance);
  }

  bindSwimlaneMoveButtons(_canvasInstance: any) {
    document.querySelectorAll('.delete-lane-btn').forEach(btn => {
      (btn as HTMLElement).addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest('.swimlane-item');
        item?.parentNode?.removeChild(item);
      });
    });
    document.querySelectorAll('.move-up-btn').forEach(btn => {
      (btn as HTMLElement).addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest('.swimlane-item');
        if (item?.previousElementSibling) item.parentNode?.insertBefore(item, item.previousElementSibling);
      });
    });
    document.querySelectorAll('.move-down-btn').forEach(btn => {
      (btn as HTMLElement).addEventListener('click', (e) => {
        const item = (e.target as HTMLElement).closest('.swimlane-item');
        if (item?.nextElementSibling) item.parentNode?.insertBefore(item.nextElementSibling, item);
      });
    });
  }

  saveSwimlanesChanges(canvasInstance: any) {
    const inputs = document.querySelectorAll('.swimlane-name-input');
    if (!canvasInstance?.taskManager) return;

    const existingMap = new Map<string, any>();
    canvasInstance.taskManager.swimlanes.forEach((s: any) => existingMap.set(s.id, s));

    const updated: any[] = [];
    const laneSpacing = 20;

    inputs.forEach(input => {
      const el = input as HTMLInputElement;
      const id = el.dataset.laneId || '';
      const name = el.value;
      const existing = existingMap.get(id);

      if (existing) {
        updated.push({ ...existing, name, y: 0 });
      } else {
        const colorDiv = el.closest('.swimlane-item')?.querySelector('.swimlane-color') as HTMLElement;
        let color = colorDiv?.style.backgroundColor || '#cccccc';
        if (color.startsWith('rgb')) {
          const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
          if (m) color = `#${parseInt(m[1]).toString(16).padStart(2,'0')}${parseInt(m[2]).toString(16).padStart(2,'0')}${parseInt(m[3]).toString(16).padStart(2,'0')}`;
        }
        updated.push({ id, name, color, y: 0, height: canvasInstance.taskManager.SWIMLANE_HEIGHT, tasks: [], taskPositions: new Map() });
      }
    });

    updated.forEach((s, i) => { s.y = i * (canvasInstance.taskManager.SWIMLANE_HEIGHT + laneSpacing); });

    canvasInstance.taskManager.swimlanes.length = 0;
    updated.forEach(s => canvasInstance.taskManager.swimlanes.push(s));
    canvasInstance.render();
    this.hide();
  }

  // ---- JSON / Share ----

  private async handleExportJSON() {
    try {
      const data = this.getCurrentProjectData();
      if (!data) { alert('No project data to export.'); return; }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.name || 'dingplan-project'}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private async handleImportJSON() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const project = JSON.parse(text);
        if (this.canvas) {
          this.loadProjectIntoCanvas(project);
          alert(`Project "${project.name}" imported successfully!`);
        }
      } catch (error) {
        alert('Import failed: ' + (error instanceof Error ? error.message : 'Invalid JSON file'));
      }
    };
    input.click();
  }

  private async handleCopyShareLink() {
    try {
      const data = this.getCurrentProjectData();
      if (!data) { alert('No project data to share.'); return; }
      const base64 = btoa(encodeURIComponent(JSON.stringify(data)));
      const url = `${window.location.origin}${window.location.pathname}#share=${base64}`;
      await navigator.clipboard.writeText(url);
      alert('Share link copied to clipboard!');
    } catch (error) {
      alert('Failed to create share link: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  private getCurrentProjectData() {
    if (!this.canvas?.taskManager) return null;
    const nameInput = this.leftPanel.querySelector('#left-project-name') as HTMLInputElement;
    return {
      id: crypto.randomUUID(),
      name: nameInput?.value || `DingPlan Project ${new Date().toLocaleDateString()}`,
      tasks: this.canvas.taskManager.getAllTasks(),
      swimlanes: this.canvas.taskManager.swimlanes || [],
      settings: { areDependenciesVisible: true }
    };
  }

  private loadProjectIntoCanvas(project: any) {
    if (!this.canvas?.taskManager) return;
    try {
      const existing = this.canvas.taskManager.getAllTasks();
      existing.forEach((t: any) => this.canvas.taskManager.removeTask(t.id));
      if (project.swimlanes && Array.isArray(project.swimlanes)) {
        this.canvas.taskManager.swimlanes = project.swimlanes;
      }
      if (project.tasks && Array.isArray(project.tasks)) {
        project.tasks.forEach((td: any) => {
          try {
            this.canvas.taskManager.addTask({
              id: td.id || crypto.randomUUID(),
              name: td.name || 'Untitled Task',
              startDate: new Date(td.startDate),
              duration: td.duration || 1,
              crewSize: td.crewSize || 1,
              color: td.color || '#3B82F6',
              tradeId: td.tradeId || '',
              dependencies: td.dependencies || []
            });
          } catch (err) { console.error('Error loading task:', err); }
        });
      }
      if (this.canvas.render) this.canvas.render();
    } catch (error) { console.error('Error loading project:', error); }
  }

  // ---- Utilities ----

  private getRandomHexColor(): string {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) color += letters[Math.floor(Math.random() * 16)];
    return color;
  }

  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  }

  getElement(): HTMLElement { return this.element; }

  public addSidebarTab(id: SidebarView, title: string, iconSvg: string): HTMLElement | null {
    let container = this.element.querySelector('.sidebar-tabs');
    if (!container) {
      container = document.createElement('div');
      container.className = 'sidebar-tabs';
      this.element.appendChild(container);
    }
    let tab = this.element.querySelector(`.sidebar-tab[data-tab="${id}"]`) as HTMLElement;
    if (!tab) {
      tab = document.createElement('div');
      tab.className = 'sidebar-tab';
      tab.dataset.tab = id;
      tab.title = title;
      tab.innerHTML = iconSvg;
      container.appendChild(tab);
      tab.addEventListener('click', () => this.show(id));
    }
    return tab;
  }

  hasTabsContainer(): boolean {
    return this.element.querySelector('.sidebar-tabs') !== null;
  }
}

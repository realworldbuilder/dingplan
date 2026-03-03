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
  private floatingBar: HTMLElement;
  private currentView: SidebarView = 'details';
  private task: Task | null = null;
  private tradeFilters: Map<string, boolean> = new Map();
  private trades = Trades.getAllTrades();
  private onTradeFilterChange: ((filters: Map<string, boolean>) => void) | null = null;
  private composer: Composer | null = null;
  private composerResponseArea: HTMLElement | null = null; // Legacy - no longer used
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

    // Create floating action bar (appears when sidebar is hidden)
    this.floatingBar = document.createElement('div');
    this.setupFloatingBar();
    document.body.appendChild(this.floatingBar);

    // Create RIGHT detail panel (slide-out)
    this.element = document.createElement('div');
    this.setupRightPanel();
    this.createRightPanelContent();
    document.body.appendChild(this.element);

    this.setupEventListeners();
    this.updateStatusBanner();
    this.refreshProjectList();
    
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
      width: ${LEFT_PANEL_WIDTH}px; height: 100%; 
      background: #2f2f2f; border-right: 1px solid #444;
      display: flex; flex-direction: column;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      overflow-y: auto; user-select: none;
      transform: translateX(-${LEFT_PANEL_WIDTH}px); transition: transform 0.2s ease;
    `;

    lp.innerHTML = `
      <!-- Logo -->
      <div style="padding: 14px 16px; text-align: center; border-bottom: 1px solid #444;">
        <span style="font-size:18px; font-weight:700; color:#ececec; letter-spacing:0.5px;">DingPlan</span>
      </div>

      <!-- Project Dropdown -->
      <div style="padding: 10px 12px; border-bottom: 1px solid #444;">
        <div style="position: relative;">
          <select id="sidebar-project-select" class="sb-select"></select>
        </div>
        <div style="display: flex; gap: 6px; margin-top: 6px;">
          <button class="sb-btn sb-btn-sm" data-action="new-project" style="flex: 1;">+ New</button>
          <button class="sb-btn sb-btn-sm sb-btn-danger" id="delete-project-btn">Delete</button>
        </div>
      </div>

      <div style="padding: 8px 0; flex: 1; display: flex; flex-direction: column; overflow-y: auto;">
        <!-- Schedule -->
        <div class="sb-section">
          <div class="sb-label">Schedule</div>
          <div class="sb-group">
            <button class="sb-btn" data-action="add-task">➕ Add Task</button>
            <button class="sb-btn" data-action="edit-swimlanes">🏊 Swimlanes</button>
            <button class="sb-btn" data-action="manage-trades">🛠️ Trades</button>
            <button class="sb-btn" data-action="go-to-today">📅 Go to Today</button>
            <button class="sb-btn" data-action="toggle-deps">🔗 Dependencies</button>
          </div>
        </div>

        <!-- AI Composer -->
        <div style="padding: 0 12px 12px;">
          <button class="sb-btn sb-btn-primary" data-action="composer">🤖 AI Composer</button>
        </div>

        <!-- Import / Export -->
        <div class="sb-section">
          <div class="sb-label">Import / Export</div>
          <div class="sb-group">
            <button class="sb-btn" data-action="import-xer">📥 Import XER</button>
            <button class="sb-btn" data-action="export-pdf">📄 Export PDF</button>
            <button class="sb-btn" data-action="export-json">💾 Export JSON</button>
            <button class="sb-btn" data-action="share-link">🔗 Share Link</button>
          </div>
        </div>

        <!-- Footer -->
        <div style="padding: 12px; border-top: 1px solid #444; margin-top: auto;">
          <div id="sidebar-status-banner" style="font-size: 12px; display: flex; align-items: center; gap: 6px; margin-bottom: 6px;"></div>
          <button class="sb-btn" data-action="settings">⚙️ Settings</button>
        </div>
      </div>

      <input id="left-project-name" type="text" value="My Project" style="display: none;">
    `;

    // Add nav button styles
    const style = document.createElement('style');
    style.textContent = `
      /* Clean dark sidebar */
      .sb-section { margin-bottom: 12px; }
      .sb-label {
        padding: 0 16px 6px; font-size: 11px; font-weight: 600;
        color: #999; text-transform: uppercase; letter-spacing: 0.5px;
      }
      .sb-group { padding: 0 12px; display: flex; flex-direction: column; gap: 1px; }
      .sb-btn {
        display: flex; align-items: center; width: 100%; text-align: left;
        padding: 8px 12px; border: none; background: transparent;
        font-size: 13px; color: #ccc; cursor: pointer; border-radius: 6px;
        font-family: inherit; transition: background 0.15s; box-sizing: border-box;
      }
      .sb-btn:hover { background: #3a3a3a; }
      .sb-btn.active { background: #3a3a3a; color: #fff; font-weight: 600; }
      .sb-btn-sm {
        padding: 6px 10px; font-size: 12px; font-weight: 500;
        border: 1px solid #555; border-radius: 6px; background: transparent;
        color: #ccc; text-align: center;
      }
      .sb-btn-sm:hover { background: #3a3a3a; border-color: #666; }
      .sb-btn-primary {
        background: #10a37f; color: #fff; font-weight: 500;
        justify-content: center; gap: 8px; padding: 10px 12px;
        border-radius: 8px; border: none;
      }
      .sb-btn-primary:hover { background: #0d8a6a; }
      .sb-btn-danger { color: #ef4444; border-color: #ef4444; }
      .sb-btn-danger:hover { background: rgba(239,68,68,0.15); }
      .sb-select {
        width: 100%; padding: 8px 10px; border: 1px solid #555;
        border-radius: 6px; background: #3a3a3a; font-size: 13px; color: #ccc;
        font-family: inherit; cursor: pointer; appearance: auto;
      }
      .sb-select:focus { outline: none; border-color: #10a37f; }
      
      .floating-action-bar {
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: #2f2f2f; border: 1px solid #444; border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4); padding: 8px 12px;
        display: flex; gap: 4px; z-index: 500;
      }
      .floating-action-btn {
        width: 44px; height: 44px; border: none; background: transparent;
        border-radius: 8px; font-size: 20px; cursor: pointer;
        display: flex; align-items: center; justify-content: center; color: #ccc;
      }
      .floating-action-btn:hover { background: #3a3a3a; }
    `;
    document.head.appendChild(style);
  }

  private setupFloatingBar() {
    this.floatingBar.className = 'floating-action-bar';
    this.floatingBar.style.display = 'flex'; // Starts visible (sidebar starts hidden)
    
    // Create floating action buttons
    const actions = [
      { emoji: '➕', action: 'add-task', needsPanel: true },
      { emoji: '🏊', action: 'edit-swimlanes', needsPanel: true },
      { emoji: '🛠️', action: 'manage-trades', needsPanel: true },
      { emoji: '📅', action: 'go-to-today', needsPanel: false },
      { emoji: '🔗', action: 'toggle-deps', needsPanel: false },
      { emoji: '🤖', action: 'composer', needsPanel: true },
    ];

    actions.forEach(({ emoji, action, needsPanel }) => {
      const btn = document.createElement('button');
      btn.className = 'floating-action-btn';
      btn.textContent = emoji;
      btn.title = this.getActionTitle(action);
      btn.setAttribute('data-action', action);
      
      btn.addEventListener('click', () => {
        // If action needs the right panel, also open the sidebar
        if (needsPanel) {
          this.showLeftPanel();
          if ((window as any).__setLeftPanelOpen) {
            (window as any).__setLeftPanelOpen(true);
          }
        }
        this.handleNavAction(action);
      });
      
      this.floatingBar.appendChild(btn);
    });
  }

  private getActionTitle(action: string): string {
    const titles: Record<string, string> = {
      'add-task': 'Add Task',
      'edit-swimlanes': 'Swimlanes',
      'manage-trades': 'Trades',
      'go-to-today': 'Go to Today',
      'toggle-deps': 'Dependencies',
      'composer': 'AI Composer',
    };
    return titles[action] || action;
  }

  private setupRightPanel() {
    this.element.style.cssText = `
      position: fixed; top: 0; right: 0; width: ${RIGHT_PANEL_WIDTH}px; height: 100%;
      background: #333; 
      
      box-shadow: 2px 0 10px rgba(0,0,0,0.3);
      display: none; z-index: 1000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      border-left: 1px solid #444; flex-direction: column;
      overflow: hidden; transition: transform 0.3s ease;
      transform: translateX(${RIGHT_PANEL_WIDTH}px);
    `;

    // Add right panel styles
    const style = document.createElement('style');
    style.textContent = `
      /* ===== Clean dark Right Panel Design System ===== */
      .rp-header {
        padding: 18px 20px; display: flex; justify-content: space-between;
        align-items: center; border-bottom: 1px solid #3a3a3a; flex-shrink: 0;
      }
      .rp-title { margin: 0; font-size: 16px; font-weight: 600; color: #ccc; letter-spacing: -0.01em; }
      .rp-close {
        border: none; background: none; font-size: 18px; cursor: pointer;
        padding: 6px 8px; margin: -6px -8px; color: #999; border-radius: 6px;
        transition: background 0.15s; line-height: 1;
      }
      .rp-close:hover { 
        background: #404040; 
        color: #ccc;
        ;
      }
      .rp-body { padding: 20px; overflow-y: auto; flex-grow: 1; display: flex; flex-direction: column; }
      .rp-view { display: none; }
      .rp-view.active { display: flex; flex-direction: column; }

      /* Form groups */
      .form-group { margin-bottom: 20px; }
      .form-group label {
        display: block; margin-bottom: 6px; font-size: 13px; font-weight: 500;
        color: #999; text-transform: uppercase; letter-spacing: 0.5px;
      }
      .form-group input, .form-group select {
        width: 100%; padding: 10px 12px; border: 1px solid #3a3a3a; 
        border-radius: 8px; font-size: 14px; font-family: inherit; 
        background: #333; color: #ccc;
        transition: background 0.15s; box-sizing: border-box; height: 40px;
      }
      .form-group input:focus, .form-group select:focus {
        border-color: #10a37f; 
        background: #3a3a3a;
        ;
        outline: none;
      }

      /* Custom checkboxes */
      .checkbox-group { display: flex; align-items: center; margin-bottom: 10px; }
      .checkbox-group label {
        margin-bottom: 0; margin-left: 10px; cursor: pointer;
        font-size: 14px; color: #ccc; text-transform: none; letter-spacing: 0; font-weight: 400;
      }
      .checkbox-group input[type="checkbox"] {
        width: 18px; height: 18px; margin-right: 0; cursor: pointer;
        accent-color: #10a37f; border-radius: 4px;
      }

      /* Buttons */
      .form-actions { display: flex; gap: 10px; margin-top: 28px; padding-top: 20px; border-top: 1px solid #3a3a3a; }
      .btn-primary {
        padding: 10px 20px; border: none; border-radius: 8px; 
        background: #10a37f;
        color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
        height: 40px; transition: background 0.15s; font-family: inherit;
      }
      .btn-primary:hover { 
        ;
        transform: translateY(-1px);
      }
      .btn-secondary {
        padding: 10px 20px; border: 1px solid #3a3a3a; border-radius: 8px;
        background: #333; color: #ccc; font-size: 14px; font-weight: 500; cursor: pointer;
        height: 40px; transition: background 0.15s; font-family: inherit;
      }
      .btn-secondary:hover { 
        background: #3a3a3a; 
        border-color: rgba(16, 163, 127, 0.3);
        ;
      }
      .btn-danger {
        padding: 10px 20px; border: 1px solid rgba(245, 101, 101, 0.3); border-radius: 8px; 
        background: rgba(245, 101, 101, 0.1);
        color: #f56565; font-size: 14px; font-weight: 500; cursor: pointer;
        height: 40px; transition: background 0.15s; font-family: inherit;
      }
      .btn-danger:hover { 
        background: rgba(245, 101, 101, 0.2);
        border-color: #f56565;
        ;
      }

      /* Swimlane items — glass card with colored left border */
      .swimlane-item {
        display: flex; align-items: center; margin-bottom: 8px; padding: 12px 14px;
        background: #333; border-radius: 8px; 
        border: 1px solid #363636;
        border-left: 4px solid #10a37f; transition: background 0.15s;
        
      }
      .swimlane-item:hover { 
        background: #3a3a3a;
        box-shadow: 0 4px 20px #444; 
      }
      .swimlane-color { display: none; }
      .swimlane-name-input {
        flex-grow: 1; padding: 8px 10px; border: 1px solid transparent;
        border-radius: 8px; font-size: 14px; background: transparent; color: #ccc;
        font-family: inherit; transition: background 0.15s;
      }
      .swimlane-name-input:hover { background: #363636; }
      .swimlane-name-input:focus {
        outline: none; background: #3a3a3a; 
        border-color: #10a37f;
        ;
      }
      .swimlane-actions { display: flex; margin-left: 4px; gap: 2px; }
      .swimlane-actions button {
        padding: 4px 6px; background: none; border: none; cursor: pointer;
        opacity: 0.6; font-size: 14px; border-radius: 8px; transition: all 0.3s;
        color: #999;
      }
      .swimlane-actions button:hover { 
        opacity: 1; 
        background: #404040;
        color: #ccc;
      }

      /* Trade management */
      .trade-filter-container { background: transparent; border-radius: 0; padding: 0; margin-top: 8px; }
      .trade-filter-header {
        display: flex; justify-content: space-between; align-items: center;
        margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #3a3a3a;
      }
      .trade-filter-header > span { font-size: 13px; font-weight: 500; color: #999; text-transform: uppercase; letter-spacing: 0.5px; }
      .trade-filter-actions { display: flex; gap: 4px; }
      .trade-filter-action {
        font-size: 12px; color: #999; background: none; border: none; cursor: pointer;
        padding: 4px 8px; border-radius: 8px; font-weight: 500; transition: all 0.3s; font-family: inherit;
      }
      .trade-filter-action:hover { 
        background: #404040; 
        color: #ccc;
      }
      .trade-filter-list { display: flex; flex-direction: column; gap: 6px; }
      .trade-filter-item {
        display: flex; align-items: center; padding: 10px 12px; 
        background: #333;
        border-radius: 8px; border: 1px solid #363636; 
        transition: background 0.15s;
        
      }
      .trade-filter-item:hover { 
        border-color: rgba(16, 163, 127, 0.3); 
        background: #3a3a3a;
        box-shadow: 0 4px 15px #444;
      }
      .trade-filter-item.disabled { opacity: 0.45; }
      .trade-filter-color {
        width: 22px; height: 22px; border-radius: 8px; margin-right: 12px; flex-shrink: 0;
        border: 2px solid transparent; cursor: pointer; transition: background 0.15s;
      }
      .trade-filter-color:hover { 
        border-color: rgba(16, 163, 127, 0.4); 
        transform: scale(1.1);
        ;
      }
      .trade-filter-name {
        flex-grow: 1; font-size: 14px; color: #ccc; border: none; background: transparent;
        font-family: inherit; padding: 4px 6px; border-radius: 8px; font-weight: 450;
      }
      .trade-filter-name:focus { 
        outline: none; 
        background: #3a3a3a; 
        ; 
      }
      .trade-filter-toggle {
        width: 40px; height: 22px; background: #404040; border-radius: 22px;
        position: relative; cursor: pointer; transition: background 0.15s; border: none; padding: 0;
        flex-shrink: 0; margin-left: 8px;
      }
      .trade-filter-toggle.active { background: #10a37f; }
      .trade-filter-toggle::before {
        content: ''; position: absolute; width: 18px; height: 18px; border-radius: 50%;
        background: #ccc; top: 2px; left: 2px; transition: transform 0.3s ease;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
      }
      .trade-filter-toggle.active::before { transform: translateX(18px); }
      .trade-filter-delete {
        background: none; border: none; color: #d1d5db; font-size: 16px;
        cursor: pointer; padding: 0 4px 0 8px; transition: color 0.15s; line-height: 1;
      }
      .trade-filter-delete:hover { color: #ef4444; }

      /* Color picker */
      .color-picker-dialog {
        position: absolute; background: white; border-radius: 8px;
        box-shadow: 0 8px 30px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.05);
        padding: 14px; z-index: 1001; display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px;
      }
      .color-swatch {
        width: 28px; height: 28px; border-radius: 6px; cursor: pointer;
        display: inline-block; border: 2px solid transparent; transition: all 0.15s;
      }
      .color-swatch:hover { transform: scale(1.15); border-color: rgba(0,0,0,0.1); }

      /* Modern Chat Interface Styles */
      .chat-container {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      }
      .chat-clear-btn:hover {
        background: #3a3a3a !important; color: #ececec !important;
      }
      .chat-input:focus {
        border-color: #10a37f !important; box-shadow: 0 0 0 2px rgba(16,163,127,0.2) !important;
      }
      .chat-input::placeholder {
        color: #999;
      }
      .chat-send-btn:disabled {
        background: #666 !important; cursor: not-allowed; opacity: 0.6;
      }
      .chat-send-btn:not(:disabled):hover {
        background: #0d8c6d !important; transform: translateY(-50%) scale(1.05);
      }
      .chat-upload-btn:hover {
        background: #3a3a3a !important; border-color: #666 !important;
      }
      
      /* Chat Message Bubbles */
      .message-bubble {
        max-width: 85%; padding: 12px 16px; border-radius: 18px; font-size: 14px; 
        line-height: 1.4; word-wrap: break-word; position: relative; animation: messageSlideIn 0.3s ease-out;
      }
      .message-bubble.user {
        background: #10a37f; color: white; align-self: flex-end; margin-left: auto;
        border-bottom-right-radius: 6px;
      }
      .message-bubble.assistant {
        background: #2f2f2f; color: #ececec; align-self: flex-start; margin-right: auto;
        border-bottom-left-radius: 6px; border: 1px solid #444;
      }
      .message-timestamp {
        font-size: 11px; color: #999; margin-top: 6px; text-align: right;
      }
      .message-bubble.user .message-timestamp {
        color: rgba(255,255,255,0.7);
      }
      
      /* Welcome Message */
      .welcome-message {
        background: #10a37f; 
        color: white; padding: 20px; border-radius: 6px; text-align: center;
        margin-bottom: 8px; border: none; animation: messageSlideIn 0.5s ease-out;
      }
      .welcome-title {
        font-size: 16px; font-weight: 600; margin-bottom: 8px;
      }
      .welcome-subtitle {
        font-size: 14px; opacity: 0.9; line-height: 1.4;
      }
      
      /* Quick Action Chips */
      .quick-actions {
        display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; justify-content: center;
      }
      .quick-action-chip {
        background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
        color: white; padding: 8px 12px; border-radius: 20px; font-size: 12px;
        cursor: pointer; transition: all 0.2s; 
        font-weight: 500;
      }
      .quick-action-chip:hover {
        background: rgba(255,255,255,0.2); transform: translateY(-1px);
      }
      
      /* Markdown-like formatting in messages */
      .message-content strong, .message-content b {
        font-weight: 600; color: #f3f4f6;
      }
      .message-content ul {
        margin: 8px 0; padding-left: 16px;
      }
      .message-content li {
        margin-bottom: 4px;
      }
      .message-content code {
        background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;
        font-family: 'SF Mono', 'Monaco', 'Consolas', monospace; font-size: 12px;
      }
      
      /* Typing animation */
      @keyframes typing {
        0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
        30% { transform: translateY(-6px); opacity: 1; }
      }
      
      /* Message slide-in animation */
      @keyframes messageSlideIn {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      /* Auto-scroll hint */
      .messages-container {
        scroll-behavior: smooth;
      }
      
      /* Scrollbar styling for dark theme */
      .chat-messages::-webkit-scrollbar {
        width: 6px;
      }
      .chat-messages::-webkit-scrollbar-track {
        background: #212121;
      }
      .chat-messages::-webkit-scrollbar-thumb {
        background: #444; border-radius: 3px;
      }
      .chat-messages::-webkit-scrollbar-thumb:hover {
        background: #666;
      }

      /* ===== Task Details Panel ===== */
      .task-details-panel { display: flex; flex-direction: column; gap: 20px; }
      .td-header { display: flex; gap: 0; border-radius: 6px; overflow: hidden; background: #2f2f2f; }
      .td-color-bar { width: 5px; flex-shrink: 0; }
      .td-header-content { padding: 14px 16px; flex: 1; }
      .td-name-input {
        width: 100%; font-size: 17px; font-weight: 600; color: #ececec;
        border: 1.5px solid transparent; padding: 6px 8px; border-radius: 6px;
        background: transparent; font-family: inherit; box-sizing: border-box;
        transition: all 0.15s ease;
      }
      .td-name-input:hover { background: #3a3a3a; border-color: #444; }
      .td-name-input:focus { background: #3a3a3a; border-color: #10a37f; outline: none; box-shadow: 0 0 0 3px rgba(16,163,127,0.15); }
      .td-meta { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
      .td-swimlane-badge, .td-status-badge {
        font-size: 11px; font-weight: 600; padding: 3px 8px; border-radius: 5px;
        border: 1px solid; letter-spacing: 0.2px;
      }
      .td-stats-row {
        display: grid; grid-template-columns: repeat(4, 1fr); gap: 0;
        background: #212121; border-radius: 6px; overflow: hidden;
      }
      .td-stat {
        display: flex; flex-direction: column; align-items: center; padding: 12px 8px;
        border-right: 1px solid #444;
      }
      .td-stat:last-child { border-right: none; }
      .td-stat-value { color: #ececec; font-size: 15px; font-weight: 700; }
      .td-stat-label { color: #999; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
      .td-section-label {
        font-size: 11px; font-weight: 600; color: #999; letter-spacing: 0.8px;
        text-transform: uppercase; margin-bottom: -12px;
      }
      .td-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
      .td-readonly-field {
        padding: 10px 12px; border: 1px solid #444; border-radius: 8px;
        font-size: 14px; background: #2f2f2f; color: #999; height: 40px;
        box-sizing: border-box; display: flex; align-items: center;
      }
      .td-toggle-group { display: flex; flex-direction: column; gap: 10px; }
      .td-toggle {
        display: flex; align-items: center; gap: 10px; cursor: pointer;
        font-size: 14px; color: #ececec;
      }
      .td-toggle input[type="checkbox"] {
        width: 36px; height: 20px; appearance: none; -webkit-appearance: none;
        background: #444; border-radius: 6px; position: relative;
        cursor: pointer; transition: background 0.2s;
      }
      .td-toggle input[type="checkbox"]::after {
        content: ''; position: absolute; top: 2px; left: 2px;
        width: 16px; height: 16px; background: #ececec; border-radius: 50%;
        transition: transform 0.2s;
      }
      .td-toggle input[type="checkbox"]:checked { background: #10a37f; }
      .td-toggle input[type="checkbox"]:checked::after { transform: translateX(16px); }
      .td-dep-add { display: flex; gap: 6px; }
      .td-dep-add select { flex: 1; }
      .td-add-btn {
        width: 40px; height: 40px; border: none; border-radius: 8px;
        background: #10a37f; color: #fff; font-size: 18px; cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: background 0.15s;
      }
      .td-add-btn:hover { background: #0d8c6d; }
      .td-dep-list { display: flex; flex-direction: column; gap: 6px; }
      .td-dep-item {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px 12px; background: #2f2f2f; border-radius: 8px;
        border: 1px solid #444; transition: border-color 0.15s;
      }
      .td-dep-item:hover { border-color: #666; }
      .td-dep-info { display: flex; align-items: center; gap: 8px; }
      .td-dep-dot { width: 8px; height: 8px; border-radius: 3px; flex-shrink: 0; }
      .td-dep-name { font-size: 13px; font-weight: 500; color: #ececec; }
      .td-dep-type {
        font-size: 11px; font-weight: 600; background: #444; padding: 2px 6px;
        border-radius: 4px; color: #999; font-family: monospace;
      }
      .td-dep-remove {
        border: none; background: none; color: #999; cursor: pointer;
        font-size: 16px; padding: 4px 8px; border-radius: 4px; transition: all 0.15s;
      }
      .td-dep-remove:hover { background: rgba(239,68,68,0.2); color: #ef4444; }
      .td-dep-empty { padding: 10px 12px; font-size: 13px; color: #999; font-style: italic; }
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
            <!-- Modern Chat Interface -->
            <div class="chat-container" style="display:flex; flex-direction:column; height:100%; background:#212121; border-radius:12px; overflow:hidden;">
              <!-- Chat Header -->
              <div class="chat-header" style="padding:16px 20px; background:#2f2f2f; border-bottom:1px solid #444; display:flex; justify-content:space-between; align-items:center; flex-shrink:0;">
                <div style="display:flex; align-items:center; gap:12px;">
                  <div style="width:10px; height:10px; background:#22c55e; border-radius:50%; box-shadow:0 0 8px rgba(34,197,94,0.5);"></div>
                  <span style="color:#e5e7eb; font-size:14px; font-weight:500;">AI Project Composer</span>
                </div>
                <button class="chat-clear-btn" style="background:none; border:none; color:#6b7280; cursor:pointer; padding:4px 8px; border-radius:6px; font-size:12px; transition:all 0.15s;" title="Clear chat">Clear</button>
              </div>

              <!-- Chat Messages Area -->
              <div class="chat-messages" style="flex:1; overflow-y:auto; padding:20px; display:flex; flex-direction:column; gap:16px; min-height:0; scroll-behavior:smooth;">
                <!-- Welcome message and quick actions will be inserted here -->
              </div>

              <!-- Typing Indicator -->
              <div class="typing-indicator" style="display:none; padding:0 20px 16px; opacity:0; transition:all 0.3s;">
                <div style="background:#2a2a2a; padding:12px 16px; border-radius:18px; display:inline-flex; align-items:center; gap:8px; max-width:80px;">
                  <div class="typing-dots" style="display:flex; gap:4px;">
                    <div style="width:6px; height:6px; background:#6b7280; border-radius:50%; animation:typing 1.5s infinite;"></div>
                    <div style="width:6px; height:6px; background:#6b7280; border-radius:50%; animation:typing 1.5s infinite 0.3s;"></div>
                    <div style="width:6px; height:6px; background:#6b7280; border-radius:50%; animation:typing 1.5s infinite 0.6s;"></div>
                  </div>
                </div>
              </div>

              <!-- Chat Input Area -->
              <div class="chat-input-area" style="border-top:1px solid #333; background:#1a1a1a; padding:16px 20px; flex-shrink:0;">
                <!-- Image preview area -->
                <div class="composer-image-preview" style="display:none; margin-bottom:12px;"></div>
                
                <div style="display:flex; gap:12px; align-items:flex-end;">
                  <!-- Image Upload Button -->
                  <label class="chat-upload-btn" style="width:44px; height:44px; display:flex; align-items:center; justify-content:center; background:#2a2a2a; border:1px solid #404040; border-radius:10px; cursor:pointer; font-size:18px; color:#9ca3af; transition:all 0.15s; flex-shrink:0;" title="Upload image">
                    <input type="file" accept="image/*" class="composer-image-input" style="display:none;">
                    📎
                  </label>
                  
                  <!-- Auto-growing Text Input -->
                  <div style="flex:1; position:relative; min-height:44px; max-height:120px;">
                    <textarea 
                      class="chat-input" 
                      placeholder="Describe your project and I'll build the schedule..."
                      style="width:100%; min-height:44px; max-height:120px; padding:12px 56px 12px 16px; background:#2a2a2a; border:1px solid #404040; border-radius:22px; color:#e5e7eb; font-size:14px; font-family:inherit; resize:none; outline:none; transition:all 0.15s; line-height:1.4; box-sizing:border-box; overflow-y:hidden;"
                      rows="1"
                    ></textarea>
                    
                    <!-- Send Button (positioned inside textarea) -->
                    <button 
                      class="chat-send-btn" 
                      style="position:absolute; right:8px; top:50%; transform:translateY(-50%); width:36px; height:36px; background:#2563eb; border:none; border-radius:50%; color:white; font-size:16px; cursor:pointer; transition:all 0.15s; display:flex; align-items:center; justify-content:center;"
                      disabled
                    >
                      ▶
                    </button>
                  </div>
                </div>
                
                <div style="font-size:12px; color:#6b7280; margin-top:8px; text-align:center;">
                  Press <kbd style="background:#2a2a2a; padding:2px 6px; border-radius:4px; font-size:11px;">Enter</kbd> to send, <kbd style="background:#2a2a2a; padding:2px 6px; border-radius:4px; font-size:11px;">Shift+Enter</kbd> for new line
                </div>
              </div>
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
              <p style="font-size:13px; color:#6b7280; margin:0 0 12px; line-height:1.5;">Enter your API key (OpenAI or Anthropic) to use the AI Composer. Stored locally in your browser.</p>
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

    // Note: Chat messages now handled by .chat-messages container
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
    // LEFT panel nav buttons (unified class)
    this.leftPanel.querySelectorAll('.sb-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const action = (e.currentTarget as HTMLElement).dataset.action;
        if (!action) return;
        if (action === 'new-project') { this.handleNewProject(); return; }
        this.handleNavAction(action);
      });
    });

    // Project dropdown switch
    const projectSelect = this.leftPanel.querySelector('#sidebar-project-select') as HTMLSelectElement;
    if (projectSelect) {
      projectSelect.addEventListener('change', async () => {
        const id = projectSelect.value;
        if (!id) return;
        if (window.canvasApp?.loadProjectById) {
          const ok = await window.canvasApp.loadProjectById(id);
          if (ok) {
            const name = localStorage.getItem('dingplan-project-name');
            const display = document.getElementById('project-name-display');
            if (display && name) display.textContent = name;
          }
        }
      });
    }

    // Delete project button
    const deleteBtn = this.leftPanel.querySelector('#delete-project-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', async () => {
        const currentId = localStorage.getItem('currentProjectId') || 'default';
        const projects = await listProjects();
        if (projects.length <= 1) { alert("Can't delete your only project"); return; }
        if (!confirm('Delete this project?')) return;
        // Find another project to switch to
        const other = projects.find(p => p.id !== currentId);
        if (other && window.canvasApp?.loadProjectById) {
          await window.canvasApp.loadProjectById(other.id);
          const display = document.getElementById('project-name-display');
          if (display) display.textContent = other.name;
        }
        await deleteProject(currentId);
        this.refreshProjectList();
      });
    }

    // RIGHT panel close
    const closeBtn = this.element.querySelector('.rp-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.hide());

    // Note: Chat interface event listeners are now handled in setupChatInterface()

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

  async refreshProjectList() {
    const select = this.leftPanel.querySelector('#sidebar-project-select') as HTMLSelectElement;
    if (!select) return;
    
    let projects = await listProjects();
    const currentId = localStorage.getItem('currentProjectId') || 'default';
    
    if (projects.length === 0) {
      const name = localStorage.getItem('dingplan-project-name') || 'My Project';
      projects = [{ id: currentId, name, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }];
    }
    
    select.innerHTML = projects.map(p =>
      `<option value="${p.id}" ${p.id === currentId ? 'selected' : ''}>${p.name}</option>`
    ).join('');
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
      background: #1a1a1a; border-radius: 8px; padding: 32px;
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
          background: #2a2a2a; border: 2px solid #333; border-radius: 6px;
          padding: 20px; cursor: pointer; transition: all 0.2s;
        ">
          <h3 style="color: white; margin: 0 0 8px 0; font-size: 16px; font-weight: 600;">📋 Blank Project</h3>
          <p style="color: #888; margin: 0; font-size: 13px; line-height: 1.4;">Start with an empty canvas and build your schedule from scratch</p>
        </div>
        
        ${WBS_TEMPLATES.map(template => `
          <div class="template-card" data-template="${template.id}" style="
            background: #1a1a1a; border: 2px solid transparent; border-radius: 6px;
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

  private async createProjectFromTemplate(templateId: string) {
    const name = prompt('Project name:');
    if (!name) return;

    // Prepare swimlanes from template
    let swimlanes: any[] = [];
    if (templateId !== 'blank') {
      const template = WBS_TEMPLATES.find(t => t.id === templateId);
      if (template) {
        const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
        swimlanes = template.categories.map((category, index) => ({
          id: generateUUID(),
          name: category,
          color: colors[index % colors.length]
        }));
      }
    }

    // Use the new unified project creation method
    if (window.canvasApp && window.canvasApp.createNewProject) {
      await window.canvasApp.createNewProject(name, swimlanes);
      
      // Update toolbar
      const display = document.getElementById('project-name-display');
      if (display) display.textContent = name;
      this.refreshProjectList();
    }
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

  private async handleAIComposerSubmit(prompt: string, imageBase64?: string | null) {
    if (!this.composer) {
      this.hideTypingIndicator();
      this.addChatMessage('Composer not initialized. Please refresh the page.', 'assistant');
      return;
    }
    
    const userKey = localStorage.getItem('dingPlanApiKey');
    const builtInKey = (import.meta.env.VITE_OPENAI_KEY as string) || '';
    const isLoggedIn = !!authService.getCurrentUser();
    const apiKey = userKey || (isLoggedIn ? builtInKey : '');
    
    if (!apiKey) {
      this.hideTypingIndicator();
      const message = isLoggedIn ? 
        'AI Composer error — please try again.' : 
        'Add your API key (OpenAI or Anthropic) in Settings to use AI Composer.';
      this.addChatMessage(message, 'assistant');
      return;
    }
    
    if (this.composer) this.composer.setApiKey(apiKey);
    
    try {
      const displayPrompt = prompt || (imageBase64 ? 'What do you see in this image? Generate a construction schedule based on it.' : '');
      const response = await this.composer.processPrompt(displayPrompt, imageBase64 || undefined);
      this.hideTypingIndicator();
      this.addChatMessage(response, 'assistant');
    } catch (error: unknown) {
      this.hideTypingIndicator();
      const errorMessage = `Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`;
      this.addChatMessage(errorMessage, 'assistant');
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
    this.floatingBar.style.display = 'none';
    this.refreshProjectList();
  }

  hideLeftPanel() {
    this.leftPanelVisible = false;
    this.leftPanel.style.transform = `translateX(-${LEFT_PANEL_WIDTH}px)`;
    this.floatingBar.style.display = 'flex'; // Show floating bar when sidebar closes
  }

  isLeftPanelOpen(): boolean { return this.leftPanelVisible; }

  private updateStatusBanner() {
    const banner = this.leftPanel.querySelector('#sidebar-status-banner');
    if (!banner) return;

    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      banner.innerHTML = '<span style="color: #22c55e; font-size: 8px;">●</span> <span>☁️ Synced</span>';
      banner.style.color = '#6b7280';
    } else {
      banner.innerHTML = '<span style="color: #22c55e; font-size: 8px;">●</span> <span>Saves automatically</span>';
      banner.style.color = '#6b7280';
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
    
    // Clear any existing messages and show welcome
    this.clearChat();
    this.showWelcomeMessage();
    
    if (apiKey && this.composer) {
      this.composer.setApiKey(apiKey);
    } else {
      const message = isLoggedIn ? 
        'AI Composer needs setup. Add your API key in Settings.' : 
        'Add your API key (OpenAI or Anthropic) in Settings to use AI Composer.';
      this.addChatMessage(message, 'assistant');
    }
    
    // Set up chat interface
    this.setupChatInterface();
  }
  
  private addChatMessage(message: string, type: 'user' | 'assistant', skipFormatting = false) {
    const chatMessages = this.element.querySelector('.chat-messages');
    if (!chatMessages) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message-bubble ${type}`;
    
    if (skipFormatting) {
      messageDiv.textContent = message;
    } else {
      // Parse markdown-like formatting for assistant messages
      if (type === 'assistant') {
        messageDiv.innerHTML = this.parseMarkdown(this.stripJsonBlocks(message));
      } else {
        messageDiv.textContent = message;
      }
    }
    
    // Add timestamp
    const timestamp = document.createElement('div');
    timestamp.className = 'message-timestamp';
    timestamp.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    messageDiv.appendChild(timestamp);
    
    chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
  }

  private addComposerMessage(message: string, isUserInput = false) {
    // Legacy method - redirect to new chat message system
    this.addChatMessage(message, isUserInput ? 'user' : 'assistant');
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

  // ---- Modern Chat Interface Methods ----

  private showWelcomeMessage() {
    const chatMessages = this.element.querySelector('.chat-messages');
    if (!chatMessages) return;

    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'welcome-message';
    welcomeDiv.innerHTML = `
      <div class="welcome-title">🚀 Welcome to AI Composer</div>
      <div class="welcome-subtitle">Describe your project and I'll build the schedule. Try: "datacenter" or "3-story office building"</div>
      <div class="quick-actions">
        <div class="quick-action-chip" data-prompt="Datacenter construction project">Datacenter</div>
        <div class="quick-action-chip" data-prompt="Tenant improvement project">Tenant Improvement</div>
        <div class="quick-action-chip" data-prompt="Residential construction project">Residential</div>
        <div class="quick-action-chip" data-prompt="Commercial office building">Commercial Office</div>
        <div class="quick-action-chip" data-prompt="Add more detail to the schedule">Add more detail</div>
        <div class="quick-action-chip" data-prompt="Compress the schedule timeline">Compress schedule</div>
      </div>
    `;
    chatMessages.appendChild(welcomeDiv);
    this.setupQuickActionChips();
  }

  private setupQuickActionChips() {
    const chips = this.element.querySelectorAll('.quick-action-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const prompt = (chip as HTMLElement).dataset.prompt;
        if (prompt) {
          this.sendChatMessage(prompt);
        }
      });
    });
  }

  private setupChatInterface() {
    const input = this.element.querySelector('.chat-input') as HTMLTextAreaElement;
    const sendBtn = this.element.querySelector('.chat-send-btn') as HTMLButtonElement;
    const clearBtn = this.element.querySelector('.chat-clear-btn') as HTMLButtonElement;
    const imageInput = this.element.querySelector('.composer-image-input') as HTMLInputElement;
    const imagePreview = this.element.querySelector('.composer-image-preview') as HTMLElement;
    
    let pendingImage: string | null = null;

    if (!input || !sendBtn) return;

    // Auto-growing textarea
    const adjustTextareaHeight = () => {
      input.style.height = 'auto';
      const scrollHeight = Math.min(input.scrollHeight, 120);
      input.style.height = scrollHeight + 'px';
      input.style.overflowY = scrollHeight === 120 ? 'auto' : 'hidden';
    };

    // Input event listeners
    input.addEventListener('input', () => {
      adjustTextareaHeight();
      const hasText = input.value.trim().length > 0;
      sendBtn.disabled = !hasText && !pendingImage;
    });

    // Keyboard shortcuts
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (input.value.trim() || pendingImage) {
          this.sendChatMessage(input.value, pendingImage);
        }
      }
    });

    // Send button
    sendBtn.addEventListener('click', () => {
      if (input.value.trim() || pendingImage) {
        this.sendChatMessage(input.value, pendingImage);
      }
    });

    // Clear chat button
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        if (confirm('Clear chat history?')) {
          this.clearChat();
          this.showWelcomeMessage();
        }
      });
    }

    // Image upload
    if (imageInput && imagePreview) {
      imageInput.addEventListener('change', () => {
        const file = imageInput.files?.[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = () => {
          pendingImage = reader.result as string;
          sendBtn.disabled = false;
          
          // Show preview
          imagePreview.style.display = 'block';
          imagePreview.innerHTML = `
            <div style="position:relative; display:inline-block;">
              <img src="${pendingImage}" style="max-height:80px; border-radius:8px; border:1px solid #404040;">
              <button class="remove-image" style="position:absolute; top:-6px; right:-6px; width:20px; height:20px; border-radius:50%; background:#ef4444; color:white; border:none; cursor:pointer; font-size:12px; line-height:1;">×</button>
            </div>
          `;
          
          const removeBtn = imagePreview.querySelector('.remove-image');
          if (removeBtn) {
            removeBtn.addEventListener('click', () => {
              pendingImage = null;
              imagePreview.style.display = 'none';
              imagePreview.innerHTML = '';
              imageInput.value = '';
              sendBtn.disabled = input.value.trim().length === 0;
            });
          }
        };
        reader.readAsDataURL(file);
      });
    }

    // Focus input when composer opens
    setTimeout(() => input.focus(), 100);
  }

  private sendChatMessage(text: string, imageBase64?: string | null) {
    const input = this.element.querySelector('.chat-input') as HTMLTextAreaElement;
    const sendBtn = this.element.querySelector('.chat-send-btn') as HTMLButtonElement;
    const imagePreview = this.element.querySelector('.composer-image-preview') as HTMLElement;
    const imageInput = this.element.querySelector('.composer-image-input') as HTMLInputElement;

    if (!input || !sendBtn) return;

    const message = text.trim();
    if (!message && !imageBase64) return;

    // Add user message
    if (message) {
      this.addChatMessage(message, 'user');
    } else if (imageBase64) {
      this.addChatMessage('📷 Image uploaded', 'user');
    }

    // Clear input
    input.value = '';
    input.style.height = 'auto';
    sendBtn.disabled = true;

    // Clear image preview
    if (imagePreview && imageInput) {
      imagePreview.style.display = 'none';
      imagePreview.innerHTML = '';
      imageInput.value = '';
    }

    // Show typing indicator
    this.showTypingIndicator();

    // Process with AI
    this.handleAIComposerSubmit(message, imageBase64);
  }

  private showTypingIndicator() {
    const indicator = this.element.querySelector('.typing-indicator') as HTMLElement;
    if (indicator) {
      indicator.style.display = 'block';
      indicator.style.opacity = '1';
      this.scrollToBottom();
    }
  }

  private hideTypingIndicator() {
    const indicator = this.element.querySelector('.typing-indicator') as HTMLElement;
    if (indicator) {
      indicator.style.opacity = '0';
      setTimeout(() => {
        indicator.style.display = 'none';
      }, 300);
    }
  }

  private clearChat() {
    const chatMessages = this.element.querySelector('.chat-messages');
    if (chatMessages) {
      chatMessages.innerHTML = '';
    }
  }

  private scrollToBottom() {
    const chatMessages = this.element.querySelector('.chat-messages');
    if (chatMessages) {
      setTimeout(() => {
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }, 100);
    }
  }

  private parseMarkdown(text: string): string {
    return text
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.*?)__/g, '<strong>$1</strong>')
      // Simple lists
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
      // Line breaks
      .replace(/\n/g, '<br>');
  }

  private stripJsonBlocks(text: string): string {
    // Remove JSON blocks that are meant for the schedule, not display
    return text.replace(/```json\s*\{[\s\S]*?\}\s*```/g, '')
      .replace(/\{[\s\S]*?"tasks"[\s\S]*?\}/g, '')
      .trim();
  }

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

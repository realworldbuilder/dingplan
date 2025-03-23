/**
 * ProjectManager.ts
 * A component that manages project saving, loading, and syncing with the server
 */

import { 
  saveProject, 
  updateProject, 
  loadProject, 
  deleteProject, 
  getUserProjects 
} from '../services/projectService';
import { onAuthStateChanged, isAuthenticated } from '../services/authService';

export class ProjectManager {
  private canvas: any; // Main canvas instance
  private _currentProjectId: string | null = null;
  private projectName: string = 'Untitled Project';
  private projectDescription: string = '';
  private isPublic: boolean = false;
  private tags: string[] = [];
  private isInitialized: boolean = false;
  private sidebarContainer: HTMLElement | null = null;
  private projectSidebar: HTMLElement | null = null; // Add this property for the project sidebar
  private isLoading: boolean = false;
  private loadingIndicator: HTMLElement | null = null;
  // Add a new class property for the backup timer
  private autoBackupTimer: number | null = null;
  private autoBackupInterval: number = 5 * 60 * 1000; // 5 minutes in milliseconds
  private currentSidebarView: 'projects' | 'backups' = 'projects'; // Track active tab

  constructor() {
    // Find the sidebar container
    this.sidebarContainer = document.getElementById('sidebar-container');
    if (!this.sidebarContainer) {
      console.warn('Sidebar container not found, creating one');
      // Create a sidebar container if it doesn't exist
      this.sidebarContainer = document.createElement('div');
      this.sidebarContainer.id = 'sidebar-container';
      this.sidebarContainer.style.position = 'fixed';
      this.sidebarContainer.style.top = '0';
      this.sidebarContainer.style.right = '0';
      this.sidebarContainer.style.width = '300px';
      this.sidebarContainer.style.height = '100%';
      this.sidebarContainer.style.zIndex = '1000';
      this.sidebarContainer.style.pointerEvents = 'none'; // Prevent blocking clicks until content is added
      this.sidebarContainer.style.background = 'transparent';
      document.body.appendChild(this.sidebarContainer);
    }
    
    // Subscribe to auth state changes
    onAuthStateChanged(this.handleAuthStateChange.bind(this));
  }

  /**
   * Handle authentication state changes
   */
  private handleAuthStateChange(state: { userId: string; authenticated: boolean }) {
    console.log('[ProjectManager] Auth state changed:', state);
    
    // Refresh the projects list when auth state changes
    if (this.isInitialized) {
      this.refreshProjectsList();
      
      // Remove sign in/out notifications
    }
  }

  /**
   * Getter for current project ID
   */
  get currentProjectId(): string | null {
    return this._currentProjectId;
  }

  /**
   * Setter for current project ID
   */
  set currentProjectId(value: string | null) {
    this._currentProjectId = value;
  }

  /**
   * Initialize the project manager with the canvas instance
   */
  init(canvas: any) {
    if (this.isInitialized) return;
    
    this.canvas = canvas;
    this.initUI();
    this.isInitialized = true;
    
    // Get reference to the projects sidebar content
    this.projectSidebar = document.getElementById('projects-sidebar');
    
    // Check for project ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const projectId = urlParams.get('project');
    
    if (projectId) {
      this.loadProjectFromServer(projectId);
    }
    
    // Add to init method, after this.isInitialized = true;
    // Start auto-backup timer
    this.startAutoBackup();
    
    // Add emergency save functionality while debugging
    // this.fixSaving(); // Removing emergency save button
  }

  /**
   * Initialize the UI for the project manager
   */
  private initUI() {
    if (!this.canvas) {
      console.error('[ProjectManager] Canvas not available');
      return;
    }
    
    console.log('[ProjectManager] Initializing UI');
    
    // Create a standalone left sidebar container for projects
    const leftSidebar = document.createElement('div');
    leftSidebar.id = 'projects-sidebar';
    leftSidebar.className = 'left-sidebar';
    leftSidebar.style.position = 'fixed';
    leftSidebar.style.top = '0';
    leftSidebar.style.left = '0';
    leftSidebar.style.width = '300px'; // Default width
    leftSidebar.style.height = '100%';
    leftSidebar.style.backgroundColor = '#ffffff';
    leftSidebar.style.boxShadow = '2px 0 10px rgba(0, 0, 0, 0.1)';
    leftSidebar.style.zIndex = '999';
    leftSidebar.style.transform = 'translateX(-300px)'; // Match with width
    leftSidebar.style.transition = 'transform 0.3s ease';
    leftSidebar.style.display = 'flex';
    leftSidebar.style.flexDirection = 'column';
    leftSidebar.style.overflow = 'hidden';
    leftSidebar.style.overflowX = 'hidden';
    
    // Create a resize handle for the sidebar
    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'sidebar-resize-handle';
    
    // Add CSS to improve sidebar appearance
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      #projects-sidebar {
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        resize: horizontal;
        min-width: 260px;
        max-width: 450px;
        overflow-x: hidden !important;
        background-color: #fcfcfc;
      }
      
      /* Project sidebar content containers */
      #projects-sidebar > div,
      #projects-sidebar .sidebar-content,
      #projects-sidebar .sidebar-panel,
      #projects-sidebar .projects-panel,
      #projects-sidebar .backups-panel,
      #projects-sidebar #project-list,
      #projects-sidebar #backup-list {
        overflow-x: hidden !important;
        max-width: 100%;
      }
      
      .sidebar-resize-handle {
        position: absolute;
        width: 6px;
        height: 100%;
        right: 0;
        top: 0;
        background-color: transparent;
        cursor: ew-resize;
        z-index: 1000;
      }
      
      .sidebar-resize-handle:hover {
        background-color: rgba(0, 0, 0, 0.05);
      }
      
      .sidebar-resize-handle.dragging {
        background-color: rgba(33, 150, 243, 0.1);
      }
      
      #projects-sidebar .sidebar-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 15px;
        border-bottom: 1px solid #eaeaea;
        background-color: #f5f5f5;
      }
      
      #projects-sidebar .sidebar-header h2 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: #333;
      }
      
      #projects-sidebar .close-sidebar-btn {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #666;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        border-radius: 4px;
      }
      
      #projects-sidebar .close-sidebar-btn:hover {
        background-color: rgba(0, 0, 0, 0.05);
      }
      
      #projects-sidebar .project-controls {
        padding: 10px 15px;
        overflow-y: auto;
        border-bottom: 1px solid #eaeaea;
      }
      
      #projects-sidebar .current-project {
        margin-bottom: 15px;
        padding: 0;
        border-radius: 4px;
      }
      
      #projects-sidebar input[type="text"],
      #projects-sidebar textarea {
        width: 100%;
        padding: 8px 10px;
        margin-bottom: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 13px;
        background-color: #fff;
      }
      
      #projects-sidebar textarea {
        min-height: 40px;
        max-height: 100px;
        resize: vertical;
      }
      
      #projects-sidebar .section-header {
        margin-bottom: 5px;
      }
      
      #projects-sidebar .section-header h3 {
        font-size: 14px;
        font-weight: 500;
        color: #333;
        margin: 0 0 6px 0;
      }
      
      #projects-sidebar .action-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 10px 0 5px 0;
      }
      
      #projects-sidebar .action-buttons button {
        flex: 1 0 auto;
        padding: 6px 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: #f8f8f8;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        min-width: 0;
        color: #333;
      }
      
      #projects-sidebar .action-buttons button:hover {
        background-color: #f0f0f0;
      }
      
      #projects-sidebar button.primary-btn {
        background-color: #2196F3;
        color: white;
        border-color: #1976D2;
      }
      
      #projects-sidebar button.primary-btn:hover {
        background-color: #1976D2;
      }
      
      #projects-sidebar button.utility-btn {
        color: #e53935;
      }
      
      #projects-sidebar button.utility-btn:hover {
        background-color: #ffebee;
      }
      
      /* Project link section */
      #projects-sidebar .project-link {
        display: flex;
        margin-top: 8px;
      }
      
      #projects-sidebar .project-link input {
        flex: 1;
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
        margin: 0;
        font-size: 12px;
        background-color: #f9f9f9;
      }
      
      #projects-sidebar .copy-link-btn {
        padding: 6px 10px;
        font-size: 12px;
        background-color: #f0f0f0;
        border: 1px solid #ddd;
        border-left: none;
        border-top-right-radius: 4px;
        border-bottom-right-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      
      #projects-sidebar .copy-link-btn:hover {
        background-color: #e6e6e6;
      }
      
      /* Add tabs styling */
      #projects-sidebar .sidebar-tabs {
        display: flex;
        border-bottom: 1px solid #eaeaea;
        background-color: #f5f5f5;
      }
      
      #projects-sidebar .sidebar-tab {
        flex: 1;
        text-align: center;
        padding: 10px 8px;
        cursor: pointer;
        color: #666;
        font-weight: 500;
        border-bottom: 2px solid transparent;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        font-size: 13px;
      }
      
      #projects-sidebar .sidebar-tab.active {
        color: #2196F3;
        border-bottom-color: #2196F3;
        background-color: rgba(33, 150, 243, 0.05);
      }
      
      #projects-sidebar .sidebar-tab:hover:not(.active) {
        background-color: rgba(0, 0, 0, 0.03);
        border-bottom-color: #e0e0e0;
      }
      
      #projects-sidebar .tab-content {
        display: none;
        height: 100%;
        overflow-y: auto;
      }
      
      #projects-sidebar .tab-content.active {
        display: block;
      }
      
      /* Toggle switch styling */
      #projects-sidebar .toggle-container {
        display: flex;
        align-items: center;
        margin-bottom: 5px;
      }
      
      #projects-sidebar .toggle-slider {
        position: relative;
        display: inline-block;
        width: 34px;
        height: 18px;
        background-color: #ccc;
        border-radius: 9px;
        margin-right: 8px;
        transition: background-color 0.2s;
      }
      
      #projects-sidebar .toggle-slider:before {
        position: absolute;
        content: "";
        height: 14px;
        width: 14px;
        left: 2px;
        bottom: 2px;
        background-color: white;
        border-radius: 50%;
        transition: transform 0.2s;
      }
      
      #projects-sidebar input[type="checkbox"]:checked + .toggle-slider {
        background-color: #2196F3;
      }
      
      #projects-sidebar input[type="checkbox"]:checked + .toggle-slider:before {
        transform: translateX(16px);
      }
      
      #projects-sidebar .toggle-label {
        font-size: 13px;
        color: #333;
      }
      
      #projects-sidebar .help-text {
        font-size: 12px;
        color: #777;
        margin: 4px 0 8px 0;
      }
      
      /* Projects list styling */
      #projects-sidebar .user-projects {
        padding: 10px 15px;
      }
      
      #projects-sidebar .user-projects h3 {
        font-size: 14px;
        font-weight: 500;
        color: #333;
        margin: 0 0 10px 0;
      }
      
      #projects-sidebar .projects-list {
        max-height: calc(100vh - 450px);
        overflow-y: auto;
      }
      
      #projects-sidebar .project-item {
        padding: 10px;
        border: 1px solid #e0e0e0;
        border-radius: 4px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;
        background-color: #fff;
      }
      
      #projects-sidebar .project-item:hover {
        border-color: #bbdefb;
        background-color: #f5f9ff;
      }
      
      #projects-sidebar .project-item.active {
        border-color: #2196F3;
        background-color: #e3f2fd;
      }
      
      #projects-sidebar .project-item-title {
        font-size: 13px;
        font-weight: 500;
        margin-bottom: 5px;
        color: #333;
      }
      
      #projects-sidebar .project-item-meta {
        font-size: 11px;
        color: #777;
        display: flex;
        justify-content: space-between;
      }
      
      #projects-sidebar .loading-projects {
        color: #666;
        font-size: 13px;
        text-align: center;
        padding: 20px 10px;
      }
      
      #projects-sidebar .project-actions {
        display: flex;
        gap: 5px;
        margin-top: 8px;
      }
      
      #projects-sidebar .project-actions button {
        padding: 4px 8px;
        font-size: 12px;
      }
      
      #projects-sidebar .project-visibility {
        margin-bottom: 15px;
      }
      
      #projects-sidebar .toggle-container {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        margin-bottom: 5px;
      }
      
      #projects-sidebar .help-text {
        font-size: 12px;
        color: #666;
      }
      
      /* Toggle slider styles */
      #projects-sidebar .toggle-slider {
        position: relative;
        display: inline-block;
        width: 36px;
        height: 20px;
        background-color: #ccc;
        border-radius: 20px;
        transition: all 0.3s;
      }
      
      #projects-sidebar .toggle-slider:before {
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 2px;
        bottom: 2px;
        background-color: white;
        border-radius: 50%;
        transition: all 0.3s;
      }
      
      #projects-sidebar input:checked + .toggle-slider {
        background-color: #2196F3;
      }
      
      #projects-sidebar input:checked + .toggle-slider:before {
        transform: translateX(16px);
      }
      
      #projects-sidebar input[type="checkbox"] {
        opacity: 0;
        width: 0;
        height: 0;
      }
      
      .sidebar-resize-handle {
        position: absolute;
        width: 6px;
        height: 100%;
        right: 0;
        top: 0;
        background-color: transparent;
        cursor: ew-resize;
        z-index: 1000;
      }
      
      .sidebar-resize-handle:hover {
        background-color: rgba(0, 0, 0, 0.05);
      }
      
      .sidebar-resize-handle.dragging {
        background-color: rgba(33, 150, 243, 0.1);
      }
      
      #projects-sidebar {
        pointer-events: auto !important;
      }
      
      body .left-sidebar {
        z-index: 9999 !important;
      }

      .project-backups {
        padding: 15px;
        border-top: 1px solid #eee;
        border-bottom: 1px solid #eee;
      }

      .project-backups h3 {
        margin: 0 0 10px 0;
        font-size: 16px;
        font-weight: 600;
      }

      .backup-controls {
        display: flex;
        gap: 10px;
        margin-bottom: 10px;
      }

      .backup-btn {
        flex: 1;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: #f5f5f5;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        transition: background-color 0.2s;
        font-size: 13px;
      }

      .backup-btn:hover {
        background: #e5e5e5;
      }

      .backups-list {
        max-height: 200px;
        overflow-y: auto;
        margin-top: 10px;
      }

      .backup-item {
        padding: 8px 10px;
        border-radius: 4px;
        border: 1px solid #eee;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .backup-item:hover {
        background-color: #f5f5f5;
      }

      .backup-item-title {
        font-weight: 500;
        font-size: 13px;
        margin-bottom: 3px;
      }

      .backup-item-date {
        font-size: 11px;
        color: #777;
      }

      .backup-item-actions {
        display: flex;
        gap: 5px;
        margin-top: 5px;
      }

      .backup-item-actions button {
        padding: 2px 6px;
        font-size: 11px;
        border: none;
        background: #f0f0f0;
        border-radius: 3px;
        cursor: pointer;
      }

      .backup-item-actions button:hover {
        background: #e0e0e0;
      }

      .backup-dialog {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 10001;
        min-width: 400px;
        max-width: 90%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
      }

      .backup-dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }

      .backup-dialog-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0;
      }

      .backup-dialog-close {
        background: none;
        border: none;
        font-size: 22px;
        cursor: pointer;
        opacity: 0.7;
        padding: 0;
      }

      .backup-dialog-content {
        flex: 1;
        overflow-y: auto;
      }

      .backup-dialog-footer {
        margin-top: 15px;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      .backup-dialog-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
      }

      .sidebar-content {
        flex-grow: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0 16px;
      }
      
      /* Add loading indicator styles */
      .loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
      }
      
      .sidebar-content {
        flex-grow: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0 16px;
      }
      
      /* Ensure all content panels don't have horizontal scrollbars */
      .sidebar-content-panel {
        overflow-x: hidden !important;
      }
      
      /* Fix any overflow issues in the sidebar */
      .projects-panel, .backups-panel, #project-list, #backup-list, .sidebar-panel {
        overflow-x: hidden !important;
      }
      
      /* Specifically target the project list container */
      #projects-sidebar hr {
        margin: 15px 0;
        width: 100%;
        max-width: 100%;
      }
      
      /* Fix scrollbar near "Your Projects" heading */
      #projects-sidebar > div > div {
        overflow-x: hidden !important;
        max-width: 100%;
      }
      
      /* Hide all horizontal scrollbars in all divs inside the sidebar */
      #projects-sidebar div {
        overflow-x: hidden !important;
        max-width: 100%;
      }
      
      /* Target menu tabs specifically */
      .sidebar-tabs, 
      .sidebar-tab,
      .auth-container-minimal,
      #auth-container,
      .sidebar-header {
        overflow: hidden !important;
      }
      
      /* Only allow vertical scrolling in the projects list */
      #project-list {
        overflow-y: auto !important;
        overflow-x: hidden !important;
      }
      
      /* Hide all scrollbars by default */
      #projects-sidebar * {
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* IE and Edge */
      }
      
      /* Hide webkit scrollbars */
      #projects-sidebar *::-webkit-scrollbar {
        display: none;
      }
      
      /* Only show scrollbars for the project list */
      #project-list::-webkit-scrollbar {
        width: 5px;
        display: block;
      }
      
      #project-list::-webkit-scrollbar-thumb {
        background: #bbb;
        border-radius: 5px;
      }
    `;
    document.head.appendChild(styleElement);
    
    const toggleButton = document.createElement('button');
    toggleButton.id = 'toggle-projects-sidebar';
    toggleButton.className = 'toggle-projects-sidebar';
    toggleButton.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 3h18v18H3zM9 3v18"/>
      </svg>
    `;
    toggleButton.style.position = 'fixed';
    toggleButton.style.bottom = '20px';
    toggleButton.style.left = '20px';
    toggleButton.style.width = '48px';
    toggleButton.style.height = '48px';
    toggleButton.style.borderRadius = '50%';
    toggleButton.style.backgroundColor = '#2196F3';
    toggleButton.style.boxShadow = '0 2px 10px rgba(0, 0, 0, 0.2)';
    toggleButton.style.border = 'none';
    toggleButton.style.cursor = 'pointer';
    toggleButton.style.zIndex = '998';
    toggleButton.style.display = 'flex';
    toggleButton.style.alignItems = 'center';
    toggleButton.style.justifyContent = 'center';
    toggleButton.style.padding = '0';
    toggleButton.style.transition = 'transform 0.2s ease, background-color 0.2s ease';
    
    // Add hover effect
    toggleButton.addEventListener('mouseover', () => {
      toggleButton.style.transform = 'rotate(90deg) scale(1.1)';
      toggleButton.style.backgroundColor = '#42a5f5';
    });
    
    toggleButton.addEventListener('mouseout', () => {
      toggleButton.style.transform = 'rotate(0deg) scale(1)';
      toggleButton.style.backgroundColor = '#2196F3';
    });
    
    // Create sidebar content with tabs
    leftSidebar.innerHTML = `
      <div class="sidebar-header">
        <h2>dingplanPM</h2>
        <button id="close-projects-sidebar" class="close-sidebar-btn">&times;</button>
      </div>
      
      <!-- Auth container -->
      <div id="auth-container" class="auth-container"></div>
      
      <div class="sidebar-tabs">
        <div id="projects-tab" class="sidebar-tab active" data-tab="projects">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
            <polyline points="13 2 13 9 20 9"/>
          </svg>
          Projects
        </div>
        <div id="backups-tab" class="sidebar-tab" data-tab="backups">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Backups
        </div>
      </div>
      
      <div id="projects-content" class="tab-content active">
        <div class="project-controls compact">
          <div class="current-project">
            <div class="section-header">
              <h3>Current Project</h3>
            </div>
            <input type="text" id="project-name" placeholder="Project Name" />
            <textarea id="project-description" placeholder="Project Description (optional)" rows="2"></textarea>
          
            <div class="project-visibility">
              <label class="toggle-container">
                <input type="checkbox" id="project-public-toggle">
                <span class="toggle-slider"></span>
                <span class="toggle-label">Public Project</span>
              </label>
              <div class="help-text">Public projects can be viewed by anyone with the link</div>
            </div>
          
            <div id="project-link-container" class="project-link" style="display: none;">
              <input type="text" id="project-link" readonly />
              <button id="copy-project-link" class="copy-link-btn">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                Copy
              </button>
            </div>
          </div>
          
          <div class="action-buttons">
            <button id="save-project-btn" class="primary-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                <polyline points="17 21 17 13 7 13 7 21"/>
                <polyline points="7 3 7 8 15 8"/>
              </svg>
              Save
            </button>
            <button id="new-project-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
                <polyline points="13 2 13 9 20 9"/>
              </svg>
              New
            </button>
            <button id="clear-local-data-btn" class="utility-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"/>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
              Clear Data
            </button>
          </div>
        </div>
        
        <div class="user-projects">
          <h3>Your Projects</h3>
          <div id="projects-list" class="projects-list">
            <div class="loading-projects">Loading your projects...</div>
          </div>
        </div>
      </div>
      
      <div id="backups-content" class="tab-content">
      <div class="project-backups">
          <h3>Project Backups</h3>
        <div class="backup-controls">
          <button id="create-backup-btn" class="backup-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2" ry="2"/>
              <path d="M12 8v8"/>
              <path d="M8 12h8"/>
            </svg>
            Create Backup
          </button>
          <button id="manage-backups-btn" class="backup-btn">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"/>
            </svg>
            Manage Backups
          </button>
        </div>
        <div id="backups-list" class="backups-list"></div>
      </div>
        </div>
      
      <div class="sidebar-resize-handle"></div>
    `;
    
    // Add both to the document
    document.body.appendChild(leftSidebar);
    document.body.appendChild(toggleButton);
    
    // Attach the resize handle
    leftSidebar.appendChild(resizeHandle);
    
    // Setup resize functionality
    this.setupResizeHandlers(leftSidebar, resizeHandle);
    
    // Setup event listeners for the toggle and close buttons
    toggleButton.addEventListener('click', () => {
      console.log('[ProjectManager] Toggle button clicked');
      this.toggleProjectSidebar();
    });
    
    // Store reference to the sidebar
    this.projectSidebar = leftSidebar;
    this.sidebarContainer = leftSidebar;
    
    // Initialize the auth connector to render Clerk auth UI in the sidebar
    if (typeof window !== 'undefined') {
      // Import and initialize auth connector
      import('../components/auth/AuthConnector').then(module => {
        const authConnector = module.default;
        console.log('[ProjectManager] Initializing auth connector');
        authConnector.init();
      }).catch(error => {
        console.error('[ProjectManager] Error loading auth connector:', error);
      });
    }
    
    // Set up event listeners for the close button after the sidebar is added to the DOM
    const closeBtn = document.getElementById('close-projects-sidebar');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        console.log('[ProjectManager] Close button clicked');
        this.toggleProjectSidebar(false);
      });
    }
    
    // Set up tab event listeners
    this.setupTabEventListeners();
    
    // Set up other event listeners
    this.setupEventListeners();
    
    // Add the CSS styles
    this.addStyles();
    
    // Create a loading overlay
    const loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'project-loading-overlay';
    loadingOverlay.className = 'project-loading-overlay';
    loadingOverlay.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-message">Loading project...</div>
    `;
    document.body.appendChild(loadingOverlay);
    this.loadingIndicator = loadingOverlay;

    // Add loading overlay styles
    const overlayStyle = document.createElement('style');
    overlayStyle.textContent = `
      .project-loading-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.3s ease;
      }
      
      .project-loading-overlay.visible {
        opacity: 1;
        pointer-events: auto;
      }
      
      .loading-spinner {
        width: 50px;
        height: 50px;
        border: 5px solid rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        border-top-color: #2196F3;
        animation: spin 1s ease-in-out infinite;
        margin-bottom: 20px;
      }
      
      .loading-message {
        color: white;
        font-size: 16px;
        font-weight: 500;
      }
      
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(overlayStyle);
    
    console.log('[ProjectManager] UI initialization complete');
  }

  /**
   * Setup event listeners for the sidebar tabs
   */
  private setupTabEventListeners() {
    if (!this.projectSidebar) {
      console.error('[ProjectManager] Cannot set up tab event listeners - sidebar not found');
      return;
    }
    
    // Get all tab elements
    const tabs = this.projectSidebar.querySelectorAll('.sidebar-tab');
    
    // Add click event listener to each tab
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabId = tab.getAttribute('data-tab');
        if (tabId) {
          this.switchTab(tabId as 'projects' | 'backups');
        }
      });
    });
  }
  
  /**
   * Switch between sidebar tabs
   */
  private switchTab(tab: 'projects' | 'backups') {
    this.currentSidebarView = tab;
    
    if (!this.projectSidebar) return;
    
    // Update active tab styling
    const tabs = this.projectSidebar.querySelectorAll('.sidebar-tab');
    tabs.forEach(tab => {
      tab.classList.remove('active');
    });
    
    const activeTab = this.projectSidebar.querySelector(`[data-tab="${tab}"]`);
    if (activeTab) {
      activeTab.classList.add('active');
    }
    
    // Update visible content
    const contents = this.projectSidebar.querySelectorAll('.tab-content');
    contents.forEach(content => {
      content.classList.remove('active');
    });
    
    const activeContent = this.projectSidebar.querySelector(`#${tab}-content`);
    if (activeContent) {
      activeContent.classList.add('active');
    }
    
    console.log(`[ProjectManager] Switched to ${tab} tab`);
  }

  /**
   * Set up resize functionality for the sidebar
   */
  private setupResizeHandlers(sidebar: HTMLElement, handle: HTMLElement) {
    let isResizing = false;
    let startX: number;
    let startWidth: number;
    
    handle.addEventListener('mousedown', (e) => {
      isResizing = true;
      startX = e.clientX;
      startWidth = parseInt(getComputedStyle(sidebar).width, 10);
      handle.classList.add('dragging');
      
      // Add class to body to prevent selection while resizing
      document.body.classList.add('sidebar-resizing');
    });
    
    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      
      // Calculate new width
      const newWidth = startWidth + (e.clientX - startX);
      
      // Apply min/max constraints
      const constrainedWidth = Math.max(250, Math.min(500, newWidth));
      
      // Apply new width
      sidebar.style.width = `${constrainedWidth}px`;
      
      // Update body margin
      document.body.style.marginLeft = `${constrainedWidth}px`;
    });
    
    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        handle.classList.remove('dragging');
        document.body.classList.remove('sidebar-resizing');
      }
    });
  }

  /**
   * Set up event listeners for project management actions
   */
  private setupEventListeners() {
    if (!this.projectSidebar) {
      console.error('[ProjectManager] Cannot set up event listeners - sidebar not found');
      return;
    }
    
    console.log('[ProjectManager] Setting up event listeners for sidebar elements');
    
    // Save project button
    const saveButton = this.projectSidebar.querySelector('#save-project-btn');
    console.log('[ProjectManager] Save button found:', !!saveButton);
    
    if (saveButton) {
      // Remove any existing event listeners
      saveButton.replaceWith(saveButton.cloneNode(true));
      
      // Get fresh reference to the button
      const freshSaveButton = this.projectSidebar.querySelector('#save-project-btn');
      
      if (freshSaveButton) {
        console.log('[ProjectManager] Adding click event listener to save button');
        
        freshSaveButton.addEventListener('click', (e) => {
          e.preventDefault();
          console.log('[ProjectManager] Save button clicked');
          this.saveProjectToServer().then(success => {
            console.log('[ProjectManager] Save project result:', success);
          }).catch(err => {
            console.error('[ProjectManager] Error in save button click handler:', err);
          });
        });
      }
    } else {
      console.error('[ProjectManager] Save button not found in sidebar');
    }
    
    // New project button
    const newButton = this.projectSidebar.querySelector('#new-project-btn');
    if (newButton) {
      newButton.addEventListener('click', () => {
        this.createNewProject();
      });
    }
    
    // Project visibility toggle
    const publicToggle = this.projectSidebar.querySelector('#project-public-toggle') as HTMLInputElement;
    if (publicToggle) {
      publicToggle.addEventListener('change', () => {
        this.isPublic = publicToggle.checked;
        
        // Toggle the visibility of the link section
        const projectLinkContainer = this.projectSidebar?.querySelector('#project-link-container') as HTMLElement;
        if (projectLinkContainer) {
          projectLinkContainer.style.display = this.isPublic ? 'flex' : 'none';
        }
      });
    }
    
    // Copy link button
    const copyLinkButton = this.projectSidebar.querySelector('#copy-project-link');
    if (copyLinkButton) {
      copyLinkButton.addEventListener('click', () => {
        const linkInput = this.projectSidebar?.querySelector('#project-link') as HTMLInputElement;
        if (linkInput) {
          linkInput.select();
          document.execCommand('copy');
          this.showNotification('Project link copied to clipboard', 'success');
        }
      });
    }
    
    // Set up keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + S to save project
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault(); // Prevent browser save dialog
        if (this.projectSidebar && window.getComputedStyle(this.projectSidebar).transform !== 'translateX(-300px)') {
          this.saveProjectToServer();
        }
      }
      
      // Ctrl/Cmd + P to toggle projects panel
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault(); // Prevent browser print dialog
        this.toggleProjectSidebar();
      }
    });

    // Setup backup buttons
    const createBackupBtn = this.projectSidebar.querySelector('#create-backup-btn');
    if (createBackupBtn) {
      createBackupBtn.addEventListener('click', () => {
        this.createBackupWithPrompt();
      });
    }

    const manageBackupsBtn = this.projectSidebar.querySelector('#manage-backups-btn');
    if (manageBackupsBtn) {
      manageBackupsBtn.addEventListener('click', () => {
        this.showBackupManager();
      });
    }
    
    // Setup clear local data button
    const clearLocalDataBtn = this.projectSidebar.querySelector('#clear-local-data-btn');
    if (clearLocalDataBtn) {
      clearLocalDataBtn.addEventListener('click', () => {
          this.clearLocalDataAndReload();
      });
    }
  }
  
  /**
   * Clears all local data and reloads the page
   */
  private clearLocalDataAndReload() {
    const confirmed = confirm(
      'Are you sure you want to clear all local data? ' +
      'This will remove all local projects, backups, and settings. ' +
      'This action cannot be undone.'
    );
    
    if (confirmed) {
      console.log('[ProjectManager] Clearing all local data');
      
      // Use the new utility function to clear all app data
      import('../utils/localStorage').then(({ clearAllAppData }) => {
        clearAllAppData();
      
      // Show notification
        this.showNotification('All local data cleared. Reloading page...');
      
        // Reload the page after a brief delay
      setTimeout(() => {
        window.location.href = window.location.pathname;
      }, 1500);
      });
    } else {
      console.log('[ProjectManager] Clear operation cancelled by user');
    }
  }

  /**
   * Toggle the project sidebar visibility
   */
  toggleProjectSidebar(show?: boolean) {
    if (!this.projectSidebar) return;
    
    const currentTransform = this.projectSidebar.style.transform;
    let isVisible = currentTransform === 'translateX(0px)' || currentTransform === 'translateX(0)';
    
    // If explicit show/hide is requested, use that instead
    if (show !== undefined) {
      isVisible = !show; // We'll flip this below
    }
    
    // Get current sidebar width
    const sidebarWidth = parseInt(this.projectSidebar.style.width || '300', 10);
    
    // Toggle visibility
    if (isVisible) {
      this.projectSidebar.style.transform = 'translateX(-' + sidebarWidth + 'px)';
      document.body.style.marginLeft = '0';
    } else {
      this.projectSidebar.style.transform = 'translateX(0)';
      document.body.style.marginLeft = sidebarWidth + 'px';
      
      // When showing sidebar, populate project fields with current values
      const nameInput = this.projectSidebar.querySelector('#project-name') as HTMLInputElement;
      const descInput = this.projectSidebar.querySelector('#project-description') as HTMLTextAreaElement;
      const publicToggle = this.projectSidebar.querySelector('#project-public-toggle') as HTMLInputElement;
      
      if (nameInput) nameInput.value = this.projectName;
      if (descInput) descInput.value = this.projectDescription;
      if (publicToggle) publicToggle.checked = this.isPublic;
      
      // Update the project link section visibility
      const projectLinkContainer = this.projectSidebar.querySelector('#project-link-container') as HTMLElement;
      if (projectLinkContainer) {
        projectLinkContainer.style.display = this.isPublic && this._currentProjectId ? 'flex' : 'none';
        
        // Update the project link if it's public
        if (this.isPublic && this._currentProjectId) {
          this.updateProjectLink();
        }
      }
      
      // Switch to the projects tab by default when opening
      this.switchTab('projects');
      
      // Load projects list
        this.loadUserProjects();
      }
    
    console.log(`[ProjectManager] Project sidebar ${isVisible ? 'hidden' : 'shown'}`);
  }

  /**
   * Open the projects panel
   */
  openProjectsPanel() {
    this.toggleProjectSidebar(true);
  }

  /**
   * Add required styles for the project manager
   */
  private addStyles() {
    // Add styles for the sidebar
    const style = document.createElement('style');
    style.textContent = `
      .left-sidebar {
        overscroll-behavior: contain;
        z-index: 9999 !important;
        width: 300px; /* Make the sidebar slightly narrower */
      }
      
      .sidebar-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 15px;
        border-bottom: 1px solid #eee;
      }
      
      .sidebar-header h2 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
      }
      
      .close-sidebar-btn {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        opacity: 0.7;
        transition: opacity 0.2s;
      }
      
      .close-sidebar-btn:hover {
        opacity: 1;
      }
      
      .project-controls {
        padding: 15px;
        border-bottom: 1px solid #eee;
        overflow-y: auto;
      }
      
      .project-controls.compact {
        padding: 10px;
      }
      
      .current-project input,
      .current-project textarea,
      .project-tags input {
        width: 100%;
        padding: 6px 10px;
        margin-bottom: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-size: 14px;
      }
      
      .current-project textarea {
        resize: vertical;
        min-height: 40px;
        max-height: 100px;
      }
      
      .section-header {
        margin-bottom: 5px;
      }
      
      .section-header h3 {
        margin: 0 0 8px 0;
        font-size: 15px;
        font-weight: 500;
      }
      
      .project-visibility {
        margin: 10px 0;
      }
      
      .toggle-container {
        display: flex;
        align-items: center;
        cursor: pointer;
      }
      
      .toggle-slider {
        position: relative;
        display: inline-block;
        width: 36px;
        height: 18px;
        background-color: #ccc;
        border-radius: 10px;
        margin-right: 8px;
        transition: background-color 0.2s;
      }
      
      .toggle-slider:before {
        position: absolute;
        content: "";
        height: 14px;
        width: 14px;
        left: 2px;
        bottom: 2px;
        background-color: white;
        border-radius: 50%;
        transition: transform 0.2s;
      }
      
      input[type="checkbox"]:checked + .toggle-slider {
        background-color: #2196F3;
      }
      
      input[type="checkbox"]:checked + .toggle-slider:before {
        transform: translateX(18px);
      }
      
      input[type="checkbox"] {
        display: none;
      }
      
      .toggle-label {
        font-size: 14px;
      }
      
      .help-text {
        font-size: 12px;
        color: #777;
        margin-top: 5px;
      }
      
      .action-buttons {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 10px 0;
      }
      
      .action-buttons button {
        flex: 1 0 auto;
        padding: 6px 8px;
        font-size: 13px;
        min-width: 0;
        white-space: nowrap;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
      }
      
      .action-buttons svg {
        width: 14px;
        height: 14px;
      }
      
      .action-buttons .utility-btn {
        flex: 1;
        background-color: #f8f8f8;
        color: #e74c3c;
        border: 1px solid #ddd;
      }
      
      .project-link {
        display: flex;
        margin-top: 10px;
      }
      
      .project-link input {
        flex: 1;
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
        margin: 0;
      }
      
      .copy-link-btn {
        padding: 8px 12px;
        background-color: #f0f0f0;
        border: 1px solid #ddd;
        border-left: none;
        border-top-right-radius: 4px;
        border-bottom-right-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 5px;
      }
      
      .copy-link-btn:hover {
        background-color: #e0e0e0;
      }
      
      .project-utilities {
        margin-top: 15px;
      }
      
      .utility-btn {
        width: 100%;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: #f5f5f5;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        transition: background-color 0.2s;
      }
      
      .utility-btn:hover {
        background: #e5e5e5;
      }
      
      .primary-btn {
        background-color: #2196F3;
        color: white;
        border: 1px solid #1976D2;
      }
      
      .primary-btn:hover {
        background-color: #1976D2;
      }
      
      .user-projects {
        padding: 10px 15px;
      }
      
      .user-projects h3 {
        margin: 0 0 10px 0;
        font-size: 15px;
        font-weight: 500;
      }
      
      .projects-list {
        max-height: calc(100vh - 450px);
        overflow-y: auto;
      }
      
      .project-item {
        padding: 8px 10px;
        border: 1px solid #ddd;
        border-radius: 4px;
        margin-bottom: 8px;
        cursor: pointer;
        transition: background-color 0.2s;
      }
      
      .project-item:hover {
        background-color: #f5f5f5;
      }
      
      .project-item.active {
        border-color: #2196F3;
        background-color: #e3f2fd;
      }
      
      .project-item-title {
        font-weight: 600;
        margin-bottom: 5px;
      }
      
      .project-item-meta {
        font-size: 12px;
        color: #777;
        display: flex;
        justify-content: space-between;
      }
      
      .project-item-actions {
        display: flex;
        gap: 5px;
        margin-top: 8px;
      }
      
      .project-item-actions button {
        padding: 3px 8px;
        font-size: 12px;
        border: none;
        background: #f0f0f0;
        border-radius: 3px;
        cursor: pointer;
      }
      
      .project-item-actions button:hover {
        background: #e0e0e0;
      }
      
      .loading-projects {
        padding: 20px;
        text-align: center;
        color: #777;
      }
      
      .projects-sidebar-toggle {
        transform-origin: center;
      }
      
      .projects-sidebar-toggle:hover {
        transform: scale(1.05);
        background-color: #1976D2;
      }
      
      .projects-sidebar-toggle:active {
        transform: scale(0.95);
      }
      
      /* Override any fixed positioning that might interfere */
      #projects-sidebar {
        pointer-events: auto !important;
      }
      
      /* Ensure the sidebar appears above other elements */
      body .left-sidebar {
        z-index: 9999 !important;
      }

      .project-backups {
        padding: 15px;
        border-top: 1px solid #eee;
        border-bottom: 1px solid #eee;
      }

      .project-backups h3 {
        margin: 0 0 10px 0;
        font-size: 16px;
        font-weight: 600;
      }

      .backup-controls {
        display: flex;
        gap: 10px;
        margin-bottom: 10px;
      }

      .backup-btn {
        flex: 1;
        padding: 8px;
        border: 1px solid #ddd;
        border-radius: 4px;
        background: #f5f5f5;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        transition: background-color 0.2s;
        font-size: 13px;
      }

      .backup-btn:hover {
        background: #e5e5e5;
      }

      .backups-list {
        max-height: 200px;
        overflow-y: auto;
        margin-top: 10px;
      }

      .backup-item {
        padding: 8px 10px;
        border-radius: 4px;
        border: 1px solid #eee;
        margin-bottom: 8px;
        cursor: pointer;
        transition: all 0.2s;
      }

      .backup-item:hover {
        background-color: #f5f5f5;
      }

      .backup-item-title {
        font-weight: 500;
        font-size: 13px;
        margin-bottom: 3px;
      }

      .backup-item-date {
        font-size: 11px;
        color: #777;
      }

      .backup-item-actions {
        display: flex;
        gap: 5px;
        margin-top: 5px;
      }

      .backup-item-actions button {
        padding: 2px 6px;
        font-size: 11px;
        border: none;
        background: #f0f0f0;
        border-radius: 3px;
        cursor: pointer;
      }

      .backup-item-actions button:hover {
        background: #e0e0e0;
      }

      .backup-dialog {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 20px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 10001;
        min-width: 400px;
        max-width: 90%;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
      }

      .backup-dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }

      .backup-dialog-title {
        font-size: 18px;
        font-weight: 600;
        margin: 0;
      }

      .backup-dialog-close {
        background: none;
        border: none;
        font-size: 22px;
        cursor: pointer;
        opacity: 0.7;
        padding: 0;
      }

      .backup-dialog-content {
        flex: 1;
        overflow-y: auto;
      }

      .backup-dialog-footer {
        margin-top: 15px;
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      .backup-dialog-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
      }

      .sidebar-content {
        flex-grow: 1;
        overflow-y: auto;
        overflow-x: hidden;
        padding: 0 16px;
      }
    `;
    document.head.appendChild(style);

    // Add to the CSS styles section

    const projectManagerStyles = document.createElement('style');
    projectManagerStyles.textContent = `
      /* Existing styles */
      
      /* Auth container styles */
      .auth-container {
        width: 100%;
        border-bottom: 1px solid #eee;
      }
      
      .auth-container h3 {
        margin-top: 0;
        margin-bottom: 8px;
        font-size: 16px;
        color: #333;
      }
      
      .auth-container p {
        color: #666;
        font-size: 14px;
        margin-bottom: 0;
      }
    `;
    document.head.appendChild(projectManagerStyles);
  }

  /**
   * Load user projects from the server
   */
  async loadUserProjects() {
    const projectsList = document.getElementById('projects-list');
    if (!projectsList) return;
    
    projectsList.innerHTML = '<div class="loading-projects">Loading your projects...</div>';
    
    try {
      const response = await getUserProjects();
      
      if (response.success && response.projects) {
        if (response.projects.length === 0) {
          projectsList.innerHTML = '<div class="loading-projects">You don\'t have any saved projects yet.</div>';
          return;
        }
        
        projectsList.innerHTML = '';
        
        response.projects.forEach(project => {
          const projectItem = document.createElement('div');
          projectItem.className = 'project-item';
          projectItem.innerHTML = `
            <h4>${project.name}</h4>
            <div class="project-meta">
              Last updated: ${new Date(project.updatedAt as Date).toLocaleDateString()}
              ${project.isPublic ? ' • <span style="color: #2196F3;">Public</span>' : ''}
            </div>
            ${project.description ? `<div class="project-description">${project.description}</div>` : ''}
            <div class="project-actions">
              <button class="load-project" data-id="${project.id}">Load</button>
              <button class="share-project" data-id="${project.id}" ${!project.isPublic ? 'style="display:none;"' : ''}>Share</button>
              <button class="delete-project" data-id="${project.id}">Delete</button>
            </div>
          `;
          
          projectsList.appendChild(projectItem);
          
          // Add event listeners
          const loadBtn = projectItem.querySelector('.load-project');
          if (loadBtn) {
            loadBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              const projectId = (e.target as HTMLElement).dataset.id;
              if (projectId) {
                this.loadProjectFromServer(projectId);
              }
            });
          }
          
          const shareBtn = projectItem.querySelector('.share-project');
          if (shareBtn) {
            shareBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              const projectId = (e.target as HTMLElement).dataset.id;
              if (projectId) {
                this.shareProject(projectId);
              }
            });
          }
          
          const deleteBtn = projectItem.querySelector('.delete-project');
          if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              const projectId = (e.target as HTMLElement).dataset.id;
              if (projectId) {
                this.deleteProjectFromServer(projectId);
              }
            });
          }
        });
      } else {
        projectsList.innerHTML = `
          <div class="loading-projects">
            Error loading projects: ${response.error || 'Unknown error'}
          </div>
        `;
      }
    } catch (error) {
      projectsList.innerHTML = `
        <div class="loading-projects">
          Error loading projects: ${(error as Error).message || 'Unknown error'}
        </div>
      `;
    }
  }

  /**
   * Save the current project to the server based on authentication status
   */
  public async saveProjectToServer(): Promise<boolean> {
    console.log('[ProjectManager] saveProjectToServer() called');
    
    if (!this.canvas) {
      console.error('[ProjectManager] Cannot save project - canvas not available');
      this.showNotification('Cannot save project - canvas not available', 'error');
      return false;
    }
    
    console.log('[ProjectManager] Starting project save process...');
    
    try {
      // Get project data from canvas
      const canvasData = this.canvas.toJSON();
      
      if (!canvasData) {
        console.error('[ProjectManager] Canvas data is empty or invalid');
        this.showNotification('Cannot save project - no data to save', 'error');
        return false;
      }
      
      console.log('[ProjectManager] Canvas data retrieved successfully', {
        dataSize: JSON.stringify(canvasData).length,
        dataType: typeof canvasData
      });
      
      // Get project metadata from form
      const nameInput = this.projectSidebar?.querySelector('#project-name') as HTMLInputElement;
      const descInput = this.projectSidebar?.querySelector('#project-description') as HTMLTextAreaElement;
      const publicToggle = this.projectSidebar?.querySelector('#project-public-toggle') as HTMLInputElement;
      
      console.log('[ProjectManager] Form elements found:', {
        nameInput: !!nameInput,
        descInput: !!descInput,
        publicToggle: !!publicToggle
      });
      
      if (!nameInput || !descInput || !publicToggle) {
        console.error('[ProjectManager] Cannot save project - form elements not found');
        this.showNotification('Cannot save project - form elements not found', 'error');
        return false;
      }
      
      const projectName = nameInput.value.trim() || 'Untitled Project';
      const projectDescription = descInput.value.trim();
      const isPublic = publicToggle.checked;
      
      // Update project metadata
      this.projectName = projectName;
      this.projectDescription = projectDescription;
      this.isPublic = isPublic;
      
      console.log('[ProjectManager] Project metadata:', { 
        name: projectName, 
        description: projectDescription ? 'set' : 'empty', 
        isPublic 
      });
      
      // Show loading indicator
      this.showLoading('Saving project...');
      
      // Prepare the result variable
      let result;
      
      // Update existing project or create a new one
      if (this.currentProjectId) {
        console.log(`[ProjectManager] Updating existing project: ${this.currentProjectId}`);
        // Update existing project
        result = await updateProject(
          this.currentProjectId,
          canvasData,
          {
            name: projectName,
            description: projectDescription,
            isPublic: isPublic,
            tags: this.tags
          }
        );
      } else {
        console.log('[ProjectManager] Creating new project');
        // Create new project
        result = await saveProject(
          canvasData,
          {
            name: projectName,
            description: projectDescription,
            isPublic: isPublic,
            tags: this.tags
          }
        );
      }
      
      console.log('[ProjectManager] Save result:', result);
      
      // Hide loading indicator
      this.hideLoading();
      
      if (result.success) {
        if (result.projectId) {
          this.currentProjectId = result.projectId;
          
          // Update the URL with the new project ID
          this.updateUrlWithProjectId(result.projectId);
        }
        
        // Show success message
        this.showNotification('Project saved successfully!');
        
        // Update project link in UI if public
        if (this.isPublic) {
          this.updateProjectLink();
        }
        
        // Refresh projects list
        this.refreshProjectsList();
        
        console.log('[ProjectManager] Project saved successfully');
        return true;
      } else {
        throw new Error(result.error || 'Failed to save project');
      }
    } catch (error) {
      console.error('[ProjectManager] Error saving project:', error);
      this.hideLoading();
      this.showNotification(error instanceof Error ? error.message : 'Error saving project', 'error');
      return false;
    }
  }

  /**
   * Validates project metadata before saving
   * @returns {boolean} True if valid, false otherwise
   */
  private validateProjectMetadata(): boolean {
    // Project name is required
    if (!this.projectName || this.projectName.trim().length === 0) {
      this.showNotification('Project name is required', 'error');
      return false;
    }
    
    // Project name length check
    if (this.projectName.length > 100) {
      this.showNotification('Project name is too long (max 100 characters)', 'error');
      return false;
    }
    
    // Project description length check
    if (this.projectDescription && this.projectDescription.length > 1000) {
      this.showNotification('Project description is too long (max 1000 characters)', 'error');
      return false;
    }
    
    // Tags validation
    if (this.tags.length > 10) {
      this.showNotification('Too many tags (max 10)', 'error');
      return false;
    }
    
    for (const tag of this.tags) {
      if (tag.length > 30) {
        this.showNotification(`Tag "${tag}" is too long (max 30 characters)`, 'error');
        return false;
      }
    }
    
    return true;
  }

  /**
   * Validates project data before saving
   * @param projectData The project data to validate
   * @returns {boolean} True if valid, false otherwise
   */
  private validateProjectData(projectData: any): boolean {
    if (!projectData) {
      this.showNotification('Invalid project data', 'error');
      return false;
    }
    
    // Validate tasks
    if (projectData.tasks) {
      if (!Array.isArray(projectData.tasks)) {
        this.showNotification('Invalid task data format', 'error');
        return false;
      }
      
      // Check for tasks with missing required fields
      const invalidTasks = projectData.tasks.filter(task => !task.id || !task.name);
      if (invalidTasks.length > 0) {
        console.warn('[ProjectManager] Found invalid tasks:', invalidTasks);
        this.showNotification(`${invalidTasks.length} tasks have missing required fields`, 'error');
        return false;
      }
    }
    
    // Validate swimlanes
    if (projectData.swimlanes) {
      if (!Array.isArray(projectData.swimlanes)) {
        this.showNotification('Invalid swimlane data format', 'error');
        return false;
      }
      
      // Check for swimlanes with missing required fields
      const invalidSwimlanes = projectData.swimlanes.filter(lane => !lane.id || !lane.name);
      if (invalidSwimlanes.length > 0) {
        console.warn('[ProjectManager] Found invalid swimlanes:', invalidSwimlanes);
        this.showNotification(`${invalidSwimlanes.length} swimlanes have missing required fields`, 'error');
        return false;
      }
    }
    
    // Validate camera position
    if (projectData.camera) {
      if (typeof projectData.camera.x !== 'number' || 
          typeof projectData.camera.y !== 'number' || 
          typeof projectData.camera.zoom !== 'number') {
        this.showNotification('Invalid camera data', 'error');
        return false;
      }
    }
    
    return true;
  }

  /**
   * Loads a project from the server
   */
  public async loadProjectFromServer(projectId: string): Promise<boolean> {
    try {
      console.log('[ProjectManager] Loading project:', projectId);
      
      // Show loading indicator
      this.showLoading('Loading project...');
      
      // Load project from server
      const response = await loadProject(projectId);
      
      // Handle error
      if (!response.success || !response.project) {
        this.hideLoading();
        this.showNotification('Failed to load project: ' + (response.error || 'Unknown error'), 'error');
        return false;
      }
      
      // Process project data
      const projectData = response.project;
      
      // Update project metadata
      this.projectName = projectData.metadata.name || 'Untitled Project';
      this.projectDescription = projectData.metadata.description || '';
      this.isPublic = projectData.metadata.isPublic || false;
      this.tags = projectData.metadata.tags || [];
      
      // Update UI fields
      this.updateProjectFields();
      
      // Set current project ID
      this.currentProjectId = projectId;
      
      // Update URL with project ID
      this.updateUrlWithProjectId(projectId);
      
      // Clear canvas before loading new project data
      this.canvas.clearCanvas(); 
      
      // Apply project data to canvas if available
      if (projectData.projectData) {
        try {
          // Apply tasks and swimlanes
          if (projectData.projectData.tasks) {
            console.log('[ProjectManager] Loading tasks:', projectData.projectData.tasks.length);
            this.canvas.taskManager.importState(projectData.projectData);
            this.canvas.render();
          }
        } catch (dataErr) {
          console.error('[ProjectManager] Error applying project data:', dataErr);
          this.showNotification('Error applying project data', 'error');
        }
      } else {
        console.log('[ProjectManager] No project data found, starting with empty canvas');
      }
      
      // Update active project in the projects list
      this.highlightActiveProject(projectId);
      
      // Hide loading indicator
      this.hideLoading();
      
      // Show success notification
      this.showNotification(`Loaded project: ${this.projectName}`);
      
      console.log('[ProjectManager] Successfully loaded project:', projectId);
      
      // After successfully loading the project, load any project-specific localStorage state for fine-grained data
      this.canvas.loadFromLocalStorage();
      
      return true;
    } catch (error) {
      console.error('[ProjectManager] Error loading project:', error);
      this.hideLoading();
      this.showNotification('Error loading project', 'error');
      return false;
    }
  }

  /**
   * Update project fields in the UI based on the current project
   */
  private updateProjectFields(): void {
    if (!this.projectSidebar) return;
    
    const nameInput = this.projectSidebar.querySelector('#project-name') as HTMLInputElement;
    const descInput = this.projectSidebar.querySelector('#project-description') as HTMLTextAreaElement;
    const publicToggle = this.projectSidebar.querySelector('#project-public-toggle') as HTMLInputElement;
    
    if (nameInput) nameInput.value = this.projectName;
    if (descInput) descInput.value = this.projectDescription;
    if (publicToggle) publicToggle.checked = this.isPublic;
    
    // Update the project link section visibility
    const projectLinkContainer = this.projectSidebar.querySelector('#project-link-container') as HTMLElement;
    if (projectLinkContainer) {
      projectLinkContainer.style.display = this.isPublic && this._currentProjectId ? 'flex' : 'none';
      
      // Update the project link if it's public
      if (this.isPublic && this._currentProjectId) {
        this.updateProjectLink();
      }
    }
  }

  /**
   * Creates a new project
   */
  public createNewProject(): void {
    try {
      console.log('[ProjectManager] Creating new project');
      
      // Show confirmation if there are unsaved changes
      if (this.currentProjectId && this.canvas.taskManager.getAllTasks().length > 0) {
        const confirmed = confirm('Creating a new project will clear the current project. Continue?');
        if (!confirmed) return;
      }
      
      // Clear the canvas
      this.canvas.clearCanvas();
      
      // Reset project metadata
      this.currentProjectId = null;
      this.projectName = 'New Project';
      this.projectDescription = '';
      this.isPublic = false;
      this.tags = [];
      
      // Update UI fields
      this.updateProjectFields();
      
      // Clear URL project parameter
      this.updateUrlWithProjectId(null);
      
      // Show notification
      this.showNotification('Created new project');
      
      // Open sidebar if it's not already open
      this.toggleProjectSidebar(true);
      
      console.log('[ProjectManager] New project created');
    } catch (error) {
      console.error('[ProjectManager] Error creating new project:', error);
      this.showNotification('Error creating new project', 'error');
    }
  }

  /**
   * Highlight the active project in the projects list
   */
  private highlightActiveProject(projectId: string) {
    if (!this.projectSidebar) return;
    
    // Remove active class from all projects
    const projectItems = this.projectSidebar.querySelectorAll('.project-item');
    projectItems.forEach(item => {
      item.classList.remove('active');
    });
    
    // Add active class to current project
    const activeProject = this.projectSidebar.querySelector(`.project-item .load-project[data-id="${projectId}"]`);
    if (activeProject) {
      const projectItem = activeProject.closest('.project-item');
      if (projectItem) {
        projectItem.classList.add('active');
      }
    }
  }

  /**
   * Delete a project from the server
   */
  async deleteProjectFromServer(projectId: string) {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await deleteProject(projectId);
      
      if (response.success) {
        this.showNotification('Project deleted successfully');
        
        // Clear current project if it's the one that was deleted
        if (this.currentProjectId === projectId) {
          this.createNewProject();
        }
        
        // Refresh the projects list
        this.loadUserProjects();
      } else {
        this.showNotification('Error deleting project: ' + response.error, 'error');
      }
    } catch (error) {
      this.showNotification('Error deleting project: ' + (error as Error).message, 'error');
    }
  }

  /**
   * Share a project by generating a URL
   */
  shareProject(projectId: string) {
    const url = `${window.location.origin}${window.location.pathname}?project=${projectId}`;
    
    // Check if we can use the clipboard API
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
        .then(() => {
          this.showNotification('Project URL copied to clipboard');
        })
        .catch(() => {
          this.showShareUrlPrompt(url);
        });
    } else {
      this.showShareUrlPrompt(url);
    }
  }

  /**
   * Show a prompt with the share URL
   */
  private showShareUrlPrompt(url: string) {
    const input = document.createElement('input');
    input.value = url;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    document.body.removeChild(input);
    this.showNotification('Project URL copied to clipboard');
  }

  /**
   * Update the URL with project ID for sharing/bookmarking
   */
  private updateUrlWithProjectId(projectId: string | null) {
    if (projectId) {
      // Add or update project ID in URL
      const url = new URL(window.location.href);
      url.searchParams.set('project', projectId);
      window.history.replaceState({}, '', url.toString());
    } else {
      // Remove project ID from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('project');
      window.history.replaceState({}, '', url.toString());
    }
  }

  /**
   * Show a notification to the user
   */
  private showNotification(message: string, type: 'success' | 'error' | 'loading' = 'success') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'notification';
      document.body.appendChild(notification);
      
      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        #notification {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 12px 20px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          color: white;
          z-index: 9999;
          opacity: 0;
          transform: translateY(20px);
          transition: all 0.3s ease;
        }
        
        #notification.show {
          opacity: 1;
          transform: translateY(0);
        }
        
        #notification.success {
          background-color: #4CAF50;
        }
        
        #notification.error {
          background-color: #F44336;
        }
        
        #notification.loading {
          background-color: #2196F3;
        }
      `;
      document.head.appendChild(style);
    }
    
    // Set notification content and type
    notification.textContent = message;
    notification.className = type;
    
    // Show the notification
    setTimeout(() => {
      notification!.classList.add('show');
    }, 10);
    
    // Hide after a delay (except for loading type)
    if (type !== 'loading') {
      setTimeout(() => {
        notification!.classList.remove('show');
      }, 3000);
    }
    
    return notification;
  }

  /**
   * Resets the canvas state completely
   */
  private resetCanvasState() {
    if (!this.canvas) {
      console.error('[ProjectManager] Cannot reset canvas - canvas not available');
      return;
    }
    
    console.log('[ProjectManager] Starting comprehensive canvas reset');
    
    try {
      // Perform multiple clearing operations to ensure complete reset
      
      // 1. Clear all task selections first to avoid reference issues
      if (this.canvas.selectionManager) {
        console.log('[ProjectManager] Clearing selection');
        this.canvas.selectionManager.clearSelection();
      }
      
      // 2. Delete all tasks from the task manager
      if (this.canvas.taskManager) {
        const tasks = this.canvas.taskManager.getAllTasks();
        console.log(`[ProjectManager] Removing ${tasks.length} tasks from canvas`);
        
        // Clear via clearAllTasks method if available
        if (typeof this.canvas.taskManager.clearAllTasks === 'function') {
          this.canvas.taskManager.clearAllTasks();
        } else {
          // Fallback: remove each task individually
          tasks.forEach(task => {
            try {
              this.canvas.taskManager.removeTask(task.id);
            } catch (e) {
              console.warn(`[ProjectManager] Failed to remove task ${task.id}:`, e);
            }
          });
        }
        
        // Verify all tasks are removed
        const remainingTasks = this.canvas.taskManager.getAllTasks();
        if (remainingTasks.length > 0) {
          console.warn(`[ProjectManager] ${remainingTasks.length} tasks remain after clearing, forcing another clear`);
          // Use a more aggressive approach to clear tasks
          if (typeof this.canvas.taskManager.reset === 'function') {
            this.canvas.taskManager.reset();
          } else {
            remainingTasks.forEach(task => {
              try {
                this.canvas.taskManager.removeTask(task.id);
              } catch (e) {
                console.warn(`[ProjectManager] Failed to remove task ${task.id} in second attempt`);
              }
            });
          }
        }
      }
      
      // 3. Reset swimlanes if they exist
      if (this.canvas.swimlaneManager) {
        console.log('[ProjectManager] Resetting swimlanes');
        if (typeof this.canvas.swimlaneManager.resetSwimlanes === 'function') {
          this.canvas.swimlaneManager.resetSwimlanes();
        } else if (typeof this.canvas.swimlaneManager.clearSwimlanes === 'function') {
          this.canvas.swimlaneManager.clearSwimlanes();
        } else if (this.canvas.taskManager && this.canvas.taskManager.swimlanes) {
          // Fallback for direct swimlane access
          this.canvas.taskManager.swimlanes = [{
            id: 'default',
            name: 'Default',
            color: '#4285F4',
            position: 0
          }];
        } else {
          console.warn('[ProjectManager] No method available to reset swimlanes');
        }
      }
      
      // 4. Reset dependencies
      if (this.canvas.taskManager && typeof this.canvas.taskManager.clearAllDependencies === 'function') {
        console.log('[ProjectManager] Clearing all dependencies');
        this.canvas.taskManager.clearAllDependencies();
      }
      
      // 5. Reset camera position
      if (this.canvas.camera) {
        console.log('[ProjectManager] Resetting camera position');
        this.canvas.camera.x = 0;
        this.canvas.camera.y = 0;
        this.canvas.camera.zoom = 1;
      }
      
      // 6. Reset visibility settings
      console.log('[ProjectManager] Resetting visibility settings');
      if (this.canvas.taskManager && 'areDependenciesVisible' in this.canvas.taskManager) {
        this.canvas.taskManager.areDependenciesVisible = true;
      } else if ('areDependenciesVisible' in this.canvas) {
        this.canvas.areDependenciesVisible = true;
      }
      
      // 7. Reset any custom application state
      if (this.canvas.resetState && typeof this.canvas.resetState === 'function') {
        console.log('[ProjectManager] Calling canvas.resetState()');
        this.canvas.resetState();
      }
      
      // 8. Use the clearCanvas method if available as a final reset
      if (typeof this.canvas.clearCanvas === 'function') {
        console.log('[ProjectManager] Calling canvas.clearCanvas()');
        this.canvas.clearCanvas();
      }
      
      // 9. Reset any internal data structures and caches
      if (this.canvas.taskManager && typeof this.canvas.taskManager.reset === 'function') {
        console.log('[ProjectManager] Resetting task manager');
        this.canvas.taskManager.reset();
      }
      
      // 10. Reset sidebar state if needed
      if (this.canvas.sidebar) {
        console.log('[ProjectManager] Resetting sidebar state');
        this.canvas.sidebar.hide();
        if (typeof this.canvas.sidebar.resetState === 'function') {
          this.canvas.sidebar.resetState();
        }
      }
      
      // 11. Dispatch an event to notify other components of the reset
      const resetEvent = new CustomEvent('canvas-reset', { detail: { timestamp: Date.now() } });
      document.dispatchEvent(resetEvent);
      
      // 12. Force garbage collection hint (can't directly call, but can help)
      const tasks = this.canvas.taskManager.getAllTasks();
      if (tasks.length > 0) {
        console.error(`[ProjectManager] STILL HAVE ${tasks.length} TASKS AFTER RESET - THIS IS A BUG`);
      } else {
        console.log('[ProjectManager] Successfully cleared all tasks');
      }
      
      // 13. Force a re-render to update the view
      if (this.canvas.render) {
        console.log('[ProjectManager] Forcing canvas render after reset');
        this.canvas.render();
      }
      
      console.log('[ProjectManager] Canvas reset complete');
    } catch (error) {
      console.error('[ProjectManager] Error during canvas reset:', error);
    }
  }

  /**
   * Shows the loading overlay with a custom message
   */
  private showLoading(message: string = 'Loading...') {
    if (!this.loadingIndicator) return;
    
    this.isLoading = true;
    const messageEl = this.loadingIndicator.querySelector('.loading-message');
    if (messageEl) {
      messageEl.textContent = message;
    }
    
    this.loadingIndicator.classList.add('visible');
  }

  /**
   * Hides the loading overlay
   */
  private hideLoading() {
    if (!this.loadingIndicator) return;
    
    this.isLoading = false;
    this.loadingIndicator.classList.remove('visible');
  }

  /**
   * Create a backup of the current project state
   */
  public createBackup(): string {
    console.log('[ProjectManager] Creating backup...');
    
    if (!this.canvas) {
      console.error('[ProjectManager] Cannot create backup - canvas not available');
      this.showNotification('Cannot create backup - canvas not available', 'error');
      return '';
    }
    
    try {
      // Generate a unique backup ID
      const backupId = 'backup_' + Date.now();
      const currentProjectId = this.currentProjectId || 'unsaved_project';
      
      // Get the project data
      const canvasData = this.canvas.toJSON();
      if (!canvasData) {
        console.error('[ProjectManager] Cannot create backup - canvas data is empty');
        this.showNotification('Cannot create backup - no data to save', 'error');
        return '';
      }
      
      console.log('[ProjectManager] Canvas data retrieved for backup');
      
      // Backup object structure
      const backup = {
        id: backupId,
        projectId: currentProjectId,
        projectName: this.projectName || 'Untitled Project',
        timestamp: Date.now(),
        data: canvasData
      };
      
      // Get existing backups
      const backupsJson = localStorage.getItem('dingplan_backups') || '[]';
      const backups = JSON.parse(backupsJson);
      
      // Add new backup
      backups.push(backup);
      
      // Save back to localStorage
      localStorage.setItem('dingplan_backups', JSON.stringify(backups));
      
      console.log(`[ProjectManager] Backup created with ID: ${backupId}`);
      this.showNotification('Backup created successfully');
      
      // Refresh the backups list if we're viewing backups
      if (this.currentSidebarView === 'backups') {
        this.refreshBackupsList();
      }
      
      return backupId;
    } catch (error) {
      console.error('[ProjectManager] Error creating backup:', error);
      this.showNotification('Error creating backup: ' + (error as Error).message, 'error');
      return '';
    }
  }

  /**
   * Lists all available backups
   */
  public listBackups(): Array<{id: string, projectName: string, projectId: string, timestamp: number}> {
    const backups = [];
    
    // Get all localStorage keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
      
      // Only process backup items
        if (key && key.startsWith('backup-')) {
          try {
            const backupData = JSON.parse(localStorage.getItem(key) || '{}');
          
          // Only include if it has the minimum required data
          if (backupData && backupData.timestamp) {
            backups.push({
              id: key,
              projectName: backupData.projectName || 'Unnamed Project',
              projectId: backupData.projectId || 'unknown',
              timestamp: backupData.timestamp
            });
          }
          } catch (e) {
          console.error(`[ProjectManager] Error parsing backup: ${key}`, e);
          }
        }
      }
      
    // Sort backups by timestamp (newest first)
      return backups.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Filters backups for the current project
   */
  public getCurrentProjectBackups(): Array<{id: string, projectName: string, timestamp: number}> {
    // Get all backups
    const allBackups = this.listBackups();
    
    // Filter for current project
    return allBackups.filter(backup => backup.projectId === this._currentProjectId);
  }

  /**
   * Restores the canvas state from a backup
   */
  public restoreFromBackup(backupId: string): boolean {
    try {
      // Get the backup data
      const serializedBackup = localStorage.getItem(backupId);
      if (!serializedBackup) {
        console.error(`[ProjectManager] Backup not found: ${backupId}`);
        return false;
      }
      
      // Parse the backup
      const backup = JSON.parse(serializedBackup);
      
      // Check if this backup has the minimal required data
      if (!backup || !backup.tasks) {
        console.error(`[ProjectManager] Invalid backup data in: ${backupId}`);
        return false;
      }
      
      // Show confirmation dialog
      const confirmRestore = confirm(
        `Are you sure you want to restore this backup from ${new Date(backup.timestamp).toLocaleString()}?` +
        `\n\nThis will replace your current work with the backup data.`
      );
      
      if (!confirmRestore) {
        console.log('[ProjectManager] Backup restoration cancelled by user');
        return false;
      }
      
      // Show loading indicator
      this.showLoading('Restoring from backup...');
      
      // Update the current project ID if it's from a different project
      if (backup.projectId && backup.projectId !== this._currentProjectId) {
        this._currentProjectId = backup.projectId;
        this.updateUrlWithProjectId(this._currentProjectId);
        
        // Update project name if available
        if (backup.projectName) {
          this.projectName = backup.projectName;
          
          // Update the project name input
          const projectNameInput = document.getElementById('project-name') as HTMLInputElement;
          if (projectNameInput) {
            projectNameInput.value = this.projectName;
          }
        }
      }
      
      // Clear current canvas state
      this.canvas.clearCanvas();
      
      // Restore state from backup
      setTimeout(() => {
        try {
          // Import task manager state
          this.canvas.taskManager.importState(backup);
          
          // Restore camera position and zoom
          if (backup.camera) {
            this.canvas.camera.x = backup.camera.x || this.canvas.camera.x;
            this.canvas.camera.y = backup.camera.y || this.canvas.camera.y;
            this.canvas.camera.zoom = backup.camera.zoom || this.canvas.camera.zoom;
          }
          
          // Restore settings
          if (backup.settings) {
            this.canvas.areDependenciesVisible = 
              backup.settings.areDependenciesVisible !== undefined 
                ? backup.settings.areDependenciesVisible 
                : true;
          }
          
          // Render with restored state
            this.canvas.render();
          
          // Update UI to reflect the restored project
          if (this._currentProjectId) {
            this.updateUrlWithProjectId(this._currentProjectId);
            this.highlightActiveProject(this._currentProjectId);
          }
          
          // Hide loading indicator
          this.hideLoading();
          
          // Show success message
          this.showNotification('Backup restored successfully');
          
          console.log(`[ProjectManager] Successfully restored from backup: ${backupId}`);
          return true;
        } catch (error) {
          console.error('[ProjectManager] Error during backup restoration:', error);
          this.hideLoading();
          this.showNotification('Error restoring backup', 'error');
          return false;
        }
      }, 200);
      
      return true;
    } catch (error) {
      console.error('[ProjectManager] Error restoring from backup:', error);
      this.hideLoading();
      this.showNotification('Error restoring backup', 'error');
      return false;
    }
  }

  /**
   * Deletes a backup
   * @param backupId The ID of the backup to delete
   */
  public deleteBackup(backupId: string): boolean {
    try {
      if (!localStorage.getItem(backupId)) {
        return false;
      }
      localStorage.removeItem(backupId);
      return true;
    } catch (error) {
      console.error('[ProjectManager] Error deleting backup:', error);
      return false;
    }
  }

  /**
   * Refreshes the backups list in the sidebar
   */
  private refreshBackupsList() {
    const backupsList = document.getElementById('backups-list');
    if (!backupsList) return;
    
    const backups = this.listBackups();
    
    if (backups.length === 0) {
      backupsList.innerHTML = '<div class="no-backups">No backups available</div>';
      return;
    }
    
    backupsList.innerHTML = '';
    
    // Show only the 3 most recent backups in the sidebar
    const recentBackups = backups.slice(0, 3);
    
    recentBackups.forEach(backup => {
      const backupDate = new Date(backup.timestamp);
      const dateString = backupDate.toLocaleDateString() + ' ' + backupDate.toLocaleTimeString();
      
      const backupItem = document.createElement('div');
      backupItem.className = 'backup-item';
      backupItem.innerHTML = `
        <div class="backup-item-title">${backup.projectName}</div>
        <div class="backup-item-date">${dateString}</div>
        <div class="backup-item-actions">
          <button class="restore-backup" data-id="${backup.id}">Restore</button>
        </div>
      `;
      
      // Add restore event listener
      const restoreBtn = backupItem.querySelector('.restore-backup');
      if (restoreBtn) {
        restoreBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const backupId = (e.target as HTMLElement).dataset.id;
          if (backupId && confirm('Restore from this backup? Any unsaved changes will be lost.')) {
            this.restoreFromBackup(backupId);
          }
        });
      }
      
      backupsList.appendChild(backupItem);
    });
  }

  /**
   * Shows a prompt to create a new backup
   */
  private createBackupWithPrompt() {
    if (!this.canvas || !this.canvas.taskManager) {
      this.showNotification('Cannot create backup - canvas not available', 'error');
      return;
    }
    
    const tasks = this.canvas.taskManager.getAllTasks();
    if (tasks.length === 0 && !confirm('The project is empty. Create backup anyway?')) {
      return;
    }
    
    // Create the backup
    const backupId = this.createBackup();
    
    if (backupId) {
      this.showNotification('Backup created successfully');
      this.refreshBackupsList();
    } else {
      this.showNotification('Failed to create backup', 'error');
    }
  }

  /**
   * Shows the backup manager dialog
   */
  private showBackupManager() {
    // Create dialog elements
    const backdrop = document.createElement('div');
    backdrop.className = 'backup-dialog-backdrop';
    
    const dialog = document.createElement('div');
    dialog.className = 'backup-dialog';
    dialog.innerHTML = `
      <div class="backup-dialog-header">
        <h3 class="backup-dialog-title">Manage Backups</h3>
        <button class="backup-dialog-close">&times;</button>
      </div>
      <div class="backup-dialog-content">
        <div id="backup-manager-list"></div>
      </div>
      <div class="backup-dialog-footer">
        <button id="create-new-backup-btn">Create New Backup</button>
        <button id="close-backup-manager-btn">Close</button>
      </div>
    `;
    
    // Add dialog to the DOM
    document.body.appendChild(backdrop);
    document.body.appendChild(dialog);
    
    // Populate the backups list
    this.populateBackupManagerList();
    
    // Set up event listeners
    const closeButton = dialog.querySelector('.backup-dialog-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        backdrop.remove();
        dialog.remove();
      });
    }
    
    const closeBtn = dialog.querySelector('#close-backup-manager-btn');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        backdrop.remove();
        dialog.remove();
      });
    }
    
    const createNewBackupBtn = dialog.querySelector('#create-new-backup-btn');
    if (createNewBackupBtn) {
      createNewBackupBtn.addEventListener('click', () => {
        this.createBackupWithPrompt();
        this.populateBackupManagerList(); // Refresh the list
      });
    }
    
    // Close on backdrop click
    backdrop.addEventListener('click', () => {
      backdrop.remove();
      dialog.remove();
    });
    
    // Prevent closing when clicking inside the dialog
    dialog.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }

  /**
   * Populates the backup manager dialog with backups
   */
  private populateBackupManagerList() {
    const backupsList = document.getElementById('backup-manager-list');
    if (!backupsList) return;
    
    const backups = this.listBackups();
    
    if (backups.length === 0) {
      backupsList.innerHTML = '<div class="no-backups">No backups available</div>';
      return;
    }
    
    backupsList.innerHTML = '';
    
    backups.forEach(backup => {
      const backupDate = new Date(backup.timestamp);
      const dateString = backupDate.toLocaleDateString() + ' ' + backupDate.toLocaleTimeString();
      
      const backupItem = document.createElement('div');
      backupItem.className = 'backup-item';
      backupItem.innerHTML = `
        <div class="backup-item-title">${backup.projectName}</div>
        <div class="backup-item-date">${dateString}</div>
        <div class="backup-item-actions">
          <button class="restore-backup" data-id="${backup.id}">Restore</button>
          <button class="delete-backup" data-id="${backup.id}">Delete</button>
        </div>
      `;
      
      // Add event listeners
      const restoreBtn = backupItem.querySelector('.restore-backup');
      if (restoreBtn) {
        restoreBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const backupId = (e.target as HTMLElement).dataset.id;
          if (backupId && confirm('Restore from this backup? Any unsaved changes will be lost.')) {
            this.restoreFromBackup(backupId);
            // Close the dialog
            const backdrop = document.querySelector('.backup-dialog-backdrop');
            const dialog = document.querySelector('.backup-dialog');
            if (backdrop) backdrop.remove();
            if (dialog) dialog.remove();
          }
        });
      }
      
      const deleteBtn = backupItem.querySelector('.delete-backup');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const backupId = (e.target as HTMLElement).dataset.id;
          if (backupId && confirm('Delete this backup? This action cannot be undone.')) {
            if (this.deleteBackup(backupId)) {
              backupItem.remove();
              this.showNotification('Backup deleted');
              this.refreshBackupsList();
              
              // Check if list is empty
              if (backupsList.children.length === 0) {
                backupsList.innerHTML = '<div class="no-backups">No backups available</div>';
              }
            } else {
              this.showNotification('Failed to delete backup', 'error');
            }
          }
        });
      }
      
      backupsList.appendChild(backupItem);
    });
  }

  /**
   * Starts the auto-backup timer
   * @param interval Optional interval in milliseconds (default: 5 minutes)
   */
  public startAutoBackup(interval?: number) {
    // Clear any existing timer
    this.stopAutoBackup();
    
    // Set interval if provided
    if (interval && interval > 0) {
      this.autoBackupInterval = interval;
    }
    
    console.log(`[ProjectManager] Starting auto-backup timer with interval ${this.autoBackupInterval}ms`);
    
    // Start new timer
    this.autoBackupTimer = window.setInterval(() => {
      // Only create a backup if there are tasks
      const tasks = this.canvas?.taskManager?.getAllTasks() || [];
      if (tasks.length > 0) {
        console.log('[ProjectManager] Creating automatic backup');
        const backupId = this.createBackup();
        if (backupId) {
          console.log(`[ProjectManager] Auto-backup created with ID: ${backupId}`);
          // Update the sidebar list without notification
          this.refreshBackupsList();
          
          // Limit the number of auto-backups to 10
          this.limitAutoBackups(10);
        }
      }
    }, this.autoBackupInterval);
  }

  /**
   * Stops the auto-backup timer
   */
  public stopAutoBackup() {
    if (this.autoBackupTimer !== null) {
      window.clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = null;
      console.log('[ProjectManager] Auto-backup timer stopped');
    }
  }

  /**
   * Limits the number of auto-backups to keep
   * @param maxAutoBackups Maximum number of auto-backups to keep
   */
  private limitAutoBackups(maxAutoBackups: number) {
    const backups = this.listBackups();
    if (backups.length <= maxAutoBackups) return;
    
    // Sort by timestamp, oldest first
    const sortedBackups = backups.sort((a, b) => a.timestamp - b.timestamp);
    
    // Remove oldest backups until we're at the limit
    const toRemove = sortedBackups.length - maxAutoBackups;
    for (let i = 0; i < toRemove; i++) {
      this.deleteBackup(sortedBackups[i].id);
      console.log(`[ProjectManager] Auto-deleted old backup: ${sortedBackups[i].id}`);
    }
  }

  /**
   * Refresh the list of user projects
   */
  private refreshProjectsList(): void {
    if (this.isInitialized) {
      this.loadUserProjects();
    }
  }

  /**
   * Update the project link in the UI
   */
  private updateProjectLink() {
    if (!this._currentProjectId || !this.isPublic) return;
    
    const linkInput = this.projectSidebar?.querySelector('#project-link') as HTMLInputElement;
    if (linkInput) {
      const baseUrl = window.location.origin + window.location.pathname;
      const projectUrl = `${baseUrl}?project=${this._currentProjectId}`;
      linkInput.value = projectUrl;
    }
  }

  /**
   * Debug function to fix saving issues - add to DOM directly
   */
  private fixSaving() {
    console.log('[ProjectManager] Setting up emergency save button...');
    
    // Create an emergency save button
    const emergencySaveBtn = document.createElement('button');
    emergencySaveBtn.id = 'emergency-save-btn';
    emergencySaveBtn.textContent = 'Emergency Save';
    emergencySaveBtn.style.position = 'fixed';
    emergencySaveBtn.style.bottom = '20px';
    emergencySaveBtn.style.right = '20px';
    emergencySaveBtn.style.zIndex = '9999';
    emergencySaveBtn.style.padding = '10px 15px';
    emergencySaveBtn.style.backgroundColor = '#ff5555';
    emergencySaveBtn.style.color = 'white';
    emergencySaveBtn.style.border = 'none';
    emergencySaveBtn.style.borderRadius = '4px';
    emergencySaveBtn.style.cursor = 'pointer';
    
    // Add click handler
    emergencySaveBtn.addEventListener('click', async () => {
      console.log('[Emergency Save] Button clicked');
      
      if (!this.canvas) {
        alert('Canvas not available');
        return;
      }
      
      try {
        // Get project data from canvas
        const canvasData = this.canvas.toJSON();
        if (!canvasData) {
          alert('Failed to get canvas data');
          return;
        }
        
        // Create minimal project data
        const projectName = prompt('Enter project name:', 'Emergency Save') || 'Emergency Save';
        
        // Show alert
        alert('Attempting emergency save for project: ' + projectName);
        
        // Save directly using the project service
        const result = await saveProject(
          canvasData,
          {
            name: projectName,
            description: 'Emergency saved project',
            isPublic: true
          }
        );
        
        if (result.success && result.projectId) {
          this.currentProjectId = result.projectId;
          alert('Project saved successfully with ID: ' + result.projectId);
          
          // Update URL with project ID
          this.updateUrlWithProjectId(result.projectId);
          
          // Refresh project list
          this.refreshProjectsList();
        } else {
          alert('Failed to save project: ' + (result.error || 'Unknown error'));
        }
      } catch (error) {
        alert('Error during emergency save: ' + (error instanceof Error ? error.message : String(error)));
        console.error('[Emergency Save] Error:', error);
      }
    });
    
    // Add to DOM
    document.body.appendChild(emergencySaveBtn);
    console.log('[ProjectManager] Emergency save button added to DOM');
  }
} 

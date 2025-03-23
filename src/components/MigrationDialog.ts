/**
 * Migration Dialog Component
 * Provides UI for migrating data from localStorage to MongoDB
 */

import { migrateLocalProjectsToMongoDB, isMigrationCompleted } from '../services/migrationService';

export class MigrationDialog {
  private container: HTMLElement | null = null;
  private isShown = false;
  private parentElement: HTMLElement | null = null;
  
  constructor() {
    // Check if we need to show the migration dialog
    this.checkAndShowMigration();
  }
  
  /**
   * Checks if there are projects in localStorage and if migration is needed
   */
  private checkAndShowMigration(): void {
    // Skip if migration is already completed
    if (isMigrationCompleted()) {
      console.log('[MigrationDialog] Migration already completed, skipping dialog');
      return;
    }
    
    // Check if there are any projects in localStorage
    try {
      const projectsJson = localStorage.getItem('dingplan_projects');
      let hasProjects = false;
      
      if (projectsJson) {
        const projects = JSON.parse(projectsJson);
        if (Array.isArray(projects) && projects.length > 0) {
          hasProjects = true;
        }
      }
      
      // Also check for individual project data
      if (!hasProjects) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key?.startsWith('dingplan_state_')) {
            hasProjects = true;
            break;
          }
        }
      }
      
      if (hasProjects) {
        console.log('[MigrationDialog] Found projects in localStorage, showing migration dialog');
        // Delay showing the dialog to ensure the page has loaded
        setTimeout(() => this.show(), 1000);
      } else {
        console.log('[MigrationDialog] No projects found in localStorage, skipping migration dialog');
      }
    } catch (error) {
      console.error('[MigrationDialog] Error checking for projects:', error);
    }
  }
  
  /**
   * Creates the dialog DOM element
   */
  private createDialog(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'migration-dialog';
    container.style.position = 'fixed';
    container.style.top = '50%';
    container.style.left = '50%';
    container.style.transform = 'translate(-50%, -50%)';
    container.style.backgroundColor = '#fff';
    container.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.15)';
    container.style.borderRadius = '8px';
    container.style.padding = '24px';
    container.style.width = '90%';
    container.style.maxWidth = '480px';
    container.style.maxHeight = '90vh';
    container.style.overflow = 'auto';
    container.style.zIndex = '10000';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '16px';
    
    // Add overlay
    const overlay = document.createElement('div');
    overlay.className = 'migration-overlay';
    overlay.style.position = 'fixed';
    overlay.style.top = '0';
    overlay.style.left = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.5)';
    overlay.style.zIndex = '9999';
    
    document.body.appendChild(overlay);
    
    // Title
    const title = document.createElement('h2');
    title.textContent = 'Migrate Your Projects';
    title.style.margin = '0';
    title.style.fontSize = '24px';
    title.style.color = '#333';
    container.appendChild(title);
    
    // Explanation text
    const explanation = document.createElement('p');
    explanation.innerHTML = 'We\'ve upgraded our storage system to provide better reliability and persistence. ' +
      'We need to migrate your existing projects from your browser to our database.<br><br>' +
      'This will ensure your work is safely stored and accessible from any device.';
    explanation.style.margin = '0';
    explanation.style.lineHeight = '1.5';
    explanation.style.color = '#666';
    container.appendChild(explanation);
    
    // Success message (hidden by default)
    const successMessage = document.createElement('div');
    successMessage.className = 'migration-success';
    successMessage.style.display = 'none';
    successMessage.style.backgroundColor = '#e6f7e6';
    successMessage.style.color = '#2e7d32';
    successMessage.style.padding = '12px';
    successMessage.style.borderRadius = '4px';
    successMessage.style.marginTop = '8px';
    container.appendChild(successMessage);
    
    // Error message (hidden by default)
    const errorMessage = document.createElement('div');
    errorMessage.className = 'migration-error';
    errorMessage.style.display = 'none';
    errorMessage.style.backgroundColor = '#ffebee';
    errorMessage.style.color = '#c62828';
    errorMessage.style.padding = '12px';
    errorMessage.style.borderRadius = '4px';
    errorMessage.style.marginTop = '8px';
    container.appendChild(errorMessage);
    
    // Progress container (hidden by default)
    const progressContainer = document.createElement('div');
    progressContainer.className = 'migration-progress-container';
    progressContainer.style.display = 'none';
    progressContainer.style.marginTop = '16px';
    
    const progressText = document.createElement('div');
    progressText.className = 'migration-progress-text';
    progressText.textContent = 'Migrating projects...';
    progressText.style.marginBottom = '8px';
    progressContainer.appendChild(progressText);
    
    const progressBar = document.createElement('div');
    progressBar.className = 'migration-progress-bar';
    progressBar.style.height = '6px';
    progressBar.style.width = '100%';
    progressBar.style.backgroundColor = '#e0e0e0';
    progressBar.style.borderRadius = '3px';
    progressBar.style.overflow = 'hidden';
    
    const progressIndicator = document.createElement('div');
    progressIndicator.className = 'migration-progress-indicator';
    progressIndicator.style.height = '100%';
    progressIndicator.style.width = '0%';
    progressIndicator.style.backgroundColor = '#2196f3';
    progressIndicator.style.transition = 'width 0.3s ease';
    progressBar.appendChild(progressIndicator);
    progressContainer.appendChild(progressBar);
    
    container.appendChild(progressContainer);
    
    // Button container
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'flex-end';
    buttonContainer.style.gap = '12px';
    buttonContainer.style.marginTop = '16px';
    
    // Buttons
    const skipButton = document.createElement('button');
    skipButton.textContent = 'Skip';
    skipButton.style.padding = '8px 16px';
    skipButton.style.backgroundColor = 'transparent';
    skipButton.style.border = '1px solid #ccc';
    skipButton.style.borderRadius = '4px';
    skipButton.style.cursor = 'pointer';
    skipButton.onclick = () => this.hide();
    
    const migrateButton = document.createElement('button');
    migrateButton.className = 'migrate-button';
    migrateButton.textContent = 'Migrate Projects';
    migrateButton.style.padding = '8px 16px';
    migrateButton.style.backgroundColor = '#2196f3';
    migrateButton.style.color = '#fff';
    migrateButton.style.border = 'none';
    migrateButton.style.borderRadius = '4px';
    migrateButton.style.cursor = 'pointer';
    migrateButton.onclick = async () => {
      // Show progress
      progressContainer.style.display = 'block';
      migrateButton.disabled = true;
      skipButton.disabled = true;
      
      try {
        // Start progress animation
        let progress = 0;
        const interval = setInterval(() => {
          progress += 1;
          if (progress > 95) clearInterval(interval);
          progressIndicator.style.width = `${progress}%`;
        }, 100);
        
        // Run migration
        const result = await migrateLocalProjectsToMongoDB();
        
        // Clear interval and set progress to 100%
        clearInterval(interval);
        progressIndicator.style.width = '100%';
        
        if (result.migratedCount > 0) {
          // Show success message
          successMessage.textContent = `Successfully migrated ${result.migratedCount} projects!`;
          successMessage.style.display = 'block';
          
          // Change buttons to just "Continue"
          migrateButton.textContent = 'Continue';
          migrateButton.disabled = false;
          migrateButton.onclick = () => {
            this.hide();
            // Reload the page to show the migrated projects
            window.location.reload();
          };
          skipButton.style.display = 'none';
          
          // If there were any errors, show them too
          if (result.errors.length > 0) {
            errorMessage.innerHTML = `
              <p>There were some issues with ${result.errors.length} projects:</p>
              <ul style="margin-top: 4px;">
                ${result.errors.map(err => `<li>${err}</li>`).join('')}
              </ul>
            `;
            errorMessage.style.display = 'block';
          }
        } else {
          // Show error message if no projects were migrated
          errorMessage.innerHTML = 'Failed to migrate any projects. Please try again later or contact support.';
          if (result.errors.length > 0) {
            errorMessage.innerHTML += `
              <p>Errors:</p>
              <ul style="margin-top: 4px;">
                ${result.errors.map(err => `<li>${err}</li>`).join('')}
              </ul>
            `;
          }
          errorMessage.style.display = 'block';
          
          // Re-enable buttons
          migrateButton.disabled = false;
          skipButton.disabled = false;
        }
      } catch (error: any) {
        // Show error message
        errorMessage.textContent = `Error during migration: ${error.message || 'Unknown error'}`;
        errorMessage.style.display = 'block';
        
        // Re-enable buttons
        migrateButton.disabled = false;
        skipButton.disabled = false;
      }
    };
    
    buttonContainer.appendChild(skipButton);
    buttonContainer.appendChild(migrateButton);
    container.appendChild(buttonContainer);
    
    return container;
  }
  
  /**
   * Shows the migration dialog
   */
  public show(): void {
    if (this.isShown) return;
    
    this.container = this.createDialog();
    document.body.appendChild(this.container);
    this.isShown = true;
  }
  
  /**
   * Hides the migration dialog
   */
  public hide(): void {
    if (!this.isShown || !this.container) return;
    
    document.body.removeChild(this.container);
    
    // Also remove overlay
    const overlay = document.querySelector('.migration-overlay');
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    
    this.isShown = false;
    this.container = null;
  }
} 
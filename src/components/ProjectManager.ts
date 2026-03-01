/**
 * ProjectManager.ts — Minimal localStorage project management
 */

export class ProjectManager {
  private canvas: any;
  private _currentProjectId: string | null = null;
  private projectName: string = 'My Project';

  constructor() {}

  get currentProjectId(): string | null {
    return this._currentProjectId;
  }

  set currentProjectId(id: string | null) {
    this._currentProjectId = id;
  }

  public getProjectName(): string {
    return this.projectName;
  }

  public setProjectName(name: string): void {
    this.projectName = name;
  }

  init(canvas: any) {
    this.canvas = canvas;
    // Load last project name from localStorage
    const savedName = localStorage.getItem('dingplan_current_project_name');
    if (savedName) {
      this.projectName = savedName;
    }
  }

  public saveCurrentProject(): void {
    if (this.canvas) {
      localStorage.setItem('dingplan_current_project_name', this.projectName);
      this.canvas.saveToLocalStorage();
    }
  }
}

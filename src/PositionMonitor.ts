export class PositionMonitor {
  private container: HTMLDivElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.style.position = 'fixed';
    this.container.style.top = '0';
    this.container.style.right = '0';
    this.container.style.width = '240px';
    this.container.style.height = '100vh';
    this.container.style.backgroundColor = 'rgba(255, 255, 255, 0.95)';
    this.container.style.borderLeft = '1px solid #e5e7eb';
    this.container.style.padding = '20px';
    this.container.style.fontFamily = 'Inter, system-ui, -apple-system, sans-serif';
    this.container.style.fontSize = '12px';
    this.container.style.color = '#374151';
    this.container.style.zIndex = '150';
    this.container.style.backdropFilter = 'blur(8px)';
    (this.container.style as any)['-webkit-backdrop-filter'] = 'blur(8px)';
    this.container.style.display = 'flex';
    this.container.style.flexDirection = 'column';
    this.container.style.gap = '20px';
    document.body.appendChild(this.container);

    // Add "Add Task" button
    const addTaskButton = document.createElement('button');
    addTaskButton.style.backgroundColor = '#2563eb';
    addTaskButton.style.color = '#ffffff';
    addTaskButton.style.padding = '8px 16px';
    addTaskButton.style.borderRadius = '6px';
    addTaskButton.style.border = 'none';
    addTaskButton.style.fontWeight = '600';
    addTaskButton.style.cursor = 'pointer';
    addTaskButton.style.transition = 'background-color 0.2s';
    addTaskButton.textContent = 'Add Task';
    addTaskButton.addEventListener('mouseover', () => {
      addTaskButton.style.backgroundColor = '#1d4ed8';
    });
    addTaskButton.addEventListener('mouseout', () => {
      addTaskButton.style.backgroundColor = '#2563eb';
    });
    this.container.appendChild(addTaskButton);
  }

  update(x: number, y: number, zoom: number) {
    // Create or update the position info section
    const positionInfo = document.createElement('div');
    positionInfo.style.display = 'flex';
    positionInfo.style.flexDirection = 'column';
    positionInfo.style.gap = '8px';
    positionInfo.innerHTML = `
      <div style="font-weight: 600; color: #1f2937; margin-bottom: 4px;">Position</div>
      <div style="display: flex; gap: 12px; color: #6b7280;">
        <span style="display: flex; align-items: center; gap: 4px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"></path>
            <circle cx="12" cy="10" r="3"></circle>
          </svg>
          ${Math.round(x)}, ${Math.round(y)}
        </span>
        <span style="display: flex; align-items: center; gap: 4px;">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"></path>
          </svg>
          ${zoom.toFixed(2)}x
        </span>
      </div>
    `;

    // Replace the second child (position info section)
    if (this.container.children.length > 1) {
      this.container.replaceChild(positionInfo, this.container.children[1]);
    } else {
      this.container.appendChild(positionInfo);
    }
  }

  destroy() {
    if (this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
} 
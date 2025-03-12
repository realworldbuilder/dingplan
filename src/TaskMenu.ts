import { Task } from './Task';

interface MenuPosition {
  x: number;
  y: number;
}

export class TaskMenu {
  private position: MenuPosition = { x: 0, y: 0 };
  private width: number = 200;
  private height: number = 120;
  private padding: number = 8;
  private isVisible: boolean = false;
  private task: Task | null = null;
  private editingField: string | null = null;
  private inputValue: string = '';

  show(task: Task, x: number, y: number) {
    this.task = task;
    this.position = { x, y: y - this.height - 10 }; // Position above task with small gap
    this.isVisible = true;
    this.editingField = null;
  }

  hide() {
    this.isVisible = false;
    this.task = null;
    this.editingField = null;
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.isVisible || !this.task) return;

    // Save context state
    ctx.save();

    // Reset transform for screen-space drawing
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Draw menu background with shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#e0e0e0';
    ctx.lineWidth = 1;

    // Draw rounded rectangle for menu
    const radius = 4;
    ctx.beginPath();
    ctx.moveTo(this.position.x + radius, this.position.y);
    ctx.lineTo(this.position.x + this.width - radius, this.position.y);
    ctx.quadraticCurveTo(this.position.x + this.width, this.position.y, this.position.x + this.width, this.position.y + radius);
    ctx.lineTo(this.position.x + this.width, this.position.y + this.height - radius);
    ctx.quadraticCurveTo(this.position.x + this.width, this.position.y + this.height, this.position.x + this.width - radius, this.position.y + this.height);
    ctx.lineTo(this.position.x + radius, this.position.y + this.height);
    ctx.quadraticCurveTo(this.position.x, this.position.y + this.height, this.position.x, this.position.y + this.height - radius);
    ctx.lineTo(this.position.x, this.position.y + radius);
    ctx.quadraticCurveTo(this.position.x, this.position.y, this.position.x + radius, this.position.y);
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.stroke();

    // Draw small triangle pointer
    ctx.beginPath();
    ctx.moveTo(this.position.x + this.width / 2 - 8, this.position.y + this.height);
    ctx.lineTo(this.position.x + this.width / 2 + 8, this.position.y + this.height);
    ctx.lineTo(this.position.x + this.width / 2, this.position.y + this.height + 8);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.stroke();

    // Draw menu content
    ctx.fillStyle = '#333333';
    ctx.font = '12px Arial';
    ctx.textAlign = 'left';
    
    const lineHeight = 24;
    let y = this.position.y + this.padding + 16;

    // Draw field labels and values
    this.drawField(ctx, 'Name:', this.task.name, y);
    y += lineHeight;
    this.drawField(ctx, 'Duration:', `${this.task.duration} days`, y);
    y += lineHeight;
    this.drawField(ctx, 'Crew:', `${this.task.crewSize}`, y);
    y += lineHeight;
    this.drawField(ctx, 'Start:', this.task.startDate.toLocaleDateString(), y);

    // If editing, draw the input field
    if (this.editingField) {
      this.drawInputField(ctx);
    }

    ctx.restore();
  }

  private drawField(ctx: CanvasRenderingContext2D, label: string, value: string, y: number) {
    const labelWidth = 60;
    
    // Draw label
    ctx.fillStyle = '#666666';
    ctx.fillText(label, this.position.x + this.padding, y);
    
    // Draw value or input field
    ctx.fillStyle = '#333333';
    if (this.editingField === label) {
      // Draw input background
      ctx.fillStyle = '#f5f5f5';
      ctx.fillRect(
        this.position.x + labelWidth + this.padding,
        y - 14,
        this.width - labelWidth - this.padding * 3,
        20
      );
      ctx.fillStyle = '#333333';
      ctx.fillText(this.inputValue, this.position.x + labelWidth + this.padding + 4, y);
    } else {
      ctx.fillText(value, this.position.x + labelWidth + this.padding, y);
    }
  }

  private drawInputField(ctx: CanvasRenderingContext2D) {
    // Add visual feedback for the active input field
    const y = this.position.y + this.padding + 16 + 
             (['Name:', 'Duration:', 'Crew:', 'Start:'].indexOf(this.editingField!) * 24);
    
    ctx.strokeStyle = '#2196F3';
    ctx.lineWidth = 2;
    ctx.strokeRect(
      this.position.x + 64 + this.padding,
      y - 14,
      this.width - 64 - this.padding * 3,
      20
    );
  }

  handleClick(x: number, y: number): boolean {
    if (!this.isVisible) return false;

    // Check if click is inside menu
    if (x >= this.position.x && x <= this.position.x + this.width &&
        y >= this.position.y && y <= this.position.y + this.height) {
      
      // Calculate which field was clicked
      const fieldIndex = Math.floor((y - (this.position.y + this.padding)) / 24);
      const fields = ['Name:', 'Duration:', 'Crew:', 'Start:'];
      
      if (fieldIndex >= 0 && fieldIndex < fields.length) {
        this.editingField = fields[fieldIndex];
        this.inputValue = this.getFieldValue(this.editingField);
      }
      
      return true;
    }

    return false;
  }

  private getFieldValue(field: string): string {
    if (!this.task) return '';
    
    switch (field) {
      case 'Name:': return this.task.name;
      case 'Duration:': return this.task.duration.toString();
      case 'Crew:': return this.task.crewSize.toString();
      case 'Start:': return this.task.startDate.toLocaleDateString();
      default: return '';
    }
  }

  handleKeyDown(e: KeyboardEvent) {
    if (!this.editingField || !this.task) return;

    if (e.key === 'Enter') {
      // Apply the change
      this.applyEdit();
      this.editingField = null;
    } else if (e.key === 'Escape') {
      this.editingField = null;
    } else if (e.key === 'Backspace') {
      this.inputValue = this.inputValue.slice(0, -1);
    } else if (e.key.length === 1) {
      // Only allow appropriate characters based on field type
      if (this.editingField === 'Name:' || 
          (this.editingField === 'Duration:' && /^\d$/.test(e.key)) ||
          (this.editingField === 'Crew:' && /^\d$/.test(e.key))) {
        this.inputValue += e.key;
      }
    }
  }

  private applyEdit() {
    if (!this.task || !this.editingField) return;

    switch (this.editingField) {
      case 'Name:':
        this.task.name = this.inputValue;
        break;
      case 'Duration:':
        const duration = parseInt(this.inputValue);
        if (!isNaN(duration) && duration >= 1) {
          this.task.duration = duration;
        }
        break;
      case 'Crew:':
        const crew = parseInt(this.inputValue);
        if (!isNaN(crew) && crew > 0) {
          this.task.crewSize = crew;
        }
        break;
    }
  }
} 
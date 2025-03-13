export class Camera {
  x: number = 0;
  y: number = 0;
  zoom: number = 1;
  onchange?: () => void;

  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  transform(ctx: CanvasRenderingContext2D) {
    ctx.setTransform(
      this.zoom, // horizontal scaling
      0,         // horizontal skewing
      0,         // vertical skewing
      this.zoom, // vertical scaling
      -this.x * this.zoom + this.width / 2,  // horizontal translation
      -this.y * this.zoom + this.height / 2   // vertical translation
    );
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.width / 2) / this.zoom + this.x,
      y: (screenY - this.height / 2) / this.zoom + this.y
    };
  }

  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: (worldX - this.x) * this.zoom + this.width / 2,
      y: (worldY - this.y) * this.zoom + this.height / 2
    };
  }

  projection(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.onchange?.();
  }
} 
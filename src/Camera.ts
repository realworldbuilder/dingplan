export class Camera {
  x: number = 0;
  y: number = 0;
  zoom: number = 1;
  onchange?: () => void;

  // Track bounds and limits
  minZoom: number = 0.05; // Allow zooming out further for longer timelines
  maxZoom: number = 5;
  minX: number = -Infinity;
  maxX: number = Infinity;
  minY: number = -Infinity;
  maxY: number = Infinity;

  // For smooth transitions
  targetX: number = 0;
  targetY: number = 0;
  targetZoom: number = 1;
  transitionSpeed: number = 0.1;
  isTransitioning: boolean = false;

  private width: number;
  private height: number;
  private lastTransform: { x: number, y: number, zoom: number } = { x: 0, y: 0, zoom: 1 };

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.targetX = this.x;
    this.targetY = this.y;
    this.targetZoom = this.zoom;
  }

  /**
   * Apply camera transform to the canvas context
   */
  transform(ctx: CanvasRenderingContext2D) {
    // Cache transform to avoid unnecessary calculations
    if (this.lastTransform.x !== this.x || 
        this.lastTransform.y !== this.y || 
        this.lastTransform.zoom !== this.zoom) {
      
      // Apply transform with optimized calculations
      ctx.setTransform(
        this.zoom, // horizontal scaling
        0,         // horizontal skewing
        0,         // vertical skewing
        this.zoom, // vertical scaling
        Math.round(-this.x * this.zoom + this.width / 2),  // horizontal translation (rounded for crisp rendering)
        Math.round(-this.y * this.zoom + this.height / 2)   // vertical translation (rounded for crisp rendering)
      );
      
      // Update cached transform
      this.lastTransform = { x: this.x, y: this.y, zoom: this.zoom };
    }
  }

  /**
   * Convert screen coordinates to world coordinates
   */
  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    return {
      x: (screenX - this.width / 2) / this.zoom + this.x,
      y: (screenY - this.height / 2) / this.zoom + this.y
    };
  }

  /**
   * Convert world coordinates to screen coordinates
   */
  worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: (worldX - this.x) * this.zoom + this.width / 2,
      y: (worldY - this.y) * this.zoom + this.height / 2
    };
  }

  /**
   * Update the canvas dimensions
   */
  projection(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.onchange?.();
  }
  
  /**
   * Set camera bounds
   */
  setBounds(minX: number, maxX: number, minY: number, maxY: number) {
    this.minX = minX;
    this.maxX = maxX;
    this.minY = minY;
    this.maxY = maxY;
    
    // Apply bounds immediately
    this.x = Math.max(this.minX, Math.min(this.maxX, this.x));
    this.y = Math.max(this.minY, Math.min(this.maxY, this.y));
    this.targetX = this.x;
    this.targetY = this.y;
  }
  
  /**
   * Move camera to specific position with animation
   */
  moveTo(x: number, y: number, zoom?: number) {
    this.targetX = Math.max(this.minX, Math.min(this.maxX, x));
    this.targetY = Math.max(this.minY, Math.min(this.maxY, y));
    
    if (zoom !== undefined) {
      this.targetZoom = Math.max(this.minZoom, Math.min(this.maxZoom, zoom));
    }
    
    this.isTransitioning = true;
  }
  
  /**
   * Update camera position based on target (for smooth transitions)
   * Returns true if still transitioning
   */
  update(): boolean {
    if (!this.isTransitioning) return false;
    
    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dz = this.targetZoom - this.zoom;
    
    // Check if close enough to target
    if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1 && Math.abs(dz) < 0.001) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.zoom = this.targetZoom;
      this.isTransitioning = false;
      this.onchange?.();
      return false;
    }
    
    // Move camera closer to target
    this.x += dx * this.transitionSpeed;
    this.y += dy * this.transitionSpeed;
    this.zoom += dz * this.transitionSpeed;
    
    // Enforce bounds
    this.x = Math.max(this.minX, Math.min(this.maxX, this.x));
    this.y = Math.max(this.minY, Math.min(this.maxY, this.y));
    this.zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoom));
    
    this.onchange?.();
    return true;
  }
  
  /**
   * Check if given point is visible in the current viewport
   */
  isPointVisible(worldX: number, worldY: number, padding: number = 0): boolean {
    const screenPos = this.worldToScreen(worldX, worldY);
    return screenPos.x >= -padding && 
           screenPos.x <= this.width + padding && 
           screenPos.y >= -padding && 
           screenPos.y <= this.height + padding;
  }
} 
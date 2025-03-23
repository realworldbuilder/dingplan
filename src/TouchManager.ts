import { Canvas } from './Canvas';
import { Logger } from './utils/logger';

/**
 * TouchManager handles touch interactions for mobile devices
 * Translates touch events into the equivalent mouse/wheel events
 */
export class TouchManager {
  private canvas: HTMLCanvasElement;
  private canvasApp: Canvas;
  
  // Single touch tracking (for panning)
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private lastTouchX: number = 0;
  private lastTouchY: number = 0;
  private isTouching: boolean = false;
  
  // Multi-touch tracking (for pinch zoom)
  private initialDistance: number = 0;
  private isPinching: boolean = false;
  private lastPinchDistance: number = 0;
  
  // Momentum tracking
  private velocityX: number = 0;
  private velocityY: number = 0;
  private lastMoveTime: number = 0;
  
  constructor(canvas: HTMLCanvasElement, canvasApp: Canvas) {
    this.canvas = canvas;
    this.canvasApp = canvasApp;
    this.initTouchEvents();
    
    Logger.log('TouchManager initialized for mobile touch support');
  }
  
  /**
   * Initialize touch event listeners
   */
  private initTouchEvents(): void {
    this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this), { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this), { passive: false });
    this.canvas.addEventListener('touchcancel', this.handleTouchEnd.bind(this), { passive: false });
  }
  
  /**
   * Handle the start of a touch
   */
  private handleTouchStart(e: TouchEvent): void {
    e.preventDefault(); // Prevent default browser behavior
    
    if (e.touches.length === 1) {
      // Single touch - track for panning
      this.isTouching = true;
      this.isPinching = false;
      
      const touch = e.touches[0];
      this.touchStartX = touch.clientX;
      this.touchStartY = touch.clientY;
      this.lastTouchX = touch.clientX;
      this.lastTouchY = touch.clientY;
      this.lastMoveTime = Date.now();
      
      // Simulate mousedown
      const mouseEvent = new MouseEvent('mousedown', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true,
        cancelable: true,
        view: window
      });
      this.canvas.dispatchEvent(mouseEvent);
      
    } else if (e.touches.length === 2) {
      // Two touches - initiate pinch zoom
      this.isPinching = true;
      this.isTouching = false;
      
      // Calculate initial distance between touch points
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      this.initialDistance = this.getTouchDistance(touch1, touch2);
      this.lastPinchDistance = this.initialDistance;
    }
  }
  
  /**
   * Handle touch movement
   */
  private handleTouchMove(e: TouchEvent): void {
    e.preventDefault(); // Prevent default browser behavior like scrolling
    
    const currentTime = Date.now();
    const timeDelta = currentTime - this.lastMoveTime;
    
    if (e.touches.length === 1 && this.isTouching) {
      // Single touch - handle panning
      const touch = e.touches[0];
      
      // Calculate movement delta
      const deltaX = touch.clientX - this.lastTouchX;
      const deltaY = touch.clientY - this.lastTouchY;
      
      // Update velocity for momentum
      if (timeDelta > 0) {
        this.velocityX = deltaX / timeDelta;
        this.velocityY = deltaY / timeDelta;
      }
      
      // Simulate mousemove
      const mouseEvent = new MouseEvent('mousemove', {
        clientX: touch.clientX,
        clientY: touch.clientY,
        bubbles: true,
        cancelable: true,
        view: window
      });
      this.canvas.dispatchEvent(mouseEvent);
      
      // Update last position
      this.lastTouchX = touch.clientX;
      this.lastTouchY = touch.clientY;
      this.lastMoveTime = currentTime;
      
    } else if (e.touches.length === 2 && this.isPinching) {
      // Two touches - handle pinch zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDistance = this.getTouchDistance(touch1, touch2);
      
      // Calculate pinch center point
      const centerX = (touch1.clientX + touch2.clientX) / 2;
      const centerY = (touch1.clientY + touch2.clientY) / 2;
      
      // Calculate zoom factor
      const distanceRatio = currentDistance / this.lastPinchDistance;
      const zoomFactor = distanceRatio > 1 ? 1.05 : 0.95; // Smooth the zoom
      
      // Simulate wheel event for zoom
      const wheelEvent = new WheelEvent('wheel', {
        clientX: centerX,
        clientY: centerY,
        deltaY: distanceRatio > 1 ? -10 : 10, // Negative for zoom in, positive for zoom out
        bubbles: true,
        cancelable: true,
        view: window
      });
      this.canvas.dispatchEvent(wheelEvent);
      
      this.lastPinchDistance = currentDistance;
    }
  }
  
  /**
   * Handle the end of a touch
   */
  private handleTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    
    if (this.isTouching) {
      // Simulate mouseup
      const mouseEvent = new MouseEvent('mouseup', {
        bubbles: true,
        cancelable: true,
        view: window
      });
      this.canvas.dispatchEvent(mouseEvent);
      
      // Apply momentum if there's velocity
      if (Math.abs(this.velocityX) > 0.1 || Math.abs(this.velocityY) > 0.1) {
        this.applyMomentum();
      }
    }
    
    // Reset touch states
    this.isTouching = false;
    this.isPinching = false;
    this.velocityX = 0;
    this.velocityY = 0;
  }
  
  /**
   * Apply momentum effect after touch end
   */
  private applyMomentum(): void {
    let velocityX = this.velocityX * 20; // Amplify for better momentum
    let velocityY = this.velocityY * 20;
    const friction = 0.95; // Friction factor (lower = more friction)
    
    // Skip momentum if velocity is too low
    if (Math.abs(velocityX) < 0.5 && Math.abs(velocityY) < 0.5) {
      return;
    }
    
    let lastTime = performance.now();
    const targetFps = 60;
    const frameTime = 1000 / targetFps;
    
    const animate = () => {
      const now = performance.now();
      const elapsed = now - lastTime;
      
      // Limit frame rate for smoother animation
      if (elapsed < frameTime) {
        requestAnimationFrame(animate);
        return;
      }
      
      // Slow down with friction
      velocityX *= friction;
      velocityY *= friction;
      
      // Move the camera
      this.canvasApp.camera.x -= velocityX;
      this.canvasApp.camera.y -= velocityY;
      
      // Only render if we moved by a significant amount
      if (Math.abs(velocityX) > 0.05 || Math.abs(velocityY) > 0.05) {
        this.canvasApp.render();
        lastTime = now;
        requestAnimationFrame(animate);
      }
    };
    
    // Start momentum animation
    requestAnimationFrame(animate);
  }
  
  /**
   * Calculate distance between two touch points
   */
  private getTouchDistance(touch1: Touch, touch2: Touch): number {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  
  /**
   * Remove all touch event listeners
   */
  public destroy(): void {
    this.canvas.removeEventListener('touchstart', this.handleTouchStart.bind(this));
    this.canvas.removeEventListener('touchmove', this.handleTouchMove.bind(this));
    this.canvas.removeEventListener('touchend', this.handleTouchEnd.bind(this));
    this.canvas.removeEventListener('touchcancel', this.handleTouchEnd.bind(this));
  }
} 
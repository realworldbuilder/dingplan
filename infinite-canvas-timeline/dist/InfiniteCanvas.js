import { Camera } from './Camera';
import { TimeAxis } from './TimeAxis';
import { TouchManager } from './TouchManager';
import { Logger } from './utils/logger';
export class InfiniteCanvas {
    constructor(config) {
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.startDate = new Date(); // Initialize startDate
        this.zoomLevel = 1;
        this.dayWidth = 30; // Width of a day in pixels
        this.touchManager = null;
        this.touchSupportEnabled = true; // Feature flag for touch support
        this.canvas = config.canvas;
        this.backgroundColor = config.backgroundColor || '#ffffff';
        this.gridColor = config.gridColor || '#e0e0e0';
        this.startDate = config.startDate || new Date();
        // Get the 2D rendering context
        const ctx = this.canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not get 2D context from canvas');
        }
        this.ctx = ctx;
        // Initialize the camera
        this.camera = new Camera(this.canvas.width, this.canvas.height);
        // Initialize the time axis
        this.timeAxis = new TimeAxis(this.startDate);
        // Initialize touch support if enabled
        if (this.touchSupportEnabled) {
            this.initTouchSupport();
        }
        // Set up event listeners
        this.setupEventListeners();
        // Initial render
        this.render();
    }
    initTouchSupport() {
        if (!this.touchManager) {
            this.touchManager = new TouchManager(this.canvas, this);
            Logger.log('Touch support enabled for mobile devices');
        }
    }
    disableTouchSupport() {
        if (this.touchManager) {
            this.touchManager.destroy();
            this.touchManager = null;
            this.touchSupportEnabled = false;
            Logger.log('Touch support disabled');
        }
    }
    enableTouchSupport() {
        this.touchSupportEnabled = true;
        this.initTouchSupport();
    }
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        window.addEventListener('mousemove', this.handleMouseMove.bind(this));
        window.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        // Listen for resize events
        window.addEventListener('resize', () => {
            this.resize(this.canvas.width, this.canvas.height);
        });
    }
    handleMouseDown(e) {
        // Only react to left mouse button
        if (e.button !== 0)
            return;
        // Prevent default behavior
        e.preventDefault();
        // Start dragging
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        // Change cursor
        this.canvas.style.cursor = 'grabbing';
    }
    handleMouseMove(e) {
        if (this.isDragging) {
            // Calculate the mouse movement
            const deltaX = e.clientX - this.lastMouseX;
            const deltaY = e.clientY - this.lastMouseY;
            // Update camera position based on mouse movement and zoom level
            this.camera.x -= deltaX / this.camera.zoom;
            this.camera.y -= deltaY / this.camera.zoom;
            // Update last position
            this.lastMouseX = e.clientX;
            this.lastMouseY = e.clientY;
            // Render the canvas with the new camera position
            this.render();
        }
    }
    handleMouseUp() {
        this.isDragging = false;
        this.canvas.style.cursor = 'default';
    }
    handleWheel(e) {
        // Prevent default scrolling behavior
        e.preventDefault();
        // Get mouse position
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        // Convert screen coordinates to world coordinates before zoom
        const worldBeforeZoom = this.camera.screenToWorld(mouseX, mouseY);
        // Adjust zoom level (faster with ctrl key)
        const zoomFactor = e.ctrlKey ? 0.1 : 0.05;
        const zoomDelta = -Math.sign(e.deltaY) * zoomFactor;
        // Apply zoom
        const newZoom = Math.max(0.1, Math.min(5, this.camera.zoom * (1 + zoomDelta)));
        this.camera.zoom = newZoom;
        // Convert the same screen position to world coordinates after zoom
        const worldAfterZoom = this.camera.screenToWorld(mouseX, mouseY);
        // Adjust camera position to keep the point under the mouse in the same position
        this.camera.x += (worldAfterZoom.x - worldBeforeZoom.x);
        this.camera.y += (worldAfterZoom.y - worldBeforeZoom.y);
        // Render with new zoom and position
        this.render();
    }
    handleKeyDown(e) {
        // Example: Reset camera position with 'r' key
        if (e.key === 'r') {
            this.camera.x = 0;
            this.camera.y = 0;
            this.camera.zoom = 1;
            this.render();
        }
    }
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.camera.projection(width, height);
        this.render();
    }
    render() {
        // Clear the canvas
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.fillStyle = this.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        // Apply camera transform
        this.camera.transform(this.ctx);
        // Draw the grid
        this.drawVerticalGrid();
        // Draw the time axis
        this.timeAxis.draw(this.ctx, {
            x: this.camera.x,
            y: this.camera.y,
            zoom: this.camera.zoom,
            width: this.canvas.width,
            height: this.canvas.height
        });
    }
    drawVerticalGrid() {
        const visibleWidth = this.canvas.width / this.camera.zoom;
        const visibleHeight = this.canvas.height / this.camera.zoom;
        // Get the leftmost visible date in the world
        const leftDate = this.timeAxis.worldToDate(this.camera.x - visibleWidth / 2);
        const rightDate = this.timeAxis.worldToDate(this.camera.x + visibleWidth / 2);
        // Round to day
        const startDate = new Date(leftDate.getFullYear(), leftDate.getMonth(), leftDate.getDate());
        // Calculate days between left and right
        const days = Math.ceil((rightDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        // Draw grid lines
        this.ctx.strokeStyle = this.gridColor;
        this.ctx.lineWidth = 1;
        for (let i = 0; i < days; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            const x = this.timeAxis.dateToWorld(date);
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, visibleHeight);
            this.ctx.stroke();
        }
    }
    worldToDate(worldX) {
        return this.timeAxis.worldToDate(worldX);
    }
    dateToWorld(date) {
        return this.timeAxis.dateToWorld(date);
    }
    // Convert screen to world coordinates
    screenToWorld(screenX, screenY) {
        return this.camera.screenToWorld(screenX, screenY);
    }
    // Convert world to screen coordinates
    worldToScreen(worldX, worldY) {
        return this.camera.worldToScreen(worldX, worldY);
    }
}

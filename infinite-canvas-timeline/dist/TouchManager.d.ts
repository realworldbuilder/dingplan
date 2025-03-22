interface ICanvasApp {
    camera: {
        x: number;
        y: number;
        zoom: number;
    };
    render: () => void;
}
/**
 * TouchManager handles touch interactions for mobile devices
 * Translates touch events into the equivalent mouse/wheel events
 */
export declare class TouchManager {
    private canvas;
    private canvasApp;
    private touchStartX;
    private touchStartY;
    private lastTouchX;
    private lastTouchY;
    private isTouching;
    private initialDistance;
    private isPinching;
    private lastPinchDistance;
    private velocityX;
    private velocityY;
    private lastMoveTime;
    constructor(canvas: HTMLCanvasElement, canvasApp: ICanvasApp);
    /**
     * Initialize touch event listeners
     */
    private initTouchEvents;
    /**
     * Handle the start of a touch
     */
    private handleTouchStart;
    /**
     * Handle touch movement
     */
    private handleTouchMove;
    /**
     * Handle the end of a touch
     */
    private handleTouchEnd;
    /**
     * Apply momentum effect after touch end
     */
    private applyMomentum;
    /**
     * Calculate distance between two touch points
     */
    private getTouchDistance;
    /**
     * Remove all touch event listeners
     */
    destroy(): void;
}
export {};

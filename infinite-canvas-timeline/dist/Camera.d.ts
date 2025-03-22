export declare class Camera {
    x: number;
    y: number;
    zoom: number;
    onchange?: () => void;
    private width;
    private height;
    constructor(width: number, height: number);
    transform(ctx: CanvasRenderingContext2D): void;
    screenToWorld(screenX: number, screenY: number): {
        x: number;
        y: number;
    };
    worldToScreen(worldX: number, worldY: number): {
        x: number;
        y: number;
    };
    projection(width: number, height: number): void;
}

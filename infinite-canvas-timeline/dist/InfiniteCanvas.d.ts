import { Camera } from './Camera';
import { TimeAxis } from './TimeAxis';
export interface InfiniteCanvasConfig {
    canvas: HTMLCanvasElement;
    backgroundColor?: string;
    gridColor?: string;
    startDate?: Date;
}
export declare class InfiniteCanvas {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    camera: Camera;
    isDragging: boolean;
    lastMouseX: number;
    lastMouseY: number;
    backgroundColor: string;
    gridColor: string;
    startDate: Date;
    zoomLevel: number;
    dayWidth: number;
    timeAxis: TimeAxis;
    private touchManager;
    private touchSupportEnabled;
    constructor(config: InfiniteCanvasConfig);
    private initTouchSupport;
    disableTouchSupport(): void;
    enableTouchSupport(): void;
    private setupEventListeners;
    private handleMouseDown;
    private handleMouseMove;
    private handleMouseUp;
    private handleWheel;
    private handleKeyDown;
    resize(width: number, height: number): void;
    render(): void;
    private drawVerticalGrid;
    worldToDate(worldX: number): Date;
    dateToWorld(date: Date): number;
    screenToWorld(screenX: number, screenY: number): {
        x: number;
        y: number;
    };
    worldToScreen(worldX: number, worldY: number): {
        x: number;
        y: number;
    };
}

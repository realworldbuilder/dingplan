export interface TimeScale {
    unit: 'hour' | 'day' | 'week' | 'month' | 'year';
    pixelsPerUnit: number;
    format: (date: Date) => string;
}
export declare class TimeAxis {
    private startDate;
    private pixelsPerDay;
    private readonly headerHeight;
    private today;
    constructor(startDate?: Date);
    getTodayPosition(): number;
    isToday(date: Date): boolean;
    worldToDate(worldX: number): Date;
    dateToWorld(date: Date): number;
    getHeaderHeight(): number;
    private getTimeScale;
    private isWeekend;
    private drawWeekendShading;
    draw(ctx: CanvasRenderingContext2D, camera: {
        x: number;
        y: number;
        zoom: number;
        width: number;
        height: number;
    }): void;
    private roundToUnit;
    private advanceByUnit;
}

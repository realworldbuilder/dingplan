export class Camera {
    constructor(width, height) {
        this.x = 0;
        this.y = 0;
        this.zoom = 1;
        this.width = width;
        this.height = height;
    }
    transform(ctx) {
        ctx.setTransform(this.zoom, // horizontal scaling
        0, // horizontal skewing
        0, // vertical skewing
        this.zoom, // vertical scaling
        -this.x * this.zoom + this.width / 2, // horizontal translation
        -this.y * this.zoom + this.height / 2 // vertical translation
        );
    }
    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.width / 2) / this.zoom + this.x,
            y: (screenY - this.height / 2) / this.zoom + this.y
        };
    }
    worldToScreen(worldX, worldY) {
        return {
            x: (worldX - this.x) * this.zoom + this.width / 2,
            y: (worldY - this.y) * this.zoom + this.height / 2
        };
    }
    projection(width, height) {
        this.width = width;
        this.height = height;
        this.onchange?.();
    }
}

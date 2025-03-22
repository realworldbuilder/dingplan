export class TimeAxis {
    constructor(startDate = new Date()) {
        this.headerHeight = 40; // Height of the header area
        // Set today's date at midnight for consistent comparison
        this.today = new Date();
        this.today.setHours(0, 0, 0, 0);
        // Ensure start date is at midnight
        this.startDate = new Date(startDate);
        this.startDate.setHours(0, 0, 0, 0);
        this.pixelsPerDay = 50; // Default scale: 50 pixels per day
    }
    // Add method to get today's position in world coordinates
    getTodayPosition() {
        return this.dateToWorld(this.today);
    }
    // Add method to check if a date is today
    isToday(date) {
        return date.getTime() === this.today.getTime();
    }
    worldToDate(worldX) {
        const daysSinceStart = worldX / this.pixelsPerDay;
        const date = new Date(this.startDate);
        date.setDate(date.getDate() + daysSinceStart);
        return date;
    }
    dateToWorld(date) {
        const diffTime = date.getTime() - this.startDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return diffDays * this.pixelsPerDay;
    }
    getHeaderHeight() {
        return this.headerHeight;
    }
    getTimeScale(zoom) {
        const effectivePixelsPerDay = this.pixelsPerDay * zoom;
        // Always show month context at the top
        const monthScale = {
            unit: 'month',
            pixelsPerUnit: effectivePixelsPerDay * 30,
            format: (date) => date.toLocaleString('default', { month: 'long', year: 'numeric' })
        };
        // Determine the detail scale based on zoom level
        let detailScale;
        // Limit minimum scale to 1 day (when effectivePixelsPerDay >= 50)
        if (effectivePixelsPerDay >= 50) {
            detailScale = {
                unit: 'day',
                pixelsPerUnit: effectivePixelsPerDay,
                format: (date) => date.getDate().toString()
            };
        }
        else if (effectivePixelsPerDay >= 10) {
            detailScale = {
                unit: 'week',
                pixelsPerUnit: effectivePixelsPerDay * 7,
                format: (date) => 'W' + Math.ceil((date.getDate() + date.getDay()) / 7)
            };
        }
        else {
            detailScale = {
                unit: 'month',
                pixelsPerUnit: effectivePixelsPerDay * 30,
                format: (date) => date.toLocaleString('default', { month: 'short' })
            };
        }
        return detailScale;
    }
    isWeekend(date) {
        const day = date.getDay();
        return day === 0 || day === 6; // 0 is Sunday, 6 is Saturday
    }
    drawWeekendShading(ctx, camera) {
        // Calculate visible date range
        const leftDate = this.worldToDate(camera.x - camera.width / (2 * camera.zoom));
        const rightDate = this.worldToDate(camera.x + camera.width / (2 * camera.zoom));
        // Start from the beginning of the left date
        let currentDate = new Date(leftDate);
        currentDate.setHours(0, 0, 0, 0);
        // Save current transform state
        ctx.save();
        // Apply camera transform
        ctx.translate(camera.width / 2, 0);
        ctx.scale(camera.zoom, 1);
        ctx.translate(-camera.x, 0);
        // Set weekend shading style
        ctx.fillStyle = 'rgba(0, 0, 0, 0.02)'; // Very subtle gray
        while (currentDate <= rightDate) {
            if (this.isWeekend(currentDate)) {
                const x = this.dateToWorld(currentDate);
                // Draw weekend shading
                ctx.fillRect(x, this.headerHeight, this.pixelsPerDay, camera.height - this.headerHeight);
            }
            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);
        }
        ctx.restore();
    }
    draw(ctx, camera) {
        // Draw weekend shading first (behind everything)
        this.drawWeekendShading(ctx, camera);
        const detailScale = this.getTimeScale(camera.zoom);
        // Calculate visible date range
        const leftDate = this.worldToDate(camera.x - camera.width / (2 * camera.zoom));
        const rightDate = this.worldToDate(camera.x + camera.width / (2 * camera.zoom));
        // Save the current transform
        ctx.save();
        // Reset transform for fixed header
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        // Draw header background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, camera.width, this.headerHeight);
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, this.headerHeight - 1, camera.width, 1);
        // Draw detail scale
        let currentDate = this.roundToUnit(new Date(leftDate), detailScale.unit);
        let lastMonth = null;
        ctx.strokeStyle = '#e0e0e0';
        ctx.fillStyle = '#666666';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        while (currentDate <= rightDate) {
            // Convert world X to screen X
            const worldX = this.dateToWorld(currentDate);
            const screenX = (worldX - camera.x) * camera.zoom + camera.width / 2;
            // Check if month has changed
            const currentMonth = currentDate.getMonth();
            if (lastMonth !== currentMonth) {
                // Draw month label
                ctx.fillStyle = '#333333';
                ctx.font = 'bold 12px Arial';
                const monthLabel = currentDate.toLocaleString('default', { month: 'short', year: currentMonth === 0 ? 'numeric' : undefined });
                ctx.fillText(monthLabel, screenX, this.headerHeight - 25);
                lastMonth = currentMonth;
                // Draw slightly longer tick for month start
                ctx.beginPath();
                ctx.moveTo(screenX, this.headerHeight - 12);
                ctx.lineTo(screenX, this.headerHeight);
                ctx.stroke();
            }
            else {
                // Draw regular time markers
                ctx.beginPath();
                ctx.moveTo(screenX, this.headerHeight - 8);
                ctx.lineTo(screenX, this.headerHeight);
                ctx.stroke();
            }
            // Reset style for day/week labels
            ctx.fillStyle = this.isWeekend(currentDate) ? '#999999' : '#666666'; // Slightly dimmer for weekends
            ctx.font = '12px Arial';
            // Draw time label (highlight today)
            const label = detailScale.format(currentDate);
            if (this.isToday(currentDate)) {
                ctx.fillStyle = '#e74c3c'; // Red color for today
                ctx.font = 'bold 12px Arial';
            }
            ctx.fillText(label, screenX, this.headerHeight - 12);
            // Draw vertical grid line for the content area
            ctx.beginPath();
            if (this.isToday(currentDate)) {
                // Draw today line in red
                ctx.strokeStyle = '#e74c3c';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 4]); // Dotted line for today
            }
            else {
                ctx.strokeStyle = '#e0e0e0';
                ctx.lineWidth = 1;
                ctx.setLineDash([]); // Solid line for other days
            }
            ctx.moveTo(screenX, this.headerHeight);
            ctx.lineTo(screenX, camera.height);
            ctx.stroke();
            // Advance to next unit
            currentDate = this.advanceByUnit(currentDate, detailScale.unit);
        }
        ctx.restore();
    }
    roundToUnit(date, unit) {
        const result = new Date(date);
        switch (unit) {
            case 'hour':
                result.setMinutes(0, 0, 0);
                break;
            case 'day':
                result.setHours(0, 0, 0, 0);
                break;
            case 'week':
                result.setDate(result.getDate() - result.getDay());
                result.setHours(0, 0, 0, 0);
                break;
            case 'month':
                result.setDate(1);
                result.setHours(0, 0, 0, 0);
                break;
            case 'year':
                result.setMonth(0, 1);
                result.setHours(0, 0, 0, 0);
                break;
        }
        return result;
    }
    advanceByUnit(date, unit) {
        const result = new Date(date);
        switch (unit) {
            case 'hour':
                result.setHours(result.getHours() + 1);
                break;
            case 'day':
                result.setDate(result.getDate() + 1);
                break;
            case 'week':
                result.setDate(result.getDate() + 7);
                break;
            case 'month':
                result.setMonth(result.getMonth() + 1);
                break;
            case 'year':
                result.setFullYear(result.getFullYear() + 1);
                break;
        }
        return result;
    }
}

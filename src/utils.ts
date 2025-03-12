/**
 * Utility functions for the Construction Planner
 */

/**
 * Generates a random UUID v4
 * @returns A random UUID string
 */
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Formats a date to a readable string
 * @param date The date to format
 * @returns Formatted date string
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Calculates the difference in days between two dates
 * @param date1 First date
 * @param date2 Second date
 * @returns Number of days between dates
 */
export function daysBetween(date1: Date, date2: Date): number {
  const oneDay = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
  const firstDate = new Date(date1);
  const secondDate = new Date(date2);
  
  firstDate.setHours(0, 0, 0, 0);
  secondDate.setHours(0, 0, 0, 0);
  
  const diffDays = Math.round(Math.abs((firstDate.getTime() - secondDate.getTime()) / oneDay));
  return diffDays;
}

/**
 * Adds days to a date
 * @param date The starting date
 * @param days Number of days to add
 * @returns New date with days added
 */
export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Clamps a number between min and max values
 * @param num The number to clamp
 * @param min Minimum value
 * @param max Maximum value
 * @returns Clamped number
 */
export function clamp(num: number, min: number, max: number): number {
  return Math.min(Math.max(num, min), max);
}

/**
 * Determines if a point is inside a rectangle
 * @param x Point x coordinate
 * @param y Point y coordinate
 * @param rectX Rectangle x coordinate
 * @param rectY Rectangle y coordinate
 * @param rectWidth Rectangle width
 * @param rectHeight Rectangle height
 * @returns Boolean indicating if point is inside rectangle
 */
export function isPointInRect(
  x: number, 
  y: number, 
  rectX: number, 
  rectY: number, 
  rectWidth: number, 
  rectHeight: number
): boolean {
  return x >= rectX && 
         x <= rectX + rectWidth && 
         y >= rectY && 
         y <= rectY + rectHeight;
} 
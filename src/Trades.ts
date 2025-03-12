/**
 * Represents a trade in the construction process
 */
export interface Trade {
  /** Unique identifier for the trade */
  id: string;
  /** Display name of the trade */
  name: string;
  /** Hex color code used to identify and display the trade */
  color: string;
  /** Optional description of the trade */
  description?: string;
}

/**
 * Centralized management of trades in the construction planner
 */
export class Trades {
  /** Standard set of construction trades with predefined colors */
  private static readonly standardTrades: Trade[] = [
    { id: 'framing', name: 'Framing', color: '#FFB74D', description: 'Structural framing work including walls, floors, and roofs' },
    { id: 'electrical', name: 'Electrical', color: '#90CAF9', description: 'All electrical installations and wiring' },
    { id: 'plumbing', name: 'Plumbing', color: '#A5D6A7', description: 'Water supply, drainage, and fixture installation' },
    { id: 'drywall', name: 'Drywall', color: '#E8D0FF', description: 'Installation and finishing of drywall/sheetrock' },
    { id: 'hvac', name: 'HVAC', color: '#FFCC80', description: 'Heating, ventilation, and air conditioning systems' },
    { id: 'finishing', name: 'Finishing', color: '#B39DDB', description: 'Final touches, trim work, and detailing' },
    { id: 'concrete', name: 'Concrete', color: '#BDBDBD', description: 'Concrete pouring, forming, and finishing' },
    { id: 'carpentry', name: 'Carpentry', color: '#BCAAA4', description: 'Finish carpentry and custom woodwork' },
    { id: 'demolition', name: 'Demolition', color: '#EF5350', description: 'Demolition and removal of existing structures' },
    { id: 'painting', name: 'Painting', color: '#81D4FA', description: 'Painting and wall coverings' },
    { id: 'flooring', name: 'Flooring', color: '#F48FB1', description: 'Installation of all floor types' },
    { id: 'roofing', name: 'Roofing', color: '#78909C', description: 'Roof installation and repairs' }
  ];

  /**
   * Get all predefined trades
   */
  public static getAllTrades(): Trade[] {
    return [...this.standardTrades];
  }

  /**
   * Find a trade by its ID
   */
  public static getTradeById(id: string): Trade | undefined {
    return this.standardTrades.find(trade => trade.id === id);
  }

  /**
   * Find a trade by its exact color code
   */
  public static getTradeByColor(color: string): Trade | undefined {
    return this.standardTrades.find(trade => trade.color === color);
  }

  /**
   * Find a trade by name (case insensitive)
   */
  public static getTradeByName(name: string): Trade | undefined {
    return this.standardTrades.find(
      trade => trade.name.toLowerCase() === name.toLowerCase()
    );
  }

  /**
   * Get a trade based on either ID, color, or name.
   * Tries each method in order until a match is found.
   */
  public static getTrade(value: string): Trade | undefined {
    return this.getTradeById(value) || 
           this.getTradeByColor(value) || 
           this.getTradeByName(value);
  }
} 
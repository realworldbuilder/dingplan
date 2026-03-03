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
 * Centralized management of trades in DingPlan
 */
export class Trades {
  /** Standard set of construction trades with predefined colors */
  private static standardTrades: Trade[] = [
    { id: 'general', name: 'General', color: '#9E9E9E', description: 'General contractor / misc work' },
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
    { id: 'roofing', name: 'Roofing', color: '#78909C', description: 'Roof installation and repairs' },
    { id: 'fire-protection', name: 'Fire Protection', color: '#FF7043', description: 'Sprinkler and fire suppression systems' },
    { id: 'insulation', name: 'Insulation', color: '#AED581', description: 'Thermal and acoustic insulation' },
    { id: 'steel', name: 'Structural Steel', color: '#546E7A', description: 'Steel erection and connections' },
    { id: 'sitework', name: 'Sitework', color: '#8D6E63', description: 'Grading, paving, utilities' },
    { id: 'elevator', name: 'Elevator', color: '#7E57C2', description: 'Elevator installation' },
    { id: 'glazing', name: 'Glazing', color: '#4FC3F7', description: 'Windows, curtain wall, storefronts' },
    { id: 'commissioning', name: 'Commissioning', color: '#26A69A', description: 'System testing, TAB, commissioning' },
    { id: 'ceiling', name: 'Ceiling', color: '#FFF176', description: 'ACT ceiling grid and tile' }
  ];

  /** Colors for auto-generated trades */
  private static readonly extraColors = [
    '#CE93D8', '#80DEEA', '#FFAB91', '#C5E1A5', '#EF9A9A', 
    '#B0BEC5', '#FFE082', '#A1887F', '#80CBC4', '#F48FB1'
  ];

  /**
   * Get all trades (standard + custom)
   */
  public static getAllTrades(): Trade[] {
    return [...this.standardTrades];
  }

  /**
   * Add a trade if it doesn't exist. Returns the trade (existing or new).
   */
  public static getOrCreate(id: string, name?: string): Trade {
    const normalized = id.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const existing = this.getTrade(normalized) || this.getTradeByName(id);
    if (existing) return existing;
    
    const color = this.extraColors[this.standardTrades.length % this.extraColors.length];
    const displayName = name || id.split(/[-_]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const trade: Trade = { id: normalized, name: displayName, color };
    this.standardTrades.push(trade);
    return trade;
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
export interface CommodityConfig {
  id: string;
  name: string;
  category: 'Metals' | 'Agriculture' | 'Energy' | 'Vehicles' | 'Electronics' | 'Property' | 'Others';
  unit: string;
  defaultPrice: number;
  defaultMultiplier: number; // For closing bid prediction (e.g. 0.75)
}

export interface CommodityState {
  commodityId: string;
  price: number;
  multiplier: number;
  lastUpdated: string;
}

export interface PriceHistoryLog {
  id: string;
  timestamp: string;
  commodityId: string;
  commodityName: string;
  price: number;
  multiplier: number;
  updatedBy: string;
}

export const COMMODITY_DEFS: CommodityConfig[] = [
  // Metals
  { id: 'steel_iron_ferrous', name: 'Steel / Iron Scrap', category: 'Metals', unit: 'kg', defaultPrice: 38.5, defaultMultiplier: 0.82 },
  { id: 'copper', name: 'Copper Cathodes / Wire Scrap', category: 'Metals', unit: 'kg', defaultPrice: 780, defaultMultiplier: 0.82 },
  { id: 'brass', name: 'Brass Scrap', category: 'Metals', unit: 'kg', defaultPrice: 480, defaultMultiplier: 0.82 },
  { id: 'aluminium', name: 'Aluminium Scrap / Ingots', category: 'Metals', unit: 'kg', defaultPrice: 235, defaultMultiplier: 0.82 },
  { id: 'lead', name: 'Lead Scrap', category: 'Metals', unit: 'kg', defaultPrice: 185, defaultMultiplier: 0.82 },
  { id: 'zinc', name: 'Zinc Scrap', category: 'Metals', unit: 'kg', defaultPrice: 220, defaultMultiplier: 0.82 },
  { id: 'cable_wire', name: 'Cable / Wire Scrap', category: 'Metals', unit: 'kg', defaultPrice: 340, defaultMultiplier: 0.82 },
  { id: 'battery', name: 'Lead Acid Battery Scrap', category: 'Metals', unit: 'kg', defaultPrice: 120, defaultMultiplier: 0.82 },
  { id: 'gold', name: 'Gold (99.9% Purity)', category: 'Metals', unit: 'gram', defaultPrice: 7450, defaultMultiplier: 0.90 },
  { id: 'silver', name: 'Silver (99.9% Purity)', category: 'Metals', unit: 'kg', defaultPrice: 91000, defaultMultiplier: 0.90 },
  { id: 'industrial_scrap_index', name: 'Industrial Scrap Metal Index', category: 'Metals', unit: 'Ton', defaultPrice: 32000, defaultMultiplier: 0.82 },

  // Agriculture
  { id: 'wheat', name: 'Wheat (Durum Grade A)', category: 'Agriculture', unit: 'Quintal', defaultPrice: 2450, defaultMultiplier: 0.75 },
  { id: 'rice', name: 'Basmati Paddy / Rice', category: 'Agriculture', unit: 'Quintal', defaultPrice: 2200, defaultMultiplier: 0.75 },
  { id: 'maize_corn', name: 'Yellow Maize / Feed Corn', category: 'Agriculture', unit: 'Ton', defaultPrice: 21000, defaultMultiplier: 0.75 },

  // Energy
  { id: 'coal', name: 'Steam Coal (5500 GAR)', category: 'Energy', unit: 'Ton', defaultPrice: 8400, defaultMultiplier: 0.75 },
  { id: 'crude_oil', name: 'Crude Oil (WTI Index)', category: 'Energy', unit: 'Barrel', defaultPrice: 6800, defaultMultiplier: 0.75 },
  { id: 'natural_gas', name: 'Natural Gas (Henry Hub)', category: 'Energy', unit: 'MMBtu', defaultPrice: 210, defaultMultiplier: 0.75 },
  { id: 'lubricant_oil', name: 'Waste Engine Oil', category: 'Energy', unit: 'Liter', defaultPrice: 85, defaultMultiplier: 0.75 },

  // Vehicles & Heavy Machinery
  { id: 'vehicle', name: 'Commercial Vehicle / Car Resale', category: 'Vehicles', unit: 'Unit', defaultPrice: 150000, defaultMultiplier: 0.70 },
  { id: 'heavy_vehicle_machinery', name: 'Heavy Vehicle / Industrial Machinery', category: 'Vehicles', unit: 'Unit', defaultPrice: 350000, defaultMultiplier: 0.70 },
  { id: 'motorcycle', name: 'Two-Wheeler / Motorcycle', category: 'Vehicles', unit: 'Unit', defaultPrice: 45000, defaultMultiplier: 0.70 },
  { id: 'transformer', name: 'Electrical Transformer', category: 'Energy', unit: 'Unit', defaultPrice: 90000, defaultMultiplier: 0.75 },

  // Electronics / IT
  { id: 'e_waste', name: 'Refurbished IT Hardware / E-Waste', category: 'Electronics', unit: 'Unit', defaultPrice: 14500, defaultMultiplier: 0.65 },

  // Property
  { id: 'immovable_property', name: 'Immovable Property (Land/Building)', category: 'Property', unit: 'Unit', defaultPrice: 5000000, defaultMultiplier: 0.75 },

  // Others
  { id: 'sand', name: 'River Sand / Stone Mines', category: 'Others', unit: 'Ton', defaultPrice: 4500, defaultMultiplier: 0.75 },
  { id: 'default', name: 'Estimated Market Valuation', category: 'Others', unit: 'Unit', defaultPrice: 2500, defaultMultiplier: 0.75 }
];

const CURRENT_PRICES_KEY = 'lelam_current_market_prices';
const PRICE_HISTORY_KEY = 'lelam_market_price_history';

// Helper to pre-populate mock historical data (15 entries per commodity over the last 30 days)
// so the user has something nice to see and train their model on!
function generateMockHistory(currentPrices: Record<string, number>): PriceHistoryLog[] {
  const history: PriceHistoryLog[] = [];
  const now = new Date();
  
  COMMODITY_DEFS.forEach(comm => {
    const basePrice = currentPrices[comm.id] || comm.defaultPrice;
    const baseMult = comm.defaultMultiplier;
    
    // Generate 15 daily entries back in time
    for (let i = 15; i >= 1; i--) {
      const logDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000 - Math.random() * 6 * 60 * 60 * 1000);
      
      // Random walk price variation of +/- 5%
      const variation = 1 + (Math.sin(i * 0.5) * 0.04) + (Math.random() * 0.02 - 0.01);
      const priceVal = Math.round(basePrice * variation * 10) / 10;
      
      // Random walk multiplier variation +/- 2%
      const multVal = Math.round((baseMult + (Math.random() * 0.04 - 0.02)) * 1000) / 1000;
      
      history.push({
        id: `mock-${comm.id}-${i}`,
        timestamp: logDate.toISOString(),
        commodityId: comm.id,
        commodityName: comm.name,
        price: priceVal,
        multiplier: multVal,
        updatedBy: 'system_auto_mock'
      });
    }
  });
  
  // Sort history newest first
  return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

export const marketPriceService = {
  // Get list of disabled pricing commodity IDs
  getDisabledCommodityIds(): string[] {
    if (typeof window === 'undefined') return [];
    const disabledStr = localStorage.getItem('lelam_disabled_pricing_ids');
    if (!disabledStr) return [];
    try {
      return JSON.parse(disabledStr);
    } catch {
      return [];
    }
  },

  isCommodityPricingDisabled(id: string): boolean {
    return this.getDisabledCommodityIds().includes(id);
  },

  setCommodityPricingDisabled(id: string, isDisabled: boolean): void {
    if (typeof window === 'undefined') return;
    const disabledIds = this.getDisabledCommodityIds();
    let nextDisabledIds = [...disabledIds];
    if (isDisabled) {
      if (!nextDisabledIds.includes(id)) {
        nextDisabledIds.push(id);
      }
    } else {
      nextDisabledIds = nextDisabledIds.filter(x => x !== id);
    }
    localStorage.setItem('lelam_disabled_pricing_ids', JSON.stringify(nextDisabledIds));
  },

  // Get all active prices and configs
  getCommodityPrices(): (CommodityConfig & { currentPrice: number; currentMultiplier: number; lastUpdated: string; keywords?: string[]; isCustom?: boolean; isPricingDisabled?: boolean })[] {
    let baseList = [...COMMODITY_DEFS];
    if (typeof window !== 'undefined') {
      const customStr = localStorage.getItem('lelam_custom_commodities');
      if (customStr) {
        try {
          const customList = JSON.parse(customStr);
          customList.forEach((c: any) => {
            // Check if not already in baseList to avoid duplicates
            if (!baseList.some(item => item.id === c.id)) {
              baseList.push({
                ...c,
                isCustom: true
              });
            }
          });
        } catch (e) {
          console.warn('Failed to parse custom commodities:', e);
        }
      }
    }

    const disabledIds = this.getDisabledCommodityIds();

    if (typeof window === 'undefined') {
      return baseList.map(c => ({
        ...c,
        currentPrice: c.defaultPrice,
        currentMultiplier: c.defaultMultiplier,
        lastUpdated: new Date().toISOString(),
        isPricingDisabled: disabledIds.includes(c.id)
      }));
    }

    let current = localStorage.getItem(CURRENT_PRICES_KEY);
    let states: Record<string, { price: number; multiplier: number; lastUpdated: string }> = {};

    if (!current) {
      // Initialize defaults
      const initialStates: Record<string, { price: number; multiplier: number; lastUpdated: string }> = {};
      const nowStr = new Date().toISOString();
      baseList.forEach(c => {
        initialStates[c.id] = {
          price: c.defaultPrice,
          multiplier: c.defaultMultiplier,
          lastUpdated: nowStr
        };
      });
      localStorage.setItem(CURRENT_PRICES_KEY, JSON.stringify(initialStates));
      states = initialStates;
    } else {
      states = JSON.parse(current);
      // Sync any missing items from baseList to states
      let changed = false;
      baseList.forEach(c => {
        if (!states[c.id]) {
          states[c.id] = {
            price: c.defaultPrice,
            multiplier: c.defaultMultiplier,
            lastUpdated: new Date().toISOString()
          };
          changed = true;
        }
      });
      if (changed) {
        localStorage.setItem(CURRENT_PRICES_KEY, JSON.stringify(states));
      }
    }

    return baseList.map(c => {
      const state = states[c.id] || { price: c.defaultPrice, multiplier: c.defaultMultiplier, lastUpdated: new Date().toISOString() };
      return {
        ...c,
        currentPrice: state.price,
        currentMultiplier: state.multiplier,
        lastUpdated: state.lastUpdated,
        isPricingDisabled: disabledIds.includes(c.id)
      };
    });
  },

  // Helper to fetch just a single commodity price
  getCommodityPrice(id: string): number {
    const prices = this.getCommodityPrices();
    const found = prices.find(p => p.id === id);
    return found ? found.currentPrice : 0;
  },

  // Helper to fetch just a single commodity multiplier
  getCommodityMultiplier(id: string): number {
    const prices = this.getCommodityPrices();
    const found = prices.find(p => p.id === id);
    return found ? found.currentMultiplier : 0.75;
  },

  // Update price and multiplier, and log to history
  updateCommodityPrice(id: string, price: number, multiplier: number, updatedBy: string = 'Admin'): void {
    if (typeof window === 'undefined') return;

    const currentStr = localStorage.getItem(CURRENT_PRICES_KEY);
    let states: Record<string, { price: number; multiplier: number; lastUpdated: string }> = {};
    if (currentStr) {
      states = JSON.parse(currentStr);
    }

    const nowStr = new Date().toISOString();
    states[id] = {
      price,
      multiplier,
      lastUpdated: nowStr
    };
    localStorage.setItem(CURRENT_PRICES_KEY, JSON.stringify(states));

    // Append to history log
    const historyStr = localStorage.getItem(PRICE_HISTORY_KEY);
    let history: PriceHistoryLog[] = [];
    if (historyStr) {
      history = JSON.parse(historyStr);
    } else {
      // Populate mock history first so we don't start with an empty list
      const pricesMap: Record<string, number> = {};
      Object.keys(states).forEach(k => { pricesMap[k] = states[k].price; });
      history = generateMockHistory(pricesMap);
    }

    const prices = this.getCommodityPrices();
    const commDef = prices.find(c => c.id === id) || { name: 'Unknown Commodity' };

    const newLog: PriceHistoryLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: nowStr,
      commodityId: id,
      commodityName: commDef.name,
      price,
      multiplier,
      updatedBy
    };

    history.unshift(newLog); // Prepend so it is sorted newest first
    localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(history));
  },

  // Get price history logs
  getPriceHistoryLogs(): PriceHistoryLog[] {
    if (typeof window === 'undefined') return [];

    const historyStr = localStorage.getItem(PRICE_HISTORY_KEY);
    if (!historyStr) {
      // Pre-populate on first load
      const currentPrices = this.getCommodityPrices();
      const pricesMap: Record<string, number> = {};
      currentPrices.forEach(p => { pricesMap[p.id] = p.currentPrice; });
      const mockHistory = generateMockHistory(pricesMap);
      localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(mockHistory));
      return mockHistory;
    }
    return JSON.parse(historyStr);
  },

  // Add custom commodity
  addCustomCommodity(c: { name: string; category: 'Metals' | 'Agriculture' | 'Energy' | 'Vehicles' | 'Electronics' | 'Property' | 'Others'; unit: string; defaultPrice: number; defaultMultiplier: number; keywords: string[] }): void {
    if (typeof window === 'undefined') return;
    const id = c.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
    if (!id) throw new Error('Invalid commodity name.');

    const prices = this.getCommodityPrices();
    if (prices.some(item => item.id === id)) {
      throw new Error(`Commodity with name/id "${c.name}" already exists.`);
    }

    const newConfig = {
      id,
      name: c.name.trim(),
      category: c.category,
      unit: c.unit.trim(),
      defaultPrice: c.defaultPrice,
      defaultMultiplier: c.defaultMultiplier,
      keywords: c.keywords.map(k => k.trim().toLowerCase()).filter(k => k.length > 0)
    };

    const customStr = localStorage.getItem('lelam_custom_commodities');
    let customList: any[] = [];
    if (customStr) {
      try {
        customList = JSON.parse(customStr);
      } catch (e) {
        customList = [];
      }
    }

    customList.push(newConfig);
    localStorage.setItem('lelam_custom_commodities', JSON.stringify(customList));

    // Force sync the state
    this.updateCommodityPrice(id, c.defaultPrice, c.defaultMultiplier, 'Admin Init');
  },

  // Delete custom commodity
  deleteCustomCommodity(id: string): void {
    if (typeof window === 'undefined') return;
    const customStr = localStorage.getItem('lelam_custom_commodities');
    if (customStr) {
      try {
        let customList: any[] = JSON.parse(customStr);
        customList = customList.filter(item => item.id !== id);
        localStorage.setItem('lelam_custom_commodities', JSON.stringify(customList));
      } catch (e) {
        console.warn('Failed to parse or clear custom commodities:', e);
      }
    }

    // Remove from current prices state
    const currentStr = localStorage.getItem(CURRENT_PRICES_KEY);
    if (currentStr) {
      try {
        const states = JSON.parse(currentStr);
        delete states[id];
        localStorage.setItem(CURRENT_PRICES_KEY, JSON.stringify(states));
      } catch (e) {
        console.warn('Failed to clear current states for', id, e);
      }
    }

    // Remove from history logs too
    const historyStr = localStorage.getItem(PRICE_HISTORY_KEY);
    if (historyStr) {
      try {
        let history: PriceHistoryLog[] = JSON.parse(historyStr);
        history = history.filter(log => log.commodityId !== id);
        localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(history));
      } catch (e) {
        console.warn('Failed to filter history for', id, e);
      }
    }
  },

  // Import external historical logs (e.g. from file)
  importPriceHistoryLogs(logs: PriceHistoryLog[]): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PRICE_HISTORY_KEY, JSON.stringify(logs));
  },

  // Clear all history logs
  clearHistoryLogs(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(PRICE_HISTORY_KEY);
  }
};

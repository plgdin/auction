import { supabase } from '../lib/supabase';

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

export type FullCommodityConfig = CommodityConfig & { currentPrice: number; currentMultiplier: number; lastUpdated: string; keywords?: string[]; isCustom?: boolean; isPricingDisabled?: boolean };

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
  { id: 'paper_wood', name: 'Paper / Wood / Cardboard Scrap', category: 'Others', unit: 'Ton', defaultPrice: 15000, defaultMultiplier: 0.70 },
  { id: 'misc_scrap', name: 'Mixed Sweeping / Dust / Sludge', category: 'Others', unit: 'Ton', defaultPrice: 3500, defaultMultiplier: 0.50 },
  { id: 'sand', name: 'River Sand / Stone Mines', category: 'Others', unit: 'Ton', defaultPrice: 4500, defaultMultiplier: 0.75 },
  { id: 'default', name: 'Estimated Market Valuation', category: 'Others', unit: 'Unit', defaultPrice: 2500, defaultMultiplier: 0.75 }
];

// Helper to pre-populate mock historical data
function generateMockHistory(currentPrices: Record<string, number>): PriceHistoryLog[] {
  const history: PriceHistoryLog[] = [];
  const now = new Date();
  
  COMMODITY_DEFS.forEach(comm => {
    const basePrice = currentPrices[comm.id] || comm.defaultPrice;
    const baseMult = comm.defaultMultiplier;
    
    // Generate 15 daily entries back in time
    for (let i = 15; i >= 1; i--) {
      const logDate = new Date(now.getTime() - i * 24 * 60 * 60 * 1000 - Math.random() * 6 * 60 * 60 * 1000);
      
      const variation = 1 + (Math.sin(i * 0.5) * 0.04) + (Math.random() * 0.02 - 0.01);
      const priceVal = Math.round(basePrice * variation * 10) / 10;
      
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
  
  return history.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

let cachedPrices: FullCommodityConfig[] = [];
let cachedHistory: PriceHistoryLog[] = [];
let isFetched = false;

export const marketPriceService = {
  // Sync wrapper (returns cached data for valuation matching)
  getCommodityPrices(): FullCommodityConfig[] {
    if (!isFetched && typeof window !== 'undefined') {
      // Fallback to local storage or defaults if not fetched yet (prevent crashes)
      return this._getLocalCommodityPrices();
    }
    return cachedPrices.length > 0 ? cachedPrices : this._getLocalCommodityPrices();
  },

  getCommodityPrice(id: string): number {
    const prices = this.getCommodityPrices();
    const found = prices.find(p => p.id === id);
    return found ? found.currentPrice : 0;
  },

  getCommodityMultiplier(id: string): number {
    const prices = this.getCommodityPrices();
    const found = prices.find(p => p.id === id);
    return found ? found.currentMultiplier : 0.75;
  },
  
  getPriceHistoryLogs(): PriceHistoryLog[] {
    if (!isFetched && typeof window !== 'undefined') {
      return this._getLocalPriceHistoryLogs();
    }
    return cachedHistory.length > 0 ? cachedHistory : this._getLocalPriceHistoryLogs();
  },

  isCommodityPricingDisabled(id: string): boolean {
    const prices = this.getCommodityPrices();
    const found = prices.find(p => p.id === id);
    return found ? (found.isPricingDisabled || false) : false;
  },

  async setCommodityPricingDisabled(id: string, isDisabled: boolean): Promise<void> {
    await supabase.from('market_indices').update({ is_pricing_disabled: isDisabled }).eq('id', id);
    await this.fetchCommodityPrices(true);
  },

  // Async Fetcher from Supabase
  async fetchCommodityPrices(forceRefresh = false): Promise<FullCommodityConfig[]> {
    if (isFetched && !forceRefresh) return cachedPrices;
    
    try {
      const { data, error } = await supabase.from('market_indices').select('*').order('name');
      
      if (error) throw error;

      if (!data || data.length === 0) {
        // Table is empty. We will not auto-populate it here.
        // We will do it in the Admin Panel's one-time migration hook.
        cachedPrices = this._getLocalCommodityPrices();
        isFetched = true;
        return cachedPrices;
      }

      cachedPrices = data.map((row: any) => ({
        id: row.id,
        name: row.name,
        category: row.category as any,
        unit: row.unit,
        defaultPrice: Number(row.default_price),
        defaultMultiplier: Number(row.default_multiplier),
        currentPrice: Number(row.current_price),
        currentMultiplier: Number(row.current_multiplier),
        keywords: row.keywords,
        isCustom: row.is_custom,
        isPricingDisabled: row.is_pricing_disabled,
        lastUpdated: row.last_updated
      }));
      
      isFetched = true;
      return cachedPrices;
    } catch (err) {
      console.error('Failed to fetch market indices from Supabase:', err);
      // Fallback to local storage safely
      return this._getLocalCommodityPrices();
    }
  },

  // Fetch History from Supabase
  async fetchPriceHistoryLogs(): Promise<PriceHistoryLog[]> {
    try {
      const { data, error } = await supabase
        .from('market_price_history')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(1000);
        
      if (error) throw error;
      
      if (!data || data.length === 0) {
        // Fallback or generate mock
        return this._getLocalPriceHistoryLogs();
      }

      cachedHistory = data.map((row: any) => ({
        id: row.id,
        timestamp: row.timestamp,
        commodityId: row.commodity_id,
        commodityName: row.commodity_name,
        price: Number(row.price),
        multiplier: Number(row.multiplier),
        updatedBy: row.updated_by
      }));
      
      return cachedHistory;
    } catch (err) {
      console.error('Failed to fetch price history from Supabase:', err);
      return this._getLocalPriceHistoryLogs();
    }
  },

  // Update price in Supabase
  async updateCommodityPrice(id: string, price: number, multiplier: number, updatedBy: string = 'Admin'): Promise<void> {
    const config = this.getCommodityPrices().find(c => c.id === id);
    if (!config) return;

    // Update index table
    const { error: updateError } = await supabase.from('market_indices').update({
      current_price: price,
      current_multiplier: multiplier,
      last_updated: new Date().toISOString()
    }).eq('id', id);

    if (updateError) throw updateError;

    // Insert history log
    const { error: logError } = await supabase.from('market_price_history').insert({
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date().toISOString(),
      commodity_id: id,
      commodity_name: config.name,
      price: price,
      multiplier: multiplier,
      updated_by: updatedBy
    });

    if (logError) throw logError;

    // Refresh cache
    await this.fetchCommodityPrices(true);
  },

  // Add Custom Commodity to Supabase
  async addCustomCommodity(c: { name: string; category: 'Metals' | 'Agriculture' | 'Energy' | 'Vehicles' | 'Electronics' | 'Property' | 'Others'; unit: string; defaultPrice: number; defaultMultiplier: number; keywords: string[] }): Promise<void> {
    const id = c.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '_');
    if (!id) throw new Error('Invalid commodity name.');

    const prices = await this.fetchCommodityPrices();
    if (prices.some(item => item.id === id)) {
      throw new Error(`Commodity with name/id "${c.name}" already exists.`);
    }

    const { error } = await supabase.from('market_indices').insert({
      id,
      name: c.name.trim(),
      category: c.category,
      unit: c.unit.trim(),
      default_price: c.defaultPrice,
      default_multiplier: c.defaultMultiplier,
      current_price: c.defaultPrice,
      current_multiplier: c.defaultMultiplier,
      keywords: c.keywords.map(k => k.trim().toLowerCase()).filter(k => k.length > 0),
      is_custom: true,
      is_pricing_disabled: false,
      last_updated: new Date().toISOString()
    });

    if (error) throw error;

    await this.fetchCommodityPrices(true);
  },

  async deleteCustomCommodity(id: string): Promise<void> {
    const { error } = await supabase.from('market_indices').delete().eq('id', id);
    if (error) throw error;
    await this.fetchCommodityPrices(true);
  },

  async clearHistoryLogs(): Promise<void> {
    const { error } = await supabase.from('market_price_history').delete().neq('id', 'dummy');
    if (error) throw error;
  },

  // ====== LOCAL STORAGE FALLBACKS & MIGRATION HELPERS ======

  // Gets the exact data currently sitting in local storage (for the migration script)
  _getLocalCommodityPrices(): FullCommodityConfig[] {
    if (typeof window === 'undefined') return COMMODITY_DEFS.map(c => ({...c, currentPrice: c.defaultPrice, currentMultiplier: c.defaultMultiplier, lastUpdated: new Date().toISOString()}));
    
    let baseList = [...COMMODITY_DEFS];
    const customStr = localStorage.getItem('lelam_custom_commodities');
    if (customStr) {
      try {
        const customList = JSON.parse(customStr);
        customList.forEach((c: any) => {
          if (!baseList.some(item => item.id === c.id)) {
            baseList.push({ ...c, isCustom: true });
          }
        });
      } catch (e) {}
    }

    const disabledStr = localStorage.getItem('lelam_disabled_pricing_ids');
    const disabledIds = disabledStr ? JSON.parse(disabledStr) : [];

    let current = localStorage.getItem('lelam_current_market_prices');
    let states: Record<string, { price: number; multiplier: number; lastUpdated: string }> = {};
    if (current) states = JSON.parse(current);

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

  _getLocalPriceHistoryLogs(): PriceHistoryLog[] {
    if (typeof window === 'undefined') return [];
    const historyStr = localStorage.getItem('lelam_market_price_history');
    if (!historyStr) {
      const currentPrices = this._getLocalCommodityPrices();
      const pricesMap: Record<string, number> = {};
      currentPrices.forEach(p => { pricesMap[p.id] = p.currentPrice; });
      return generateMockHistory(pricesMap);
    }
    return JSON.parse(historyStr);
  }
};

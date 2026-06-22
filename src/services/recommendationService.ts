import { auctionService } from './auctionService';
import { dashboardService } from './dashboardService';
import { supabase } from '../lib/supabase';
import { estimateAuctionValues } from './publicService';

export interface UserPreference {
  categories: string[];
  locations: string[];
  maxBudget: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface RankedAuction {
  id: string;
  title: string;
  referenceNumber: string;
  startingPrice: number;
  location: string;
  category: string;
  profitability: number; // Estimated ROI % (e.g., 18.5)
  riskScore: number;     // 1 to 10 scale
  riskLevel: 'Low' | 'Medium' | 'High';
  isRecommended: boolean;
  score?: number;
  isMstc?: boolean;
}

const DEFAULT_PREFS: UserPreference = {
  categories: ['scrap & scrap material', 'plant & machinery', 'vehicles'],
  locations: ['Maharashtra', 'Delhi', 'Karnataka'],
  maxBudget: 2500000, // 25 Lakhs default
  riskLevel: 'medium'
};

export const recommendationService = {
  // --- PREFERENCES (QUESTIONNAIRE) ---
  getUserPreferences(userId: string): UserPreference | null {
    const key = `usr_prefs_${userId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  },

  saveUserPreferences(userId: string, prefs: UserPreference): void {
    const key = `usr_prefs_${userId}`;
    localStorage.setItem(key, JSON.stringify(prefs));
  },

  // --- SEARCH HISTORY LOGGING ---
  logUserSearch(userId: string, query: string): void {
    if (!query || query.trim().length < 3) return;
    const key = `usr_searches_${userId}`;
    const data = localStorage.getItem(key);
    const searches: string[] = data ? JSON.parse(data) : [];
    
    // Add if not already present, cap at 10 items
    const cleanQuery = query.trim().toLowerCase();
    if (!searches.includes(cleanQuery)) {
      searches.unshift(cleanQuery);
      if (searches.length > 10) searches.pop();
      localStorage.setItem(key, JSON.stringify(searches));
    }
  },

  getUserSearches(userId: string): string[] {
    const key = `usr_searches_${userId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  },

  // --- ANALYSIS: PROFITABILITY & RISK ASSESSMENT ---
  assessAuction(auction: any, maxBudget: number = 2500000): { profitability: number; riskScore: number; riskLevel: 'Low' | 'Medium' | 'High' } {
    const titleLower = (auction.title || '').toLowerCase();
    const descLower = (auction.description || '').toLowerCase();
    
    // 1. Calculate Profitability % (ROI)
    // Higher starting price / grade ratio or scrap category yields higher estimated margin
    let baseMargin = 12.0; // standard margin
    
    if (titleLower.includes('copper') || descLower.includes('copper')) baseMargin += 6.5;
    else if (titleLower.includes('aluminum') || titleLower.includes('aluminium')) baseMargin += 4.5;
    else if (titleLower.includes('cable') || titleLower.includes('wire')) baseMargin += 3.0;
    else if (titleLower.includes('battery') || titleLower.includes('lead')) baseMargin += 5.0;
    else if (titleLower.includes('machinery') || titleLower.includes('transformer')) baseMargin += 2.0;
    else if (titleLower.includes('vehicle') || titleLower.includes('car') || titleLower.includes('truck')) baseMargin += 3.5;

    // Simulate minor variance based on auction ID string length (deterministic random)
    const variance = (auction.id.length % 5) - 2; // -2 to +2
    const profitability = parseFloat((baseMargin + variance).toFixed(1));

    // 2. Calculate Risk Score (1 to 10)
    let riskScore = 4; // base risk
    
    // Non-inspected or salvage keyword increases risk
    if (titleLower.includes('salvage') || descLower.includes('salvage') || descLower.includes('as is where is')) {
      riskScore += 3;
    }
    // High starting price relative to user budget increases financial risk
    if (auction.starting_price > maxBudget) {
      riskScore += 2;
    }
    // E-waste or hazardous waste has environmental compliance risk
    if (titleLower.includes('e-waste') || titleLower.includes('hazardous') || titleLower.includes('battery')) {
      riskScore += 1;
    }
    // Missing documents/photo indicators
    if (!auction.terms_conditions) {
      riskScore += 1;
    }

    // Ensure range is 1-10
    riskScore = Math.max(1, Math.min(10, riskScore));
    
    let riskLevel: 'Low' | 'Medium' | 'High' = 'Medium';
    if (riskScore <= 3) riskLevel = 'Low';
    else if (riskScore >= 7) riskLevel = 'High';

    return { profitability, riskScore, riskLevel };
  },

  // --- SEARCH DYNAMIC INTEREST EXTRACTION ---
  getSearchInterests(userId: string): { categories: string[], locations: string[] } {
    const searches = this.getUserSearches(userId);
    const categories: string[] = [];
    const locations: string[] = [];

    const categoryKeywords: Record<string, string[]> = {
      'scrap & scrap material': ['scrap', 'metal', 'copper', 'aluminum', 'aluminium', 'iron', 'steel', 'brass', 'lead', 'zinc', 'cable', 'wire', 'battery', 'surplus', 'waste'],
      'plant & machinery': ['plant', 'machinery', 'machineries', 'transformer', 'turbine', 'boiler', 'generator', 'compressor', 'pump', 'engine', 'industrial', 'equipment'],
      'vehicles': ['vehicle', 'vehicles', 'car', 'truck', 'bus', 'tractor', 'vessel', 'vessels', 'tempo', 'dumper', 'tipper'],
      'real estate': ['property', 'land', 'building', 'office', 'flat', 'apartment', 'plot', 'immovable', 'estate'],
      'e-waste': ['e-waste', 'electronic', 'electronics', 'computer', 'laptop', 'monitor', 'printer', 'ups', 'server'],
      'minerals & ores': ['mineral', 'minerals', 'ore', 'ores', 'coal', 'lignite', 'bauxite', 'limestone', 'mine', 'blocks']
    };

    const locationKeywords = [
      'Delhi', 'Maharashtra', 'West Bengal', 'Tamil Nadu', 'Karnataka', 'Gujarat', 'Uttar Pradesh', 'Kerala', 'Rajasthan',
      'Mumbai', 'Kolkata', 'Chennai', 'Nagpur', 'Bangalore', 'Bengaluru', 'Pune', 'Ahmedabad', 'Hyderabad'
    ];

    searches.forEach(search => {
      const lowerSearch = search.toLowerCase();

      // Check category keywords
      Object.entries(categoryKeywords).forEach(([cat, keywords]) => {
        if (keywords.some(kw => lowerSearch.includes(kw))) {
          categories.push(cat);
        }
      });

      // Check location keywords
      locationKeywords.forEach(loc => {
        if (lowerSearch.includes(loc.toLowerCase())) {
          if (loc === 'Mumbai' || loc === 'Nagpur' || loc === 'Pune') {
            locations.push('Maharashtra');
          } else if (loc === 'Bangalore' || loc === 'Bengaluru') {
            locations.push('Karnataka');
          } else if (loc === 'Kolkata') {
            locations.push('West Bengal');
          } else if (loc === 'Chennai') {
            locations.push('Tamil Nadu');
          } else if (loc === 'Ahmedabad') {
            locations.push('Gujarat');
          } else {
            locations.push(loc);
          }
        }
      });
    });

    return {
      categories: Array.from(new Set(categories)),
      locations: Array.from(new Set(locations))
    };
  },

  // --- HYBRID RECOMMENDATION ENGINE ---
  async getAllAvailableAuctions(categories: any[]): Promise<any[]> {
    // Get all commercial auctions
    const response = await auctionService.getAuctions({ limit: 100 });
    let allAuctions: any[] = response.data || [];

    // Get active upcoming MSTC auctions
    try {
      const { data: mstcData, error } = await supabase
        .from('mstc_auctions')
        .select('*')
        .eq('asset_status', 'completed')
        .gt('closing_date', new Date().toISOString())
        .limit(100);

      if (error) throw error;

      if (mstcData && mstcData.length > 0) {
        const mappedMstc = mstcData.map((item: any) => {
          const parts = (item.category_name || '').split(' | ');
          const mainCat = parts[0]?.trim() || 'Scrap Metal';
          const subCat = parts[1]?.trim() || mainCat;
          
          const matchedCategory = categories.find((c: any) => c.name.toLowerCase() === mainCat.toLowerCase());
          const category_id = matchedCategory ? matchedCategory.id : null;

          const { preBid, totalValue } = estimateAuctionValues(item);

          return {
            ...item,
            id: item.id,
            title: `${subCat} - ${item.seller_name}`,
            description: item.raw_materials_text || '',
            starting_price: totalValue,
            reserve_price: null,
            bid_increment: 0,
            emd_amount: preBid,
            start_time: item.opening_date,
            end_time: item.closing_date,
            terms_conditions: item.raw_materials_text || '',
            status: 'active',
            reference_number: item.mstc_auction_number,
            location: item.location || 'India',
            category_id,
            category: {
              name: mainCat
            },
            is_mstc: true
          };
        });
        allAuctions = [...allAuctions, ...mappedMstc];
      }
    } catch (e) {
      console.warn('Failed to load MSTC auctions for recommendations:', e);
    }

    return allAuctions;
  },

  async getRecommendedAuctions(userId: string, limit: number = 6): Promise<any[]> {
    // 1. Fetch all categories to resolve category names from category_id
    const categories = await auctionService.getCategories();
    const categoryMap = new Map(categories.map(c => [c.id, c]));

    // 2. Get all active upcoming auctions (merged commercial and MSTC)
    const allAuctions = await this.getAllAvailableAuctions(categories);
    if (allAuctions.length === 0) return [];

    // 3. Fetch User Context
    const prefs = this.getUserPreferences(userId) || DEFAULT_PREFS;
    const searches = this.getUserSearches(userId);
    const searchInterests = this.getSearchInterests(userId);
    
    // Combine explicit preferences with implicit search interests
    const combinedCategories = Array.from(new Set([...prefs.categories, ...searchInterests.categories]));
    const combinedLocations = Array.from(new Set([...prefs.locations, ...searchInterests.locations]));

    const dbWatchlist = await auctionService.getUserWatchlistIds(userId);
    const localWatchlist = dashboardService.getInterestedAuctions(userId);
    const watchlistIds = Array.from(new Set([...dbWatchlist, ...localWatchlist]));

    // 4. Compute scores for each auction
    const scored = allAuctions.map((auction: any) => {
      // Don't recommend auctions already on the watchlist
      if (watchlistIds.includes(auction.id)) {
        return { auction, score: -1 };
      }

      let score = 0;
      const titleLower = (auction.title || '').toLowerCase();
      const descLower = (auction.description || '').toLowerCase();
      
      const catObj = auction.category_id ? categoryMap.get(auction.category_id) : null;
      const categoryName = (catObj?.name || auction.category?.name || '').toLowerCase();
      const parentCatObj = catObj?.parent_id ? categoryMap.get(catObj.parent_id) : null;
      const parentCategoryName = (parentCatObj?.name || '').toLowerCase();
      const locationName = (auction.location || '').toLowerCase();

      // A. Knowledge-Based Component (Rules matching preference questionnaire & search interests)
      // Category match
      const hasCatPref = combinedCategories.some(prefCat => {
        const pLower = prefCat.toLowerCase();
        const HOME_PAGE_CATEGORY_MAPPING: Record<string, string[]> = {
          'scrap & scrap material': ['metal', 'miscellaneous'],
          'plant & machinery': ['plant/machineries'],
          'vehicles': ['transport vehicles', 'vessels'],
          'real estate': ['immovable property'],
          'e-waste': ['electrical items', 'electronics items'],
          'minerals & ores': ['minerals', 'mine block']
        };
        const mappedNames = HOME_PAGE_CATEGORY_MAPPING[pLower] || [pLower];
        return mappedNames.some(mName => 
          categoryName.includes(mName) || 
          parentCategoryName.includes(mName) ||
          titleLower.includes(mName)
        );
      });
      if (hasCatPref) score += 45;

      // Location match
      const hasLocPref = combinedLocations.some(prefLoc => 
        locationName.includes(prefLoc.toLowerCase())
      );
      if (hasLocPref) score += 40;

      // Budget match
      if (auction.starting_price <= prefs.maxBudget) {
        score += 25;
      } else if (auction.starting_price > prefs.maxBudget * 1.5) {
        score -= 40; // Penalize heavy budget overshoot
      }

      // Risk preference match
      const { riskLevel } = this.assessAuction(auction, prefs.maxBudget);
      if (riskLevel.toLowerCase() === prefs.riskLevel) {
        score += 20;
      }

      // B. Content-Based Component (Watchlist and searches)
      // Search matching: check if auction contains logged search keywords
      if (searches.length > 0) {
        searches.forEach(searchQuery => {
          if (titleLower.includes(searchQuery) || descLower.includes(searchQuery)) {
            score += 25; // boost search match score
          }
        });
      }

      // Watchlist overlap (Find category/locations of what they already watchlisted)
      const watchlistAuctions = allAuctions.filter(a => watchlistIds.includes(a.id));
      if (watchlistAuctions.length > 0) {
        watchlistAuctions.forEach(watched => {
          if (watched.category_id === auction.category_id) score += 15;
          if (watched.location === auction.location) score += 10;
        });
      }

      // C. Collaborative Component (Simulated Global Popularity / Active Bidding)
      if (auction.bids && auction.bids.length > 0) {
        score += Math.min(auction.bids.length * 5, 20); // Popularity boost
      }

      return { auction, score };
    });

    // 5. Filter, sort and return top items. 
    // We allow score >= 0 so we always have fallback recommendations displayed instead of nothing.
    return scored
      .filter(item => item.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(item => item.auction);
  },

  // --- COMPARE AND RANK INTERESTED + SUGGESTED AUCTIONS ---
  async getRankedAuctions(userId: string): Promise<RankedAuction[]> {
    const prefs = this.getUserPreferences(userId) || DEFAULT_PREFS;
    const categories = await auctionService.getCategories();
    const allAuctions = await this.getAllAvailableAuctions(categories);

    // Fetch user watchlisted (interested) auctions
    const dbWatchlist = await auctionService.getUserWatchlistIds(userId);
    const localWatchlist = dashboardService.getInterestedAuctions(userId);
    const watchlistIds = Array.from(new Set([...dbWatchlist, ...localWatchlist]));
    const interestedList = allAuctions.filter(a => watchlistIds.includes(a.id));

    // Fetch recommended list
    const recommendedList = await this.getRecommendedAuctions(userId, 6);

    const ranked: RankedAuction[] = [];

    // Process interested
    interestedList.forEach((a: any) => {
      const { profitability, riskScore, riskLevel } = this.assessAuction(a, prefs.maxBudget);
      ranked.push({
        id: a.id,
        title: a.title,
        referenceNumber: a.reference_number || 'N/A',
        startingPrice: a.starting_price,
        location: a.location || 'India',
        category: a.category?.name || 'Scrap Metal',
        profitability,
        riskScore,
        riskLevel,
        isRecommended: false,
        isMstc: !!a.is_mstc
      });
    });

    // Process recommended
    recommendedList.forEach((a: any) => {
      // Avoid adding duplicates if already in interested
      if (interestedList.some(i => i.id === a.id)) return;
      
      const { profitability, riskScore, riskLevel } = this.assessAuction(a, prefs.maxBudget);
      ranked.push({
        id: a.id,
        title: a.title,
        referenceNumber: a.reference_number || 'N/A',
        startingPrice: a.starting_price,
        location: a.location || 'India',
        category: a.category?.name || 'Scrap Metal',
        profitability,
        riskScore,
        riskLevel,
        isRecommended: true,
        isMstc: !!a.is_mstc
      });
    });

    // Sort: High to Low profitability
    return ranked.sort((a, b) => b.profitability - a.profitability);
  }
};

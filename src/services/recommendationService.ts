import { auctionService } from './auctionService';
import { dashboardService } from './dashboardService';
import { supabase } from '../lib/supabase';
import { estimateAuctionValues } from './publicService';
import { hasPersonalizationConsent } from '../utils/cookieConsent';

export interface UserPreference {
  categories: string[];
  locations: string[];
  maxBudget: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface RecommendationProfile {
  preferences: UserPreference | null;
  recentSearches: string[];
  questionnaireCompleted: boolean;
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

  async getRecommendationProfile(userId: string): Promise<RecommendationProfile> {
    const localPreferences = this.getUserPreferences(userId);
    const localSearches = this.getUserSearches(userId);
    const localCompleted = localStorage.getItem(`usr_questionnaire_completed_${userId}`) === 'true';

    const { data, error } = await supabase
      .from('user_recommendation_profiles')
      .select('preferences, recent_searches, questionnaire_completed')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error({ error }, 'Failed to load recommendation profile');
      return {
        preferences: localPreferences,
        recentSearches: localSearches,
        questionnaireCompleted: localCompleted
      };
    }

    if (data) {
      const preferences = data.preferences as UserPreference | null;
      const recentSearches = Array.isArray(data.recent_searches) ? data.recent_searches : [];
      if (preferences) localStorage.setItem(`usr_prefs_${userId}`, JSON.stringify(preferences));
      localStorage.setItem(`usr_searches_${userId}`, JSON.stringify(recentSearches));
      if (data.questionnaire_completed) {
        localStorage.setItem(`usr_questionnaire_completed_${userId}`, 'true');
      }
      return {
        preferences,
        recentSearches,
        questionnaireCompleted: data.questionnaire_completed
      };
    }

    const localProfile = {
      user_id: userId,
      preferences: localPreferences,
      recent_searches: localSearches,
      questionnaire_completed: localCompleted
    };
    const { error: migrationError } = await supabase
      .from('user_recommendation_profiles')
      .upsert(localProfile, { onConflict: 'user_id' });
    if (migrationError) {
      console.error({ error: migrationError }, 'Failed to migrate recommendation profile');
    }

    return {
      preferences: localPreferences,
      recentSearches: localSearches,
      questionnaireCompleted: localCompleted
    };
  },

  async saveUserPreferences(userId: string, prefs: UserPreference): Promise<void> {
    const key = `usr_prefs_${userId}`;
    localStorage.setItem(key, JSON.stringify(prefs));
    localStorage.setItem(`usr_questionnaire_completed_${userId}`, 'true');

    const { error } = await supabase
      .from('user_recommendation_profiles')
      .upsert({
        user_id: userId,
        preferences: prefs,
        questionnaire_completed: true
      }, { onConflict: 'user_id' });
    if (error) {
      console.error({ error }, 'Failed to save recommendation preferences');
      throw error;
    }
  },

  async resetRecommendationProfile(userId: string): Promise<void> {
    const { error } = await supabase
      .from('user_recommendation_profiles')
      .upsert({
        user_id: userId,
        preferences: null,
        recent_searches: [],
        questionnaire_completed: false
      }, { onConflict: 'user_id' });
    if (error) {
      console.error({ error }, 'Failed to reset recommendation profile');
      throw error;
    }

    localStorage.removeItem(`usr_prefs_${userId}`);
    localStorage.removeItem(`usr_searches_${userId}`);
    localStorage.removeItem(`usr_questionnaire_completed_${userId}`);
  },

  // --- SEARCH HISTORY LOGGING ---
  logUserSearch(userId: string, query: string): void {
    if (!hasPersonalizationConsent()) return;
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
      void supabase
        .from('user_recommendation_profiles')
        .upsert({ user_id: userId, recent_searches: searches }, { onConflict: 'user_id' })
        .then(({ error }) => {
          if (error) console.error({ error }, 'Failed to save recommendation search history');
        });
    }
  },

  getUserSearches(userId: string): string[] {
    const key = `usr_searches_${userId}`;
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : [];
  },

  async clearUserSearches(userId: string): Promise<void> {
    localStorage.removeItem(`usr_searches_${userId}`);
    const { error } = await supabase
      .from('user_recommendation_profiles')
      .upsert({ user_id: userId, recent_searches: [] }, { onConflict: 'user_id' });
    if (error) {
      console.error({ error }, 'Failed to clear recommendation search history');
    }
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
    const categories = await auctionService.getCategories();
    const categoryMap = new Map(categories.map(c => [c.id, c]));
    const allAuctions = await this.getAllAvailableAuctions(categories);
    if (allAuctions.length === 0) return [];

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
    const [profile, dbWatchlist, userBids, globalBidResult] = await Promise.all([
      this.getRecommendationProfile(userId),
      auctionService.getUserWatchlistIds(userId),
      auctionService.getUserBids(userId),
      supabase.from('bids').select('auction_id, bidder_id, created_at').gte('created_at', thirtyDaysAgo).limit(5000)
    ]);

    if (globalBidResult.error) {
      console.error({ error: globalBidResult.error }, 'Failed to load recommendation popularity signals');
    }

    const prefs = profile.preferences;
    const searches = hasPersonalizationConsent() ? profile.recentSearches : [];
    const localWatchlist = dashboardService.getInterestedAuctions(userId);
    const watchlistIds = Array.from(new Set([...dbWatchlist, ...localWatchlist]));
    const watchlistAuctions = allAuctions.filter(a => watchlistIds.includes(a.id));
    const auctionById = new Map(allAuctions.map(auction => [auction.id, auction]));

    const categoryAliases: Record<string, string[]> = {
      'scrap & scrap material': ['scrap', 'metal', 'miscellaneous'],
      'plant & machinery': ['plant', 'machinery', 'machineries', 'equipment'],
      'vehicles': ['vehicle', 'transport vehicles', 'vessel'],
      'real estate': ['real estate', 'immovable property', 'property'],
      'e-waste': ['e-waste', 'electrical items', 'electronics items', 'electronics'],
      'minerals & ores': ['mineral', 'minerals', 'ore', 'mine block']
    };

    const categoryOf = (auction: any): string => {
      const category = auction.category_id ? categoryMap.get(auction.category_id) : null;
      return (category?.name || auction.category?.name || '').toLowerCase();
    };
    const locationOf = (auction: any): string => (auction.location || '').toLowerCase();
    const addSignal = (signals: Map<string, number>, key: string, weight: number) => {
      const normalized = key.trim().toLowerCase();
      if (normalized) signals.set(normalized, (signals.get(normalized) || 0) + weight);
    };
    const matchesCategory = (preference: string, category: string, text: string): boolean => {
      const aliases = categoryAliases[preference.toLowerCase()] || [preference.toLowerCase()];
      return aliases.some(alias => category.includes(alias) || text.includes(alias));
    };

    // Knowledge signals evolve from the user's searches, watchlist, and bidding history.
    const categoryAffinity = new Map<string, number>();
    const locationAffinity = new Map<string, number>();
    const termAffinity = new Map<string, number>();

    const ignoredSearchTerms = new Set(['and', 'the', 'for', 'with', 'from', 'near', 'auction', 'auctions']);
    searches.forEach((query, index) => {
      const recencyWeight = Math.max(1, 5 - index * 0.4);
      query.split(/\s+/).filter(term => term.length > 2 && !ignoredSearchTerms.has(term)).forEach(term => {
        addSignal(termAffinity, term, recencyWeight);
      });
      Object.entries(categoryAliases).forEach(([category, aliases]) => {
        if (aliases.some(alias => query.includes(alias))) addSignal(categoryAffinity, category, recencyWeight * 1.5);
      });
    });

    watchlistAuctions.forEach(auction => {
      addSignal(categoryAffinity, categoryOf(auction), 7);
      addSignal(locationAffinity, locationOf(auction), 4);
    });

    const latestUserBidByAuction = new Map<string, any>();
    userBids.forEach((bid: any) => {
      const current = latestUserBidByAuction.get(bid.auction_id);
      if (!current || new Date(bid.created_at) > new Date(current.created_at)) {
        latestUserBidByAuction.set(bid.auction_id, bid);
      }
    });
    latestUserBidByAuction.forEach((bid: any) => {
      if (!bid.auction) return;
      const ageDays = Math.max(0, (Date.now() - new Date(bid.created_at).getTime()) / 86400000);
      const recencyWeight = Math.max(2, 10 * Math.exp(-ageDays / 120));
      addSignal(categoryAffinity, categoryOf(bid.auction), recencyWeight);
      addSignal(locationAffinity, locationOf(bid.auction), recencyWeight * 0.5);
    });

    // Collaborative signals use real recent bidding activity across the marketplace.
    const auctionPopularity = new Map<string, number>();
    const auctionBidders = new Map<string, Set<string>>();
    const categoryPopularity = new Map<string, number>();
    (globalBidResult.data || []).forEach((bid: any) => {
      auctionPopularity.set(bid.auction_id, (auctionPopularity.get(bid.auction_id) || 0) + 1);
      if (!auctionBidders.has(bid.auction_id)) auctionBidders.set(bid.auction_id, new Set());
      auctionBidders.get(bid.auction_id)?.add(bid.bidder_id);
      const auction = auctionById.get(bid.auction_id);
      if (auction) addSignal(categoryPopularity, categoryOf(auction), 1);
    });

    const scored = allAuctions.map((auction: any) => {
      if (watchlistIds.includes(auction.id)) return { auction, score: -1 };

      const titleLower = (auction.title || '').toLowerCase();
      const descLower = (auction.description || '').toLowerCase();
      const categoryName = categoryOf(auction);
      const locationName = locationOf(auction);
      const searchableText = `${titleLower} ${descLower} ${categoryName} ${locationName}`;

      let knowledgeScore = 0;
      categoryAffinity.forEach((weight, category) => {
        if (matchesCategory(category, categoryName, searchableText)) knowledgeScore += weight * 2.5;
      });
      locationAffinity.forEach((weight, location) => {
        if (locationName.includes(location)) knowledgeScore += weight * 1.5;
      });
      termAffinity.forEach((weight, term) => {
        if (searchableText.includes(term)) knowledgeScore += weight;
      });
      knowledgeScore = Math.min(70, knowledgeScore);

      // Content-based cold start uses explicit questionnaire features.
      let contentScore = 0;
      if (prefs) {
        if (prefs.categories.some(category => matchesCategory(category, categoryName, searchableText))) contentScore += 35;
        if (prefs.locations.some(location => locationName.includes(location.toLowerCase()))) contentScore += 20;

        const price = Number(auction.starting_price) || 0;
        if (price > 0 && price <= prefs.maxBudget) contentScore += 15;
        else if (price > prefs.maxBudget * 1.5) contentScore -= 15;

        const { riskLevel } = this.assessAuction(auction, prefs.maxBudget);
        if (riskLevel.toLowerCase() === prefs.riskLevel) contentScore += 10;
      }

      const directPopularity = auctionPopularity.get(auction.id) || 0;
      const distinctBidders = auctionBidders.get(auction.id)?.size || 0;
      const categoryTrend = categoryPopularity.get(categoryName) || 0;
      const collaborativeScore = Math.min(
        35,
        Math.log1p(directPopularity) * 7 + Math.log1p(distinctBidders) * 10
      )
        + Math.min(15, Math.log1p(categoryTrend) * 5);

      const daysUntilClose = (new Date(auction.end_time).getTime() - Date.now()) / 86400000;
      const timeRelevance = daysUntilClose > 0 && daysUntilClose <= 7 ? 6 : daysUntilClose <= 30 ? 3 : 0;
      const score = knowledgeScore + contentScore + collaborativeScore + timeRelevance;

      return { auction, score, knowledgeScore, contentScore, collaborativeScore };
    });

    const sorted = scored
      .filter(item => item.score >= 0)
      .sort((a, b) => b.score - a.score || new Date(a.auction.end_time).getTime() - new Date(b.auction.end_time).getTime());

    const selected: typeof sorted = [];
    const categoryCounts = new Map<string, number>();
    for (const item of sorted) {
      const category = item.auction.category?.name || item.auction.category_id || 'uncategorized';
      if ((categoryCounts.get(category) || 0) >= 2) continue;
      selected.push(item);
      categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
      if (selected.length === limit) break;
    }
    if (selected.length < limit) {
      for (const item of sorted) {
        if (!selected.includes(item)) selected.push(item);
        if (selected.length === limit) break;
      }
    }

    return selected.map(item => item.auction);
  },

  // --- COMPARE AND RANK INTERESTED + SUGGESTED AUCTIONS ---
  async getRankedAuctions(userId: string): Promise<RankedAuction[]> {
    const profile = await this.getRecommendationProfile(userId);
    const prefs = profile.preferences || DEFAULT_PREFS;
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

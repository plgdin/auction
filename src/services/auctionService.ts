// @ts-nocheck
import { supabase } from '../lib/supabase';
import type { Auction, AuctionCategory, AuctionImage, AuctionDocument, Watchlist } from '../types/database.types';
import { FALLBACK_CATEGORIES } from './fallbackCategories';

export interface AuctionFilterParams {
  categoryId?: string;
  categoryIds?: string[];
  listingType?: 'all' | 'closes_soon' | 'recently_added';
  searchQuery?: string;
  sortBy?: 'ending_soon' | 'price_asc' | 'price_desc' | 'newest';
  page?: number;
  limit?: number;
  regionalOffice?: string;
  location?: string;
  preBid?: string;
  startDate?: string;
  endDate?: string;
}

const REGIONAL_OFFICES = [
  'North - New Delhi',
  'West - Mumbai',
  'East - Kolkata',
  'South - Chennai',
  'Central - Nagpur'
];

const LOCATIONS = [
  'Delhi',
  'Maharashtra',
  'West Bengal',
  'Tamil Nadu',
  'Karnataka',
  'Gujarat',
  'Uttar Pradesh'
];

export const enrichAuction = (auction: any): any => {
  if (!auction) return auction;
  const charCodeSum = auction.id.split('').reduce((sum: number, char: string) => sum + char.charCodeAt(0), 0);
  const regional_office = REGIONAL_OFFICES[charCodeSum % REGIONAL_OFFICES.length];
  const location = LOCATIONS[(charCodeSum + 2) % LOCATIONS.length];
  const pre_bid = charCodeSum % 2 === 0;

  return {
    ...auction,
    regional_office,
    location,
    pre_bid,
  };
};

export const auctionService = {
  async getCategories(): Promise<AuctionCategory[]> {
    const { data, error } = await supabase
      .from('auction_categories')
      .select('*')
      .order('name');
    
    if (error || !data || data.length === 0) {
      if (error) {
        console.error('Error fetching categories from database, using fallback:', error);
      }
      return FALLBACK_CATEGORIES;
    }
    return data;
  },

  async getAuctions(params: AuctionFilterParams = {}): Promise<{ data: Auction[], count: number }> {
    let query = supabase
      .from('auctions')
      .select('*, seller:organizations(*)', { count: 'exact' })
      .in('status', ['active', 'published'])
      .gt('end_time', new Date().toISOString());

    const rawCategoryInputs: string[] = [];
    if (params.categoryIds && params.categoryIds.length > 0) {
      rawCategoryInputs.push(...params.categoryIds);
    } else if (params.categoryId) {
      rawCategoryInputs.push(params.categoryId);
    }

    if (rawCategoryInputs.length > 0) {
      const categories = await this.getCategories();
      const HOME_PAGE_CATEGORY_MAPPING: Record<string, string[]> = {
        'scrap & scrap material': ['metal', 'miscellaneous'],
        'plant & machinery': ['plant/machineries'],
        'vehicles': ['transport vehicles', 'vessels'],
        'real estate': ['immovable property'],
        'e-waste': ['electrical items', 'electronics items'],
        'minerals & ores': ['minerals', 'mine block']
      };

      const resolvedIds: string[] = [];
      rawCategoryInputs.forEach(input => {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input);
        if (isUuid) {
          resolvedIds.push(input);
        } else {
          const matchedNames = HOME_PAGE_CATEGORY_MAPPING[input.toLowerCase()] || [input.toLowerCase()];
          matchedNames.forEach(mName => {
            const matched = categories.find(c => c.name.toLowerCase() === mName);
            if (matched) {
              resolvedIds.push(matched.id);
            }
          });
        }
      });

      if (resolvedIds.length > 0) {
        const descendantIds = [...resolvedIds];
        const queue = [...resolvedIds];
        
        while (queue.length > 0) {
          const currentId = queue.shift();
          const children = categories.filter(c => c.parent_id === currentId);
          for (const child of children) {
            if (!descendantIds.includes(child.id)) {
              descendantIds.push(child.id);
              queue.push(child.id);
            }
          }
        }
        
        query = query.in('category_id', descendantIds);
      } else {
        query = query.eq('id', '00000000-0000-0000-0000-000000000000');
      }
    }
    if (params.searchQuery) {
      query = query.ilike('title', `%${params.searchQuery}%`);
    }

    const { data: dbData, error } = await query;

    if (error || !dbData) {
      console.error('Error fetching auctions:', error);
      return { data: [], count: 0 };
    }

    // Programmatically enrich and apply remaining filters
    let enriched = dbData.map(enrichAuction);

    // CRITICAL REQUIREMENT: Only show upcoming auctions, never ended/closed/draft/cancelled.
    const now = new Date();
    enriched = enriched.filter(item => {
      const isUpcomingOrActive = item.status === 'active' || item.status === 'published';
      const hasNotEnded = new Date(item.end_time) > now;
      return isUpcomingOrActive && hasNotEnded;
    });

    if (params.listingType === 'closes_soon') {
      const fortyEightHoursLater = new Date(now.getTime() + 48 * 60 * 60 * 1000);
      enriched = enriched.filter(item => {
        const endTime = new Date(item.end_time);
        return endTime > now && endTime <= fortyEightHoursLater;
      });
    } else if (params.listingType === 'recently_added') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      enriched = enriched.filter(item => {
        const createdAt = new Date(item.created_at);
        return createdAt >= sevenDaysAgo;
      });
    }

    if (params.regionalOffices && params.regionalOffices.length > 0) {
      enriched = enriched.filter(item => params.regionalOffices.includes(item.regional_office));
    } else if (params.regionalOffice) {
      enriched = enriched.filter(item => item.regional_office === params.regionalOffice);
    }

    if (params.locations && params.locations.length > 0) {
      enriched = enriched.filter(item => params.locations.includes(item.location));
    } else if (params.location) {
      enriched = enriched.filter(item => item.location === params.location);
    }

    if (params.preBid === 'yes') {
      enriched = enriched.filter(item => item.pre_bid === true);
    } else if (params.preBid === 'no') {
      enriched = enriched.filter(item => item.pre_bid === false);
    }

    if (params.startDate) {
      const startLimit = new Date(params.startDate);
      enriched = enriched.filter(item => new Date(item.start_time) >= startLimit);
    }

    if (params.endDate) {
      const endLimit = new Date(params.endDate);
      enriched = enriched.filter(item => new Date(item.end_time) <= endLimit);
    }

    // Programmatic Sorting
    switch (params.sortBy) {
      case 'ending_soon':
        enriched.sort((a, b) => new Date(a.end_time).getTime() - new Date(b.end_time).getTime());
        break;
      case 'price_asc':
        enriched.sort((a, b) => a.starting_price - b.starting_price);
        break;
      case 'price_desc':
        enriched.sort((a, b) => b.starting_price - a.starting_price);
        break;
      case 'newest':
      default:
        enriched.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
    }

    // Programmatic Pagination
    const totalCount = enriched.length;
    const page = params.page || 1;
    const limit = params.limit || 12;
    const from = (page - 1) * limit;
    const paginated = enriched.slice(from, from + limit);

    return {
      data: paginated,
      count: totalCount
    };
  },

  async getAuctionById(id: string): Promise<Auction | null> {
    const { data, error } = await supabase
      .from('auctions')
      .select(`
        *,
        category:auction_categories(name)
      `)
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching auction by id:', error);
      return null;
    }
    return enrichAuction(data);
  },

  async getAuctionImages(auctionId: string): Promise<AuctionImage[]> {
    const { data, error } = await supabase
      .from('auction_images')
      .select('*')
      .eq('auction_id', auctionId)
      .order('display_order');
    
    if (error) {
      console.error('Error fetching auction images:', error);
      return [];
    }
    return data;
  },

  async getAuctionDocuments(auctionId: string): Promise<AuctionDocument[]> {
    const { data, error } = await supabase
      .from('auction_documents')
      .select('*')
      .eq('auction_id', auctionId);
    
    if (error) {
      console.error('Error fetching auction documents:', error);
      return [];
    }
    return data;
  },

  async getRelatedAuctions(categoryId: string, currentAuctionId: string, limit: number = 4): Promise<Auction[]> {
    const { data, error } = await supabase
      .from('auctions')
      .select('*')
      .eq('category_id', categoryId)
      .eq('status', 'active')
      .neq('id', currentAuctionId)
      .limit(limit);
    
    if (error) {
      console.error('Error fetching related auctions:', error);
      return [];
    }
    return data;
  },

  // Watchlist
  async toggleWatchlist(userId: string, auctionId: string): Promise<boolean> {
    // Check if it exists
    const { data: existing } = await supabase
      .from('watchlists')
      .select('*')
      .eq('user_id', userId)
      .eq('auction_id', auctionId)
      .single();

    if (existing) {
      // Remove
      const { error } = await supabase
        .from('watchlists')
        .delete()
        .eq('id', existing.id);
      if (error) throw error;
      return false; // Removed
    } else {
      // Add
      const { error } = await supabase
        .from('watchlists')
        .insert([{ user_id: userId, auction_id: auctionId }]);
      if (error) throw error;
      return true; // Added
    }
  },

  async getUserWatchlistIds(userId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('watchlists')
      .select('auction_id')
      .eq('user_id', userId);
    
    if (error) {
      console.error('Error fetching watchlist:', error);
      return [];
    }
    return data.map(w => w.auction_id);
  },

  // User Dashboard Aggregation
  async getUserBids(userId: string) {
    const { data, error } = await supabase
      .from('bids')
      .select(`
        *,
        auction:auctions(*)
      `)
      .eq('bidder_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching user bids:', error);
      return [];
    }
    return data;
  },

  async getWonAuctions(userId: string): Promise<Auction[]> {
    const { data, error } = await supabase
      .from('bids')
      .select(`
        *,
        auction:auctions(*)
      `)
      .eq('bidder_id', userId)
      .eq('status', 'winning');

    if (error) {
      console.error('Error fetching won auctions:', error);
      return [];
    }
    return (data || [])
      .map((bid: any) => bid.auction)
      .filter((auction): auction is Auction => !!auction);
  },

  // Realtime Bidding Logic
  async placeBid(auctionId: string, userId: string, amount: number): Promise<{ success: boolean; message: string; bid_amount?: number; end_time?: string }> {
    const { data, error } = await supabase.rpc('place_bid', {
      p_auction_id: auctionId,
      p_bidder_id: userId,
      p_bid_amount: amount
    });

    if (error) {
      console.error('Error placing bid RPC:', error);
      return { success: false, message: 'Failed to place bid due to a network error.' };
    }

    return data as any;
  },

  async getBidHistory(auctionId: string) {
    const { data, error } = await supabase
      .from('bids')
      .select(`
        *,
        bidder:profiles(first_name, last_name, organization_id)
      `)
      .eq('auction_id', auctionId)
      .order('amount', { ascending: false });

    if (error) {
      console.error('Error fetching bid history:', error);
      return [];
    }
    return data;
  },

  // Seller Methods
  async createAuction(auctionData: Partial<Auction>): Promise<Auction | null> {
    const { data, error } = await supabase
      .from('auctions')
      .insert([auctionData])
      .select()
      .single();

    if (error) {
      console.error('Error creating auction:', error);
      return null;
    }
    return data;
  },

  async getAuctionsBySeller(sellerId: string): Promise<Auction[]> {
    const { data, error } = await supabase
      .from('auctions')
      .select('*')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching seller auctions:', error);
      return [];
    }
    return data;
  },

  async getAuctionAnalytics(sellerId: string) {
    // A simplified analytics fetch for the dashboard
    const { data: auctions, error } = await supabase
      .from('auctions')
      .select(`
        id, status, starting_price,
        bids (amount)
      `)
      .eq('seller_id', sellerId);

    if (error) {
      console.error('Error fetching auction analytics:', error);
      return { totalRevenue: 0, activeAuctions: 0, totalBids: 0 };
    }

    let totalRevenue = 0;
    let activeAuctions = 0;
    let totalBids = 0;

    auctions.forEach((auction: any) => {
      if (auction.status === 'active') activeAuctions++;
      if (auction.bids && auction.bids.length > 0) {
        totalBids += auction.bids.length;
        // For revenue, we assume highest bid of closed/awarded, but for simplicity here we sum highest bids of all
        const highestBid = Math.max(...auction.bids.map((b: any) => b.amount));
        totalRevenue += highestBid;
      }
    });

    return { totalRevenue, activeAuctions, totalBids };
  }
};

// @ts-nocheck
import { supabase } from '../lib/supabase';
import type { Auction, AuctionCategory, AuctionImage, AuctionDocument, Watchlist } from '../types/database.types';

export interface AuctionFilterParams {
  categoryId?: string;
  status?: string;
  searchQuery?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: 'ending_soon' | 'price_asc' | 'price_desc' | 'newest';
  page?: number;
  limit?: number;
}

export const auctionService = {
  async getCategories(): Promise<AuctionCategory[]> {
    const { data, error } = await supabase
      .from('auction_categories')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching categories:', error);
      return [];
    }
    return data;
  },

  async getAuctions(params: AuctionFilterParams = {}): Promise<{ data: Auction[], count: number }> {
    let query = supabase.from('auctions').select('*', { count: 'exact' });

    if (params.categoryId) {
      query = query.eq('category_id', params.categoryId);
    }
    if (params.status) {
      query = query.eq('status', params.status);
    }
    if (params.searchQuery) {
      query = query.ilike('title', `%${params.searchQuery}%`);
    }
    if (params.minPrice !== undefined) {
      query = query.gte('starting_price', params.minPrice);
    }
    if (params.maxPrice !== undefined) {
      query = query.lte('starting_price', params.maxPrice);
    }

    // Sorting
    switch (params.sortBy) {
      case 'ending_soon':
        query = query.order('end_time', { ascending: true });
        break;
      case 'price_asc':
        query = query.order('starting_price', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('starting_price', { ascending: false });
        break;
      case 'newest':
      default:
        query = query.order('created_at', { ascending: false });
        break;
    }

    // Pagination
    const page = params.page || 1;
    const limit = params.limit || 12;
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching auctions:', error);
      return { data: [], count: 0 };
    }
    return { data: data || [], count: count || 0 };
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
    return data;
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
      .from('auctions')
      .select('*')
      .eq('winner_id', userId)
      .order('end_time', { ascending: false });

    if (error) {
      console.error('Error fetching won auctions:', error);
      return [];
    }
    return data;
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

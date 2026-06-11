import { supabase } from '../lib/supabase';
import type { ContactMessage, FaqItem, Announcement, NewsUpdate } from '../types/database.types';

export const publicService = {
  async submitContactMessage(messageData: Partial<ContactMessage>): Promise<boolean> {
    const { error } = await supabase
      .from('contact_messages')
      .insert([messageData]);

    if (error) {
      console.error('Error submitting contact message:', error);
      return false;
    }
    return true;
  },

  async getActiveFaqs(): Promise<FaqItem[]> {
    const { data, error } = await supabase
      .from('faq_items')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching FAQs:', error);
      return [];
    }
    return data;
  },

  async getActiveAnnouncements(limit: number = 5): Promise<Announcement[]> {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching announcements:', error);
      return [];
    }
    return data;
  },

  async getPublishedNews(limit: number = 10): Promise<NewsUpdate[]> {
    const { data, error } = await supabase
      .from('news_updates')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching news:', error);
      return [];
    }
    return data;
  }
};

export interface MstcSanitizedAuction {
  id: string;
  mstc_auction_number: string;
  seller_name: string;
  category_name: string;
  location: string;
  opening_date: string;
  closing_date: string;
  sanitized_document_path: string | null; // Masked path pointing exclusively to your Supabase cloud asset
  raw_materials_text: string | null;
  status: string;
}

export const MstcSearchService = {
  /**
   * High-speed catalog search engine filtering through clean, deduplicated snapshots
   */
  async searchMarketplaceCatalog(
    query: string,
    filters?: { category?: string; seller?: string; location?: string }
  ): Promise<MstcSanitizedAuction[]> {
    try {
      let queryBuilder = supabase
        .from('mstc_auctions')
        .select('*')
        .eq('asset_status', 'completed'); // Only show items that have ready, downloaded PDFs

      if (query) {
        queryBuilder = queryBuilder.or(`mstc_auction_number.ilike.%${query}%,seller_name.ilike.%${query}%,category_name.ilike.%${query}%`);
      }
      
      if (filters?.category) {
        queryBuilder = queryBuilder.eq('category_name', filters.category);
      }
      
      if (filters?.seller) {
        queryBuilder = queryBuilder.eq('seller_name', filters.seller);
      }
      
      if (filters?.location) {
        queryBuilder = queryBuilder.eq('location', filters.location);
      }

      const { data, error } = await queryBuilder
        .order('opening_date', { ascending: false })
        .limit(200); // Load up to 200 items for responsive viewing

      if (error) throw error;
      return (data as MstcSanitizedAuction[]) || [];
    } catch (error) {
      console.error('Failed to fetch filtered MSTC catalogs:', error);
      return [];
    }
  },

  /**
   * Fetches unique filter options (State/Location, Category, Seller) from the database
   */
  async getMstcFilterOptions(): Promise<{ categories: string[]; sellers: string[]; locations: string[] }> {
    try {
      const { data, error } = await supabase
        .from('mstc_auctions')
        .select('category_name, seller_name, location')
        .eq('asset_status', 'completed'); // Match filter dropdown choices with visible completed catalogs
      
      if (error) throw error;
      
      const categories = new Set<string>();
      const sellers = new Set<string>();
      const locations = new Set<string>();
      
      data?.forEach(row => {
        if (row.category_name) categories.add(row.category_name);
        if (row.seller_name) sellers.add(row.seller_name);
        if (row.location) locations.add(row.location);
      });
      
      return {
        categories: Array.from(categories).sort(),
        sellers: Array.from(sellers).sort(),
        locations: Array.from(locations).sort()
      };
    } catch (error) {
      console.error('Failed to fetch MSTC filter options:', error);
      return { categories: [], sellers: [], locations: [] };
    }
  },

  /**
   * Fetches verified, fully processed feeds for consultant analytics modules
   */
  async fetchVerifiedConsultantFeed(limitCount: number = 15): Promise<MstcSanitizedAuction[]> {
    try {
      const { data, error } = await supabase
        .from('mstc_auctions')
        .select('*')
        .eq('asset_status', 'completed') // Guarantees consultants only view rows with ready, uncorrupted local files
        .order('opening_date', { ascending: false })
        .limit(limitCount);

      if (error) throw error;
      return (data as MstcSanitizedAuction[]) || [];
    } catch (error) {
      console.error('Failed processing analytics baseline query maps:', error);
      return [];
    }
  }
};


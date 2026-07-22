import { supabase } from '../lib/supabase';
import type { LogisticsProfile, LogisticsRequest, Profile } from '../types/database.types';

export const logisticsService = {
  // Fetch all profiles that have the logistics role, joined with their logistics_profiles
  getLogisticsProviders: async (): Promise<(LogisticsProfile & { profile: Profile })[]> => {
    // First, find users with logistics role
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'logistics')
      .eq('is_active', true);

    if (profileError) throw profileError;

    if (!profiles || profiles.length === 0) return [];

    const profileIds = profiles.map(p => p.id);

    // Fetch their logistics profiles
    const { data: logisticsProfiles, error: logisticsError } = await supabase
      .from('logistics_profiles')
      .select('*')
      .in('id', profileIds)
      .eq('is_accepting_requests', true);

    if (logisticsError) throw logisticsError;

    // Merge them
    return logisticsProfiles.map((lp) => {
      const profile = profiles.find((p) => p.id === lp.id)!;
      return {
        ...lp,
        profile,
      };
    });
  },

  // Get a specific logistics profile
  getLogisticsProfile: async (id: string): Promise<LogisticsProfile | null> => {
    const { data, error } = await supabase
      .from('logistics_profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // Ignore not found error
    return data;
  },

  // Update or insert logistics profile
  updateLogisticsProfile: async (id: string, data: Partial<LogisticsProfile>): Promise<LogisticsProfile> => {
    const { data: existing } = await supabase
      .from('logistics_profiles')
      .select('id')
      .eq('id', id)
      .single();

    if (existing) {
      const { data: updated, error } = await supabase
        .from('logistics_profiles')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    } else {
      const { data: inserted, error } = await supabase
        .from('logistics_profiles')
        .insert({ id, ...data })
        .select()
        .single();
      if (error) throw error;
      return inserted;
    }
  },

  // Send a quote request to a logistics provider
  sendQuoteRequest: async (senderId: string, logisticsId: string, quoteData: any, userNote: string = '') => {
    const { data, error } = await supabase
      .from('logistics_requests')
      .insert({
        sender_id: senderId,
        logistics_id: logisticsId,
        quote_data: quoteData,
        user_note: userNote,
        status: 'pending'
      })
      .select()
      .single();

    if (error) throw error;

    // Send notification to logistics provider
    await supabase.from('notifications').insert({
      user_id: logisticsId,
      title: 'New Shipping Quote Request',
      message: 'You have received a new quote request.',
      type: 'logistics_request',
      link_url: '/logistics/requests',
      is_read: false
    });

    return data;
  },

  // Fetch requests sent TO a logistics provider (for Logistics Dashboard)
  getIncomingRequests: async (logisticsId: string) => {
    const { data, error } = await supabase
      .from('logistics_requests')
      .select('*, sender:profiles!logistics_requests_sender_id_fkey(*)')
      .eq('logistics_id', logisticsId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Fetch requests sent BY a normal user (for User Dashboard)
  getUserSentRequests: async (userId: string) => {
    const { data, error } = await supabase
      .from('logistics_requests')
      .select('*')
      .eq('sender_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    // Also fetch the logistics profile company names
    const logisticsIds = data.map(d => d.logistics_id);
    const { data: lProfiles } = await supabase
        .from('logistics_profiles')
        .select('id, company_name')
        .in('id', logisticsIds);
        
    return data.map(req => ({
        ...req,
        logistics_company: lProfiles?.find(p => p.id === req.logistics_id)?.company_name || 'Unknown'
    }));
  },

  // Respond to a quote request (for Logistics Dashboard)
  respondToRequest: async (requestId: string, status: 'responded' | 'rejected' | 'completed', responseText: string) => {
    const { data, error } = await supabase
      .from('logistics_requests')
      .update({
        status,
        logistics_response: responseText
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) throw error;

    // Send notification to normal user
    await supabase.from('notifications').insert({
      user_id: data.sender_id,
      title: 'Logistics Provider Responded',
      message: `A logistics provider has ${status} your quote request.`,
      type: 'logistics_response',
      link_url: '/dashboard/logistics-requests',
      is_read: false
    });

    return data;
  }
};

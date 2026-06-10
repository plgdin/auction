// @ts-nocheck
import { supabase } from '../lib/supabase';
import type { Tender, TenderSubmission, TenderDocument } from '../types/database.types';

export const tenderService = {
  async getTenders(filters?: { status?: string; search?: string }): Promise<Tender[]> {
    let query = supabase.from('tenders').select('*').order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    
    if (filters?.search) {
      query = query.or(`title.ilike.%${filters.search}%,reference_number.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching tenders:', error);
      return [];
    }
    return data;
  },

  async getTenderById(id: string): Promise<Tender | null> {
    const { data, error } = await supabase
      .from('tenders')
      .select('*, tender_documents(*)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching tender details:', error);
      return null;
    }
    return data;
  },

  async createTender(tenderData: Partial<Tender>): Promise<Tender | null> {
    const { data, error } = await supabase
      .from('tenders')
      .insert([tenderData])
      .select()
      .single();

    if (error) {
      console.error('Error creating tender:', error);
      return null;
    }
    return data;
  },

  async submitTender(submissionData: Partial<TenderSubmission>): Promise<TenderSubmission | null> {
    const { data, error } = await supabase
      .from('tender_submissions')
      .insert([submissionData])
      .select()
      .single();

    if (error) {
      console.error('Error submitting tender:', error);
      return null;
    }
    return data;
  },

  async getSubmissionsForTender(tenderId: string): Promise<TenderSubmission[]> {
    const { data, error } = await supabase
      .from('tender_submissions')
      .select('*')
      .eq('tender_id', tenderId)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error fetching tender submissions:', error);
      return [];
    }
    return data;
  },

  async getUserTenderSubmissions(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('tender_submissions')
      .select(`
        *,
        tender:tenders(*)
      `)
      .eq('submitter_id', userId)
      .order('submitted_at', { ascending: false });

    if (error) {
      console.error('Error fetching user tender submissions:', error);
      return [];
    }
    return data;
  }
};

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

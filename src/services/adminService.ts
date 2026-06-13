import { supabase } from '../lib/supabase';
import type { AuditLog, Notification, Announcement, FaqItem, NewsUpdate } from '../types/database.types';

export const adminService = {
  async getAuditLogs(limit: number = 50): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching audit logs:', error);
      return [];
    }
    return data;
  },

  async logAction(logData: Partial<AuditLog>): Promise<AuditLog | null> {
    const { data, error } = await supabase
      .from('audit_logs')
      .insert([logData])
      .select()
      .single();

    if (error) {
      console.error('Error creating audit log:', error);
      return null;
    }
    return data;
  },

  async getNotifications(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
      return [];
    }
    return data;
  },

  async sendNotification(notificationData: Partial<Notification>): Promise<Notification | null> {
    const { data, error } = await supabase
      .from('notifications')
      .insert([notificationData])
      .select()
      .single();

    if (error) {
      console.error('Error sending notification:', error);
      return null;
    }
    return data;
  },

  async publishAnnouncement(announcementData: Partial<Announcement>): Promise<Announcement | null> {
    const { data, error } = await supabase
      .from('announcements')
      .insert([announcementData])
      .select()
      .single();

    if (error) {
      console.error('Error publishing announcement:', error);
      return null;
    }
    return data;
  },

  async getActiveAnnouncements(): Promise<Announcement[]> {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_published', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching announcements:', error);
      return [];
    }
    return data;
  },

  async getFaqItems(): Promise<FaqItem[]> {
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

  async getNewsUpdates(): Promise<NewsUpdate[]> {
    const { data, error } = await supabase
      .from('news_updates')
      .select('*')
      .eq('is_published', true)
      .order('published_at', { ascending: false });

    if (error) {
      console.error('Error fetching news updates:', error);
      return [];
    }
    return data;
  },

  async markNotificationAsRead(id: string) {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);
      
    if (error) {
      console.error('Error marking notification read:', error);
    }
  },

  // User Management
  async getUsers(): Promise<any[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return [];
    }
    return data;
  },

  async updateUserRole(userId: string, role: string): Promise<boolean> {
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user role:', error);
      return false;
    }
    return true;
  },

  // Global Analytics
  async getGlobalAnalytics() {
    const { count: userCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { count: auctionCount } = await supabase
      .from('auctions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    const { count: tenderCount } = await supabase
      .from('tenders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'open');

    return {
      totalUsers: userCount || 0,
      activeAuctions: auctionCount || 0,
      activeTenders: tenderCount || 0
    };
  },

  // Scraper & Asset Worker Dashboard Services
  async getScraperAnalytics() {
    try {
      const [totalRes, pendingRes, processingRes, completedRes, failedRes] = await Promise.all([
        supabase.from('mstc_auctions').select('*', { count: 'exact', head: true }),
        supabase.from('mstc_auctions').select('*', { count: 'exact', head: true }).eq('asset_status', 'pending'),
        supabase.from('mstc_auctions').select('*', { count: 'exact', head: true }).eq('asset_status', 'processing'),
        supabase.from('mstc_auctions').select('*', { count: 'exact', head: true }).eq('asset_status', 'completed'),
        supabase.from('mstc_auctions').select('*', { count: 'exact', head: true }).eq('asset_status', 'failed'),
      ]);

      return {
        total: totalRes.count || 0,
        pending: pendingRes.count || 0,
        processing: processingRes.count || 0,
        completed: completedRes.count || 0,
        failed: failedRes.count || 0
      };
    } catch (error) {
      console.error('Error fetching scraper analytics:', error);
      return { total: 0, pending: 0, processing: 0, completed: 0, failed: 0 };
    }
  },

  async getScraperAuctions(limit: number = 100): Promise<any[]> {
    const { data, error } = await supabase
      .from('mstc_auctions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching scraper auctions:', error);
      return [];
    }
    return data;
  },

  async getScraperLogs(limit: number = 100): Promise<AuditLog[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .in('action', ['mstc_auction_downloaded', 'mstc_auction_deleted', 'mstc_auction_failed'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching scraper audit logs:', error);
      return [];
    }
    return data;
  }
};

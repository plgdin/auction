import { supabase } from '../lib/supabase';
import type { AuditLog, Notification, Announcement, FaqItem, NewsUpdate, ContactMessage } from '../types/database.types';

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

  async getFaqItemsAdmin(): Promise<FaqItem[]> {
    const { data, error } = await supabase
      .from('faq_items')
      .select('*')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching admin FAQs:', error);
      return [];
    }
    return data;
  },

  async createFaqItem(faqData: Partial<FaqItem>): Promise<boolean> {
    const { error } = await supabase
      .from('faq_items')
      .insert([faqData]);

    if (error) {
      console.error('Error creating FAQ:', error);
      return false;
    }
    return true;
  },

  async updateFaqItem(id: string, faqData: Partial<FaqItem>): Promise<boolean> {
    const { error } = await supabase
      .from('faq_items')
      .update(faqData)
      .eq('id', id);

    if (error) {
      console.error('Error updating FAQ:', error);
      return false;
    }
    return true;
  },

  async reorderFaqItems(reorderedItems: { id: string; display_order: number }[]): Promise<boolean> {
    try {
      const updates = reorderedItems.map(item =>
        supabase
          .from('faq_items')
          .update({ display_order: item.display_order })
          .eq('id', item.id)
      );

      const results = await Promise.all(updates);
      const failed = results.filter(r => r.error);

      if (failed.length > 0) {
        console.error('Error reordering FAQs:', failed.map(f => f.error));
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error reordering FAQs:', error);
      return false;
    }
  },

  async deleteFaqItem(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('faq_items')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting FAQ:', error);
      return false;
    }
    return true;
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

  async getAllNewsAdmin(): Promise<NewsUpdate[]> {
    const { data, error } = await supabase
      .from('news_updates')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching all news admin:', error);
      return [];
    }
    return data;
  },

  async createNews(newsData: Partial<NewsUpdate>): Promise<boolean> {
    const { error } = await supabase
      .from('news_updates')
      .insert([{
        ...newsData,
        published_at: newsData.is_published ? new Date().toISOString() : null
      }]);

    if (error) {
      console.error('Error creating news:', error);
      return false;
    }
    return true;
  },

  async updateNews(id: string, newsData: Partial<NewsUpdate>): Promise<boolean> {
    const updatePayload = { ...newsData };
    if (newsData.is_published && !newsData.published_at) {
      updatePayload.published_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('news_updates')
      .update(updatePayload)
      .eq('id', id);

    if (error) {
      console.error('Error updating news:', error);
      return false;
    }
    return true;
  },

  async deleteNews(id: string): Promise<boolean> {
    const { error } = await supabase
      .from('news_updates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting news:', error);
      return false;
    }
    return true;
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
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch users: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching users via API:', error);
      return [];
    }
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
      .order('scraped_at', { ascending: false })
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
  },

  // Contact Messages Management
  async getContactMessages(): Promise<ContactMessage[]> {
    const { data, error } = await supabase
      .from('contact_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching contact messages:', error);
      return [];
    }
    return data;
  },

  async updateContactMessageStatus(id: string, status: string): Promise<boolean> {
    const { error } = await supabase
      .from('contact_messages')
      .update({ status })
      .eq('id', id);

    if (error) {
      console.error('Error updating contact message status:', error);
      return false;
    }
    return true;
  },

  async resetFailedAuctions(): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const response = await fetch('/api/scraper/reset-failed', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to reset failed auctions: ${response.statusText}`);
      }

      const data = await response.json();
      return !!data.success;
    } catch (error) {
      console.error('Error resetting failed auctions:', error);
      return false;
    }
  },

  async resetSingleFailedAuction(id: string): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const response = await fetch(`/api/scraper/reset-single?id=${id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to reset single failed auction: ${response.statusText}`);
      }

      const data = await response.json();
      return !!data.success;
    } catch (error) {
      console.error('Error resetting single failed auction:', error);
      return false;
    }
  },

  async unlockProcessingAuctions(): Promise<boolean> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';

      const response = await fetch('/api/scraper/unlock-processing', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to unlock processing auctions: ${response.statusText}`);
      }

      const data = await response.json();
      return !!data.success;
    } catch (error) {
      console.error('Error unlocking processing auctions:', error);
      return false;
    }
  }
};

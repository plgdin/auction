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
      
    // Stats to match the website's real database numbers
    const { count: activeListings } = await supabase
      .from('mstc_auctions')
      .select('*', { count: 'exact', head: true })
      .eq('asset_status', 'completed');

    const now = new Date().toISOString();
    const { count: upcomingAuctions } = await supabase
      .from('mstc_auctions')
      .select('*', { count: 'exact', head: true })
      .gt('opening_date', now);

    return {
      totalUsers: userCount || 0,
      activeAuctions: auctionCount || 0,
      activeTenders: tenderCount || 0,
      activeListings: activeListings || 0,
      upcomingAuctions: upcomingAuctions || 0
    };
  },

  // Category Analytics
  async getCategoryAnalytics() {
    try {
      // 1. Fetch current totals via the highly optimized RPC function
      const { data: currentData, error: currentError } = await supabase
        .rpc('get_current_category_totals');

      // 2. Fetch historical/daily totals directly from the lightweight stats table
      // We don't need limits here because it's aggregated strictly by day
      const { data: historicalData, error: historicalError } = await supabase
        .from('category_daily_stats')
        .select('date, category_name, items_added');

      if (currentError || historicalError) {
        console.error('Error fetching category analytics', currentError || historicalError);
        return { currentTotals: [], historicalTotals: [], daily: [] };
      }

      // Process Current Totals (RPC already returned aggregated counts!)
      const currentTotals = (currentData || [])
        .map((item: any) => ({ name: item.category_name, count: item.count }))
        .sort((a: any, b: any) => b.count - a.count);

      // Process Historical & Daily Totals
      const historicalTotalsMap: Record<string, number> = {};
      const dailyMap: Record<string, Record<string, number>> = {};

      historicalData?.forEach(stat => {
        const cat = stat.category_name || 'Uncategorized';
        const count = stat.items_added || 0;
        const date = stat.date;

        historicalTotalsMap[cat] = (historicalTotalsMap[cat] || 0) + count;

        if (!dailyMap[date]) dailyMap[date] = {};
        dailyMap[date][cat] = (dailyMap[date][cat] || 0) + count;
      });

      const historicalTotals = Object.entries(historicalTotalsMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      const daily = Object.entries(dailyMap)
        .map(([date, categories]) => ({
          date,
          ...categories
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      return { currentTotals, historicalTotals, daily };
    } catch (e) {
      console.error(e);
      return { currentTotals: [], historicalTotals: [], daily: [] };
    }
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
  },

  async toggleMaintenanceMode(enabled: boolean): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          key: 'maintenance_mode',
          value: enabled,
          updated_at: new Date().toISOString(),
          updated_by: (await supabase.auth.getUser()).data.user?.id
        });
      
      if (error) {
        console.error('Error toggling maintenance mode:', error);
        return false;
      }
      return true;
    } catch (e) {
      console.error('Error toggling maintenance mode:', e);
      return false;
    }
  },

  async getSecurityLogs(limit: number = 50): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('security_audit_logs')
        .select('*')
        .order('attempted_at', { ascending: false })
        .limit(limit);
      if (error) {
        console.error('Error fetching security logs:', error);
        return [];
      }
      return data || [];
    } catch (e) {
      console.error('Error fetching security logs:', e);
      return [];
    }
  }
};

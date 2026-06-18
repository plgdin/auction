import { supabase } from '../lib/supabase';

export const newsAggregatorService = {
  /**
   * Fetches the latest auction news from Google News RSS and saves them as drafts.
   * Uses rss2json API to easily parse the XML feed into JSON.
   */
  async fetchAndSaveLatestNews(): Promise<{ success: boolean; message: string; count: number }> {
    try {
      // Google News RSS URL for "auction" OR "e-auction" in India
      const rssUrl = 'https://news.google.com/rss/search?q=india+auction+OR+e-auction+OR+mstc&hl=en-IN&gl=IN&ceid=IN:en';
      const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;
      
      const response = await fetch(apiUrl);
      const data = await response.json();
      
      if (data.status !== 'ok' || !data.items) {
        throw new Error('Failed to fetch news from RSS feed');
      }

      // We only want to process the top 15 results to prevent spam
      const articles = data.items.slice(0, 15);
      let insertedCount = 0;

      for (const article of articles) {
        // Check if article with this title already exists to prevent duplicates
        const { data: existing } = await supabase
          .from('news_updates')
          .select('id')
          .eq('title', article.title)
          .single();

        if (existing) continue;

        // Clean up the description/content (Google News includes HTML in descriptions)
        const summary = article.description ? article.description.replace(/<[^>]+>/g, '').trim().substring(0, 200) + '...' : '';
        
        // Use a generic placeholder image if none provided by RSS
        let imageUrl = article.enclosure?.link || article.thumbnail || 'https://images.unsplash.com/photo-1589816790906-8d5f30e9d6ff?auto=format&fit=crop&q=80&w=800';

        // Insert as draft (is_published: false)
        const { error } = await supabase
          .from('news_updates')
          .insert({
            title: article.title,
            summary: summary,
            content: `Original Link: ${article.link}\n\n${summary}`,
            image_url: imageUrl,
            is_published: false, // Save as draft for admin approval
            published_at: null
          });

        if (!error) {
          insertedCount++;
        }
      }

      return { 
        success: true, 
        message: `Successfully synced. Found ${insertedCount} new articles to review.`,
        count: insertedCount 
      };

    } catch (error: any) {
      console.error('News aggregator error:', error);
      return { success: false, message: error.message || 'Unknown error occurred', count: 0 };
    }
  }
};

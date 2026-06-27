import { supabase } from '../lib/supabase';
import type { Blog } from '../types/database.types';

export const blogService = {
  async getBlogs(publishedOnly = true): Promise<Blog[]> {
    let query = supabase
      .from('blogs')
      .select('*')
      .order('is_featured', { ascending: false })
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (publishedOnly) {
      query = query.eq('is_published', true);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data as Blog[];
  },

  async getBlogById(id: string): Promise<Blog | null> {
    const { data, error } = await supabase
      .from('blogs')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return data as Blog | null;
  },

  async createBlog(blog: Partial<Blog>): Promise<Blog> {
    const { data, error } = await supabase
      .from('blogs')
      .insert([blog])
      .select()
      .single();
    
    if (error) throw error;
    return data as Blog;
  },

  async updateBlog(id: string, updates: Partial<Blog>): Promise<Blog> {
    const { data, error } = await supabase
      .from('blogs')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as Blog;
  },

  async deleteBlog(id: string): Promise<void> {
    const { error } = await supabase
      .from('blogs')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async updateDisplayOrders(updates: { id: string, display_order: number }[]): Promise<void> {
    for (const update of updates) {
      const { error } = await supabase
        .from('blogs')
        .update({ display_order: update.display_order })
        .eq('id', update.id);
      
      if (error) throw error;
    }
  }
};

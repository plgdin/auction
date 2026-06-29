import { supabase } from '../lib/supabase';

export const embeddingService = {
  /**
   * Generates a 384-dimensional vector embedding for a given text string using Supabase Edge Functions.
   */
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const { data, error } = await supabase.functions.invoke('get-embedding', {
        body: { text }
      });
      if (error) throw error;
      return data.embedding;
    } catch (error) {
      console.error('Edge Function embedding failed, using zero fallback:', error);
      // Fallback to zero-vector if edge function fails to prevent UI blocking
      return new Array(384).fill(0);
    }
  },

  /**
   * Pre-warm the model by loading it in the background
   * (No-op since server-side execution doesn't require local model loading)
   */
  async prewarmModel() {
    // No-op
  }
};

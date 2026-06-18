import { pipeline, env } from '@xenova/transformers';

// Skip local model check and fetch directly from HF Hub
env.allowLocalModels = false;
env.useBrowserCache = true;

class EmbeddingPipeline {
  static task = 'feature-extraction';
  static model = 'Xenova/all-MiniLM-L6-v2';
  static instance: any = null;

  static async getInstance(progress_callback?: any) {
    if (this.instance === null) {
      this.instance = await pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

export const embeddingService = {
  /**
   * Generates a 384-dimensional vector embedding for a given text string.
   */
  async generateEmbedding(text: string, progressCallback?: (progress: any) => void): Promise<number[]> {
    try {
      const extractor = await EmbeddingPipeline.getInstance(progressCallback);
      
      // Compute the embedding
      const output = await extractor(text, {
        pooling: 'mean',
        normalize: true,
      });

      // output.data is a Float32Array, convert to standard JS array
      return Array.from(output.data);
    } catch (error) {
      console.error('Failed to generate embedding:', error);
      throw error;
    }
  },

  /**
   * Pre-warm the model by loading it in the background
   */
  async prewarmModel() {
    try {
      await EmbeddingPipeline.getInstance();
      console.log('Embedding model loaded successfully.');
    } catch (e) {
      console.warn('Failed to pre-warm embedding model:', e);
    }
  }
};

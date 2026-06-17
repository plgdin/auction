import { supabase } from '../lib/supabase';

export const storageService = {
  /**
   * Uploads a file to a specific Supabase Storage bucket and returns its public URL
   */
  async uploadFile(file: File, bucketName: string): Promise<string | null> {
    try {
      // 1. Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;

      // 2. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        return null;
      }

      // 3. Get the public URL
      const { data } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      return data.publicUrl;
    } catch (err) {
      console.error('Unexpected error during file upload:', err);
      return null;
    }
  },

  /**
   * Upload an auction image specifically
   */
  async uploadAuctionImage(file: File): Promise<string | null> {
    return this.uploadFile(file, 'auction_images');
  },

  /**
   * Upload an auction document specifically
   */
  async uploadAuctionDocument(file: File): Promise<string | null> {
    return this.uploadFile(file, 'auction_documents');
  },

  /**
   * Triggers a browser download for a public Supabase URL
   */
  async downloadFile(url: string, fileName: string) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Error downloading file:', err);
    }
  },

  /**
   * Fetches all documents associated with a user across auctions and tenders
   * Since we don't have a unified generic documents table, we query the specific ones
   * and normalize the output.
   */
  async getUserDocuments(userId: string) {
    const documents = [];

    // Fetch Auction Documents
    const { data: auctionDocs, error: auctionError } = await supabase
      .from('auction_documents')
      .select('id, name, file_url, created_at, auction_id')
      .eq('uploaded_by', userId);

    if (!auctionError && auctionDocs) {
      documents.push(...auctionDocs.map(d => ({
        id: d.id,
        name: d.name,
        url: d.file_url,
        createdAt: d.created_at,
        source: 'Auction Attachment',
        sourceId: d.auction_id
      })));
    }

    // Fetch Tender Documents
    const { data: tenderDocs, error: tenderError } = await supabase
      .from('tender_documents')
      .select('id, name, file_url, created_at, tender_id')
      .eq('uploaded_by', userId);

    if (!tenderError && tenderDocs) {
      documents.push(...tenderDocs.map(d => ({
        id: d.id,
        name: d.name,
        url: d.file_url,
        createdAt: d.created_at,
        source: 'Tender Attachment',
        sourceId: d.tender_id
      })));
    }

    // Fetch User Documents (Vault KYC)
    const { data: userDocs, error: userError } = await supabase
      .from('user_documents')
      .select('id, name, file_url, created_at, document_type')
      .eq('user_id', userId);

    if (!userError && userDocs) {
      documents.push(...userDocs.map(d => ({
        id: d.id,
        name: d.name,
        url: d.file_url,
        createdAt: d.created_at,
        source: 'User Vault (KYC)',
        sourceId: d.document_type
      })));
    }

    // Sort by newest first
    return documents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * Save a document record to the database
   */
  async saveUserDocument(userId: string, name: string, fileUrl: string, documentType: string = 'kyc') {
    const { data, error } = await supabase
      .from('user_documents')
      .insert([{ user_id: userId, name, file_url: fileUrl, document_type: documentType }])
      .select()
      .single();
    
    if (error) {
      console.error('Error saving user document:', error);
      return null;
    }
    return data;
  }
};

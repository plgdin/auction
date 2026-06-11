import { useEffect, useState, useRef, useCallback } from 'react';
import { FileText, FileImage, Download, UploadCloud, X, FolderLock, Eye } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { storageService } from '../../services/storageService';

interface VaultDocument {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  source: string;
  sourceId: string;
}

export function DocumentVault() {
  const { user } = useAuthStore();
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  
  // Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<VaultDocument | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const docs = await storageService.getUserDocuments(user.id);
    setDocuments(docs);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    
    // Upload generic KYC document
    // In a full implementation, we would insert a record into a 'user_documents' table here.
    // Since we are mocking the vault fetching via auction/tender tables, we will upload to storage
    // and manually inject it into the UI state to demonstrate functionality.
    const url = await storageService.uploadFile(file, 'documents');
    
    if (url) {
      setDocuments(prev => [{
        id: Math.random().toString(),
        name: file.name,
        url,
        createdAt: new Date().toISOString(),
        source: 'User Vault (KYC)',
        sourceId: 'N/A'
      }, ...prev]);
    }
    
    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isImage = (fileName: string) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded shadow-sm border border-border">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center">
            <FolderLock className="w-6 h-6 mr-3 text-primary" />
            Document Vault
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">Secure storage for your KYC documents, auction images, and tender attachments.</p>
        </div>
        
        <div>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload}
            className="hidden" 
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-6 py-2 bg-primary text-white font-bold rounded hover:bg-primary/95 transition-colors flex items-center disabled:opacity-50"
          >
            {isUploading ? (
              <span className="flex items-center"><div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Uploading...</span>
            ) : (
              <><UploadCloud className="w-4 h-4 mr-2" /> Upload Document</>
            )}
          </button>
        </div>
      </div>

      {/* Document Grid */}
      <div className="bg-white rounded shadow-sm border border-border overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-20 bg-muted">
            <FolderLock className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-foreground">Your vault is empty</h3>
            <p className="text-muted-foreground mt-1 mb-6 max-w-md mx-auto text-sm">Upload KYC documents or participate in auctions/tenders to see your associated files here.</p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2 bg-white border border-border text-foreground font-bold rounded hover:bg-muted transition-colors"
            >
              Upload First File
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-muted border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-6 py-4 font-bold">File Details</th>
                  <th className="px-6 py-4 font-bold">Associated Entity</th>
                  <th className="px-6 py-4 font-bold">Upload Date</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`p-2 rounded mr-3 ${isImage(doc.name) ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                          {isImage(doc.name) ? <FileImage className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground truncate max-w-xs" title={doc.name}>
                            {doc.name}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {isImage(doc.name) ? 'Image Asset' : 'PDF/Document'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-muted text-foreground border border-border">
                        {doc.source}
                      </span>
                      {doc.sourceId !== 'N/A' && (
                        <p className="text-xs font-mono text-muted-foreground mt-1 truncate max-w-[120px]" title={doc.sourceId}>
                          {doc.sourceId.split('-')[0]}...
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        className="inline-flex items-center px-3 py-1.5 bg-muted hover:bg-border/50 text-foreground text-xs font-bold rounded transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1.5" /> Preview
                      </button>
                      <button
                        onClick={() => storageService.downloadFile(doc.url, doc.name)}
                        className="inline-flex items-center px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded transition-colors"
                      >
                        <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/80 backdrop-blur-sm">
          <div className="bg-white rounded w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted">
              <div className="flex items-center">
                {isImage(previewDoc.name) ? <FileImage className="w-5 h-5 text-primary mr-2" /> : <FileText className="w-5 h-5 text-destructive mr-2" />}
                <h3 className="font-bold text-foreground truncate max-w-lg">{previewDoc.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => storageService.downloadFile(previewDoc.url, previewDoc.name)}
                  className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded transition-colors"
                  title="Download File"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-muted p-6 flex items-center justify-center min-h-[500px]">
              {isImage(previewDoc.name) ? (
                <img 
                  src={previewDoc.url} 
                  alt={previewDoc.name} 
                  className="max-w-full max-h-[70vh] object-contain rounded shadow-md border border-border bg-white"
                />
              ) : (
                <iframe 
                  src={`${previewDoc.url}#toolbar=0`} 
                  className="w-full h-[70vh] rounded shadow-md border border-border bg-white"
                  title="Document Preview"
                />
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

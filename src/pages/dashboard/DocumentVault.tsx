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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <FolderLock className="w-6 h-6 mr-3 text-primary" />
            Document Vault
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Secure storage for your KYC documents, auction images, and tender attachments.</p>
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
            className="px-6 py-2 bg-primary text-white font-bold rounded-lg hover:bg-primary-700 transition-colors flex items-center disabled:opacity-50"
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
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-20 bg-slate-50">
            <FolderLock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">Your vault is empty</h3>
            <p className="text-slate-500 mt-1 mb-6 max-w-md mx-auto text-sm">Upload KYC documents or participate in auctions/tenders to see your associated files here.</p>
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-2 bg-white border border-slate-300 text-slate-700 font-bold rounded-lg hover:bg-slate-50 transition-colors"
            >
              Upload First File
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4 font-semibold">File Details</th>
                  <th className="px-6 py-4 font-semibold">Associated Entity</th>
                  <th className="px-6 py-4 font-semibold">Upload Date</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {documents.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`p-2 rounded-lg mr-3 ${isImage(doc.name) ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                          {isImage(doc.name) ? <FileImage className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900 truncate max-w-xs" title={doc.name}>
                            {doc.name}
                          </p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {isImage(doc.name) ? 'Image Asset' : 'PDF/Document'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-800">
                        {doc.source}
                      </span>
                      {doc.sourceId !== 'N/A' && (
                        <p className="text-xs font-mono text-slate-400 mt-1 truncate max-w-[120px]" title={doc.sourceId}>
                          {doc.sourceId.split('-')[0]}...
                        </p>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                      <button
                        onClick={() => setPreviewDoc(doc)}
                        className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-md transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 mr-1.5" /> Preview
                      </button>
                      <button
                        onClick={() => storageService.downloadFile(doc.url, doc.name)}
                        className="inline-flex items-center px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold rounded-md transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center">
                {isImage(previewDoc.name) ? <FileImage className="w-5 h-5 text-blue-500 mr-2" /> : <FileText className="w-5 h-5 text-red-500 mr-2" />}
                <h3 className="font-bold text-slate-900 truncate max-w-lg">{previewDoc.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => storageService.downloadFile(previewDoc.url, previewDoc.name)}
                  className="p-2 text-slate-500 hover:text-primary hover:bg-slate-200 rounded-lg transition-colors"
                  title="Download File"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 text-slate-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-6 flex items-center justify-center min-h-[500px]">
              {isImage(previewDoc.name) ? (
                <img 
                  src={previewDoc.url} 
                  alt={previewDoc.name} 
                  className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-md border border-slate-200 bg-white"
                />
              ) : (
                <iframe 
                  src={`${previewDoc.url}#toolbar=0`} 
                  className="w-full h-[70vh] rounded-lg shadow-md border border-slate-200 bg-white"
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

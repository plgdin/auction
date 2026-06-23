// @ts-nocheck
import { useEffect, useState, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText, FileImage, Download, UploadCloud, X, FolderLock,
  Eye, Trash2, CheckCircle, AlertTriangle, HelpCircle, ArrowRight, ShieldCheck,
  ChevronDown
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { storageService } from '../../services/storageService';
import { dashboardService } from '../../services/dashboardService';
import { auctionService } from '../../services/auctionService';
import { MstcSearchService } from '../../services/publicService';
import { toast } from 'react-hot-toast';
import { Dropdown } from 'antd';
import { DownOutlined } from '@ant-design/icons';

interface VaultDocument {
  id: string;
  name: string;
  url: string;
  createdAt: string;
  source: string;
  sourceId: string;
}

const STANDARD_DOC_TYPES = [
  'MSTC Buyer Registration Certificate',
  'GSTIN Registration Certificate',
  'SPCB Consent to Operate (CTO)',
  'CPCB Recycler Registration',
  'ELV Dismantling License / RVSF',
  'Forest Division Timber Transit Pass',
  'Chartered Engineer Safety Certificate',
  'Aadhaar Card / Identity Proof',
  'PAN Card',
  'Partnership Deed / Company Incorporation',
  'Other (Specify custom name)'
];

export function DocumentVault() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'vault' | 'eligibility'>('vault');
  const [documents, setDocuments] = useState<VaultDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  // Watchlist & Won auctions for metadata linking
  const [watchlistItems, setWatchlistItems] = useState<any[]>([]);
  const [wonItems, setWonItems] = useState<any[]>([]);
  const [isLoadingEligibility, setIsLoadingEligibility] = useState(false);

  // Upload Modal State
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState('MSTC Buyer Registration Certificate');
  const [customDocType, setCustomDocType] = useState('');
  const [entityType, setEntityType] = useState('User Vault');
  const [customEntity, setCustomEntity] = useState('');
  const [docTypeDropdownOpen, setDocTypeDropdownOpen] = useState(false);
  const [entityDropdownOpen, setEntityDropdownOpen] = useState(false);
  const uploadModalRef = useRef<HTMLDivElement>(null);

  // Preview Modal State
  const [previewDoc, setPreviewDoc] = useState<VaultDocument | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadDocuments = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const docs = await storageService.getUserDocuments(user.id);
      setDocuments(docs);
    } catch (err) {
      console.error('Failed to load documents:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const loadMetadataOptions = useCallback(async () => {
    if (!user) return;
    setIsLoadingEligibility(true);
    try {
      // Load interested watchlist auctions
      const watchlistIds = dashboardService.getInterestedAuctions(user.id);
      const watchDetails = await Promise.all(
        watchlistIds.map(id => MstcSearchService.getMstcAuctionById(id))
      );
      setWatchlistItems(watchDetails.filter(Boolean));

      // Load won auctions
      const dbWon = await auctionService.getWonAuctions(user.id);
      const localData = localStorage.getItem(`usr_won_auctions_${user.id}`);
      const localWon = localData ? JSON.parse(localData) : [];
      setWonItems([...localWon, ...dbWon]);
    } catch (err) {
      console.error('Failed to load metadata options:', err);
    } finally {
      setIsLoadingEligibility(false);
    }
  }, [user]);

  useEffect(() => {
    loadDocuments();
    loadMetadataOptions();
  }, [loadDocuments, loadMetadataOptions]);

  useEffect(() => {
    async function fetchPreviewUrl() {
      if (!previewDoc) {
        setPreviewUrl(null);
        return;
      }
      setIsLoadingPreview(true);
      try {
        let bucketName = 'auction_documents';
        if (previewDoc.source === 'Tender Attachment') bucketName = 'tender_documents';
        if (previewDoc.source === 'User Vault (KYC)') bucketName = 'auction_documents';

        const signedUrl = await storageService.getSignedUrl(previewDoc.url, bucketName);
        setPreviewUrl(signedUrl);
      } catch (err) {
        console.error('Preview error:', err);
      } finally {
        setIsLoadingPreview(false);
      }
    }
    fetchPreviewUrl();
  }, [previewDoc]);

  // Helper to parse stored metadata
  const parseDocMetadata = (doc: VaultDocument) => {
    let typeDisplay = doc.sourceId || 'Other';
    let entityDisplay = doc.source === 'User Vault (KYC)' ? 'User Vault' : doc.source;

    if (doc.source === 'User Vault (KYC)' && doc.sourceId && doc.sourceId.includes('::')) {
      const parts = doc.sourceId.split('::');
      typeDisplay = parts[0] || 'Other';
      entityDisplay = parts[1] || 'User Vault';
      if (entityDisplay === 'User Vault (KYC)') {
        entityDisplay = 'User Vault';
      }
    }

    return { typeDisplay, entityDisplay };
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setIsUploadModalOpen(true);
    }
  };

  const handleStartUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || !user) return;

    setIsUploading(true);
    try {
      const finalDocType = docType === 'Other (Specify custom name)' ? customDocType.trim() : docType;
      const finalEntity = entityType === 'Custom Entity Name (Specify below)' ? customEntity.trim() : entityType;

      if (!finalDocType) {
        toast.error('Please specify a document type');
        setIsUploading(false);
        return;
      }
      if (!finalEntity) {
        toast.error('Please specify an associated entity');
        setIsUploading(false);
        return;
      }

      // Upload file to Supabase storage
      toast.loading(`Uploading ${selectedFile.name}...`, { id: 'vault_upload' });
      const url = await storageService.uploadFile(selectedFile, 'auction_documents');

      if (url) {
        const combinedMetadata = `${finalDocType}::${finalEntity}`;
        const dbDoc = await storageService.saveUserDocument(user.id, selectedFile.name, url, combinedMetadata);

        if (dbDoc) {
          toast.success('Document uploaded and indexed successfully!', { id: 'vault_upload' });
          setIsUploadModalOpen(false);
          setSelectedFile(null);
          // Reset form
          setDocType('MSTC Buyer Registration Certificate');
          setCustomDocType('');
          setEntityType('User Vault');
          setCustomEntity('');
          loadDocuments();
        } else {
          toast.error('Failed to save document metadata in database', { id: 'vault_upload' });
        }
      } else {
        toast.error('File upload failed', { id: 'vault_upload' });
      }
    } catch (error) {
      console.error('Upload handler error:', error);
      toast.error('Unexpected error during upload');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (docId: string, source: string, fileUrl: string, name: string) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${name}" from your vault?`)) {
      return;
    }
    try {
      const success = await storageService.deleteDocument(docId, source, fileUrl);
      if (success) {
        toast.success('Document deleted');
        setDocuments(prev => prev.filter(doc => doc.id !== docId));
      } else {
        toast.error('Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('An error occurred during deletion');
    }
  };

  // Automated compliance matching logic
  const checkDocumentMatch = (reqDocName: string) => {
    const cleanReq = reqDocName.toLowerCase().replace(/[^a-z0-9]/g, '');

    // Normalize aliases to map requirements to dropdown types
    const getNormalizedType = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.includes('spcb') || lower.includes('consent to operate') || lower.includes('cto') || lower.includes('pollution control board')) return 'spcb';
      if (lower.includes('cpcb') || lower.includes('recycler registration')) return 'cpcb';
      if (lower.includes('elv') || lower.includes('rvsf') || lower.includes('dismantling') || lower.includes('vehicle')) return 'elv';
      if (lower.includes('gstin') || lower.includes('gst') || lower.includes('goods and services')) return 'gst';
      if (lower.includes('mstc buyer') || lower.includes('mstc registration')) return 'mstc';
      if (lower.includes('timber') || lower.includes('transit pass') || lower.includes('forest')) return 'timber';
      if (lower.includes('chartered engineer') || lower.includes('safety certificate')) return 'chartered';
      if (lower.includes('aadhaar') || lower.includes('identity')) return 'identity';
      if (lower.includes('pan')) return 'pan';
      return lower.replace(/[^a-z0-9]/g, '');
    };

    const reqNorm = getNormalizedType(reqDocName);

    return documents.find(doc => {
      const { typeDisplay } = parseDocMetadata(doc);
      const docNorm = getNormalizedType(typeDisplay);
      const fileNameNorm = getNormalizedType(doc.name);

      return docNorm === reqNorm || fileNameNorm.includes(reqNorm) || reqNorm.includes(docNorm);
    });
  };

  const handleTriggerMissingUpload = (docName: string, auctionRef: string, auctionTitle: string) => {
    // Preset fields for the user to make upload frictionless
    const matchingStandard = STANDARD_DOC_TYPES.find(t => {
      const tClean = t.toLowerCase().replace(/[^a-z0-9]/g, '');
      const reqClean = docName.toLowerCase().replace(/[^a-z0-9]/g, '');
      return tClean.includes(reqClean) || reqClean.includes(tClean);
    });

    setDocType(matchingStandard || 'Other (Specify custom name)');
    if (!matchingStandard) setCustomDocType(docName);
    setEntityType(`${auctionRef} - ${auctionTitle}`);

    fileInputRef.current?.click();
  };

  const isImage = (fileName: string) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(fileName);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <FolderLock className="w-6 h-6 mr-3 text-slate-950" />
            Document Vault & Compliance
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Secure storage for your KYC documents, auction licenses, and certificates with auto-eligibility matching.</p>
        </div>

        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-700 transition-all flex items-center disabled:opacity-50 shadow-xs cursor-pointer"
          >
            <UploadCloud className="w-4 h-4 mr-2" /> Upload Document
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('vault')}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-all cursor-pointer ${activeTab === 'vault'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          My Vault Documents ({documents.length})
        </button>
        <button
          onClick={() => setActiveTab('eligibility')}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-all cursor-pointer ${activeTab === 'eligibility'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
        >
          Compliance Eligibility Advisor
        </button>
      </div>

      {activeTab === 'vault' ? (
        /* Tab 1: Vault Documents */
        <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-20 bg-slate-50">
              <FolderLock className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900">Your vault is empty</h3>
              <p className="text-slate-500 mt-1 mb-6 max-w-md mx-auto text-sm">Upload KYC certificates or recycler licenses to start matching them against government catalog requirements.</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 bg-white border border-slate-250 text-slate-800 text-xs font-bold rounded-xl hover:bg-slate-55 transition-all cursor-pointer shadow-2xs"
              >
                Upload First File
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-6 py-4 font-bold">Document Title & File</th>
                    <th className="px-6 py-4 font-bold">Document Type</th>
                    <th className="px-6 py-4 font-bold">Associated Entity / Target</th>
                    <th className="px-6 py-4 font-bold">Upload Date</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {documents.map((doc) => {
                    const { typeDisplay, entityDisplay } = parseDocMetadata(doc);
                    return (
                      <tr key={doc.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <div className={`p-2 rounded-lg mr-3 shrink-0 ${isImage(doc.name) ? 'bg-indigo-50 text-indigo-600' : 'bg-red-50 text-red-600'}`}>
                              {isImage(doc.name) ? <FileImage className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                            </div>
                            <div className="truncate max-w-[200px] sm:max-w-xs">
                              <p className="text-sm font-bold text-slate-800 truncate" title={doc.name}>
                                {doc.name}
                              </p>
                              <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider">
                                {isImage(doc.name) ? 'Image file' : 'PDF Document'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                            {typeDisplay}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-650">
                          <div className="truncate max-w-[180px] font-semibold text-slate-700" title={entityDisplay}>
                            {entityDisplay}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-550 whitespace-nowrap">
                          {new Date(doc.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 text-right space-x-2 whitespace-nowrap">
                          <button
                            onClick={() => setPreviewDoc(doc)}
                            className="inline-flex items-center px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" /> Preview
                          </button>
                          <button
                            onClick={async () => {
                              const storagePath = storageService.extractStoragePath(doc.url);
                              await storageService.downloadPrivateFile('auction_documents', storagePath, doc.name);
                            }}
                            className="inline-flex items-center px-3 py-1.5 bg-primary hover:bg-primary-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-2xs"
                          >
                            <Download className="w-3.5 h-3.5 mr-1" /> Download
                          </button>
                          <button
                            onClick={() => handleDelete(doc.id, doc.source, doc.url, doc.name)}
                            className="inline-flex items-center px-3 py-1.5 border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Tab 2: Compliance Eligibility Advisor */
        <div className="space-y-6">
          {isLoadingEligibility ? (
            <div className="flex justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : watchlistItems.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300 shadow-2xs">
              <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-slate-900">No watchlist auctions to evaluate</h3>
              <p className="text-slate-500 mt-1 mb-6 text-sm">Add government auctions to your interested watchlist to run automatic compliance evaluation.</p>
              <Link to="/auctions?tab=mstc" className="inline-flex items-center px-5 py-2.5 text-xs font-bold rounded-xl text-white bg-slate-950 hover:bg-slate-800 transition-all shadow-xs hover:shadow-md">
                Browse eAuctions
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="bg-emerald-50 border border-emerald-250 p-5 rounded-2xl flex items-start gap-4">
                <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-emerald-950 text-sm">Automated Compliance Auditor Active</h4>
                  <p className="text-xs text-emerald-900 mt-1 leading-relaxed">
                    The platform scans your vault uploaded certificates against dynamic catalog requirements for SPCB, CPCB, ELV automobile, forest division licenses and GSTIN status to verify bidding eligibility.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {watchlistItems.map((item) => {
                  // Fetch or derive compliance info
                  const compInfo = item.complianceInfo || { requiredDocuments: [] };
                  const reqDocs = compInfo.requiredDocuments || [];

                  if (reqDocs.length === 0) {
                    // Fallback to basic mandatory document if none parsed
                    reqDocs.push({
                      name: 'MSTC Buyer Registration Certificate',
                      type: 'mandatory',
                      description: 'Buyer login credentials and active registration with MSTC portal.'
                    });
                  }

                  // Count matching documents
                  let matchedCount = 0;
                  const docsStatus = reqDocs.map(req => {
                    const match = checkDocumentMatch(req.name);
                    if (match) matchedCount++;
                    return {
                      req,
                      match,
                    };
                  });

                  const percent = Math.round((matchedCount / reqDocs.length) * 100);
                  const isFullyEligible = percent === 100;

                  return (
                    <div key={item.id} className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                      {/* Auction header status */}
                      <div className="p-5 border-b border-slate-150 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 font-mono uppercase bg-slate-200 px-2 py-0.5 rounded">
                              REF: {item.reference_number || 'N/A'}
                            </span>
                            <span className="text-xs text-slate-450 font-semibold">
                              {item.seller_name}
                            </span>
                          </div>
                          <h3 className="text-sm font-bold text-slate-900 mt-1 leading-snug">
                            {item.title}
                          </h3>
                        </div>

                        {/* Eligibility Score */}
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <span className="text-[10px] font-black text-slate-400 block uppercase tracking-wider">Compliance Score</span>
                            <span className={`text-lg font-black block ${isFullyEligible ? 'text-emerald-600' : percent >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                              {percent}% Approved
                            </span>
                          </div>
                          <div className={`px-3 py-1.5 rounded-xl text-xs font-bold border uppercase tracking-wider ${isFullyEligible
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : 'bg-amber-50 border-amber-200 text-amber-700'
                            }`}>
                            {isFullyEligible ? 'Ready to Bid' : `${reqDocs.length - matchedCount} Action Required`}
                          </div>
                        </div>
                      </div>

                      {/* Documents Checklist mapping */}
                      <div className="p-5 divide-y divide-slate-100 bg-white">
                        {docsStatus.map(({ req, match }, idx) => (
                          <div key={idx} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1 max-w-xl">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${req.type === 'mandatory' ? 'bg-red-500' : 'bg-amber-400'}`} title={req.type} />
                                <h4 className="text-xs font-bold text-slate-800">{req.name}</h4>
                                <span className="text-[9px] uppercase tracking-wider font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                  {req.type}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 leading-normal font-medium pl-4">
                                {req.description}
                              </p>
                            </div>

                            {/* Status badge & action */}
                            <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                              {match ? (
                                <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-800">
                                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                                  <span className="truncate max-w-[120px]" title={match.name}>{match.name}</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1 bg-red-50 border border-red-200 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-800">
                                    <AlertTriangle className="w-4 h-4 text-red-500 shrink-0" />
                                    <span>Missing</span>
                                  </div>
                                  <button
                                    onClick={() => handleTriggerMissingUpload(req.name, item.reference_number || 'N/A', item.title)}
                                    className="px-3.5 py-1.5 bg-primary hover:bg-primary-700 text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer shadow-2xs flex items-center gap-1"
                                  >
                                    Upload <ArrowRight className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Upload Metadata Dialog Modal */}
      {isUploadModalOpen && selectedFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/45 backdrop-blur-md">
          <div ref={uploadModalRef} className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-visible animate-in fade-in-50 zoom-in-95 duration-150 relative">
            <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                <UploadCloud className="w-5 h-5 text-slate-900" /> Index Uploaded File
              </h3>
              <button
                onClick={() => {
                  setIsUploadModalOpen(false);
                  setSelectedFile(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleStartUpload} className="p-6 space-y-4">
              {/* Selected File Details */}
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Target File</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5 truncate">{selectedFile.name}</p>
                <p className="text-xs font-semibold text-slate-500 mt-1">Size: {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
              </div>

              {/* Document Type Dropdown */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-650 uppercase tracking-wider block">Document Category / Type *</label>
                <Dropdown
                  open={docTypeDropdownOpen}
                  onOpenChange={setDocTypeDropdownOpen}
                  popupRender={() => (
                    <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-2 min-w-[200px] max-h-[280px] overflow-y-auto custom-scrollbar flex flex-col gap-0.5" style={{ scrollbarWidth: 'thin' }}>
                      {STANDARD_DOC_TYPES.map((type) => {
                        const isSelected = docType === type;
                        return (
                          <div
                            key={type}
                            onClick={() => { setDocType(type); setDocTypeDropdownOpen(false); }}
                            className={`flex items-center gap-2 py-1.5 px-2.5 rounded-lg cursor-pointer text-sm font-medium transition-colors select-none ${
                              isSelected
                                ? 'bg-primary-50/70 text-primary font-semibold'
                                : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            <span className={`w-4 h-4 rounded border transition-colors flex items-center justify-center flex-shrink-0 ${
                              isSelected
                                ? 'border-primary bg-primary'
                                : 'border-slate-300 bg-white'
                            }`}>
                              {isSelected && (
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-2.5 h-2.5 text-white">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </span>
                            <span className="truncate">{type}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  trigger={['click']}
                  placement="bottomLeft"
                  getPopupContainer={() => uploadModalRef.current || document.body}
                >
                  <button
                    type="button"
                    className="w-full flex justify-between items-center px-3.5 py-2.5 border border-slate-250 rounded-xl shadow-2xs bg-white text-sm text-slate-700 hover:border-primary hover:bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-left cursor-pointer"
                  >
                    <span className="truncate">{docType}</span>
                    <DownOutlined className="w-3.5 h-3.5 text-slate-450 shrink-0 ml-2" />
                  </button>
                </Dropdown>
              </div>

              {/* Custom Document Type Input */}
              {docType === 'Other (Specify custom name)' && (
                <div className="space-y-1 animate-in fade-in-50 duration-150">
                  <label className="text-xs font-bold text-slate-650 uppercase tracking-wider block">Custom Document Name *</label>
                  <input
                    type="text"
                    required
                    value={customDocType}
                    onChange={(e) => setCustomDocType(e.target.value)}
                    placeholder="e.g. Hazardous Materials Transport License"
                    className="w-full px-3.5 py-2.5 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              )}

              {/* Associated Entity Dropdown */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-650 uppercase tracking-wider block">Associated Entity / Auction *</label>
                <Dropdown
                  open={entityDropdownOpen}
                  onOpenChange={setEntityDropdownOpen}
                  popupRender={() => {
                    const allEntityOptions = [
                      { key: 'User Vault', label: 'User Vault - General' },
                      ...watchlistItems.map(item => ({
                        key: `${item.reference_number || 'N/A'} - ${item.title}`,
                        label: `${item.reference_number || 'N/A'} - ${item.title.substring(0, 35)}...`,
                        group: 'Interested'
                      })),
                      ...wonItems.map(item => ({
                        key: `${item.reference_number || 'N/A'} - ${item.title}`,
                        label: `Won: ${item.reference_number || 'N/A'} - ${item.title.substring(0, 35)}...`,
                        group: 'Won'
                      })),
                      { key: 'Custom Entity Name (Specify below)', label: 'Custom Entity Name (Specify below)...' },
                    ];
                    let lastGroup;
                    return (
                      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-2 min-w-[200px] max-h-[280px] overflow-y-auto custom-scrollbar flex flex-col gap-0.5" style={{ scrollbarWidth: 'thin' }}>
                        {allEntityOptions.map((opt, idx) => {
                          const isSelected = entityType === opt.key;
                          let showGroupHeader = false;
                          if (opt.group && opt.group !== lastGroup) {
                            showGroupHeader = true;
                            lastGroup = opt.group;
                          }
                          return (
                            <div key={opt.key + idx}>
                              {showGroupHeader && (
                                <>
                                  <div className="h-px bg-slate-100 my-1" />
                                  <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">{opt.group === 'Interested' ? 'Interested Watchlist' : 'Won Auctions'}</div>
                                </>
                              )}
                              <div
                                onClick={() => { setEntityType(opt.key); setEntityDropdownOpen(false); }}
                                className={`flex items-center gap-2 py-1.5 px-2.5 rounded-lg cursor-pointer text-sm font-medium transition-colors select-none ${
                                  isSelected
                                    ? 'bg-primary-50/70 text-primary font-semibold'
                                    : 'hover:bg-slate-50 text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                <span className={`w-4 h-4 rounded border transition-colors flex items-center justify-center flex-shrink-0 ${
                                  isSelected
                                    ? 'border-primary bg-primary'
                                    : 'border-slate-300 bg-white'
                                }`}>
                                  {isSelected && (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-2.5 h-2.5 text-white">
                                      <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                  )}
                                </span>
                                <span className="truncate">{opt.label}</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  }}
                  trigger={['click']}
                  placement="bottomLeft"
                  getPopupContainer={() => uploadModalRef.current || document.body}
                >
                  <button
                    type="button"
                    className="w-full flex justify-between items-center px-3.5 py-2.5 border border-slate-250 rounded-xl shadow-2xs bg-white text-sm text-slate-700 hover:border-primary hover:bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-left cursor-pointer"
                  >
                    <span className="truncate">
                      {entityType === 'User Vault' ? 'User Vault - General' : entityType === 'Custom Entity Name (Specify below)' ? 'Custom Entity Name...' : entityType}
                    </span>
                    <DownOutlined className="w-3.5 h-3.5 text-slate-450 shrink-0 ml-2" />
                  </button>
                </Dropdown>
              </div>

              {/* Custom Associated Entity Input */}
              {entityType === 'Custom Entity Name (Specify below)' && (
                <div className="space-y-1 animate-in fade-in-50 duration-150">
                  <label className="text-xs font-bold text-slate-650 uppercase tracking-wider block">Custom Associated Name *</label>
                  <input
                    type="text"
                    required
                    value={customEntity}
                    onChange={(e) => setCustomEntity(e.target.value)}
                    placeholder="e.g. BSNL Delhi division or Custom Project Name"
                    className="w-full px-3.5 py-2.5 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setIsUploadModalOpen(false);
                    setSelectedFile(null);
                  }}
                  className="px-4 py-2.5 border border-slate-250 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-5 py-2.5 bg-primary hover:bg-primary-700 disabled:bg-slate-400 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center"
                >
                  {isUploading ? 'Uploading...' : 'Save & Index'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/45 backdrop-blur-md">
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150 bg-slate-50/50">
              <div className="flex items-center">
                {isImage(previewDoc.name) ? <FileImage className="w-5 h-5 text-indigo-650 mr-2" /> : <FileText className="w-5 h-5 text-red-600 mr-2" />}
                <h3 className="font-bold text-slate-900 truncate max-w-lg">{previewDoc.name}</h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    const storagePath = storageService.extractStoragePath(previewDoc.url);
                    await storageService.downloadPrivateFile('auction_documents', storagePath, previewDoc.name);
                  }}
                  className="p-2 text-slate-500 hover:text-slate-850 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="Download File"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setPreviewDoc(null)}
                  className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto bg-slate-100 p-6 flex items-center justify-center min-h-[500px]">
              {isLoadingPreview ? (
                <div className="flex flex-col items-center text-slate-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
                  <p className="text-sm font-semibold">Loading secure preview...</p>
                </div>
              ) : !previewUrl ? (
                <div className="flex flex-col items-center text-red-550">
                  <X className="w-8 h-8 mb-4" />
                  <p className="text-sm font-bold">Failed to load secure preview</p>
                </div>
              ) : isImage(previewDoc.name) ? (
                <img
                  src={previewUrl}
                  alt={previewDoc.name}
                  className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-md border border-slate-200 bg-white"
                />
              ) : (
                <iframe
                  src={`${previewUrl || ''}#toolbar=0`}
                  className="w-full h-[70vh] rounded-xl shadow-md border border-slate-200 bg-white"
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

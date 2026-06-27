// @ts-nocheck
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { 
  Heart, Plus, Trash2, Edit3, ClipboardCheck, 
  Upload, Download, Calendar, DollarSign, FileText, CheckCircle, X
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useAppStore } from '../../store/appStore';
import { MstcCard } from '../../components/auction/MstcCard';
import { lazy, Suspense } from 'react';
const MstcDetailsModal = lazy(() => import('../../components/auction/MstcDetailsModal').then(module => ({ default: module.MstcDetailsModal })));
import { MstcSearchService } from '../../services/publicService';
import { dashboardService } from '../../services/dashboardService';
import { storageService } from '../../services/storageService';
import { auctionService } from '../../services/auctionService';
import type { MstcSanitizedAuction } from '../../services/publicService';
import { toast } from 'react-hot-toast';

export function Interested() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'interested' | 'won'>('interested');
  const [mstcWatchlist, setMstcWatchlist] = useState<MstcSanitizedAuction[]>([]);
  const [wonList, setWonList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Government Preview Modal
  const [selectedPreviewItem, setSelectedPreviewItem] = useState<MstcSanitizedAuction | null>(null);

  // Add/Edit Won Auction Modal State
  const [isAddWonModalOpen, setIsAddWonModalOpen] = useState(false);
  const [editingWonItem, setEditingWonItem] = useState<any | null>(null);
  const [wonTitle, setWonTitle] = useState('');
  const [wonRefNo, setWonRefNo] = useState('');
  const [wonClosingBid, setWonClosingBid] = useState('');
  const [wonClosingDate, setWonClosingDate] = useState('');
  const [wonFile, setWonFile] = useState<File | null>(null);
  const [isSavingWon, setIsSavingWon] = useState(false);

  const { interestedMstcIds, toggleInterestedMstcId } = useAppStore();

  const loadMstcWatchlist = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      if (interestedMstcIds.length > 0) {
        const items = await Promise.all(
          interestedMstcIds.map(id => MstcSearchService.getMstcAuctionById(id))
        );
        setMstcWatchlist(items.filter((item): item is MstcSanitizedAuction => item !== null));
      } else {
        setMstcWatchlist([]);
      }
    } catch (error) {
      console.error('Failed to load MSTC watchlist:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadWonAuctions = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      // Load from supabase bids
      const dbWon = await auctionService.getWonAuctions(user.id);
      // Load from localStorage
      const localData = localStorage.getItem(`usr_won_auctions_${user.id}`);
      const localWon = localData ? JSON.parse(localData) : [];
      
      const combined = [
        ...localWon.map((item: any) => ({ ...item, isManual: true })),
        ...dbWon.map((item: any) => ({ ...item, isManual: false }))
      ];
      setWonList(combined);
    } catch (error) {
      console.error('Failed to load won auctions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'interested') {
      loadMstcWatchlist();
    } else {
      loadWonAuctions();
    }
  }, [user, activeTab, interestedMstcIds]);

  const handleMstcInterestedToggle = (itemId: string) => {
    if (!user) return;
    toggleInterestedMstcId(user.id, itemId);
    if (selectedPreviewItem?.id === itemId) {
      setSelectedPreviewItem(null);
    }
  };

  const generateMockLots = (title: string) => {
    return JSON.stringify({
      items: [
        {
          id: 'manual_lot_1',
          lotNo: '1',
          description: `High-grade ${title} Lot A`,
          qty: 15,
          unit: 'MT',
          checked: false,
          status: 'pending'
        },
        {
          id: 'manual_lot_2',
          lotNo: '2',
          description: `Processed secondary ${title} Lot B`,
          qty: 45,
          unit: 'KG',
          checked: false,
          status: 'pending'
        },
        {
          id: 'manual_lot_3',
          lotNo: '3',
          description: `Industrial surplus ${title} Lot C`,
          qty: 3,
          unit: 'MT',
          checked: false,
          status: 'pending'
        }
      ]
    });
  };

  const handleOpenAddWonModal = () => {
    setEditingWonItem(null);
    setWonTitle('');
    setWonRefNo('');
    setWonClosingBid('');
    setWonClosingDate('');
    setWonFile(null);
    setIsAddWonModalOpen(true);
  };

  const handleOpenEditWonModal = (item: any) => {
    setEditingWonItem(item);
    setWonTitle(item.title || '');
    setWonRefNo(item.reference_number || '');
    setWonClosingBid(item.closing_bid ? String(item.closing_bid) : '');
    setWonClosingDate(item.closing_date || '');
    setWonFile(null);
    setIsAddWonModalOpen(true);
  };

  const handleDeleteWon = (itemId: string) => {
    if (!window.confirm('Are you sure you want to remove this won auction?')) return;
    const localKey = `usr_won_auctions_${user.id}`;
    const localData = localStorage.getItem(localKey);
    if (localData) {
      const current = JSON.parse(localData);
      const filtered = current.filter((item: any) => item.id !== itemId);
      localStorage.setItem(localKey, JSON.stringify(filtered));
      toast.success('Won auction removed');
      loadWonAuctions();
    }
  };

  const handleRegisterWonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!wonTitle.trim()) {
      toast.error('Auction title is required');
      return;
    }

    setIsSavingWon(true);
    try {
      let docUrl = editingWonItem?.document_url || '';
      let docName = editingWonItem?.document_name || '';

      if (wonFile) {
        toast.loading(`Uploading ${wonFile.name}...`, { id: 'won_upload' });
        const uploadedUrl = await storageService.uploadFile(wonFile, 'auction_documents');
        if (uploadedUrl) {
          docUrl = uploadedUrl;
          docName = wonFile.name;
          // Correlate and save to user documents
          const metadata = `Won Auction Certificate::Won Auction: ${wonTitle}`;
          await storageService.saveUserDocument(user.id, wonFile.name, uploadedUrl, metadata);
          toast.success('Document uploaded and saved to vault', { id: 'won_upload' });
        } else {
          toast.error('Failed to upload document', { id: 'won_upload' });
        }
      }

      const localKey = `usr_won_auctions_${user.id}`;
      const localData = localStorage.getItem(localKey);
      let currentLocal: any[] = localData ? JSON.parse(localData) : [];

      if (editingWonItem) {
        currentLocal = currentLocal.map((item: any) => {
          if (item.id === editingWonItem.id) {
            return {
              ...item,
              title: wonTitle,
              reference_number: wonRefNo,
              closing_bid: wonClosingBid ? parseFloat(wonClosingBid) : undefined,
              closing_date: wonClosingDate || undefined,
              document_name: docName,
              document_url: docUrl,
            };
          }
          return item;
        });
      } else {
        const newWon = {
          id: `won_manual_${Math.random().toString(36).substring(2, 11)}`,
          title: wonTitle,
          reference_number: wonRefNo || `REF-${Math.floor(Math.random() * 90000 + 10000)}`,
          closing_bid: wonClosingBid ? parseFloat(wonClosingBid) : undefined,
          closing_date: wonClosingDate || undefined,
          document_name: docName,
          document_url: docUrl,
          end_time: wonClosingDate ? new Date(wonClosingDate).toISOString() : new Date().toISOString(),
          status: 'ended',
          category: { name: 'Manually Registered' },
          raw_materials_text: generateMockLots(wonTitle)
        };
        currentLocal.push(newWon);
      }

      localStorage.setItem(localKey, JSON.stringify(currentLocal));
      toast.success(editingWonItem ? 'Won auction updated' : 'Won auction registered successfully');
      setIsAddWonModalOpen(false);
      setEditingWonItem(null);
      loadWonAuctions();
    } catch (error) {
      console.error('Error saving won auction:', error);
      toast.error('Failed to save won auction');
    } finally {
      setIsSavingWon(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <Heart className="w-6 h-6 mr-3 text-red-500 fill-red-500" />
            My Auctions Portfolio
          </h1>
          <p className="text-slate-500 mt-1 text-sm">Monitor interested auctions and track your won government catalogs.</p>
        </div>

        {activeTab === 'won' && (
          <button
            onClick={handleOpenAddWonModal}
            className="inline-flex items-center px-5 py-2.5 bg-primary hover:bg-primary-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer hover:shadow-md"
          >
            <Plus className="w-4 h-4 mr-2" /> Register Won Auction
          </button>
        )}
      </div>

      {/* Tabs Layout */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('interested')}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === 'interested'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Interested Auctions
        </button>
        <button
          onClick={() => setActiveTab('won')}
          className={`px-6 py-3 font-bold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === 'won'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Won Auctions ({wonList.length})
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : activeTab === 'interested' ? (
        mstcWatchlist.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300 shadow-2xs">
            <Heart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">Your interested list is empty</h3>
            <p className="text-slate-500 mt-1 mb-6 text-sm">Click the heart icon on any government catalog to save it here for later.</p>
            <Link to="/auctions?tab=mstc" className="inline-flex items-center px-5 py-2.5 text-xs font-bold rounded-xl text-white bg-primary hover:bg-primary-700 transition-all shadow-xs hover:shadow-md">
              Browse Government Catalogs
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {mstcWatchlist.map((item) => (
              <MstcCard
                key={item.id}
                item={item}
                isGrid={true}
                onPreview={setSelectedPreviewItem}
                isInterested={true}
                onInterestedToggle={() => handleMstcInterestedToggle(item.id)}
              />
            ))}
          </div>
        )
      ) : (
        /* Won Auctions Tab Content */
        wonList.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300 shadow-2xs">
            <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No won auctions registered</h3>
            <p className="text-slate-500 mt-1 mb-6 text-sm">Register auctions you have won to track documentation, record bids, and verify inventory checklists.</p>
            <button
              onClick={handleOpenAddWonModal}
              className="inline-flex items-center px-5 py-2.5 text-xs font-bold rounded-xl text-white bg-primary hover:bg-primary-700 transition-all shadow-xs hover:shadow-md"
            >
              Register First Won Auction
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wonList.map((item) => (
              <div key={item.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4 flex flex-col justify-between hover:shadow-xs transition-shadow">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded uppercase tracking-wide">
                      {item.isManual ? 'Manual Registry' : 'Bidding Winner'}
                    </span>
                    <span className="text-[10px] text-slate-500 font-bold font-mono">
                      {item.reference_number || 'N/A'}
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-slate-900 line-clamp-2 leading-snug">
                    {item.title}
                  </h3>

                  <div className="grid grid-cols-2 gap-3 pt-2 text-xs border-t border-slate-100">
                    <div>
                      <span className="text-slate-400 font-medium block">Closing Bid</span>
                      <span className="text-slate-800 font-bold block mt-0.5">
                        {item.closing_bid ? `₹${item.closing_bid.toLocaleString('en-IN')}` : 'Not Specified'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 font-medium block">Awarded Date</span>
                      <span className="text-slate-800 font-bold block mt-0.5">
                        {item.closing_date ? new Date(item.closing_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not Specified'}
                      </span>
                    </div>
                  </div>

                  {/* Document Display */}
                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-150 flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-slate-455 shrink-0" />
                      <span className="text-xs text-slate-700 font-semibold truncate">
                        {item.document_name || 'No receipt/document'}
                      </span>
                    </div>
                    {item.document_url && (
                      <button
                        onClick={async () => {
                          const storagePath = storageService.extractStoragePath(item.document_url);
                          await storageService.downloadPrivateFile('auction_documents', storagePath, item.document_name || 'won_receipt.pdf');
                        }}
                        className="text-primary hover:text-primary/80 p-1"
                        title="Download Document"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-slate-100 mt-2">
                  <Link
                    to={`/dashboard/inventory?auctionId=${item.id}`}
                    className="flex-1 inline-flex items-center justify-center px-3.5 py-2 bg-primary hover:bg-primary-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors gap-1.5"
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" /> Checklist
                  </Link>

                  {item.isManual && (
                    <>
                      <button
                        onClick={() => handleOpenEditWonModal(item)}
                        className="p-2 border border-slate-200 text-slate-650 hover:text-slate-900 rounded-xl hover:bg-slate-50 transition-colors"
                        title="Edit Details"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleDeleteWon(item.id)}
                        className="p-2 border border-slate-200 text-red-500 hover:text-red-700 rounded-xl hover:bg-red-50 hover:border-red-200 transition-colors"
                        title="Remove Registry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Catalog Details Modal */}
      {selectedPreviewItem && (
        <Suspense fallback={
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-955/80 backdrop-blur-xs">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        }>
          <MstcDetailsModal
            item={selectedPreviewItem}
            onClose={() => setSelectedPreviewItem(null)}
            isInterested={true}
            onInterestedToggle={() => handleMstcInterestedToggle(selectedPreviewItem.id)}
          />
        </Suspense>
      )}

      {/* Add/Edit Won Auction Modal */}
      {isAddWonModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/45 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-lg">
                {editingWonItem ? 'Edit Won Auction Details' : 'Register Won Auction'}
              </h3>
              <button
                onClick={() => setIsAddWonModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRegisterWonSubmit} className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-650 uppercase tracking-wider block">Auction Title *</label>
                <input
                  type="text"
                  required
                  value={wonTitle}
                  onChange={(e) => setWonTitle(e.target.value)}
                  placeholder="e.g. Heavy Duty Copper Scrap Lot"
                  className="w-full px-3.5 py-2.5 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-650 uppercase tracking-wider block">Reference / Catalog No (Optional)</label>
                <input
                  type="text"
                  value={wonRefNo}
                  onChange={(e) => setWonRefNo(e.target.value)}
                  placeholder="e.g. MSTC/N-DEL/24-25/0042"
                  className="w-full px-3.5 py-2.5 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-650 uppercase tracking-wider block">Closing Bid (Optional)</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-slate-400 font-bold text-sm">₹</span>
                    <input
                      type="number"
                      value={wonClosingBid}
                      onChange={(e) => setWonClosingBid(e.target.value)}
                      placeholder="Amount"
                      className="w-full pl-7 pr-3.5 py-2.5 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-650 uppercase tracking-wider block">Award Date (Optional)</label>
                  <input
                    type="date"
                    value={wonClosingDate}
                    onChange={(e) => setWonClosingDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1 pt-2">
                <label className="text-xs font-bold text-slate-650 uppercase tracking-wider block">Award Letter / Document (Optional)</label>
                <div className="border border-dashed border-slate-255 rounded-xl p-4 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                  <Upload className="w-6 h-6 text-slate-400 mb-1.5" />
                  <span className="text-xs text-slate-500 font-semibold mb-1 text-center">
                    {wonFile ? wonFile.name : 'PDF, JPG or PNG up to 10MB'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    onChange={(e) => setWonFile(e.target.files?.[0] || null)}
                    className="hidden"
                    id="won-file-input"
                  />
                  <label
                    htmlFor="won-file-input"
                    className="mt-1 px-3 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-lg text-slate-700 text-[11px] font-bold shadow-2xs cursor-pointer"
                  >
                    Select File
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setIsAddWonModalOpen(false)}
                  className="px-4 py-2.5 border border-slate-250 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingWon}
                  className="px-5 py-2.5 bg-primary hover:bg-primary-700 disabled:bg-slate-400 text-white text-sm font-semibold rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center"
                >
                  {isSavingWon ? 'Registering...' : editingWonItem ? 'Save Changes' : 'Register Auction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

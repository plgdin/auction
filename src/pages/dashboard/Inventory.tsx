import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { auctionService } from '../../services/auctionService';
import { dashboardService } from '../../services/dashboardService';
import type { AuctionInventory, InventoryItem } from '../../services/dashboardService';
import { 
  CheckCircle, AlertTriangle, MoreVertical, 
  X, Check, AlertOctagon, Archive, Lock
} from 'lucide-react';
import type { Auction } from '../../types/database.types';
import { toast } from 'react-hot-toast';
import { flattenCatalogItems } from '../../utils/mstcHelpers';

type AuctionWithMstc = Auction & { reference_number?: string; raw_materials_text?: string };

export function Inventory() {
  const { user } = useAuthStore();
  const [wonAuctions, setWonAuctions] = useState<AuctionWithMstc[]>([]);
  const [selectedAuction, setSelectedAuction] = useState<AuctionWithMstc | null>(null);
  const [inventory, setInventory] = useState<AuctionInventory | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Issue reporting modal state
  const [reportingItem, setReportingItem] = useState<InventoryItem | null>(null);
  const [issueType, setIssueType] = useState('Damaged');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [description, setDescription] = useState('');
  
  // Active dropdown item id state (for the 3 dots menu)
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  useEffect(() => {
    async function loadWonAuctions() {
      if (!user?.id) return;
      setIsLoading(true);
      try {
        const wonData = await auctionService.getWonAuctions(user.id);
        
        // If there are no won auctions in database, let's create a couple of realistic mock ones 
        // to make sure the dashboard is fully testable and rich out of the box!
        if (wonData.length === 0) {
          const mockWon: Auction[] = [
            {
              id: 'mock_won_1',
              title: 'Heavy Melting Steel Scrap & Heavy Machinery',
              reference_number: 'MSTC/N-DEL/24-25/0042',
              end_time: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
              starting_price: 450000,
              status: 'ended',
              category: { name: 'Scrap & Scrap Material' }
            } as any,
            {
              id: 'mock_won_2',
              title: 'Condemned Off-Road Transport Vehicles',
              reference_number: 'MSTC/MUM/24-25/0819',
              end_time: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
              starting_price: 180000,
              status: 'ended',
              category: { name: 'Vehicles' }
            } as any
          ];
          setWonAuctions(mockWon);
          setSelectedAuction(mockWon[0]);
        } else {
          setWonAuctions(wonData);
          setSelectedAuction(wonData[0]);
        }
      } catch (err) {
        console.error('Error loading won auctions', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadWonAuctions();
  }, [user]);

  // Load inventory when selected auction changes
  useEffect(() => {
    if (!user?.id || !selectedAuction) {
      setInventory(null);
      return;
    }

    let lotItems: any[] = [];
    if (selectedAuction.raw_materials_text) {
      try {
        const parsed = JSON.parse(selectedAuction.raw_materials_text);
        if (parsed?.items) {
          lotItems = flattenCatalogItems(parsed.items, (selectedAuction as any).category?.name || selectedAuction.title);
        }
      } catch (e) {
        // Fallback
      }
    }

    // Initialize/retrieve inventory list
    const inv = dashboardService.initializeInventory(
      user.id,
      selectedAuction.id,
      selectedAuction.title,
      selectedAuction.reference_number || 'N/A',
      lotItems
    );
    setInventory(inv);
  }, [selectedAuction, user]);

  const handleToggleCheck = (itemId: string) => {
    if (!user?.id || !selectedAuction) return;
    if (inventory?.isLocked) {
      toast.error('This inventory checklist is locked and cannot be modified.');
      return;
    }
    const updated = dashboardService.toggleInventoryItemCheck(user.id, selectedAuction.id, itemId);
    setInventory(updated);
    
    // Toast notification
    const item = inventory?.items.find(i => i.id === itemId);
    if (item) {
      if (!item.checked) {
        toast.success(`Verified: ${item.description}`);
      }
    }
  };

  const handleOpenReportModal = (item: InventoryItem) => {
    if (inventory?.isLocked) return;
    setReportingItem(item);
    setIssueType('Damaged');
    setSeverity('medium');
    setDescription('');
    setActiveMenuId(null);
  };

  const handleReportIssue = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id || !selectedAuction || !reportingItem) return;
    if (inventory?.isLocked) return;

    if (!description.trim()) {
      toast.error('Please describe the issue in detail');
      return;
    }

    const updated = dashboardService.reportInventoryIssue(
      user.id,
      selectedAuction.id,
      reportingItem.id,
      issueType,
      description,
      severity
    );
    setInventory(updated);
    setReportingItem(null);
    toast.error(`Issue reported for ${reportingItem.description}`);
  };

  const handleResolveIssue = (itemId: string) => {
    if (!user?.id || !selectedAuction) return;
    if (inventory?.isLocked) return;
    const updated = dashboardService.resolveInventoryIssue(user.id, selectedAuction.id, itemId);
    setInventory(updated);
    setActiveMenuId(null);
    toast.success('Issue resolved');
  };

  const handleLockVerification = () => {
    if (!user?.id || !selectedAuction) return;
    const confirmLock = window.confirm("Are you sure you want to lock and save this inventory verification? This action is permanent and cannot be undone.");
    if (!confirmLock) return;

    const updated = dashboardService.lockInventory(user.id, selectedAuction.id);
    if (updated) {
      setInventory(updated);
      toast.success('Inventory verification locked and saved successfully.');
    }
  };

  // Close active dropdowns when clicking outside
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuId(null);
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const totalItems = inventory?.items.length || 0;
  const verifiedCount = inventory?.items.filter(i => i.checked).length || 0;
  const reportedCount = inventory?.items.filter(i => i.status === 'reported').length || 0;
  const progressPercent = totalItems > 0 ? Math.round((verifiedCount / totalItems) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Inventory Verification</h1>
        <p className="text-slate-500">Perform checklist verification on lots won. Verify items received and report mismatches or damages.</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : wonAuctions.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-xl border border-dashed border-slate-300 shadow-sm">
          <Archive className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-slate-900">No Won Auctions Available</h3>
          <p className="text-slate-500 mt-1">Checklists will automatically generate here once you win an auction.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Won Auctions List */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider px-1">Won Auctions</h2>
            <div className="space-y-3">
              {wonAuctions.map(a => {
                const isSelected = selectedAuction?.id === a.id;
                return (
                  <button
                    key={a.id}
                    onClick={() => setSelectedAuction(a)}
                    className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-primary/5 border-primary shadow-2xs' 
                        : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded uppercase tracking-wide">
                        Won
                      </span>
                      <span className="text-[10px] text-slate-550 font-bold">
                        REF: {a.reference_number}
                      </span>
                    </div>
                    <h4 className="text-sm font-bold text-slate-900 line-clamp-2 leading-tight">
                      {a.title}
                    </h4>
                    <p className="text-xs text-slate-450 mt-2">
                      Closed: {new Date(a.end_time).toLocaleDateString()}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right 2 cols: Selected Inventory Checklist */}
          <div className="lg:col-span-2">
            {inventory && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {/* Panel Header */}
                <div className="p-6 border-b border-slate-200 bg-slate-50/50">
                  <span className="text-xs text-slate-500 font-bold">VERIFICATION DESK</span>
                  <h2 className="text-xl font-bold text-slate-900 mt-0.5 leading-snug">{inventory.auctionTitle}</h2>
                  <p className="text-xs text-slate-500 mt-1">Ref No: {inventory.referenceNumber}</p>

                  {/* Progress Stats */}
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="bg-white p-3 rounded-lg border border-slate-150">
                      <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Total Items</p>
                      <p className="text-xl font-black text-slate-800 mt-0.5">{totalItems}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-150">
                      <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Verified</p>
                      <p className="text-xl font-black text-emerald-600 mt-0.5">{verifiedCount}</p>
                    </div>
                    <div className="bg-white p-3 rounded-lg border border-slate-150">
                      <p className="text-[10px] font-bold text-slate-450 uppercase tracking-wider">Reported Issues</p>
                      <p className="text-xl font-black text-red-600 mt-0.5">{reportedCount}</p>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-650 mb-1.5">
                      <span>Verification Progress</span>
                      <span>{progressPercent}%</span>
                    </div>
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progressPercent}%` }}></div>
                    </div>
                  </div>
                </div>

                {/* Checklist Rows */}
                <div className="divide-y divide-slate-100">
                  {inventory.items.map((item) => (
                    <div 
                      key={item.id}
                      className={`p-5 flex items-start justify-between gap-4 transition-colors ${
                        item.checked ? 'bg-emerald-50/20' : item.status === 'reported' ? 'bg-red-50/10' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        {/* Custom Large Checkbox */}
                        <button
                          onClick={() => handleToggleCheck(item.id)}
                          className={`mt-1 w-5.5 h-5.5 rounded-md border flex items-center justify-center transition-all cursor-pointer ${
                            item.checked
                              ? 'bg-emerald-600 border-emerald-600 text-white shadow-2xs'
                              : 'bg-white border-slate-300 hover:border-primary focus:ring-2 focus:ring-primary/20'
                          }`}
                        >
                          {item.checked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </button>

                        <div>
                          <p className={`text-sm font-bold text-slate-800 leading-normal transition-colors duration-500 ${item.checked ? 'text-slate-400 font-medium' : ''}`}>
                            <span className="relative inline-block">
                              {item.description}
                              <span 
                                className="absolute left-0 top-[55%] h-[2px] bg-slate-400/80 transition-all duration-500 ease-out origin-left rounded"
                                style={{ width: item.checked ? '100%' : '0%' }}
                              />
                            </span>
                          </p>
                          <p className="text-xs font-semibold text-slate-500 mt-1">
                            Quantity: {item.qty} {item.unit}
                          </p>

                          {/* Reported issue details */}
                          {item.status === 'reported' && item.issue && (
                            <div className="mt-2.5 p-3 rounded-lg border border-red-200 bg-red-50/50 max-w-lg">
                              <div className="flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                                <span className="text-xs font-bold text-red-700 capitalize">
                                  {item.issue.type} Issue ({item.issue.severity} severity)
                                </span>
                              </div>
                              <p className="text-xs text-red-950 font-medium mt-1 leading-snug">
                                {item.issue.description}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Dropdown Options Trigger */}
                      {!inventory.isLocked && (
                        <div className="relative shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuId(activeMenuId === item.id ? null : item.id);
                            }}
                            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-450 hover:text-slate-700 transition-colors cursor-pointer"
                          >
                            <MoreVertical className="w-4.5 h-4.5" />
                          </button>

                          {/* Custom Overlay Menu */}
                          {activeMenuId === item.id && (
                            <div className="absolute right-0 mt-1 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-10 py-1 overflow-hidden animate-in fade-in-50 slide-in-from-top-1">
                              {item.status === 'reported' ? (
                                <button
                                  onClick={() => handleResolveIssue(item.id)}
                                  className="w-full text-left px-4 py-2 text-xs font-bold text-emerald-600 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                >
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  Resolve Issue
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleOpenReportModal(item)}
                                  className="w-full text-left px-4 py-2 text-xs font-bold text-red-600 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                >
                                  <AlertOctagon className="w-3.5 h-3.5" />
                                  Report Issue
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Verification Lock Footer */}
                {inventory.isLocked ? (
                  <div className="p-6 border-t border-slate-200 bg-slate-900 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-slate-800 rounded-lg text-emerald-450 shrink-0">
                        <Lock className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold flex items-center gap-1.5">
                          Verification Completed & Locked
                        </p>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                          Locked on {new Date(inventory.verifiedAt || '').toLocaleDateString()} at {new Date(inventory.verifiedAt || '').toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                      Audit Compliant
                    </div>
                  </div>
                ) : (
                  <div className="p-6 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-slate-700">Ready to finalize verification?</p>
                      <p className="text-[11px] text-slate-500 mt-0.5 font-medium">Once saved, this checklist will be locked and cannot be edited.</p>
                    </div>
                    <button
                      onClick={handleLockVerification}
                      className="w-full sm:w-auto px-5 py-2.5 bg-slate-950 hover:bg-slate-800 active:bg-black text-white text-xs font-bold rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer hover:shadow-md duration-150 active:scale-[0.98]"
                    >
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                      Lock & Save Verification
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Report Issue Modal */}
      {reportingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/45 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-55/30">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                <h3 className="font-bold text-slate-900 text-lg">Report Lot Issue</h3>
              </div>
              <button
                onClick={() => setReportingItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReportIssue} className="p-6 space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Target Item</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{reportingItem.description}</p>
                <p className="text-xs font-semibold text-slate-550 mt-1">Qty: {reportingItem.qty} {reportingItem.unit}</p>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-650 uppercase tracking-wider">Issue Category *</label>
                <select
                  value={issueType}
                  onChange={(e) => setIssueType(e.target.value)}
                  className="w-full px-3 py-2.5 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                >
                  <option value="Damaged">Damaged Items</option>
                  <option value="Missing">Missing / Shortage</option>
                  <option value="Mismatch">Specification Mismatch</option>
                  <option value="AccessDenied">Access denied to site</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-650 uppercase tracking-wider">Priority / Severity</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {(['low', 'medium', 'high'] as const).map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setSeverity(level)}
                      className={`py-2 px-3 text-xs font-bold capitalize border rounded-xl transition-all cursor-pointer ${
                        severity === level
                          ? level === 'low'
                            ? 'bg-blue-50 border-blue-500 text-blue-700 font-extrabold'
                            : level === 'medium'
                              ? 'bg-amber-50 border-amber-500 text-amber-700 font-extrabold'
                              : 'bg-red-50 border-red-500 text-red-700 font-extrabold'
                          : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-650 uppercase tracking-wider">Detailed Description *</label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the discrepancy in detail (e.g. 2 of the heavy melting bars are rusted beyond grading or 5 units missing from pallet #4)..."
                  className="w-full px-3.5 py-2.5 border border-slate-250 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={() => setReportingItem(null)}
                  className="px-4 py-2.5 border border-slate-250 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2.5 bg-red-600 hover:bg-red-750 text-white text-sm font-semibold rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  Submit Issue Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

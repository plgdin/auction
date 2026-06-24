import React, { useState, useEffect } from 'react';
import { X, Save, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface MstcEditModalProps {
  auction: any;
  onClose: () => void;
  onSaveSuccess: () => void;
}

export const MstcEditModal: React.FC<MstcEditModalProps> = ({
  auction,
  onClose,
  onSaveSuccess
}) => {
  const [categoryName, setCategoryName] = useState(auction.category_name || '');
  const [sellerName, setSellerName] = useState(auction.seller_name || '');
  const [location, setLocation] = useState(auction.location || '');
  const [lots, setLots] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const [reviewReason, setReviewReason] = useState('');

  useEffect(() => {
    if (auction.raw_materials_text) {
      try {
        const parsed = JSON.parse(auction.raw_materials_text);
        if (parsed) {
          setLots(parsed.items || []);
          setNeedsReview(!!parsed.needsReview);
          setReviewReason(parsed.reviewReason || '');
        }
      } catch (err) {
        console.error('Error parsing raw_materials_text JSON:', err);
      }
    }
  }, [auction]);

  const handleLotChange = (index: number, field: string, value: any) => {
    const updated = [...lots];
    updated[index] = { ...updated[index], [field]: value };
    setLots(updated);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let rawMaterialsObj: any = {};
      if (auction.raw_materials_text) {
        try {
          rawMaterialsObj = JSON.parse(auction.raw_materials_text);
        } catch (e) {
          rawMaterialsObj = {};
        }
      }

      // Update the items in the parsed JSON
      rawMaterialsObj.items = lots;
      // Mark as resolved/no longer needs review since the admin manually adjusted it
      rawMaterialsObj.needsReview = false;
      rawMaterialsObj.reviewReason = '';

      const updatedRawText = JSON.stringify(rawMaterialsObj);

      // Perform update to Supabase
      const { error } = await supabase
        .from('mstc_auctions')
        .update({
          category_name: categoryName,
          seller_name: sellerName,
          location: location,
          raw_materials_text: updatedRawText,
          updated_at: new Date().toISOString()
        })
        .eq('id', auction.id);

      if (error) {
        throw error;
      }

      // Log audit trail event
      await supabase.from('audit_logs').insert({
        action: 'mstc_auction_edited_by_admin',
        entity_type: 'mstc_auction',
        entity_id: auction.id,
        details: {
          mstc_auction_number: auction.mstc_auction_number,
          edited_fields: {
            category_name: categoryName !== auction.category_name,
            seller_name: sellerName !== auction.seller_name,
            location: location !== auction.location,
            lots_updated: true
          }
        }
      });

      toast.success('Catalog updated and review flag cleared successfully!');
      onSaveSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error saving auction edits:', err);
      toast.error(`Failed to save edits: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden transform transition-all">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
          <div>
            <h3 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center">
              Edit Catalog: <span className="ml-2 font-mono text-primary font-bold text-sm bg-slate-200 dark:bg-slate-800 px-2.5 py-1 rounded-md">{auction.mstc_auction_number}</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Directly edit extracted items to fix missing or confusing lot details.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Review Notice */}
          {needsReview && (
            <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/55 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-extrabold text-amber-800 dark:text-amber-300">Catalog Flagged for Review</h4>
                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1">
                  Reason: {reviewReason || 'Confusing or fallback descriptions detected.'}
                </p>
              </div>
            </div>
          )}

          {/* Auction Fields */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Category */}
            <div>
              <label className="block text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Category Name</label>
              <input
                type="text"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-primary/25"
              />
            </div>

            {/* Seller */}
            <div>
              <label className="block text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Seller Name</label>
              <input
                type="text"
                value={sellerName}
                onChange={(e) => setSellerName(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-primary/25"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-100 text-sm focus:ring-2 focus:ring-primary/25"
              />
            </div>

          </div>

          <div className="border-t border-slate-100 dark:border-slate-800 pt-6">
            <h4 className="text-xs font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center">
              Parsed Catalog Lots ({lots.length})
            </h4>

            {lots.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-150 dark:border-slate-850">
                <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">No parsed lot items found</p>
                <p className="text-xs text-slate-400 mt-1">This catalog is either empty or failed to parse.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {lots.map((lot, idx) => (
                  <div 
                    key={lot.sr || idx} 
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/20 grid grid-cols-1 md:grid-cols-12 gap-4 items-start hover:border-slate-350 transition-colors"
                  >
                    
                    {/* Lot Sr */}
                    <div className="md:col-span-1">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Lot No</label>
                      <input
                        type="text"
                        value={lot.sr || ''}
                        onChange={(e) => handleLotChange(idx, 'sr', e.target.value)}
                        className="w-full text-center font-bold px-2 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-white text-xs"
                      />
                    </div>

                    {/* Lot Description */}
                    <div className="md:col-span-7">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Material Description</label>
                      <textarea
                        rows={2}
                        value={lot.description || ''}
                        onChange={(e) => handleLotChange(idx, 'description', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-white text-xs focus:ring-1 focus:ring-primary focus:border-primary focus:outline-hidden"
                      />
                    </div>

                    {/* Lot Qty */}
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Quantity</label>
                      <input
                        type="text"
                        value={lot.qty || ''}
                        onChange={(e) => handleLotChange(idx, 'qty', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-white text-xs"
                      />
                    </div>

                    {/* Lot Unit */}
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Unit</label>
                      <input
                        type="text"
                        value={lot.unit || ''}
                        onChange={(e) => handleLotChange(idx, 'unit', e.target.value)}
                        className="w-full px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-white text-xs"
                      />
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5 font-medium">
            <Info className="w-3.5 h-3.5 shrink-0 text-slate-400" />
            Saving will instantly clear the "Needs Review" flag.
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-sm font-bold text-slate-650 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-all rounded-lg"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center px-5 py-2.5 bg-primary hover:bg-primary-700 text-white text-sm font-bold shadow-xs hover:shadow-md transition-all rounded-lg"
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving Changes...' : 'Save Catalog Changes'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

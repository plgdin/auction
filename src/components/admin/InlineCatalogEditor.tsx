import React, { useState, useEffect } from 'react';
import { Save, AlertTriangle, AlertCircle, ExternalLink, FileText, Check, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface InlineCatalogEditorProps {
  auction: any;
  onSaveSuccess: () => void;
}

const formatDateToLocalInput = (dateStr: string) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const InlineCatalogEditor: React.FC<InlineCatalogEditorProps> = ({
  auction,
  onSaveSuccess
}) => {
  const [mstcAuctionNumber, setMstcAuctionNumber] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [sellerName, setSellerName] = useState('');
  const [location, setLocation] = useState('');
  const [openingDate, setOpeningDate] = useState('');
  const [closingDate, setClosingDate] = useState('');
  const [sourcePdfUrl, setSourcePdfUrl] = useState('');
  const [sanitizedDocumentPath, setSanitizedDocumentPath] = useState('');

  const [lots, setLots] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const [reviewReason, setReviewReason] = useState('');
  
  const [editorTab, setEditorTab] = useState<'lots' | 'json'>('lots');
  const [rawJsonText, setRawJsonText] = useState('');

  useEffect(() => {
    if (auction) {
      setMstcAuctionNumber(auction.mstc_auction_number || '');
      setCategoryName(auction.category_name || '');
      setSellerName(auction.seller_name || '');
      setLocation(auction.location || '');
      setOpeningDate(formatDateToLocalInput(auction.opening_date));
      setClosingDate(formatDateToLocalInput(auction.closing_date));
      setSourcePdfUrl(auction.source_pdf_url || '');
      setSanitizedDocumentPath(auction.sanitized_document_path || '');
      
      let itemsList: any[] = [];
      let flagged = false;
      let reason = '';

      if (auction.raw_materials_text) {
        try {
          const parsed = JSON.parse(auction.raw_materials_text);
          if (parsed) {
            itemsList = parsed.items || [];
            flagged = !!parsed.needsReview;
            reason = parsed.reviewReason || '';
          }
        } catch (err) {
          console.error('Error parsing raw_materials_text JSON:', err);
        }
      }

      setLots(itemsList);
      setNeedsReview(flagged);
      setReviewReason(reason);

      const defaultObj = {
        needsReview: flagged,
        reviewReason: reason,
        items: itemsList
      };
      setRawJsonText(JSON.stringify(defaultObj, null, 2));
    }
  }, [auction]);

  const handleLotChange = (index: number, field: string, value: any) => {
    const updated = [...lots];
    updated[index] = { ...updated[index], [field]: value };
    setLots(updated);

    // Sync back to raw JSON text
    try {
      const parsed = JSON.parse(rawJsonText);
      parsed.items = updated;
      setRawJsonText(JSON.stringify(parsed, null, 2));
    } catch (e) {
      // Fallback
      setRawJsonText(JSON.stringify({
        needsReview,
        reviewReason,
        items: updated
      }, null, 2));
    }
  };

  const handleAddLot = () => {
    const newLot = { sr: (lots.length + 1).toString(), description: '', qty: '1', unit: 'LOT' };
    const updated = [...lots, newLot];
    setLots(updated);

    try {
      const parsed = JSON.parse(rawJsonText);
      parsed.items = updated;
      setRawJsonText(JSON.stringify(parsed, null, 2));
    } catch (e) {
      setRawJsonText(JSON.stringify({
        needsReview,
        reviewReason,
        items: updated
      }, null, 2));
    }
  };

  const handleDeleteLot = (index: number) => {
    const updated = lots.filter((_, i) => i !== index);
    setLots(updated);

    try {
      const parsed = JSON.parse(rawJsonText);
      parsed.items = updated;
      setRawJsonText(JSON.stringify(parsed, null, 2));
    } catch (e) {
      setRawJsonText(JSON.stringify({
        needsReview,
        reviewReason,
        items: updated
      }, null, 2));
    }
  };

  const handleRawJsonChange = (val: string) => {
    setRawJsonText(val);
    try {
      const parsed = JSON.parse(val);
      if (parsed && Array.isArray(parsed.items)) {
        setLots(parsed.items);
      }
      if (parsed && typeof parsed.needsReview === 'boolean') {
        setNeedsReview(parsed.needsReview);
      }
      if (parsed && typeof parsed.reviewReason === 'string') {
        setReviewReason(parsed.reviewReason);
      }
    } catch (e) {
      // Don't log or crash, let user finish typing invalid JSON
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      let finalJsonObj: any = {
        needsReview: false,
        reviewReason: '',
        items: lots
      };

      try {
        finalJsonObj = JSON.parse(rawJsonText);
        finalJsonObj.needsReview = false;
        finalJsonObj.reviewReason = '';
      } catch (e) {
        toast.error('Invalid Raw JSON syntax. Please correct it before saving.');
        setIsSaving(false);
        return;
      }

      const updatedRawText = JSON.stringify(finalJsonObj);

      const { error } = await supabase
        .from('mstc_auctions')
        .update({
          mstc_auction_number: mstcAuctionNumber,
          category_name: categoryName,
          seller_name: sellerName,
          location: location,
          opening_date: new Date(openingDate).toISOString(),
          closing_date: new Date(closingDate).toISOString(),
          source_pdf_url: sourcePdfUrl,
          sanitized_document_path: sanitizedDocumentPath || null,
          raw_materials_text: updatedRawText,
          updated_at: new Date().toISOString()
        })
        .eq('id', auction.id);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        action: 'mstc_auction_edited_by_admin',
        entity_type: 'mstc_auction',
        entity_id: auction.id,
        details: {
          mstc_auction_number: mstcAuctionNumber,
          edited_fields: {
            mstc_auction_number: mstcAuctionNumber !== auction.mstc_auction_number,
            category_name: categoryName !== auction.category_name,
            seller_name: sellerName !== auction.seller_name,
            location: location !== auction.location,
            opening_date: new Date(openingDate).toISOString() !== new Date(auction.opening_date).toISOString(),
            closing_date: new Date(closingDate).toISOString() !== new Date(auction.closing_date).toISOString(),
            source_pdf_url: sourcePdfUrl !== auction.source_pdf_url,
            sanitized_document_path: sanitizedDocumentPath !== auction.sanitized_document_path,
            lots_updated: true
          }
        }
      });

      toast.success('Catalog updated and review flag cleared successfully!');
      onSaveSuccess();
    } catch (err: any) {
      console.error('Error saving auction edits:', err);
      toast.error(`Failed to save edits: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickApprove = async () => {
    setIsSaving(true);
    try {
      let finalJsonObj: any = {
        needsReview: false,
        reviewReason: '',
        items: lots
      };

      try {
        finalJsonObj = JSON.parse(rawJsonText);
        finalJsonObj.needsReview = false;
        finalJsonObj.reviewReason = '';
      } catch (e) {}

      const updatedRawText = JSON.stringify(finalJsonObj);

      const { error } = await supabase
        .from('mstc_auctions')
        .update({
          raw_materials_text: updatedRawText,
          updated_at: new Date().toISOString()
        })
        .eq('id', auction.id);

      if (error) throw error;

      await supabase.from('audit_logs').insert({
        action: 'mstc_auction_edited_by_admin',
        entity_type: 'mstc_auction',
        entity_id: auction.id,
        details: {
          mstc_auction_number: auction.mstc_auction_number,
          approved_directly: true
        }
      });

      toast.success('Catalog approved directly!');
      onSaveSuccess();
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to approve: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewPrivateAsset = async (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    try {
      const { data, error } = await supabase.storage
        .from('mstc-catalogs')
        .createSignedUrl(path, 60);

      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (err: any) {
      console.error('Error generating signed URL:', err);
      toast.error('Failed to access cloud storage document.');
    }
  };

  if (!auction) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      
      {/* Editor Header */}
      <div className="p-4 border-b border-slate-150 bg-slate-50/50 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-sm text-slate-800">Reviewing:</span>
            <span className="font-mono text-xs font-bold bg-slate-200 px-2 py-0.5 rounded-md text-slate-800">
              {auction.mstc_auction_number}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <a 
              href={auction.source_pdf_url} 
              target="_blank" 
              rel="noreferrer"
              className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
            >
              Original MSTC <ExternalLink className="w-2.5 h-2.5" />
            </a>
            {auction.sanitized_document_path && (
              <button 
                onClick={(e) => handleViewPrivateAsset(e, auction.sanitized_document_path)}
                className="text-[10px] text-emerald-600 hover:underline flex items-center gap-0.5 bg-transparent border-0 cursor-pointer"
              >
                Cloud PDF <FileText className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {needsReview && (
            <button
              onClick={handleQuickApprove}
              disabled={isSaving}
              className="flex items-center px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs hover:shadow-sm transition-all cursor-pointer"
            >
              <Check className="w-3.5 h-3.5 mr-1" /> Quick Approve
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center px-3 py-1.5 bg-primary hover:bg-primary-700 text-white text-xs font-bold rounded-lg shadow-xs hover:shadow-sm transition-all cursor-pointer"
          >
            <Save className="w-3.5 h-3.5 mr-1" /> Save & Resolve
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="flex-1 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 overflow-hidden min-h-0">
        
        {/* Left: General Metadata Form */}
        <div className="w-full md:w-80 shrink-0 p-4 overflow-y-auto space-y-4 text-left bg-slate-50/25">
          <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5 text-primary" /> Auction Details
          </h3>
          
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Auction Reference No
            </label>
            <input
              type="text"
              value={mstcAuctionNumber}
              onChange={(e) => setMstcAuctionNumber(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-850 text-xs font-semibold focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Category
            </label>
            <input
              type="text"
              value={categoryName}
              onChange={(e) => setCategoryName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-850 text-xs font-semibold focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Seller Name
            </label>
            <input
              type="text"
              value={sellerName}
              onChange={(e) => setSellerName(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-850 text-xs font-semibold focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Location
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-855 text-xs font-semibold focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Opening Date
            </label>
            <input
              type="datetime-local"
              value={openingDate}
              onChange={(e) => setOpeningDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-850 text-xs font-semibold focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Closing Date
            </label>
            <input
              type="datetime-local"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-850 text-xs font-semibold focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Source PDF URL
            </label>
            <input
              type="text"
              value={sourcePdfUrl}
              onChange={(e) => setSourcePdfUrl(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-850 text-xs focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Cloud Storage Path
            </label>
            <input
              type="text"
              value={sanitizedDocumentPath}
              onChange={(e) => setSanitizedDocumentPath(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-850 text-xs focus:ring-1 focus:ring-primary focus:border-primary"
            />
          </div>

        </div>

        {/* Right: Tabbed Lots / JSON area */}
        <div className="flex-1 p-4 overflow-y-auto flex flex-col min-h-0 text-left">
          
          {/* Flag Alert */}
          {needsReview && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-800">Requires Audit Attention</p>
                <p className="text-[11px] text-amber-600 font-medium mt-0.5">{reviewReason}</p>
              </div>
            </div>
          )}

          {/* Tabs header */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-4 shrink-0">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditorTab('lots')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  editorTab === 'lots'
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Lots Form ({lots.length})
              </button>
              <button
                type="button"
                onClick={() => setEditorTab('json')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  editorTab === 'json'
                    ? 'bg-primary/10 text-primary'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Raw JSON Editor
              </button>
            </div>

            {editorTab === 'lots' && (
              <button
                type="button"
                onClick={handleAddLot}
                className="px-2.5 py-1 bg-primary hover:bg-primary-700 text-white text-[10px] font-bold rounded-md transition-all flex items-center gap-1 cursor-pointer"
              >
                + Add Lot
              </button>
            )}
          </div>

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {editorTab === 'lots' ? (
              lots.length === 0 ? (
                <div className="p-12 text-center bg-slate-50 rounded-xl border border-slate-150">
                  <AlertCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-500">No lot data extracted.</p>
                  <button
                    type="button"
                    onClick={handleAddLot}
                    className="mt-3 px-3 py-1.5 bg-primary text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    Add First Lot
                  </button>
                </div>
              ) : (
                <div className="space-y-3 pr-1">
                  {lots.map((lot, idx) => (
                    <div 
                      key={idx} 
                      className="p-3 rounded-lg border border-slate-200 bg-slate-50/30 relative group flex flex-col gap-3"
                    >
                      {/* Delete button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteLot(idx)}
                        className="absolute top-2 right-2 p-1 text-slate-300 hover:text-rose-600 rounded transition-colors cursor-pointer"
                        title="Delete Lot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start pr-6">
                        <div className="md:col-span-1">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Lot No</label>
                          <input
                            type="text"
                            value={lot.sr || ''}
                            onChange={(e) => handleLotChange(idx, 'sr', e.target.value)}
                            className="w-full text-center px-1.5 py-1 rounded-md border border-slate-200 bg-white text-slate-800 text-xs font-bold"
                          />
                        </div>
                        <div className="md:col-span-5">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Material Description</label>
                          <textarea
                            rows={2}
                            value={lot.description || ''}
                            onChange={(e) => handleLotChange(idx, 'description', e.target.value)}
                            className="w-full px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-800 text-xs focus:ring-1 focus:ring-primary focus:border-primary"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Quantity</label>
                          <input
                            type="text"
                            value={lot.qty || ''}
                            onChange={(e) => handleLotChange(idx, 'qty', e.target.value)}
                            className="w-full px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-800 text-xs"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Unit</label>
                          <input
                            type="text"
                            value={lot.unit || ''}
                            onChange={(e) => handleLotChange(idx, 'unit', e.target.value)}
                            className="w-full px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-800 text-xs"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-[9px] font-bold text-slate-400 uppercase mb-1">Price</label>
                          <input
                            type="text"
                            value={lot.price || ''}
                            onChange={(e) => handleLotChange(idx, 'price', e.target.value)}
                            className="w-full px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-800 text-xs"
                            placeholder="Price"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              <div className="h-full flex flex-col gap-2">
                <p className="text-[10px] text-slate-400 font-semibold leading-relaxed">
                  Directly edit raw catalog JSON. Ensure valid format: <code className="bg-slate-100 px-1 py-0.5 rounded">{"{ \"needsReview\": false, \"items\": [...] }"}</code>.
                </p>
                <textarea
                  value={rawJsonText}
                  onChange={(e) => handleRawJsonChange(e.target.value)}
                  className="flex-1 w-full p-3 font-mono text-xs rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:ring-1 focus:ring-primary focus:border-primary h-full min-h-[400px] resize-y"
                  placeholder="{}"
                />
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

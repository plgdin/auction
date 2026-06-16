import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, Plus, Trash2, Printer, Save, Paperclip,
  Palette, Building2, User, Percent, FileCode, Check,
  Bookmark, FileDown, ChevronDown
} from 'lucide-react';
import { useQuoteStore } from '../../store/quoteStore';
import type { QuoteAttachment } from '../../store/quoteStore';
import { useAuthStore } from '../../store/authStore';
import { MstcSearchService } from '../../services/publicService';
import { dashboardService } from '../../services/dashboardService';
import { generateCatalogSummary } from '../../utils/mstcHelpers';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

interface CustomDropdownProps {
  value: any;
  onChange: (value: any) => void;
  options: { value: any; label: string }[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

function CustomSingleDropdown({
  value,
  onChange,
  options,
  placeholder = 'Select option',
  className = '',
  disabled = false
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <div ref={dropdownRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "w-full flex justify-between items-center px-3 py-1.5 border rounded-lg shadow-2xs text-xs transition-all text-left font-semibold",
          disabled 
            ? "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed" 
            : "border-slate-200 bg-white text-slate-700 hover:border-primary hover:bg-slate-50/50 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer",
          className
        )}
      >
        <span className="truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 ml-1.5" />
      </button>

      {isOpen && !disabled && (
        <div 
          className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl shadow-lg border border-slate-200 p-1.5 max-h-[200px] overflow-y-auto custom-scrollbar flex flex-col gap-0.5"
          style={{ scrollbarWidth: 'thin' }}
        >
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <div
                key={opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={clsx(
                  "flex items-center justify-between py-1.5 px-2.5 rounded-lg cursor-pointer text-xs font-semibold transition-colors select-none",
                  isSelected
                    ? "bg-primary-50/50 text-primary font-bold"
                    : "hover:bg-slate-50 text-slate-605 hover:text-slate-900"
                )}
              >
                <span className="truncate">{opt.label}</span>
                {isSelected && (
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-scale-up" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function QuotePage() {
  const {
    activeQuote,
    quotes,
    addItemToActiveQuote,
    removeItemFromActiveQuote,
    updateActiveQuoteItem,
    updateActiveQuoteMetadata,
    addAttachmentToActiveQuote,
    removeAttachmentFromActiveQuote,
    saveActiveQuote,
    loadQuote,
    deleteQuote,
    createNewQuote
  } = useQuoteStore();

  const [activeTab, setActiveTab] = useState<'editor' | 'quotes'>('editor');
  const [logoPreview, setLogoPreview] = useState<string>(activeQuote.senderLogoUrl || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Interested Auctions Importing State
  const { user } = useAuthStore();
  const [interestedAuctions, setInterestedAuctions] = useState<any[]>([]);
  const [selectedAuctionId, setSelectedAuctionId] = useState<string>('');
  const [selectedAuctionDetails, setSelectedAuctionDetails] = useState<any | null>(null);
  const [isAuctionsLoading, setIsAuctionsLoading] = useState(false);

  React.useEffect(() => {
    const loadInterestedAuctions = async () => {
      if (!user) return;
      setIsAuctionsLoading(true);
      try {
        const ids = dashboardService.getInterestedAuctions(user.id);
        if (ids.length > 0) {
          const items = await Promise.all(
            ids.map(id => MstcSearchService.getMstcAuctionById(id))
          );
          setInterestedAuctions(items.filter((item): item is any => item !== null));
        } else {
          setInterestedAuctions([]);
        }
      } catch (error) {
        console.error('Failed to load interested auctions in Quote Builder:', error);
      } finally {
        setIsAuctionsLoading(false);
      }
    };
    loadInterestedAuctions();
  }, [user]);

  const handleAuctionSelect = (auctionId: string) => {
    setSelectedAuctionId(auctionId);
    if (!auctionId) {
      setSelectedAuctionDetails(null);
      return;
    }
    const found = interestedAuctions.find(a => a.id === auctionId);
    if (found) {
      const summary = generateCatalogSummary(found);
      setSelectedAuctionDetails({
        auction: found,
        items: summary.items || []
      });
    } else {
      setSelectedAuctionDetails(null);
    }
  };

  const handleAddAuctionItemToQuote = (row: any) => {
    const qty = parseFloat(String(row.qty).replace(/,/g, '')) || 1;
    let price = 0;
    const priceMatch = (row.marketPrice || '').match(/₹([\d,]+)/);
    if (priceMatch) {
      price = parseFloat(priceMatch[1].replace(/,/g, ''));
    }
    
    let taxRate = 18;
    const taxMatch = (row.taxRate || '').match(/(\d+)%/);
    if (taxMatch) {
      taxRate = parseInt(taxMatch[1], 10);
    }

    addItemToActiveQuote({
      description: row.description,
      qty,
      unit: row.unit || 'Units',
      price,
      taxRate
    });
    toast.success(`Added "${row.description}" to quote`);
  };

  const handleAddAllAuctionItemsToQuote = () => {
    if (!selectedAuctionDetails || !selectedAuctionDetails.items) return;
    selectedAuctionDetails.items.forEach((row: any) => {
      const qty = parseFloat(String(row.qty).replace(/,/g, '')) || 1;
      let price = 0;
      const priceMatch = (row.marketPrice || '').match(/₹([\d,]+)/);
      if (priceMatch) {
        price = parseFloat(priceMatch[1].replace(/,/g, ''));
      }
      
      let taxRate = 18;
      const taxMatch = (row.taxRate || '').match(/(\d+)%/);
      if (taxMatch) {
        taxRate = parseInt(taxMatch[1], 10);
      }

      addItemToActiveQuote({
        description: row.description,
        qty,
        unit: row.unit || 'Units',
        price,
        taxRate
      });
    });
    toast.success(`Added all items to quote`);
  };

  // Manual Item Form State
  const [manualItem, setManualItem] = useState({
    description: '',
    qty: 1,
    unit: 'Units',
    price: 0,
    taxRate: 18
  });

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setLogoPreview(base64String);
        updateActiveQuoteMetadata({ senderLogoUrl: base64String });
        toast.success('Logo uploaded successfully');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAttachmentUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onloadend = () => {
          const attachment: QuoteAttachment = {
            name: file.name,
            size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
            type: file.type,
            dataUrl: reader.result as string
          };
          addAttachmentToActiveQuote(attachment);
        };
        reader.readAsDataURL(file);
      }
      toast.success('Document(s) attached');
    }
  };

  const handleAddManualItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualItem.description.trim()) {
      toast.error('Please enter a description');
      return;
    }
    addItemToActiveQuote({
      description: manualItem.description,
      qty: Number(manualItem.qty),
      unit: manualItem.unit,
      price: Number(manualItem.price),
      taxRate: Number(manualItem.taxRate)
    });
    setManualItem({
      description: '',
      qty: 1,
      unit: 'Units',
      price: 0,
      taxRate: 18
    });
    toast.success('Item added to quote');
  };

  // Calculations
  const subtotal = activeQuote.items.reduce((acc, item) => {
    const itemAmount = Math.round(item.qty * item.price * 100) / 100;
    return acc + itemAmount;
  }, 0);
  
  const taxDetails = activeQuote.items.map(item => {
    const amount = Math.round(item.qty * item.price * 100) / 100;
    const taxAmount = Math.round(amount * (item.taxRate / 100) * 100) / 100;
    return {
      rate: item.taxRate,
      amount: taxAmount
    };
  });

  // Group by tax rates
  const taxSummary = taxDetails.reduce((acc, cur) => {
    const existing = acc.find(a => a.rate === cur.rate);
    if (existing) {
      existing.amount = Math.round((existing.amount + cur.amount) * 100) / 100;
    } else {
      acc.push({ rate: cur.rate, amount: cur.amount });
    }
    return acc;
  }, [] as { rate: number; amount: number }[]);

  const totalTax = Math.round(taxSummary.reduce((acc, cur) => acc + cur.amount, 0) * 100) / 100;
  const grandTotal = Math.round((subtotal + (activeQuote.gstEnabled ? totalTax : 0)) * 100) / 100;

  const handleSave = () => {
    saveActiveQuote();
    toast.success('Quote saved successfully');
  };

  const handlePrint = () => {
    window.print();
  };

  const themes = [
    { name: 'Sky Blue', color: '#0284c7' },
    { name: 'Emerald', color: '#059669' },
    { name: 'Indigo', color: '#4f46e5' },
    { name: 'Violet', color: '#7c3aed' },
    { name: 'Slate', color: '#475569' },
    { name: 'Rose', color: '#e11d48' },
    { name: 'Orange', color: '#ea580c' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Header Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center">
            <FileText className="w-6 h-6 mr-3 text-primary" />
            Commercial Proposal & Quote Generator
          </h1>
          <p className="text-slate-500 mt-1">Design, customize, and generate professional client-ready quotations.</p>
        </div>

        <div className="flex border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm shrink-0">
          <button
            onClick={() => setActiveTab('editor')}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'editor' ? 'bg-primary text-white' : 'text-slate-600 hover:text-slate-950 bg-white'}`}
          >
            Quote Editor
          </button>
          <button
            onClick={() => setActiveTab('quotes')}
            className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'quotes' ? 'bg-primary text-white' : 'text-slate-600 hover:text-slate-950 bg-white'}`}
          >
            Saved Quotes ({quotes.length})
          </button>
        </div>
      </div>

      {activeTab === 'quotes' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 print:hidden">
          <h3 className="text-lg font-bold text-slate-900 mb-4">Saved Quotes</h3>
          {quotes.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <FileText className="w-12 h-12 text-slate-350 mx-auto mb-3" />
              <p className="font-semibold">No saved quotes found</p>
              <p className="text-xs text-slate-400 mt-1">Start by adding items to your quote from the catalog details modal.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 font-mono">
                    <th className="p-4 font-bold">Quote #</th>
                    <th className="p-4 font-bold">Client Name / Company</th>
                    <th className="p-4 font-bold">Date</th>
                    <th className="p-4 font-bold">Items Count</th>
                    <th className="p-4 font-bold text-right">Total Amount</th>
                    <th className="p-4 font-bold text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {quotes.map((q) => {
                    const qSubtotal = q.items.reduce((acc, item) => acc + (item.qty * item.price), 0);
                    const qTax = q.items.reduce((acc, item) => acc + (item.qty * item.price * (item.taxRate / 100)), 0);
                    const qTotal = qSubtotal + (q.gstEnabled ? qTax : 0);

                    return (
                      <tr key={q.id} className="hover:bg-slate-50/50">
                        <td className="p-4 font-bold font-mono text-slate-900">{q.quoteNumber}</td>
                        <td className="p-4">
                          <p className="font-bold text-slate-900">{q.clientName || 'N/A'}</p>
                          <p className="text-xs text-slate-500">{q.clientCompany}</p>
                        </td>
                        <td className="p-4">{new Date(q.date).toLocaleDateString()}</td>
                        <td className="p-4">{q.items.length} items</td>
                        <td className="p-4 text-right font-bold text-slate-950">₹{qTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td className="p-4 text-center space-x-2">
                          <button
                            onClick={() => {
                              loadQuote(q.id);
                              setLogoPreview(q.senderLogoUrl || '');
                              setActiveTab('editor');
                              toast.success(`Loaded Quote ${q.quoteNumber}`);
                            }}
                            className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition-colors cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              deleteQuote(q.id);
                              toast.success('Quote deleted');
                            }}
                            className="px-3 py-1.5 text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded-lg transition-colors cursor-pointer"
                          >
                            Delete
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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: EDITOR CONTROL PANEL */}
          <div className="lg:col-span-5 space-y-6 print:hidden">
            
            {/* Template customization */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-5">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900 flex items-center">
                  <Palette className="w-5 h-5 mr-2 text-slate-400" />
                  Customize Proposal Layout
                </h3>
                <button
                  onClick={() => {
                    createNewQuote();
                    setLogoPreview('');
                    toast.success('Created fresh quote canvas');
                  }}
                  className="px-2.5 py-1 text-xs font-bold text-primary hover:bg-primary/10 rounded-md border border-primary/20 transition-colors"
                >
                  Reset / New
                </button>
              </div>

              {/* Theme Colors */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Accent Theme Color</label>
                <div className="flex flex-wrap gap-2">
                  {themes.map((t) => (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => updateActiveQuoteMetadata({ colorTheme: t.color })}
                      className="w-8 h-8 rounded-full border-2 transition-all relative flex items-center justify-center cursor-pointer shadow-2xs hover:scale-105"
                      style={{ 
                        backgroundColor: t.color,
                        borderColor: activeQuote.colorTheme === t.color ? '#000000' : 'transparent' 
                      }}
                      title={t.name}
                    >
                      {activeQuote.colorTheme === t.color && (
                        <Check className="w-4 h-4 text-white drop-shadow-sm" />
                      )}
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5 ml-1">
                    <button
                      type="button"
                      onClick={() => colorInputRef.current?.click()}
                      className="w-8 h-8 rounded-full border-2 transition-all flex items-center justify-center cursor-pointer shadow-2xs hover:scale-105"
                      style={{
                        background: 'conic-gradient(from 0deg, red, yellow, green, cyan, blue, magenta, red)',
                        borderColor: !themes.some(t => t.color.toLowerCase() === activeQuote.colorTheme.toLowerCase()) ? '#000000' : 'transparent'
                      }}
                      title="Custom Color Wheel"
                    >
                      {!themes.some(t => t.color.toLowerCase() === activeQuote.colorTheme.toLowerCase()) && (
                        <Check className="w-4 h-4 text-white drop-shadow-sm" />
                      )}
                    </button>
                    <input
                      ref={colorInputRef}
                      type="color"
                      value={activeQuote.colorTheme}
                      onChange={(e) => updateActiveQuoteMetadata({ colorTheme: e.target.value })}
                      className="sr-only"
                    />
                  </div>
                </div>
              </div>

              {/* Logo Upload */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Sender Logo</label>
                <div className="flex items-center gap-3">
                  {logoPreview ? (
                    <div className="relative w-16 h-16 border border-slate-200 rounded-xl bg-slate-50 flex items-center justify-center p-1 overflow-hidden">
                      <img src={logoPreview} alt="Logo preview" className="max-w-full max-h-full object-contain" />
                      <button
                        type="button"
                        onClick={() => {
                          setLogoPreview('');
                          updateActiveQuoteMetadata({ senderLogoUrl: '' });
                        }}
                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="w-16 h-16 border-2 border-dashed border-slate-200 hover:border-primary rounded-xl flex items-center justify-center cursor-pointer bg-slate-50 text-slate-400 transition-colors hover:bg-slate-100"
                    >
                      <Building2 className="w-6 h-6" />
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-350 rounded-lg bg-white cursor-pointer shadow-3xs"
                    >
                      Upload Image
                    </button>
                    <p className="text-[10px] text-slate-400 mt-1">PNG, JPG, or SVG. Transparent background recommended.</p>
                  </div>
                </div>
              </div>

              {/* Proposal Document Title */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Proposal Document Title</label>
                <input
                  type="text"
                  placeholder="e.g. Quotation, Proposal (Leave blank to hide)"
                  value={activeQuote.documentTitle || ''}
                  onChange={(e) => updateActiveQuoteMetadata({ documentTitle: e.target.value })}
                  className="w-full text-xs px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-slate-700 placeholder:text-slate-400"
                />
                <p className="text-[10px] text-slate-400">If cleared, you can rely purely on your logo at the top.</p>
              </div>

              {/* Logo Layout Settings */}
              {activeQuote.senderLogoUrl && (
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider font-mono">Logo Settings</label>

                  {/* Horizontal Position Offset (X) */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 font-mono">
                      <span>Horizontal Position Offset (X)</span>
                      <span>{activeQuote.logoLeftOffset !== undefined ? activeQuote.logoLeftOffset : 0}px</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="-20"
                        max="500"
                        value={activeQuote.logoLeftOffset !== undefined ? activeQuote.logoLeftOffset : 0}
                        onChange={(e) => updateActiveQuoteMetadata({ logoLeftOffset: Number(e.target.value) })}
                        className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                  </div>

                  {/* Vertical Position Offset (Y) */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 font-mono">
                      <span>Vertical Position Offset (Y)</span>
                      <span>{activeQuote.logoTopOffset !== undefined ? activeQuote.logoTopOffset : 16}px</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="0"
                        max="120"
                        value={activeQuote.logoTopOffset !== undefined ? activeQuote.logoTopOffset : 16}
                        onChange={(e) => updateActiveQuoteMetadata({ logoTopOffset: Number(e.target.value) })}
                        className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                  </div>

                  {/* Logo Size (Scale) */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-500 font-mono">
                      <span>Logo Size (Scale)</span>
                      <span>{activeQuote.logoWidth || 150}px</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="range"
                        min="40"
                        max="150"
                        value={activeQuote.logoWidth || 150}
                        onChange={(e) => updateActiveQuoteMetadata({ logoWidth: Number(e.target.value) })}
                        className="w-full h-1.5 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Address Details */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center">
                <User className="w-5 h-5 mr-2 text-slate-400" />
                Quotation Metadata & Details
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Quote ID / Number</label>
                  <input
                    type="text"
                    value={activeQuote.quoteNumber}
                    onChange={(e) => updateActiveQuoteMetadata({ quoteNumber: e.target.value })}
                    className="w-full text-xs font-mono font-bold px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all text-slate-800"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Quote Date</label>
                  <input
                    type="date"
                    value={activeQuote.date}
                    onChange={(e) => updateActiveQuoteMetadata({ date: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-slate-750"
                  />
                </div>
                <div className="space-y-1 col-span-2">
                  <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Proposal Valid Until</label>
                  <input
                    type="date"
                    value={activeQuote.validUntil}
                    onChange={(e) => updateActiveQuoteMetadata({ validUntil: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-slate-750"
                  />
                </div>
              </div>

              {/* Sender Details (Our Info) */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-mono">Sender Details (From)</h4>
                <div className="space-y-2.5">
                  <input
                    type="text"
                    placeholder="Sender Name"
                    value={activeQuote.senderName}
                    onChange={(e) => updateActiveQuoteMetadata({ senderName: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-slate-750 placeholder:text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Company Name"
                    value={activeQuote.senderCompany}
                    onChange={(e) => updateActiveQuoteMetadata({ senderCompany: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-slate-750 placeholder:text-slate-400"
                  />
                  <input
                    type="email"
                    placeholder="Sender Email Address"
                    value={activeQuote.senderEmail}
                    onChange={(e) => updateActiveQuoteMetadata({ senderEmail: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-slate-750 placeholder:text-slate-400"
                  />
                  <textarea
                    placeholder="Sender Address / Registered Office"
                    value={activeQuote.senderAddress}
                    onChange={(e) => updateActiveQuoteMetadata({ senderAddress: e.target.value })}
                    rows={2}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-slate-750 placeholder:text-slate-400 resize-none"
                  />
                </div>
              </div>

              {/* Client Details (Quoting to) */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider font-mono">Recipient Details (To)</h4>
                <div className="space-y-2.5">
                  <input
                    type="text"
                    placeholder="Client Contact Name"
                    value={activeQuote.clientName}
                    onChange={(e) => updateActiveQuoteMetadata({ clientName: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-slate-750 placeholder:text-slate-400"
                  />
                  <input
                    type="text"
                    placeholder="Client Company Name"
                    value={activeQuote.clientCompany}
                    onChange={(e) => updateActiveQuoteMetadata({ clientCompany: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-slate-750 placeholder:text-slate-400"
                  />
                  <input
                    type="email"
                    placeholder="Client Email Address"
                    value={activeQuote.clientEmail}
                    onChange={(e) => updateActiveQuoteMetadata({ clientEmail: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-slate-750 placeholder:text-slate-400"
                  />
                  <textarea
                    placeholder="Client Delivery Address / Billing Address"
                    value={activeQuote.clientAddress}
                    onChange={(e) => updateActiveQuoteMetadata({ clientAddress: e.target.value })}
                    rows={2}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-slate-750 placeholder:text-slate-400 resize-none"
                  />
                </div>
              </div>
            </div>

            {/* GST / Taxation Settings */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center">
                <Percent className="w-5 h-5 mr-2 text-slate-400" />
                GST & Taxation Configuration
              </h3>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-750">Enable GST / Taxes</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activeQuote.gstEnabled}
                    onChange={(e) => updateActiveQuoteMetadata({ gstEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-250 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </label>
              </div>

              {activeQuote.gstEnabled && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Tax Type Structure</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => updateActiveQuoteMetadata({ gstType: 'CGST_SGST' })}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                        activeQuote.gstType === 'CGST_SGST'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      Intra-State (CGST + SGST)
                    </button>
                    <button
                      type="button"
                      onClick={() => updateActiveQuoteMetadata({ gstType: 'IGST' })}
                      className={`px-3 py-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                        activeQuote.gstType === 'IGST'
                          ? 'border-primary bg-primary/5 text-primary'
                          : 'border-slate-200 hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      Inter-State (IGST Only)
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Import from Interested Auctions */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center">
                <Bookmark className="w-5 h-5 mr-2 text-primary" />
                Pull from Interested Auctions
              </h3>

              {isAuctionsLoading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  <span className="text-xs text-slate-500 ml-2">Loading saved catalogs...</span>
                </div>
              ) : interestedAuctions.length === 0 ? (
                <div className="text-center py-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl">
                  <p className="text-xs font-semibold text-slate-500">No interested auctions found</p>
                  <p className="text-[10px] text-slate-400 mt-1 max-w-[220px] mx-auto">
                    Heart any MSTC catalog in the auctions list to import its lots directly.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      Select Saved Auction
                    </label>
                    <CustomSingleDropdown
                      value={selectedAuctionId}
                      onChange={handleAuctionSelect}
                      options={[
                        { value: '', label: '-- Choose an Auction Catalog --' },
                        ...interestedAuctions.map((auc) => ({
                          value: auc.id,
                          label: `${auc.mstc_auction_number.split('/').pop() || 'Catalog'} - ${auc.seller_name.substring(0, 30)}`
                        }))
                      ]}
                      placeholder="-- Choose an Auction Catalog --"
                    />
                  </div>

                  {selectedAuctionDetails && (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-slate-800">
                          Available Lots ({selectedAuctionDetails.items.length})
                        </span>
                        <button
                          type="button"
                          onClick={handleAddAllAuctionItemsToQuote}
                          className="inline-flex items-center text-[10.5px] font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                        >
                          <FileDown className="w-3.5 h-3.5 mr-1" />
                          Import All
                        </button>
                      </div>

                      <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                        {selectedAuctionDetails.items.map((row: any, idx: number) => (
                          <div
                            key={idx}
                            className="p-2.5 bg-slate-50 border border-slate-200 hover:border-slate-350 rounded-lg text-xs flex justify-between items-start gap-3 transition-colors"
                          >
                            <div className="space-y-1 overflow-hidden">
                              <p className="font-bold text-slate-800 leading-snug break-words">
                                {row.description}
                              </p>
                              <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 font-medium">
                                <span>Qty: <strong className="text-slate-700">{row.qty} {row.unit}</strong></span>
                                <span>Tax: <strong className="text-slate-700">{row.taxRate}</strong></span>
                                <span>Market Est: <strong className="text-slate-700">{row.marketPrice}</strong></span>
                              </div>
                            </div>
                             <button
                               type="button"
                               onClick={() => handleAddAuctionItemToQuote(row)}
                               className="px-3 py-1.5 text-[10px] font-black text-white bg-primary hover:bg-primary/90 rounded-lg transition-colors shrink-0 cursor-pointer"
                             >
                               Add
                             </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Add Custom Item Manually */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center">
                <Plus className="w-5 h-5 mr-2 text-slate-400" />
                Add Custom Item Manually
              </h3>

              <form onSubmit={handleAddManualItem} className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Item Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Mixed Structural Steel Plate Waste"
                    value={manualItem.description}
                    onChange={(e) => setManualItem({ ...manualItem, description: e.target.value })}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-slate-750 placeholder:text-slate-400"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Qty</label>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={manualItem.qty}
                      onChange={(e) => setManualItem({ ...manualItem, qty: Number(e.target.value) })}
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-slate-750"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Unit</label>
                    <input
                      type="text"
                      placeholder="MT, Kgs, Nos"
                      value={manualItem.unit}
                      onChange={(e) => setManualItem({ ...manualItem, unit: e.target.value })}
                      className="w-full text-xs px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-semibold text-slate-750 placeholder:text-slate-400"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">GST %</label>
                    <CustomSingleDropdown
                      value={manualItem.taxRate}
                      onChange={(val) => setManualItem({ ...manualItem, taxRate: Number(val) })}
                      options={[
                        { value: 0, label: '0%' },
                        { value: 5, label: '5%' },
                        { value: 12, label: '12%' },
                        { value: 18, label: '18%' },
                        { value: 28, label: '28%' }
                      ]}
                      placeholder="18%"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider font-mono">Price Rate (₹)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Rate per unit"
                    value={manualItem.price || ''}
                    onChange={(e) => setManualItem({ ...manualItem, price: Number(e.target.value) })}
                    className="w-full text-xs px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all font-mono font-bold text-slate-800 placeholder:text-slate-400"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  Insert Item
                </button>
              </form>
            </div>

            {/* Document Attachments */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center">
                <Paperclip className="w-5 h-5 mr-2 text-slate-400" />
                Attach Documents
              </h3>

              <div className="space-y-3">
                <input
                  type="file"
                  ref={attachmentInputRef}
                  onChange={handleAttachmentUpload}
                  multiple
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => attachmentInputRef.current?.click()}
                  className="w-full py-3 border border-dashed border-slate-300 hover:border-primary rounded-xl text-center text-xs font-semibold text-slate-600 hover:text-primary transition-all bg-slate-50 cursor-pointer"
                >
                  Select & Attach Documents
                </button>

                {activeQuote.attachments && activeQuote.attachments.length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {activeQuote.attachments.map((file, idx) => (
                      <div key={idx} className="flex justify-between items-center bg-slate-50 border border-slate-200 p-2 rounded-lg text-xs">
                        <div className="flex items-center gap-2 overflow-hidden max-w-[80%]">
                          <Paperclip className="w-3.5 h-3.5 shrink-0 text-slate-400" />
                          <span className="font-semibold text-slate-800 truncate" title={file.name}>{file.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({file.size})</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAttachmentFromActiveQuote(idx)}
                          className="text-rose-500 hover:text-rose-700 p-1 rounded hover:bg-rose-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Footer Text */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <h3 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3">Quote Terms / Footer</h3>
              <textarea
                placeholder="Write footer text, notes, banking details, payment conditions, etc..."
                value={activeQuote.footerText}
                onChange={(e) => updateActiveQuoteMetadata({ footerText: e.target.value })}
                rows={3}
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50/50 border border-slate-200 hover:border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none font-medium text-slate-705 placeholder:text-slate-400"
              />
            </div>

          </div>

          {/* RIGHT COLUMN: PREVIEW SHEET */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Editor Top Bar for Preview actions */}
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-end print:hidden bg-white p-4 border border-slate-200 rounded-2xl shadow-xs">
              <button
                onClick={handleSave}
                className="inline-flex justify-center items-center py-2 px-5 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-350 shadow-2xs transition-all bg-white cursor-pointer"
              >
                <Save className="w-4 h-4 mr-2 text-slate-500" />
                Save Layout
              </button>
              <button
                onClick={handlePrint}
                className="inline-flex justify-center items-center py-2.5 px-6 rounded-xl text-xs font-bold text-white bg-primary hover:bg-primary/90 transition-all cursor-pointer shadow-md shadow-primary/10"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print / Save PDF
              </button>
            </div>

            {/* PRINT WRAPPER AND THE PREVIEW SHEET */}
            {/* We apply printing overrides to isolate the quote-sheet during windows printing */}
            <div className="bg-slate-100 lg:p-6 rounded-2xl border border-slate-200/50 print:p-0 print:border-none print:bg-white overflow-hidden shadow-inner">
              <div 
                id="quote-print-sheet"
                className="w-full bg-white mx-auto p-8 sm:p-12 shadow-md print:shadow-none print:p-0 text-slate-800 relative flex flex-col justify-between min-h-[1050px]"
                style={{ 
                  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }}
              >
                {/* Decorative Colored Top Bar Accent */}
                <div className="absolute top-0 left-0 right-0 h-2" style={{ backgroundColor: activeQuote.colorTheme }}></div>

                <div>
                  {/* QUOTE HEADER LOGO BLOCK (Absolutely Positioned to prevent layout shifting on resize) */}
                  {(activeQuote.senderLogoUrl || activeQuote.senderCompany) && (
                    <div 
                      className="absolute left-8 right-8 flex items-center justify-start print:left-[20mm] print:right-[20mm]"
                      style={{ 
                        top: `${activeQuote.logoTopOffset !== undefined ? activeQuote.logoTopOffset + 12 : 28}px`,
                        height: '150px'
                      }}
                    >
                      <div
                        style={{
                          transform: `translateX(${activeQuote.logoLeftOffset !== undefined ? activeQuote.logoLeftOffset : 0}px)`,
                          display: 'flex',
                          alignItems: 'center'
                        }}
                      >
                        {activeQuote.senderLogoUrl ? (
                          <img 
                            src={activeQuote.senderLogoUrl} 
                            alt={activeQuote.senderCompany || 'Logo'} 
                            style={{ 
                              width: `${activeQuote.logoWidth || 150}px`,
                              height: 'auto',
                              maxHeight: '150px',
                              objectFit: 'contain'
                            }} 
                          />
                        ) : (
                          <div className="flex items-center gap-2 text-slate-750 font-black text-xl tracking-tight">
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-mono" style={{ backgroundColor: activeQuote.colorTheme }}>
                              {activeQuote.senderCompany.charAt(0) || 'S'}
                            </div>
                            <span>{activeQuote.senderCompany}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Fixed space reservation for header logo block so that other text never shifts */}
                  <div 
                    style={{ 
                      height: `${(activeQuote.logoTopOffset !== undefined ? activeQuote.logoTopOffset : 16) + 150 + 10}px` 
                    }}
                    className="w-full block" 
                  />

                  {/* QUOTE DETAILS BLOCK */}
                  <div className="flex justify-between items-start gap-4 mb-8">
                    {/* Sender Details */}
                    <div className="text-xs text-slate-500 space-y-0.5 leading-relaxed">
                      {activeQuote.senderName && (
                        <p className="font-bold text-slate-800 text-sm">{activeQuote.senderName}</p>
                      )}
                      {activeQuote.senderCompany && (
                        <p className="font-semibold text-slate-700">{activeQuote.senderCompany}</p>
                      )}
                      {activeQuote.senderEmail && <p>{activeQuote.senderEmail}</p>}
                      {activeQuote.senderAddress && (
                        <p className="whitespace-pre-line max-w-[280px] mt-1">{activeQuote.senderAddress}</p>
                      )}
                    </div>

                    {/* Document Info & Meta */}
                    <div className="text-right space-y-2">
                      {activeQuote.documentTitle && activeQuote.documentTitle.trim() !== '' && (
                        <h2 className="text-2xl font-black uppercase tracking-wide" style={{ color: activeQuote.colorTheme }}>
                          {activeQuote.documentTitle}
                        </h2>
                      )}
                      
                      <div className="text-xs space-y-1 font-mono text-slate-600">
                        {activeQuote.quoteNumber && (
                          <p className="flex justify-end gap-2">
                            <span className="text-slate-400">Quote #:</span>
                            <span className="font-bold text-slate-900">{activeQuote.quoteNumber}</span>
                          </p>
                        )}
                        {activeQuote.date && (
                          <p className="flex justify-end gap-2">
                            <span className="text-slate-400">Date:</span>
                            <span className="font-bold text-slate-900">{activeQuote.date}</span>
                          </p>
                        )}
                        {activeQuote.validUntil && (
                          <p className="flex justify-end gap-2">
                            <span className="text-slate-400">Valid Until:</span>
                            <span className="font-bold text-slate-900">{activeQuote.validUntil}</span>
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* BILLING / CLIENT ADDRESS SECTION */}
                  <div className="grid grid-cols-2 gap-4 border-t border-b border-slate-100 py-6 mb-10 bg-slate-50/50 px-4 rounded-xl">
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Prepared For</span>
                      <div className="text-xs text-slate-700 space-y-1 leading-relaxed">
                        <p className="font-black text-slate-900 text-sm">{activeQuote.clientName || 'N/A'}</p>
                        {activeQuote.clientCompany && <p className="font-bold text-slate-805">{activeQuote.clientCompany}</p>}
                        {activeQuote.clientEmail && <p className="font-mono text-slate-500">{activeQuote.clientEmail}</p>}
                        {activeQuote.clientAddress && (
                          <p className="whitespace-pre-line max-w-[320px] text-slate-550 mt-1">{activeQuote.clientAddress}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ITEMS TABLE — Clean read-only rows with click-to-edit panel */}
                  <div className="mb-8">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="border-b-2 border-slate-200 text-[10px] font-bold text-slate-400 uppercase tracking-widest font-mono">
                          <th className="py-3 text-left w-8">#</th>
                          <th className="py-3 text-left">Description / Particulars</th>
                          <th className="py-3 text-right w-28">Qty / Unit</th>
                          <th className="py-3 text-right w-28">Unit Rate</th>
                          {activeQuote.gstEnabled && <th className="py-3 text-right w-16">Tax %</th>}
                          <th className="py-3 text-right w-40">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="text-slate-700">
                        {activeQuote.items.length === 0 ? (
                          <tr>
                            <td colSpan={activeQuote.gstEnabled ? 6 : 5} className="py-8 text-center text-slate-400 italic font-mono">
                              No items added yet. Click "Add" on any lot description or use the left panel form.
                            </td>
                          </tr>
                        ) : (
                          activeQuote.items.map((item, idx) => {
                            const amount = Math.round(item.qty * item.price * 100) / 100;
                            const isEditing = editingItemId === item.id;
                            return (
                              <React.Fragment key={item.id}>
                                {/* Clean read-only data row */}
                                <tr 
                                  className={clsx(
                                    "align-top transition-colors border-b border-slate-100 print:cursor-default",
                                    isEditing ? "bg-blue-50/60" : "hover:bg-slate-50/60 cursor-pointer"
                                  )}
                                  onClick={() => setEditingItemId(isEditing ? null : item.id)}
                                >
                                  <td className="py-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                                  <td className="py-3 font-semibold text-slate-900 text-xs leading-snug pr-4">
                                    <span className="line-clamp-2 print:line-clamp-none">{item.description || <span className="text-slate-350 italic font-normal">No description</span>}</span>
                                  </td>
                                  <td className="py-3 text-right font-mono font-medium whitespace-nowrap text-xs">{item.qty} {item.unit}</td>
                                  <td className="py-3 text-right font-mono font-medium whitespace-nowrap text-xs">₹{item.price.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                                  {activeQuote.gstEnabled && <td className="py-3 text-right font-mono whitespace-nowrap text-xs">{item.taxRate}%</td>}
                                  <td className="py-3 text-right">
                                    <span className="font-mono font-bold text-slate-900 whitespace-nowrap text-xs">
                                      ₹{amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                  </td>
                                </tr>

                                {/* Expandable Edit Panel (hidden in print) */}
                                {isEditing && (
                                  <tr className="print:hidden">
                                    <td colSpan={activeQuote.gstEnabled ? 6 : 5} className="p-0">
                                      <div className="bg-slate-50/80 border-b-2 border-blue-200 px-6 py-4 animate-fade-in">
                                        <div className="flex items-center justify-between mb-3">
                                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest font-mono">Edit Item #{idx + 1}</span>
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={(e) => { e.stopPropagation(); removeItemFromActiveQuote(item.id); setEditingItemId(null); }}
                                              className="text-[10px] font-bold text-rose-400 hover:text-rose-600 uppercase tracking-wider transition-colors cursor-pointer"
                                            >
                                              Remove
                                            </button>
                                            <button
                                              onClick={(e) => { e.stopPropagation(); setEditingItemId(null); }}
                                              className="text-[10px] font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 px-3 py-1 rounded-lg uppercase tracking-wider transition-colors cursor-pointer"
                                            >
                                              Done
                                            </button>
                                          </div>
                                        </div>
                                        {/* Description */}
                                        <div className="mb-3">
                                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mb-1 block">Description</label>
                                          <textarea
                                            value={item.description}
                                            onChange={(e) => updateActiveQuoteItem(item.id, { description: e.target.value })}
                                            onClick={(e) => e.stopPropagation()}
                                            rows={2}
                                            className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 px-3 py-2.5 rounded-xl text-xs font-semibold text-slate-800 resize-y min-h-[44px] leading-relaxed transition-all outline-none"
                                            placeholder="Item description..."
                                          />
                                        </div>
                                        {/* Qty, Unit, Price, Tax in a row */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                          <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mb-1 block">Quantity</label>
                                            <input
                                              type="number"
                                              value={item.qty}
                                              onChange={(e) => updateActiveQuoteItem(item.id, { qty: Number(e.target.value) })}
                                              onClick={(e) => e.stopPropagation()}
                                              className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-right px-3 py-2.5 rounded-xl text-xs font-mono font-medium text-slate-800 transition-all outline-none"
                                            />
                                          </div>
                                          <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mb-1 block">Unit</label>
                                            <input
                                              type="text"
                                              value={item.unit}
                                              onChange={(e) => updateActiveQuoteItem(item.id, { unit: e.target.value })}
                                              onClick={(e) => e.stopPropagation()}
                                              className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-center py-2.5 rounded-xl text-xs font-bold text-slate-600 uppercase transition-all outline-none"
                                              placeholder="MT, Kgs, NO"
                                            />
                                          </div>
                                          <div>
                                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mb-1 block">Unit Price (₹)</label>
                                            <input
                                              type="number"
                                              value={item.price}
                                              onChange={(e) => updateActiveQuoteItem(item.id, { price: Number(e.target.value) })}
                                              onClick={(e) => e.stopPropagation()}
                                              className="w-full bg-white border border-slate-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 text-right px-3 py-2.5 rounded-xl text-xs font-mono font-bold text-slate-800 transition-all outline-none"
                                            />
                                          </div>
                                          {activeQuote.gstEnabled && (
                                            <div>
                                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono mb-1 block">Tax Rate</label>
                                              <CustomSingleDropdown
                                                value={item.taxRate}
                                                onChange={(val) => updateActiveQuoteItem(item.id, { taxRate: Number(val) })}
                                                options={[
                                                  { value: 0, label: '0%' },
                                                  { value: 5, label: '5%' },
                                                  { value: 12, label: '12%' },
                                                  { value: 18, label: '18%' },
                                                  { value: 28, label: '28%' }
                                                ]}
                                                placeholder="18%"
                                              />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* SUMMARY SECTION */}
                  <div className="flex justify-end mb-10 pt-4">
                    <div className="w-80 space-y-2.5 text-xs">
                      
                      <div className="flex justify-between items-center text-slate-550 font-semibold">
                        <span>Items Subtotal:</span>
                        <span className="font-mono font-bold text-slate-800">
                          ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>

                      {activeQuote.gstEnabled && activeQuote.gstType === 'CGST_SGST' && (
                        <>
                          {taxSummary.map((t) => (
                            <React.Fragment key={t.rate}>
                              <div className="flex justify-between items-center text-[11px] text-slate-450 border-t border-slate-50 pt-1 leading-snug">
                                <span>Central Tax (CGST) @{t.rate / 2}%:</span>
                                <span className="font-mono">
                                  ₹{(t.amount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[11px] text-slate-450 leading-snug">
                                <span>State Tax (SGST) @{t.rate / 2}%:</span>
                                <span className="font-mono">
                                  ₹{(t.amount / 2).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                              </div>
                            </React.Fragment>
                          ))}
                        </>
                      )}

                      {activeQuote.gstEnabled && activeQuote.gstType === 'IGST' && (
                        <>
                          {taxSummary.map((t) => (
                            <div key={t.rate} className="flex justify-between items-center text-[11px] text-slate-450 border-t border-slate-50 pt-1 leading-snug">
                              <span>Integrated Tax (IGST) @{t.rate}%:</span>
                              <span className="font-mono">
                                ₹{t.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          ))}
                        </>
                      )}

                      {activeQuote.gstEnabled && totalTax > 0 && (
                        <div className="flex justify-between items-center text-slate-550 border-t border-slate-100 pt-1.5 font-semibold">
                          <span>Total GST Tax:</span>
                          <span className="font-mono font-bold text-slate-800">
                            ₹{totalTax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between items-center border-t border-slate-200 pt-3 text-sm">
                        <span className="font-black text-slate-850">Proposal Total (INR):</span>
                        <span className="font-mono font-black text-[16px]" style={{ color: activeQuote.colorTheme }}>
                          ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ATTACHED DOCUMENTS LIST (IN PREVIEW) */}
                  {activeQuote.attachments && activeQuote.attachments.length > 0 && (
                    <div className="border-t border-slate-100 pt-6 mt-8 space-y-2">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">Associated Enclosures & Documentation</h4>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {activeQuote.attachments.map((file, idx) => (
                          <div 
                            key={idx} 
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11.5px] font-semibold text-slate-700 shadow-3xs"
                          >
                            <FileCode className="w-3.5 h-3.5 text-slate-400" />
                            <span>{file.name}</span>
                            <span className="text-[9.5px] text-slate-400 font-mono">({file.size})</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* FOOTER */}
                {(activeQuote.footerText || activeQuote.id) && (
                  <div className="border-t border-slate-100 pt-6 mt-12 text-[10px] text-slate-400 leading-relaxed max-w-2xl">
                    {activeQuote.footerText && (
                      <p className="whitespace-pre-line">{activeQuote.footerText}</p>
                    )}
                    
                    {/* Visual print check spacer */}
                    <div className="mt-4 text-[9px] text-slate-300 font-mono select-none flex justify-between">
                      <span>Generated Reference: {activeQuote.id}</span>
                      <span>Document Page 1 of 1</span>
                    </div>
                  </div>
                )}

              </div>
            </div>

          </div>

        </div>
      )}

    </div>
  );
}

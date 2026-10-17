import { useState, useEffect } from 'react';
import { 
  X, MessageSquare, Send, CheckCircle2, AlertCircle, 
  Sparkles, Phone, RefreshCw
} from 'lucide-react';
import { adminService } from '../../services/adminService';
import toast from 'react-hot-toast';

interface QuickWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipient: {
    id: string;
    first_name?: string;
    last_name?: string;
    name?: string;
    phone?: string;
    phone_number?: string;
    email?: string;
    role?: string;
  } | null;
  onSuccess?: () => void;
}

export function QuickWhatsAppModal({
  isOpen,
  onClose,
  recipient,
  onSuccess,
}: QuickWhatsAppModalProps) {
  const [message, setMessage] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<'custom' | 'vip' | 'kyc' | 'followup'>('custom');
  const [selectedStyleId, setSelectedStyleId] = useState<string>('');
  const [isSending, setIsSending] = useState(false);
  const [campaignStyles, setCampaignStyles] = useState<Array<{ id: string; style: string; group: string }>>([]);
  const [isLoadingStyles, setIsLoadingStyles] = useState(false);

  const recipientName = recipient
    ? (recipient.first_name ? `${recipient.first_name} ${recipient.last_name || ''}`.trim() : recipient.name || 'Valued User')
    : 'Valued User';

  const rawPhone = recipient?.phone || recipient?.phone_number || '';
  const cleanPhone = rawPhone.replace(/\D/g, '');
  const hasValidPhone = cleanPhone.length >= 10;

  // Presets
  const PRESETS = [
    {
      id: 'custom',
      label: 'Freeform Direct',
      icon: MessageSquare,
      defaultText: `Hello ${recipientName},\n\nWe noticed your recent activity on Lelam.co and wanted to personally reach out to assist you with any upcoming auctions or queries.\n\nBest regards,\nLelam Support Team`,
    },
    {
      id: 'vip',
      label: 'VIP Lot Invite',
      icon: Sparkles,
      defaultText: `🔥 *Exclusive Priority Invite for ${recipientName}*\n\nHigh-value industrial machinery & scrap lots just dropped on Lelam.co. Bidding opens in under 48 hours.\n\n👉 Inspect lots now: https://lelam.co/auctions\n\n_Reply 1 to connect with an auction manager._`,
    },
    {
      id: 'kyc',
      label: 'KYC & Verification',
      icon: CheckCircle2,
      defaultText: `Hi ${recipientName},\n\nYour account on Lelam.co is 1 step away from bidding approval. Please ensure your GST/ID documentation is uploaded on your dashboard to unlock live auctions:\n\n👉 https://lelam.co/dashboard/documents\n\nNeed assistance? Reply directly to this message.`,
    },
    {
      id: 'followup',
      label: 'Quick Follow-Up',
      icon: Phone,
      defaultText: `Hello ${recipientName}, thanks for choosing Lelam.co! Did you find the lots or equipment you were looking for? If you need custom sourcing or help placing a bid, I'm here to assist you right here on WhatsApp.`,
    },
  ];

  // Fetch styles on load
  useEffect(() => {
    if (isOpen) {
      setIsLoadingStyles(true);
      adminService.getWhatsAppCampaignStyles()
        .then(res => {
          setCampaignStyles(res.availableStyles || []);
        })
        .finally(() => setIsLoadingStyles(false));
    }
  }, [isOpen]);

  // Set default message when preset or recipient changes
  useEffect(() => {
    if (recipient) {
      const current = PRESETS.find(p => p.id === selectedPreset);
      if (current) {
        setMessage(current.defaultText);
      }
    }
  }, [recipient, selectedPreset]);

  if (!isOpen || !recipient) return null;

  const handleApplyStyle = async (styleId: string) => {
    setSelectedStyleId(styleId);
    if (!styleId) return;

    try {
      const preview = await adminService.previewWhatsAppStyle({
        styleId,
        recipientName,
        title: 'MSTC Heavy Industrial Copper Scrap Lot',
        location: 'Mumbai, Maharashtra',
        price: 350000,
      });

      if (preview?.fullMessage) {
        setMessage(preview.fullMessage);
        setSelectedPreset('custom');
      }
    } catch (err) {
      console.error('Failed to preview style:', err);
    }
  };

  const handleSend = async () => {
    if (!hasValidPhone) {
      toast.error('Recipient does not have a valid phone number recorded.');
      return;
    }

    if (!message.trim()) {
      toast.error('Please enter a message to send.');
      return;
    }

    setIsSending(true);
    try {
      const res = await adminService.sendDirectWhatsApp({
        phone: rawPhone,
        message: message.trim(),
        userId: recipient.id,
        recipientName,
      });

      if (res.success) {
        toast.success(`WhatsApp message dispatched to ${recipientName} (+${res.messageId || cleanPhone})!`, {
          icon: '✅',
          duration: 4000,
        });
        if (onSuccess) onSuccess();
        onClose();
      } else {
        toast.error(res.error || 'Failed to dispatch WhatsApp message');
      }
    } catch (err: any) {
      toast.error(err.message || 'Dispatch error occurred');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-emerald-500/10 via-transparent to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-base">Direct WhatsApp Message</h3>
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                  +91 81388 89406
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official Business Cloud API dispatch with audit logging
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Recipient Details Pill */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-sm">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary font-bold text-sm flex items-center justify-center">
                {recipientName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">{recipientName}</span>
                  {recipient.role && (
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {recipient.role}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-mono flex items-center gap-2">
                  <span>{recipient.email || 'No email'}</span>
                  <span>•</span>
                  <span className={hasValidPhone ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-red-500 font-bold'}>
                    {rawPhone ? `+${cleanPhone}` : 'No phone registered'}
                  </span>
                </div>
              </div>
            </div>

            {!hasValidPhone && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-900">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Cannot send: missing phone</span>
              </div>
            )}
          </div>

          {/* Quick Preset Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-2">
              Message Presets
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PRESETS.map((preset) => {
                const Icon = preset.icon;
                const isSelected = selectedPreset === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setSelectedPreset(preset.id as any);
                      setSelectedStyleId('');
                    }}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium text-left transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 shadow-sm'
                        : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`} />
                    <span className="truncate">{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Advanced Marketing / Outreach Hook Template Selector */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Or Use AI Campaign Engine (42 Styles)
              </label>
              <span className="text-[11px] text-slate-400">MSTC & Zomato Viral Hooks</span>
            </div>
            <select
              value={selectedStyleId}
              disabled={isLoadingStyles}
              onChange={(e) => handleApplyStyle(e.target.value)}
              className="w-full text-xs py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-emerald-500 transition-colors cursor-pointer disabled:opacity-50"
            >
              <option value="">-- Choose Campaign Copy Tone --</option>
              <optgroup label="Promotional & Urgency Hooks (30)">
                {campaignStyles
                  .filter(s => s.group.includes('Promotional'))
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {s.style}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="B2B Cold Outreach (12)">
                {campaignStyles
                  .filter(s => s.group.includes('Outreach'))
                  .map(s => (
                    <option key={s.id} value={s.id}>
                      {s.style}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          {/* Message Text Input & WhatsApp Bubble Preview */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Message Content
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                {message.length} chars
              </span>
            </div>

            <textarea
              rows={5}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your WhatsApp message..."
              className="w-full p-3 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-sans"
            />

            {/* Live WhatsApp Bubble Preview */}
            <div className="bg-[#efeae2] dark:bg-[#0b141a] p-4 rounded-xl border border-slate-200 dark:border-slate-800 relative overflow-hidden">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2 flex items-center justify-between">
                <span>WhatsApp Live Preview</span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">Official Lelam Sender</span>
              </div>
              <div className="max-w-[85%] ml-auto bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-white p-3 rounded-2xl rounded-tr-sm shadow-sm text-xs leading-relaxed whitespace-pre-wrap font-sans break-words border border-[#c1f5b8]/50 dark:border-[#005c4b]">
                {message || <span className="italic opacity-50">Empty message preview...</span>}
                <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-slate-500 dark:text-slate-300">
                  <span>Just now</span>
                  <span className="text-emerald-600 dark:text-emerald-300 font-bold">✓✓</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Messages are tracked under <code className="text-emerald-600 font-mono">whatsapp_messages</code> audit logs.
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSending}
              className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || !hasValidPhone || !message.trim()}
              className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:pointer-events-none rounded-xl shadow-sm hover:shadow transition-all cursor-pointer"
            >
              {isSending ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Dispatching...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Send WhatsApp</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

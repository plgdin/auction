import React from 'react';
import { Lock, ShieldAlert, X, Mail } from 'lucide-react';
import { ALL_AUCTION_TYPES, type AuctionTypeKey } from '../../hooks/useAuctionAccess';

interface AuctionAccessLockModalProps {
  isOpen: boolean;
  onClose: () => void;
  auctionType: AuctionTypeKey | string;
  itemTitle?: string;
}

export const AuctionAccessLockModal: React.FC<AuctionAccessLockModalProps> = ({
  isOpen,
  onClose,
  auctionType,
  itemTitle,
}) => {
  if (!isOpen) return null;

  const typeDef = ALL_AUCTION_TYPES.find((t) => t.key === auctionType) || {
    key: auctionType as any,
    label: auctionType,
    description: 'This category of auctions and government tenders.',
    shortLabel: auctionType,
    colorClass: '',
    badgeBg: '',
    badgeText: '',
    badgeBorder: '',
    isBeta: false,
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col z-10 text-left animate-in zoom-in-95 duration-200">
        {/* Top Header Graphic */}
        <div className="relative bg-slate-900 px-6 pt-8 pb-6 text-white overflow-hidden">
          <div className="absolute -right-6 -top-6 w-32 h-32 bg-primary/20 rounded-full blur-2xl pointer-events-none" />
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 font-mono">
                  Access Restricted
                </span>
                {typeDef.isBeta && (
                  <span className="px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                    BETA
                  </span>
                )}
              </div>
              <h3 className="text-xl font-bold tracking-tight text-white">
                {typeDef.shortLabel} Permission Required
              </h3>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Your account has not been granted access to view{' '}
            <span className="font-bold text-white">{typeDef.label}</span>. Access to this auction channel is governed by organization permissions.
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {itemTitle && (
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Target Item / Notice
              </span>
              <p className="text-xs font-bold text-slate-800 line-clamp-2 leading-snug">
                {itemTitle}
              </p>
            </div>
          )}

          <div className="space-y-3 text-xs text-slate-600">
            <div className="flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span>
                <strong>Administrator Controlled:</strong> Only authorized members approved by the system administrator can view tender notices, participate in bidding, and download specifications for this channel.
              </span>
            </div>
          </div>

          {/* Contact Admin Box */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Request Channel Access
            </h4>
            <p className="text-xs text-slate-500">
              Contact your organization administrator or our support desk to enable access to {typeDef.shortLabel} auctions on your profile.
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <a
                href="mailto:support@lelam.co?subject=Auction%20Access%20Request"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors"
              >
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                <span>support@lelam.co</span>
              </a>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shadow-md"
            >
              Close Notice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

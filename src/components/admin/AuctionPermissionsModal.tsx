import React, { useState } from 'react';
import { X, ShieldCheck, Check, Save, CheckSquare, Square, Info } from 'lucide-react';
import { ALL_AUCTION_TYPES } from '../../hooks/useAuctionAccess';
import { adminService } from '../../services/adminService';
import clsx from 'clsx';

interface AuctionPermissionsModalProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdated: (userId: string, updatedAllowedTypes: string[]) => void;
}

export const AuctionPermissionsModal: React.FC<AuctionPermissionsModalProps> = ({
  user,
  isOpen,
  onClose,
  onUpdated,
}) => {
  if (!isOpen || !user) return null;

  // Initialize state with user's current permissions or MSTC only if undefined
  const initialAllowed: string[] = Array.isArray(user.allowed_auction_types)
    ? user.allowed_auction_types
    : ['mstc'];

  const [selectedTypes, setSelectedTypes] = useState<string[]>(initialAllowed);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleToggle = (key: string) => {
    if (selectedTypes.includes(key)) {
      setSelectedTypes(selectedTypes.filter((k) => k !== key));
    } else {
      setSelectedTypes([...selectedTypes, key]);
    }
  };

  const handleSelectAll = () => {
    setSelectedTypes(ALL_AUCTION_TYPES.map((t) => t.key));
  };

  const handleDeselectAll = () => {
    setSelectedTypes([]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSuccessMessage(null);
    try {
      const success = await adminService.updateUserAuctionPermissions(user.id, selectedTypes);
      if (success) {
        setSuccessMessage('Permissions updated successfully!');
        onUpdated(user.id, selectedTypes);
        setTimeout(() => {
          onClose();
        }, 800);
      } else {
        alert('Failed to update user auction permissions.');
      }
    } catch (err: any) {
      console.error(err);
      alert('Error updating permissions.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative bg-white rounded-3xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col z-10 text-left animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/70">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <h3 className="font-extrabold text-slate-900 text-lg">
                Auction Access Control
              </h3>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Configure allowed auction portals and channels for{' '}
              <strong className="text-slate-800">{user.first_name} {user.last_name}</strong> ({user.email})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[65vh]">
          {/* Quick Select Actions */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Channels ({selectedTypes.length}/{ALL_AUCTION_TYPES.length} Granted)
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-xs font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer"
              >
                Grant All
              </button>
              <span className="text-slate-300">|</span>
              <button
                type="button"
                onClick={handleDeselectAll}
                className="text-xs font-bold text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                Revoke All
              </button>
            </div>
          </div>

          {/* List of Auction Types */}
          <div className="space-y-2.5">
            {ALL_AUCTION_TYPES.map((type) => {
              const isSelected = selectedTypes.includes(type.key);
              return (
                <div
                  key={type.key}
                  onClick={() => handleToggle(type.key)}
                  className={clsx(
                    'p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-3.5 select-none',
                    isSelected
                      ? 'bg-slate-50/80 border-primary/30 shadow-xs'
                      : 'bg-white border-slate-200 opacity-60 hover:opacity-100'
                  )}
                >
                  <div className="mt-0.5 text-primary shrink-0">
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-primary" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-grow space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">
                        {type.label}
                      </span>
                      <span
                        className={clsx(
                          'px-2 py-0.5 text-[10px] font-extrabold uppercase rounded border',
                          type.colorClass
                        )}
                      >
                        {type.shortLabel}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      {type.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Notice info */}
          <div className="p-3.5 bg-blue-50/60 rounded-2xl border border-blue-100 flex items-start gap-2.5 text-xs text-blue-800">
            <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              Users with revoked access will see an entitlement lock modal if they attempt to view, bid, or download notices for that specific portal.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            {successMessage && (
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                <Check className="w-4 h-4" /> {successMessage}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Permissions'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

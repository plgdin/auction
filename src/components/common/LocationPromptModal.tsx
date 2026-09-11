import { MapPin, X, AlertCircle, Loader2, Navigation } from 'lucide-react';
import clsx from 'clsx';

interface LocationPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAllow: () => Promise<void> | void;
  isLoading?: boolean;
  error?: string | null;
  permissionDenied?: boolean;
}

export function LocationPromptModal({
  isOpen,
  onClose,
  onAllow,
  isLoading = false,
  error = null,
  permissionDenied = false,
}: LocationPromptModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
      <div 
        className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 overflow-hidden transform transition-all scale-100"
        role="dialog"
        aria-modal="true"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Icon Badge */}
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner border border-emerald-100">
              <Navigation className="w-8 h-8 text-emerald-600 fill-emerald-100 animate-pulse" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow-md">
              <MapPin className="w-3.5 h-3.5" />
            </span>
          </div>

          <h3 className="text-xl font-bold text-slate-900 mb-2">
            Turn On Location Services
          </h3>
          <p className="text-sm text-slate-600 leading-relaxed mb-5">
            To view auctions within your chosen distance, allow Lelam to access your device location.
          </p>

          {/* Error notice if permission was denied or unavailable */}
          {(error || permissionDenied) && (
            <div className="w-full mb-5 text-left p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold text-amber-950">
                  {permissionDenied
                    ? 'Location permission is blocked in your browser.'
                    : (error || 'Location access unavailable.')}
                </p>
                <p className="text-amber-800 leading-normal">
                  Please click the <strong>lock/tune icon (🔒)</strong> in your browser's address bar, enable <strong>Location</strong>, then click <strong>Try Again</strong>.
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="w-full flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={onAllow}
              disabled={isLoading}
              className={clsx(
                "flex-1 py-3 px-4 rounded-xl text-sm font-bold text-white shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer",
                isLoading
                  ? "bg-primary/80 cursor-wait"
                  : "bg-primary hover:bg-primary/95 hover:shadow-lg active:scale-[0.98]"
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Requesting...</span>
                </>
              ) : (
                <>
                  <Navigation className="w-4 h-4 fill-white/20" />
                  <span>{permissionDenied ? 'Try Again' : 'Allow Location Access'}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="py-3 px-4 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

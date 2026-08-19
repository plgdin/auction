import React, { useState, useEffect, useRef } from 'react';
import { X, Download, Maximize2, Minimize2, FileText, Loader2, AlertCircle, Printer } from 'lucide-react';

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  documentUrl: string;
  filename?: string;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  title,
  documentUrl,
  filename = 'Auction_Notice.pdf',
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Format in-app proxy URLs
  const proxyViewUrl = `/api/document-proxy?url=${encodeURIComponent(documentUrl)}&filename=${encodeURIComponent(filename)}&disposition=inline`;
  const proxyDownloadUrl = `/api/document-proxy?url=${encodeURIComponent(documentUrl)}&filename=${encodeURIComponent(filename)}&disposition=attachment`;

  const handlePrint = () => {
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.print();
      } else {
        window.open(proxyViewUrl, '_blank')?.print();
      }
    } catch (e) {
      window.open(proxyViewUrl, '_blank');
    }
  };

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setIsLoading(true);
      setHasError(false);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen, documentUrl]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Modal Window */}
      <div
        className={`relative bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700 flex flex-col transition-all duration-200 ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-5xl h-[88vh]'
        }`}
      >
        {/* Top Navigation Bar */}
        <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 text-white select-none">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <span className="p-1.5 rounded-lg bg-primary/20 text-primary-300">
              <FileText className="w-4 h-4" />
            </span>
            <div className="truncate">
              <h3 className="text-xs sm:text-sm font-bold text-slate-100 truncate">{title}</h3>
              <span className="text-[10px] text-slate-400 font-mono block truncate">{filename}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Print / Save PDF Button */}
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold shadow-xs transition-colors cursor-pointer border border-slate-700"
              title="Print / Save as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Save as PDF</span>
            </button>

            {/* Direct Download Button */}
            <a
              href={proxyDownloadUrl}
              download={filename}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-rose-500/20 hover:text-rose-300 transition-colors cursor-pointer"
              title="Close Viewer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Viewer Body */}
        <div className="relative flex-1 bg-slate-950 w-full h-full overflow-hidden flex items-center justify-center">
          {isLoading && !hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950 z-10 text-slate-400">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <span className="text-xs font-medium">Loading document securely from portal...</span>
            </div>
          )}

          {hasError ? (
            <div className="p-8 text-center max-w-md space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">Preview unavailable in browser iframe</h4>
                <p className="text-xs text-slate-400 mt-1">
                  The document can still be downloaded directly to your device.
                </p>
              </div>
              <a
                href={proxyDownloadUrl}
                download={filename}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs transition-colors"
              >
                <Download className="w-4 h-4" /> Download Notice File Directly
              </a>
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={proxyViewUrl}
              title={title}
              className="w-full h-full border-0 bg-white"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  Download, 
  Maximize2, 
  Minimize2, 
  FileText, 
  AlertCircle, 
  Printer, 
  ExternalLink,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Copy,
  Check,
  ShieldCheck,
  RefreshCw,
  FileCheck2
} from 'lucide-react';

interface DocumentViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  documentUrl: string;
  filename?: string;
  subtitle?: string;
  badge?: string;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  onClose,
  title,
  documentUrl,
  filename = 'Auction_Notice.pdf',
  subtitle,
  badge = 'Official Tender Notice',
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Format URLs: handling direct data URIs, Supabase CDN, and proxy endpoints
  const isDirectUrl = 
    documentUrl.startsWith('data:') || 
    documentUrl.startsWith('blob:') || 
    documentUrl.startsWith('/api/') || 
    documentUrl.includes('supabase.co');

  const proxyViewUrl = isDirectUrl 
    ? documentUrl 
    : `/api/document-proxy?url=${encodeURIComponent(documentUrl)}&filename=${encodeURIComponent(filename)}&disposition=inline`;

  const proxyDownloadUrl = isDirectUrl 
    ? documentUrl 
    : `/api/document-proxy?url=${encodeURIComponent(documentUrl)}&filename=${encodeURIComponent(filename)}&disposition=attachment`;

  // Print Notice Document
  const handlePrint = useCallback(() => {
    try {
      if (iframeRef.current?.contentWindow) {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
      } else {
        const w = window.open(proxyViewUrl, '_blank');
        w?.print();
      }
    } catch {
      window.open(proxyViewUrl, '_blank');
    }
  }, [proxyViewUrl]);

  // Copy URL
  const handleCopyUrl = useCallback(() => {
    const shareUrl = documentUrl.startsWith('http') ? documentUrl : `${window.location.origin}${proxyViewUrl}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [documentUrl, proxyViewUrl]);

  // Zoom controls
  const handleZoomIn = () => setZoomLevel((z) => Math.min(z + 15, 200));
  const handleZoomOut = () => setZoomLevel((z) => Math.max(z - 15, 60));
  const handleResetZoom = () => {
    setZoomLevel(100);
    setRotation(0);
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  // Reload iframe
  const handleReload = () => {
    setIsLoading(true);
    setHasError(false);
    setLoadTimedOut(false);
    if (iframeRef.current) {
      iframeRef.current.src = proxyViewUrl;
    }
  };

  // Body scroll lock & safety timeout
  useEffect(() => {
    let timer: any;
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setIsLoading(true);
      setHasError(false);
      setLoadTimedOut(false);
      setZoomLevel(100);
      setRotation(0);

      // Safety timeout: 12 seconds for slow upstream portals
      timer = setTimeout(() => {
        setIsLoading((loading) => {
          if (loading) {
            setLoadTimedOut(true);
          }
          return loading;
        });
      }, 12000);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, documentUrl]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      } else if ((e.metaKey || e.ctrlKey) && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        handleZoomIn();
      } else if ((e.metaKey || e.ctrlKey) && e.key === '-') {
        e.preventDefault();
        handleZoomOut();
      } else if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        handleResetZoom();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        handlePrint();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isFullscreen, onClose, handlePrint]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'Notice PDF Viewer'}
    >
      {/* Clickable Backdrop */}
      <div 
        className="absolute inset-0 bg-transparent cursor-pointer" 
        onClick={onClose} 
        aria-hidden="true" 
      />

      {/* Modal Container */}
      <div
        ref={containerRef}
        className={`relative z-10 bg-slate-950 rounded-2xl overflow-hidden shadow-2xl shadow-black/80 border border-slate-800/90 flex flex-col transition-all duration-200 ring-1 ring-white/10 ${
          isFullscreen ? 'fixed inset-0 w-full h-full rounded-none border-none ring-0' : 'w-full max-w-6xl h-[90vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Top Executive Navigation Bar ──────────────────────────────────── */}
        <header className="px-4 py-3 bg-slate-900/95 border-b border-slate-800/80 flex items-center justify-between shrink-0 text-white select-none backdrop-blur-md gap-3">
          {/* Document Title & Status Pill */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 rounded-xl bg-primary/20 text-primary-400 border border-primary/30 shrink-0 shadow-xs">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-slate-100 truncate tracking-tight" title={title}>
                  {title || 'Tender Notice Document'}
                </h3>
                <span className="hidden md:inline-flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0">
                  <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  {badge}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono mt-0.5">
                <span className="truncate max-w-[220px] sm:max-w-md">{filename}</span>
                {subtitle && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-300 truncate hidden sm:inline">{subtitle}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Center Zoom & Rotate Controls (Hidden on narrow mobile screens) */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-xl p-1 px-1.5 shadow-inner">
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= 60}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Zoom Out (Ctrl -)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleResetZoom}
              className="px-2 py-0.5 text-[11px] font-mono text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors"
              title="Reset Zoom & Rotation (Ctrl 0)"
            >
              {zoomLevel}%
            </button>
            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= 200}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title="Zoom In (Ctrl +)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-4 bg-slate-800 mx-1" />

            <button
              onClick={handleRotate}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Rotate 90 Degrees"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleReload}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Reload Document"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-primary-400' : ''}`} />
            </button>
          </div>

          {/* Right Action Docks */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Copy Link Button */}
            <button
              onClick={handleCopyUrl}
              className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700/80 transition-colors shadow-2xs"
              title="Copy direct document link"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400 text-[11px]">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[11px]">Copy Link</span>
                </>
              )}
            </button>

            {/* Print / Save PDF Button */}
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-semibold shadow-2xs transition-colors border border-slate-700"
              title="Print Document or Save as PDF (Ctrl P)"
            >
              <Printer className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
              <span className="hidden md:inline">Print</span>
            </button>

            {/* Open in external tab */}
            <a
              href={proxyViewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition-colors"
              title="Open Notice in New Tab"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {/* Direct Download Button */}
            <a
              href={proxyDownloadUrl}
              download={filename}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-white text-xs font-bold shadow-md shadow-primary/20 transition-all active:scale-95"
              title="Download Official Government Notice PDF"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download</span>
            </a>

            {/* Fullscreen Toggle */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-rose-300 hover:bg-rose-500/20 transition-colors ml-0.5"
              title="Close Viewer (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ── Document Body & Workspace ─────────────────────────────────────── */}
        <div className="relative flex-1 bg-slate-950 w-full h-full overflow-auto flex items-center justify-center select-none">
          {/* Loading Indicator Overlay */}
          {isLoading && !hasError && !loadTimedOut && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/95 z-20 text-slate-300">
              <div className="relative flex items-center justify-center">
                <div className="w-16 h-16 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                <FileText className="w-6 h-6 text-primary absolute" />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold text-slate-200">Loading Official Government Document</p>
                <p className="text-xs text-slate-500 font-mono">Fetching secure notice stream...</p>
              </div>
            </div>
          )}

          {/* Timeout Fallback Screen */}
          {loadTimedOut && isLoading && !hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-slate-950/95 z-30 text-slate-300 p-6 text-center max-w-lg mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/10">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-base font-bold text-white">Notice Preview Taking Longer Than Expected</h4>
                <p className="text-xs text-slate-400 leading-relaxed">
                  The government portal server may be heavily loaded or protected by strict frame security. You can open the official notice directly in a new tab or download it immediately.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                <a
                  href={proxyDownloadUrl}
                  download={filename}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 shadow-md shadow-primary/25 transition-all"
                >
                  <Download className="w-4 h-4" /> Download Official PDF
                </a>
                <a
                  href={proxyViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 border border-slate-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> Open in New Tab
                </a>
                <button
                  onClick={handleReload}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 text-slate-400 hover:text-white text-xs border border-slate-800 transition-colors"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Retry
                </button>
              </div>
            </div>
          )}

          {/* Hard Error Screen */}
          {hasError ? (
            <div className="p-8 text-center max-w-md space-y-4 z-30">
              <div className="w-14 h-14 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
                <AlertCircle className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white">Browser Frame Embedding Restricted</h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  The portal host disallows iframe embedding via its security policy. You can still view or download the original file safely.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                <a
                  href={proxyDownloadUrl}
                  download={filename}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary/90 shadow-md shadow-primary/25 transition-all"
                >
                  <Download className="w-4 h-4" /> Download Notice File
                </a>
                <a
                  href={proxyViewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 text-slate-200 text-xs font-semibold hover:bg-slate-700 border border-slate-700 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" /> Open in New Tab
                </a>
              </div>
            </div>
          ) : (
            /* PDF Iframe Workspace */
            <div 
              className="w-full h-full flex items-center justify-center overflow-auto p-0 sm:p-2 bg-slate-900/60"
              style={{
                perspective: '1000px',
              }}
            >
              <div
                className="w-full h-full transition-transform duration-150 ease-out origin-top flex items-center justify-center"
                style={{
                  transform: `scale(${zoomLevel / 100}) rotate(${rotation}deg)`,
                  maxWidth: zoomLevel > 100 ? `${zoomLevel}%` : '100%',
                  height: zoomLevel > 100 ? `${zoomLevel}%` : '100%',
                }}
              >
                <iframe
                  ref={iframeRef}
                  src={proxyViewUrl}
                  title={title || 'Tender Notice PDF'}
                  className="w-full h-full border-0 bg-white rounded-none sm:rounded-lg shadow-xl"
                  onLoad={() => {
                    setIsLoading(false);
                    setHasError(false);
                  }}
                  onError={() => {
                    setIsLoading(false);
                    setHasError(true);
                  }}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


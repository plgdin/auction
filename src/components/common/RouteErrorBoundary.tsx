import { useEffect, useState } from 'react';
import { useRouteError } from 'react-router-dom';
import { RefreshCw, Home, ChevronDown, ChevronRight, Terminal, FileQuestion, ArrowLeft } from 'lucide-react';

export function RouteErrorBoundary() {
  const error: any = useRouteError();
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Stringify/check the error to detect chunk load failures
    const errorStr = error?.toString() || '';
    const errorMessage = error?.message || '';
    const errorStack = error?.stack || '';
    
    const isChunk = 
      errorMessage.includes('Failed to fetch dynamically imported module') ||
      errorStack.includes('Failed to fetch dynamically imported module') ||
      errorStr.includes('Failed to fetch dynamically imported module') ||
      errorMessage.includes('ChunkLoadError') ||
      errorStr.includes('ChunkLoadError');

    if (isChunk) {
      // Attempt a single automatic reload to fetch the new chunk from the server
      const lastReload = sessionStorage.getItem('last-chunk-error-reload');
      const now = Date.now();
      
      // Only auto-reload if the last automatic reload was more than 15 seconds ago (prevent loop)
      if (!lastReload || now - parseInt(lastReload, 10) > 15000) {
        sessionStorage.setItem('last-chunk-error-reload', now.toString());
        window.location.reload();
      }
    }
  }, [error]);

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const handleGoBack = () => {
    window.history.back();
  };

  const is404 = error?.status === 404;

  const errorMessage = error instanceof Error 
    ? error.message 
    : (typeof error === 'string' ? error : (error?.message || error?.statusText || 'An unexpected error occurred.'));

  const errorStack = error instanceof Error ? error.stack : JSON.stringify(error, null, 2);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-3xl shadow-xl p-8 md:p-12 text-center">
        
        {/* Glow badge/icon wrapper */}
        <div className="relative mx-auto w-20 h-20 mb-8">
          <div className="absolute inset-0 rounded-2xl blur-xl opacity-20 bg-primary/40" />
          <div className="relative w-20 h-20 rounded-2xl flex items-center justify-center border bg-blue-50 border-blue-200 text-primary">
            {is404 ? (
              <FileQuestion className="w-10 h-10" />
            ) : (
              <RefreshCw className="w-10 h-10" />
            )}
          </div>
        </div>

        {/* Badge */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase mb-4 bg-blue-50/70 text-primary border border-blue-100">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          {is404 ? '404 Not Found' : 'Application Status'}
        </span>

        {/* Heading */}
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mb-3">
          {is404 ? 'Page Not Found' : 'Something went wrong'}
        </h1>

        {/* Description */}
        <p className="text-slate-500 text-sm max-w-md mx-auto mb-8 leading-relaxed">
          {is404 
            ? 'The page you are looking for does not exist, or has been relocated to another address.'
            : 'The application encountered an unexpected runtime error. Our system logs have been updated automatically.'}
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mb-8">
          {is404 ? (
            <>
              <button
                type="button"
                onClick={handleGoBack}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl active:scale-95 transition-all duration-200 border border-slate-200 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </button>
              <button
                type="button"
                onClick={handleGoHome}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-bold text-sm rounded-xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/10 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Go to Home
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleReload}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-white font-bold text-sm rounded-xl hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/10 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Application
              </button>
              <button
                type="button"
                onClick={handleGoHome}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl active:scale-95 transition-all duration-200 border border-slate-200 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Go to Home
              </button>
            </>
          )}
        </div>

        {/* Collapsible Error Log for Developer Debugging (Hidden if 404) */}
        {!is404 && (
          <div className="border-t border-slate-100 pt-6 text-left">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-650 uppercase tracking-wider transition-colors cursor-pointer"
            >
              {showDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              {showDetails ? 'Hide Diagnostics' : 'Show Diagnostics'}
            </button>

            {showDetails && (
              <div className="mt-4 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 bg-slate-100">
                  <Terminal className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Error Log</span>
                </div>
                <div className="p-4 overflow-x-auto max-h-48 custom-scrollbar">
                  <p className="text-xs font-mono text-red-600 font-semibold mb-1">
                    {errorMessage}
                  </p>
                  {errorStack && (
                    <pre className="text-[10px] font-mono text-slate-400 whitespace-pre leading-normal mt-2">
                      {errorStack}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

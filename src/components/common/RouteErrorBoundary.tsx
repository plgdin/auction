import { useEffect, useState } from 'react';
import { useRouteError, Link } from 'react-router-dom';
import { RefreshCw, Home, ChevronDown, ChevronRight, Terminal, ShieldAlert, FileQuestion, ArrowLeft } from 'lucide-react';

export function RouteErrorBoundary() {
  const error: any = useRouteError();
  const [showDetails, setShowDetails] = useState(false);
  const [isChunkError, setIsChunkError] = useState(false);

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

    setIsChunkError(!!isChunk);

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
    <div className="min-h-screen bg-slate-50 dark:bg-[#0f1c2a] flex flex-col items-center justify-center p-6 transition-colors duration-300">
      <div className="w-full max-w-xl bg-white dark:bg-[#172d42] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-8 md:p-12 text-center animate-scale-up">
        
        {/* Glow badge/icon wrapper */}
        <div className="relative mx-auto w-20 h-20 mb-8">
          <div className={`absolute inset-0 rounded-2xl blur-xl opacity-30 ${
            is404 ? 'bg-amber-500' : isChunkError ? 'bg-blue-500' : 'bg-red-500'
          }`} />
          <div className={`relative w-20 h-20 rounded-2xl flex items-center justify-center border ${
            is404 
              ? 'bg-amber-55 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400'
              : isChunkError 
                ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400' 
                : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400'
          }`}>
            {is404 ? (
              <FileQuestion className="w-10 h-10" />
            ) : isChunkError ? (
              <RefreshCw className="w-10 h-10 animate-spin" style={{ animationDuration: '4s' }} />
            ) : (
              <ShieldAlert className="w-10 h-10" />
            )}
          </div>
        </div>

        {/* Badge */}
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold tracking-wider uppercase mb-4 ${
          is404
            ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
            : isChunkError 
              ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300' 
              : 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${
            is404 ? 'bg-amber-500' : isChunkError ? 'bg-blue-500' : 'bg-red-500'
          } ${isChunkError || !is404 ? 'animate-pulse' : ''}`} />
          {is404 ? '404 Not Found' : isChunkError ? 'Sync Required' : 'Application Error'}
        </span>

        {/* Heading */}
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mb-3">
          {is404 ? 'Page Not Found' : isChunkError ? 'Application Update Available' : 'Something went wrong'}
        </h1>

        {/* Description */}
        <p className="text-slate-500 dark:text-slate-400 text-base max-w-md mx-auto mb-8 leading-relaxed">
          {is404 
            ? 'The page you are looking for does not exist, or has been relocated to another address.'
            : isChunkError 
              ? "We've deployed an updated version of the Lelam platform. A quick refresh is needed to sync changes."
              : "The application encountered an unexpected runtime error. Our system logs have been updated automatically."}
        </p>

        {/* Primary Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 mb-8">
          {is404 ? (
            <>
              <button
                type="button"
                onClick={handleGoBack}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl active:scale-95 transition-all duration-200 border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                Go Back
              </button>
              <Link
                to="/"
                onClick={handleGoHome}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-primary dark:bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 dark:hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/10 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Go to Home
              </Link>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={handleReload}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-primary dark:bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 dark:hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/10 active:scale-95 transition-all duration-200 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh Application
              </button>
              <Link
                to="/"
                onClick={handleGoHome}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold rounded-xl active:scale-95 transition-all duration-200 border border-slate-200 dark:border-slate-700 cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Go to Home
              </Link>
            </>
          )}
        </div>

        {/* Collapsible Error Log for Developer Debugging (Hidden if 404) */}
        {!is404 && (
          <div className="border-t border-slate-100 dark:border-slate-800 pt-6 text-left">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 uppercase tracking-wider transition-colors cursor-pointer"
            >
              {showDetails ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              {showDetails ? 'Hide Diagnostics' : 'Show Diagnostics'}
            </button>

            {showDetails && (
              <div className="mt-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden animate-fade-in">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/50">
                  <Terminal className="w-3.5 h-3.5 text-slate-500" />
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">Error Log</span>
                </div>
                <div className="p-4 overflow-x-auto max-h-48 custom-scrollbar">
                  <p className="text-xs font-mono text-red-600 dark:text-red-400 font-semibold mb-1">
                    {errorMessage}
                  </p>
                  {errorStack && (
                    <pre className="text-[10px] font-mono text-slate-400 dark:text-slate-500 whitespace-pre leading-normal mt-2">
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

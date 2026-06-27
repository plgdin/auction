import { useRouteError, isRouteErrorResponse } from 'react-router-dom';
import { AlertTriangle, Home, RefreshCw } from 'lucide-react';

export function RouteErrorBoundary() {
  const error = useRouteError() as any;

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full text-center border border-slate-200">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        
        <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Oops! Something went wrong</h1>
        
        <div className="bg-slate-100 p-4 rounded-lg text-left overflow-x-auto mb-8 border border-slate-200 mt-4">
          <p className="text-sm font-mono text-slate-700 whitespace-pre-wrap break-words">
            {isRouteErrorResponse(error) 
              ? `${error.status} ${error.statusText}` 
              : error.message || 'An unexpected error occurred.'}
          </p>
        </div>
        
        <div className="flex gap-4">
          <button
            onClick={() => window.location.href = '/'}
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-white text-slate-700 border border-slate-300 font-semibold rounded-lg hover:bg-slate-50 transition-colors"
          >
            <Home className="w-4 h-4 mr-2" />
            Home
          </button>
          <button
            onClick={() => window.location.reload()}
            className="flex-1 inline-flex items-center justify-center px-4 py-2.5 bg-primary text-white font-bold rounded-lg hover:bg-primary-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Reload
          </button>
        </div>
      </div>
    </div>
  );
}

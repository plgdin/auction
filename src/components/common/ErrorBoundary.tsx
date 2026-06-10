// @ts-nocheck
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-lg w-full text-center border border-slate-200">
            <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-600" />
            </div>
            
            <h1 className="text-2xl font-extrabold text-slate-900 mb-2">Something went wrong</h1>
            <p className="text-slate-500 mb-6">
              We've encountered an unexpected error. Our engineering team has been notified.
            </p>
            
            {this.state.error && (
              <div className="bg-slate-100 p-4 rounded-lg text-left overflow-x-auto mb-8 border border-slate-200">
                <p className="text-xs font-mono text-red-600 whitespace-pre-wrap break-words">
                  {this.state.error.toString()}
                </p>
              </div>
            )}
            
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center w-full px-6 py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
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
    console.error('[Pushtak ErrorBoundary caught]:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 m-4 rounded-2xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-center max-w-md mx-auto space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#FAEDE7] text-[#C2562F] flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-serif-heading font-bold text-lg text-[var(--text-primary)]">
              {this.props.fallbackTitle || 'Something went wrong'}
            </h3>
            <p className="text-sm text-[var(--text-secondary)] font-ui mt-1">
              {this.state.error?.message || 'An unexpected error occurred while loading this view.'}
            </p>
          </div>
          <button
            onClick={this.handleReset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#C2562F] hover:bg-[#A94522] text-white text-sm font-medium transition tap-target"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try again</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

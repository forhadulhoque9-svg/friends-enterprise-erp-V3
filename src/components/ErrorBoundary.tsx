import React, { Component, ReactNode, ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

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
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 rounded-2xl border border-amber-200 bg-amber-50 text-amber-950 shadow-sm my-4 text-center space-y-4">
          <div className="inline-flex p-3 bg-amber-100 rounded-full text-amber-700">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h2 className="text-base font-black text-amber-900">
            {this.props.fallbackTitle || 'মডিউলটি রেন্ডার করতে সমস্যা হয়েছে।'}
          </h2>
          <p className="text-xs text-amber-800 max-w-md mx-auto font-medium">
            {this.state.error?.message || 'সাময়িক ত্রুটি ঘটেছে। অনুগ্রহ করে পুনরায় চেষ্টা করুন।'}
          </p>
          <div className="pt-2">
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-amber-800 hover:bg-amber-900 text-white font-bold text-xs rounded-xl inline-flex items-center gap-2 transition cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" /> পুনরায় লোড করুন
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

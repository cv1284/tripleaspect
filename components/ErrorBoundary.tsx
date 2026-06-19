'use client';

import React from 'react';

interface State {
  hasError: boolean;
  message:  string | null;
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode; label?: string },
  State
> {
  constructor(props: { children: React.ReactNode; label?: string }) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error: unknown): State {
    const message = error instanceof Error ? error.message : String(error);
    return { hasError: true, message };
  }

  override componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? ` — ${this.props.label}` : ''}]`, error, info.componentStack);
  }

  override render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] px-6 text-center">
        <p className="text-3xl mb-4">⚠</p>
        <h2 className="text-lg font-semibold text-slate-200 mb-1">Something went wrong</h2>
        <p className="text-sm font-mono text-slate-500 mb-6 max-w-sm">
          {this.state.message ?? 'An unexpected error occurred.'}
        </p>
        <button
          onClick={() => this.setState({ hasError: false, message: null })}
          className="btn-primary text-sm px-5"
        >
          Try again
        </button>
      </div>
    );
  }
}

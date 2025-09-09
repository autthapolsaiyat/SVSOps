// FILE: src/components/RootErrorBoundary.tsx
import React from "react";

export default class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: any }
> {
  constructor(props: any) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { error };
  }
  componentDidCatch(error: any, info: any) {
    console.error("[RootErrorBoundary]", error, info);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen grid place-items-center bg-background text-foreground">
          <div className="text-center space-y-3">
            <div className="text-2xl font-semibold">Something went wrong</div>
            <div className="text-sm text-muted-foreground">
              Check the browser console for details.
            </div>
            <pre className="text-xs bg-card border border-border rounded p-3 max-w-[80vw] overflow-auto">
              {String(this.state.error?.message || this.state.error)}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}


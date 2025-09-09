import React from "react";
type Props = { children: React.ReactNode };
type State = { error?: any };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = {};
  static getDerivedStateFromError(error: any){ return { error }; }
  componentDidCatch(err:any, info:any){ console.error("App error:", err, info); }
  render(){
    if (this.state.error) {
      return (
        <div className="p-6">
          <h1 className="text-xl font-bold text-red-600">Something went wrong.</h1>
          <pre className="mt-3 whitespace-pre-wrap text-sm bg-gray-100 p-3 rounded">
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}


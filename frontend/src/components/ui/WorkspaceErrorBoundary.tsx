import { Component, type ErrorInfo, type ReactNode } from "react";

type WorkspaceErrorBoundaryProps = {
  children: ReactNode;
  resetKey?: string;
};

type WorkspaceErrorBoundaryState = {
  hasError: boolean;
};

export class WorkspaceErrorBoundary extends Component<
  WorkspaceErrorBoundaryProps,
  WorkspaceErrorBoundaryState
> {
  state: WorkspaceErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError(): WorkspaceErrorBoundaryState {
    return {
      hasError: true,
    };
  }

  componentDidUpdate(prevProps: WorkspaceErrorBoundaryProps) {
    if (this.props.resetKey !== prevProps.resetKey && this.state.hasError) {
      this.setState({
        hasError: false,
      });
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Workspace render failed", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[320px] items-center justify-center">
          <div className="max-w-md rounded-[28px] border border-rose-200 bg-white px-6 py-8 text-center shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-600">
              Workspace issue
            </p>
            <h2 className="mt-2 text-xl font-semibold text-slate-950">
              This page could not be rendered safely.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              We blocked a blank screen and stopped the failed render. Reload the
              workspace once to recover with the latest code.
            </p>
            <p className="mt-3 rounded-2xl bg-slate-50 px-3 py-2 text-left text-xs text-slate-600">
              Technical details were hidden from the workspace to keep the screen safe for daily use.
            </p>
            <button
              className="mt-5 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              onClick={() =>
                this.setState({
                  hasError: false,
                })
              }
              type="button"
            >
              Try again
            </button>
            <button
              className="mt-3 rounded-2xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              onClick={() => window.location.reload()}
              type="button"
            >
              Reload workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

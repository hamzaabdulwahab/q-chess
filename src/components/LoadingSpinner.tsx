import React from "react";

export const LoadingSpinner: React.FC = () => {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="flex flex-col items-center gap-3" role="status">
        <div
          className="grid h-12 w-12 grid-cols-2 overflow-hidden rounded-md border"
          style={{ borderColor: "var(--border-strong)" }}
          aria-hidden="true"
        >
          <span className="animate-pulse" style={{ background: "var(--surface-2)" }} />
          <span className="animate-pulse" style={{ background: "var(--surface)" }} />
          <span className="animate-pulse" style={{ background: "var(--surface)" }} />
          <span className="animate-pulse" style={{ background: "var(--surface-2)" }} />
        </div>
        <span className="text-xs font-medium uppercase tracking-wider text-muted">
          Loading Q-Chess
        </span>
        <span className="sr-only">Loading Q-Chess</span>
      </div>
    </div>
  );
};

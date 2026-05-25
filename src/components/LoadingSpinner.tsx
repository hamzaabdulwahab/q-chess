import React from "react";

export const LoadingSpinner: React.FC = () => {
  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <div className="flex flex-col items-center gap-3" role="status">
        <div
          className="h-10 w-10 animate-spin rounded-full"
          style={{
            border: "2px solid var(--border-strong)",
            borderTopColor: "var(--accent)",
            boxShadow: "0 0 0 1px oklch(0 0 0 / 0.25)",
          }}
        />
        <span className="sr-only">Loading Q-Chess</span>
      </div>
    </div>
  );
};

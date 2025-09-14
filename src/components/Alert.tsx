"use client";
import React from "react";
import {
  CheckCircle2,
  Info,
  TriangleAlert,
  CircleAlert,
  X as CloseIcon,
} from "lucide-react";

type Variant = "error" | "success" | "info" | "warning";
type Tone = "soft" | "solid" | "outline";

const toneMap: Record<Variant, Record<Tone, string>> = {
  error: {
    soft: "bg-red-900/60 border-red-600/60 text-red-100",
    solid: "bg-red-600 border-red-700 text-white",
    outline: "bg-transparent border-red-500/60 text-red-200",
  },
  success: {
    soft: "bg-green-900/60 border-green-600/60 text-green-100",
    solid: "bg-green-600 border-green-700 text-white",
    outline: "bg-transparent border-green-500/60 text-green-200",
  },
  info: {
    soft: "bg-blue-900/60 border-blue-600/60 text-blue-100",
    solid: "bg-blue-600 border-blue-700 text-white",
    outline: "bg-transparent border-blue-500/60 text-blue-200",
  },
  warning: {
    soft: "bg-yellow-900/60 border-yellow-600/60 text-yellow-100",
    solid: "bg-yellow-600 border-yellow-700 text-white",
    outline: "bg-transparent border-yellow-500/60 text-yellow-200",
  },
};

function Icon({ variant }: { variant: Variant }) {
  const cls = "w-4 h-4 mt-0.5 shrink-0";
  if (variant === "success") return <CheckCircle2 className={cls} />;
  if (variant === "info") return <Info className={cls} />;
  if (variant === "warning") return <TriangleAlert className={cls} />;
  return <CircleAlert className={cls} />; // error
}

export function Alert({
  variant = "info",
  tone = "soft",
  title,
  children,
  onClose,
  className,
  showIcon = true,
}: {
  variant?: Variant;
  tone?: Tone;
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
  showIcon?: boolean;
}) {
  const base = `border px-4 py-3 rounded-lg mb-4 flex items-start gap-3 ${toneMap[variant][tone]}`;
  const live = variant === "error" ? "assertive" : "polite";
  return (
    <div role="alert" aria-live={live} className={`${base} ${className || ""}`}>
      {showIcon && <Icon variant={variant} />}
      <div className="flex-1 text-sm">
        {title && <div className="font-medium mb-0.5">{title}</div>}
        <div>{children}</div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          aria-label="Close alert"
          className="ml-2 text-white/80 hover:text-white"
          type="button"
        >
          <CloseIcon className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

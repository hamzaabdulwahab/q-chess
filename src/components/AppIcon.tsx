"use client";

import type { LucideIcon } from "lucide-react";

type AppIconProps = {
  icon: LucideIcon;
  className?: string;
  decorative?: boolean;
};

export function AppIcon({
  icon: Icon,
  className,
  decorative = true,
}: AppIconProps) {
  return (
    <Icon
      className={className}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={decorative}
    />
  );
}

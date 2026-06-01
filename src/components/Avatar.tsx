"use client";
import Image from "next/image";

type AvatarProps = {
  name?: string | null;
  url?: string | null;
  size?: number; // pixels
};

export function Avatar({ name, url, size = 40 }: AvatarProps) {
  const initials =
    (name || "?")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase())
      .join("") || "?";

  const px = `${size}px`;
  if (url) {
    return (
      <Image
        src={url}
        alt={name || "avatar"}
        width={size}
        height={size}
        unoptimized
        className="rounded-full object-cover border border-gray-700"
        style={{ width: px, height: px }}
      />
    );
  }

  const fontSize =
    size >= 96
      ? "text-2xl"
      : size >= 72
      ? "text-xl"
      : size >= 56
      ? "text-lg"
      : "text-xs";
  return (
    <div
      className="rounded-full text-white grid place-items-center"
      style={{
        width: px,
        height: px,
        background: "var(--avatar-fallback)",
        border: "1px solid color-mix(in oklch, var(--avatar-fallback) 78%, white 16%)",
      }}
      aria-label="avatar"
    >
      <span className={`${fontSize} font-semibold`}>{initials}</span>
    </div>
  );
}

"use client";

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
      <img
        src={url}
        alt={name || "avatar"}
        width={size}
        height={size}
        className="rounded-full object-cover border border-gray-700"
        style={{ width: px, height: px }}
      />
    );
  }

  return (
    <div
      className="rounded-full bg-gray-700 text-white grid place-items-center border border-gray-700"
      style={{ width: px, height: px }}
      aria-label="avatar"
    >
      <span className="text-xs font-semibold">{initials}</span>
    </div>
  );
}

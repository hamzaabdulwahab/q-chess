"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type TickerProps = {
  src?: string; // URL to fetch lines from (default /ticker.txt)
  speed?: number; // pixels per second
  gap?: number; // gap in px between items
};

export function Ticker({
  src = "/ticker.txt",
  speed = 320,
  gap = 20,
}: TickerProps) {
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [durationSec, setDurationSec] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(src, { cache: "no-store" });
        if (!res.ok) throw new Error(`Failed to load ticker: ${res.status}`);
        const text = await res.text();
        const items = text
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (active)
          setLines(items.length ? items : ["Add items in public/ticker.txt"]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to load ticker";
        if (active) setError(msg);
      }
    })();
    return () => {
      active = false;
    };
  }, [src]);

  // Duplicate items to create a seamless loop
  const items = useMemo(
    () => (lines.length ? [...lines, ...lines] : []),
    [lines]
  );

  // Compute animation duration from content width and speed (px/sec)
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const calc = () => {
      const width = el.scrollWidth;
      const distance = width * 0.5; // we translate -50%
      const sec = speed > 0 ? distance / speed : 40;
      // Minimal clamp so very high speeds are reflected
      setDurationSec(Math.max(0.5, sec));
    };
    // Delay to ensure layout is ready
    const t = setTimeout(calc, 0);
    const RO: typeof ResizeObserver | undefined =
      typeof ResizeObserver !== "undefined" ? ResizeObserver : undefined;
    const ro = RO ? new RO(() => calc()) : undefined;
    if (ro) ro.observe(el);
    window.addEventListener("resize", calc);
    return () => {
      clearTimeout(t);
      if (ro) ro.disconnect();
      window.removeEventListener("resize", calc);
    };
  }, [items, speed, gap]);

  // Inline CSS variables to control speed/gap
  const style = useMemo(
    () =>
      ({
        // speed is pixels per second; animation duration depends on track width via CSS
        ["--ticker-gap"]: `${gap}px`,
        ["--ticker-duration"]: durationSec ? `${durationSec}s` : undefined,
        // Inline overrides to guarantee the class animation properties are updated
        animationDuration: durationSec ? `${durationSec}s` : undefined,
        animationPlayState: "running",
      } as React.CSSProperties),
    [gap, durationSec]
  );

  return (
    <div className="ticker-root" aria-label="Live ticker" role="region">
      <div className="ticker-viewport">
        <div className="ticker-track" ref={trackRef} style={style}>
          {error ? (
            <div className="ticker-item text-red-400">{error}</div>
          ) : (
            items.map((t, i) => {
              const isWelcome = lines.length > 0 && i % lines.length === 0;
              const cls = isWelcome
                ? "ticker-item ticker-item--welcome"
                : "ticker-item";
              return (
                <div key={`${i}-${t}`} className={cls}>
                  {t}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

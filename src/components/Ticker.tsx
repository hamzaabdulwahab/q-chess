"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

type TickerProps = {
  src?: string; // URL to fetch lines from (default /ticker.txt)
  speed?: number; // pixels per second
  gap?: number; // gap in px between items
};

export function Ticker({
  src = "/ticker.txt",
  speed = 30, // pixels per second (default slower visual pace)
  gap = 32,
}: TickerProps) {
  const [lines, setLines] = useState<string[]>([]);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const offsetRef = useRef<number>(0); // current translated px
  const contentWidthRef = useRef<number>(0); // full width of duplicated content
  const lastTsRef = useRef<number | null>(null);
  // debug overlay removed

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch(src, { 
          cache: "no-store",
          headers: {
            'Cache-Control': 'no-cache',
          }
        });
        if (!res.ok) throw new Error(`Failed to load ticker: ${res.status}`);
        const text = await res.text();
        const items = text
          .split(/\r?\n/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        if (active) {
          // If no items loaded, use fallback content
          if (items.length === 0) {
            setLines([
              "Welcome to Q-Chess — enjoy your game!",
              "Tip: Knights jump in L-shapes; don't forget forks.",
              "Always control the center squares (d4, d5, e4, e5).",
              "Develop your knights and bishops before moving your queen.",
              "Castle early to protect your king."
            ]);
          } else {
            setLines(items);
          }
        }
      } catch (e) {
        console.error("Ticker load error:", e);
        // Use fallback content instead of showing error
        if (active) {
          setLines([
            "Welcome to Q-Chess — enjoy your game!",
            "Tip: Knights jump in L-shapes; don't forget forks.",
            "Always control the center squares (d4, d5, e4, e5).",
            "Develop your knights and bishops before moving your queen.",
            "Castle early to protect your king."
          ]);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [src]);

  // Duplicate items to create a seamless loop (two sets)
  const items = useMemo(() => (lines.length ? [...lines, ...lines] : []), [lines]);

  // JS-driven marquee animation (requestAnimationFrame)
  useEffect(() => {
    const el = trackRef.current;
    if (!el || items.length === 0) return;

    // Measure width of first half (original set) for looping distance
    // We rely on duplicated array: length/2 original, next half duplicate.
    const originalCount = lines.length;
    const childNodes = Array.from(el.children) as HTMLElement[];
    let firstSetWidth = 0;
    for (let i = 0; i < originalCount && i < childNodes.length; i++) {
      firstSetWidth += childNodes[i].offsetWidth + (i < originalCount - 1 ? gap : 0);
    }
    contentWidthRef.current = firstSetWidth;
    offsetRef.current = 0; // reset
    lastTsRef.current = null;
  // (debug overlay removed)

    const step = (ts: number) => {
      if (lastTsRef.current == null) {
        lastTsRef.current = ts;
      }
      const dt = (ts - lastTsRef.current) / 1000; // seconds
      lastTsRef.current = ts;
      // Advance by speed * dt
      offsetRef.current += speed * dt;
      const loopWidth = contentWidthRef.current;
      if (loopWidth > 0) {
        // Wrap around when surpassing loopWidth
        if (offsetRef.current >= loopWidth) {
          offsetRef.current = offsetRef.current % loopWidth;
        }
        // Apply transform: move left by offset
        el.style.transform = `translate3d(${-offsetRef.current}px,0,0)`;
      }
      frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [items, lines.length, speed, gap]);
  // Inline style for gap only now (transform handled by JS)
  const style = useMemo(() => ({
    ["--ticker-gap"]: `${gap}px`,
    display: 'flex',
    gap: `${gap}px`,
    alignItems: 'center',
    whiteSpace: 'nowrap',
    willChange: 'transform'
  }) as React.CSSProperties, [gap]);

  return (
    <div className="ticker-root" aria-label="Live ticker" role="region">
      <div className="ticker-viewport">
        <div ref={trackRef} className="ticker-track js-marquee" style={style}>
          {items.map((t, i) => {
            const isWelcome = lines.length > 0 && i % lines.length === 0;
            const cls = isWelcome ? "ticker-item ticker-item--welcome" : "ticker-item";
            return (
              <div key={`${i}-${t}`} className={cls}>
                {t}
              </div>
            );
          })}
        </div>
        {/* debug overlay removed */}
      </div>
    </div>
  );
}

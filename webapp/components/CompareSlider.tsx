"use client";

import { useState, useRef, useCallback } from "react";

interface Props {
  /** Full image src — either a blob URL or a data: URI */
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
}

export default function CompareSlider({
  before,
  after,
  beforeLabel = "Original",
  afterLabel = "Reconstructed",
}: Props) {
  const [pos, setPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMove = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden rounded-xl bg-slate-900 cursor-ew-resize select-none touch-none"
      onMouseMove={(e) => handleMove(e.clientX)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
    >
      {/* After — always visible underneath */}
      <img src={after} alt={afterLabel} className="block w-full" draggable={false} />
      {/* Before — clipped to left portion via clip-path */}
      <img
        src={before}
        alt={beforeLabel}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
        draggable={false}
      />
      {/* Divider line */}
      <div
        className="absolute inset-y-0 w-px bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.5)] pointer-events-none"
        style={{ left: `${pos}%`, transform: "translateX(-50%)" }}
      />
      {/* Handle knob */}
      <div
        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-[0_2px_12px_rgba(0,0,0,0.35)] flex items-center justify-center pointer-events-none"
        style={{ left: `${pos}%` }}
      >
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
          <path d="M4 5H1M1 5L3 3M1 5L3 7M10 5H13M13 5L11 3M13 5L11 7" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      {/* Labels */}
      <span className="absolute top-2.5 left-3 text-[11px] font-semibold text-white bg-black/50 px-2 py-0.5 rounded-md pointer-events-none backdrop-blur-sm">
        {beforeLabel}
      </span>
      <span className="absolute top-2.5 right-3 text-[11px] font-semibold text-white bg-black/50 px-2 py-0.5 rounded-md pointer-events-none backdrop-blur-sm">
        {afterLabel}
      </span>
    </div>
  );
}

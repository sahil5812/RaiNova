"use client";

import React, { useEffect, useRef, useState } from "react";
import { clsx } from "clsx";

// ===== BottomSheet =====
interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  snapPoints?: ("peek" | "half" | "full")[];
  initialSnap?: "peek" | "half" | "full";
  className?: string;
}

const SNAP_HEIGHTS = {
  peek: "25vh",
  half: "50vh",
  full: "90vh",
};

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  initialSnap = "half",
  className,
}: BottomSheetProps) {
  const [snap, setSnap] = useState(initialSnap);
  const startY = useRef<number>(0);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) setSnap(initialSnap);
  }, [isOpen, initialSnap]);

  const handleTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const dy = e.changedTouches[0].clientY - startY.current;
    if (dy > 60) {
      if (snap === "full") setSnap("half");
      else if (snap === "half") setSnap("peek");
      else onClose();
    } else if (dy < -60) {
      if (snap === "peek") setSnap("half");
      else if (snap === "half") setSnap("full");
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/10"
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className={clsx(
          "nm-bottom-sheet fixed bottom-0 left-0 right-0 z-50",
          "flex flex-col transition-[height] duration-300 ease-out",
          className
        )}
        style={{ height: SNAP_HEIGHTS[snap] }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Handle */}
        <div className="nm-sheet-handle" />

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 pt-3 pb-2">
            <h3 className="nm-h3">{title}</h3>
            <button
              className="nm-icon-btn w-7 h-7 rounded-lg"
              onClick={onClose}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                <path d="M10 2L2 10M2 2l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {/* Snap controls */}
        <div className="flex justify-center gap-2 px-5 pb-2">
          {(["peek", "half", "full"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSnap(s)}
              className={clsx(
                "w-6 h-1 rounded-full transition-all",
                snap === s ? "bg-[var(--nm-accent)]" : "bg-[var(--nm-bg-darker)]"
              )}
            />
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto nm-scroll px-5 pb-4">
          {children}
        </div>
      </div>
    </>
  );
}

// ===== MapControlsPanel =====
interface MapControlItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onPress: () => void;
}

interface MapControlsPanelProps {
  controls: MapControlItem[];
  className?: string;
}

export function MapControlsPanel({ controls, className }: MapControlsPanelProps) {
  return (
    <div className={clsx("nm-card-sm p-2 flex flex-col gap-1", className)}>
      {controls.map((c) => (
        <button
          key={c.id}
          title={c.label}
          onClick={c.onPress}
          className={clsx(
            "nm-icon-btn w-9 h-9 rounded-[9px]",
            c.active && "active"
          )}
        >
          {c.icon}
        </button>
      ))}
    </div>
  );
}

// ===== ForecastTimeline =====
interface ForecastStep {
  time: string;
  rainfallMmHr: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  depthCm: number;
}

interface ForecastTimelineProps {
  steps: ForecastStep[];
  selectedIndex: number;
  onSelect: (i: number) => void;
  className?: string;
}

const RAIN_COLOR = {
  LOW: "#22c55e",
  MEDIUM: "#f59e0b",
  HIGH: "#ef4444",
};

export function ForecastTimeline({ steps, selectedIndex, onSelect, className }: ForecastTimelineProps) {
  return (
    <div className={clsx("flex gap-2 overflow-x-auto pb-1 nm-scroll", className)}>
      {steps.map((step, i) => {
        const isSelected = i === selectedIndex;
        const color = RAIN_COLOR[step.riskLevel];
        const barH = Math.max(8, Math.min(40, step.rainfallMmHr * 0.5));
        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
            className={clsx(
              "flex flex-col items-center gap-1.5 px-2.5 py-2 rounded-xl shrink-0 transition-all",
              isSelected
                ? "nm-card-sm ring-1 ring-[var(--nm-accent)]/40"
                : "nm-icon-btn",
              "w-[56px]"
            )}
          >
            <span className="nm-caption text-[9px]">{step.time}</span>
            {/* Mini bar chart */}
            <div className="flex flex-col-reverse items-center" style={{ height: 44 }}>
              <div
                className="w-3 rounded-t-sm transition-all"
                style={{ height: barH, background: color, opacity: isSelected ? 1 : 0.7 }}
              />
            </div>
            <span className="nm-caption text-[9px]" style={{ color }}>
              {step.rainfallMmHr > 0 ? `${step.rainfallMmHr.toFixed(0)}mm` : "Dry"}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ===== RouteSegmentBar =====
interface RouteSegmentBarProps {
  segments: { status: "FLOOD_FREE" | "SLOW" | "SUBMERGED"; lengthKm: number }[];
  totalKm: number;
  className?: string;
}

const SEG_COLOR = {
  FLOOD_FREE: "#22c55e",
  SLOW: "#f59e0b",
  SUBMERGED: "#ef4444",
};

export function RouteSegmentBar({ segments, totalKm, className }: RouteSegmentBarProps) {
  return (
    <div className={clsx("flex rounded-full overflow-hidden h-2 gap-0.5", className)}>
      {segments.map((seg, i) => {
        const pct = totalKm > 0 ? (seg.lengthKm / totalKm) * 100 : 0;
        return (
          <div
            key={i}
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: SEG_COLOR[seg.status], minWidth: 4 }}
          />
        );
      })}
    </div>
  );
}

// ===== Toast =====
interface ToastProps {
  message: string;
  type?: "info" | "success" | "error" | "warning";
  isVisible: boolean;
}

export function Toast({ message, type = "info", isVisible }: ToastProps) {
  const bg = {
    info: "bg-[var(--nm-accent)]",
    success: "bg-[var(--nm-safe)]",
    error: "bg-[var(--nm-high)]",
    warning: "bg-[var(--nm-medium)]",
  }[type];

  return (
    <div
      className={clsx(
        "fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-2.5 rounded-full text-white text-sm font-semibold shadow-xl transition-all duration-300",
        bg,
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-4 pointer-events-none"
      )}
    >
      {message}
    </div>
  );
}

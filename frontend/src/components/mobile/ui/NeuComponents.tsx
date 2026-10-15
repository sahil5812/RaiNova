"use client";

import React from "react";
import { clsx } from "clsx";
import { AlertTriangle, Shield, Droplets, Info } from "lucide-react";

// ===== RiskBadge =====
type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | "SAFE";
type DataStatus = "LIVE" | "FORECAST" | "NOWCAST" | "HISTORICAL" | "SIMULATION" | "UNAVAILABLE";

interface RiskBadgeProps {
  level: RiskLevel;
  small?: boolean;
  showIcon?: boolean;
  className?: string;
}

const RISK_CONFIG: Record<RiskLevel, { label: string; className: string; icon: React.ReactNode }> = {
  SAFE: {
    label: "SAFE",
    className: "nm-badge-safe",
    icon: <Shield size={9} />,
  },
  LOW: {
    label: "LOW RISK",
    className: "nm-badge-low",
    icon: <Droplets size={9} />,
  },
  MEDIUM: {
    label: "MEDIUM",
    className: "nm-badge-medium",
    icon: <AlertTriangle size={9} />,
  },
  HIGH: {
    label: "HIGH RISK",
    className: "nm-badge-high",
    icon: <AlertTriangle size={9} />,
  },
  CRITICAL: {
    label: "CRITICAL",
    className: "nm-badge-high",
    icon: <AlertTriangle size={9} />,
  },
};

export function RiskBadge({ level, small, showIcon = true, className }: RiskBadgeProps) {
  const config = RISK_CONFIG[level] || RISK_CONFIG.SAFE;
  return (
    <span
      className={clsx(
        "nm-badge",
        config.className,
        small && "text-[9px] px-2 py-0.5",
        className
      )}
    >
      {showIcon && config.icon}
      {config.label}
    </span>
  );
}

// ===== DataStatusBadge =====
interface DataStatusBadgeProps {
  status: DataStatus;
  className?: string;
}

const STATUS_CONFIG: Record<DataStatus, { label: string; className: string }> = {
  LIVE: { label: "● LIVE", className: "nm-badge-live" },
  FORECAST: { label: "FORECAST", className: "nm-badge-forecast" },
  NOWCAST: { label: "NOWCAST", className: "nm-badge-forecast" },
  HISTORICAL: { label: "HISTORICAL", className: "nm-badge" },
  SIMULATION: { label: "SIMULATION", className: "nm-badge-simulation" },
  UNAVAILABLE: { label: "UNAVAILABLE", className: "nm-badge-unavailable" },
};

export function DataStatusBadge({ status, className }: DataStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={clsx("nm-badge", config.className, className)}>
      {config.label}
    </span>
  );
}

// ===== FloodDepthIndicator =====
interface FloodDepthProps {
  depthCm: number;
  maxDepthCm?: number;
  showBar?: boolean;
  className?: string;
}

export function FloodDepthIndicator({ depthCm, maxDepthCm = 120, showBar = true, className }: FloodDepthProps) {
  const pct = Math.min(100, (depthCm / maxDepthCm) * 100);
  const color =
    depthCm >= 60 ? "#ef4444" :
    depthCm >= 30 ? "#f59e0b" :
    depthCm >= 10 ? "#eab308" : "#22c55e";

  return (
    <div className={clsx("flex flex-col gap-1", className)}>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold" style={{ color }}>{depthCm.toFixed(0)}</span>
        <span className="nm-caption">cm</span>
      </div>
      {showBar && (
        <div className="nm-forecast-bar">
          <div
            className="nm-forecast-bar-fill"
            style={{ width: `${pct}%`, background: color }}
          />
        </div>
      )}
    </div>
  );
}

// ===== AlertCard =====
type AlertSeverity = "critical" | "warning" | "info" | "safe";

interface AlertCardProps {
  severity: AlertSeverity;
  title: string;
  message: string;
  location?: string;
  timestamp?: string;
  source?: string;
  isRead?: boolean;
  onClick?: () => void;
}

const ALERT_SEVERITY_CLASS: Record<AlertSeverity, string> = {
  critical: "nm-alert-critical",
  warning: "nm-alert-warning",
  info: "nm-alert-info",
  safe: "nm-alert-safe",
};

const ALERT_ICON_COLOR: Record<AlertSeverity, string> = {
  critical: "#ef4444",
  warning: "#f59e0b",
  info: "#0ea5e9",
  safe: "#16a34a",
};

export function AlertCard({ severity, title, message, location, timestamp, source, isRead, onClick }: AlertCardProps) {
  return (
    <div
      className={clsx(
        "nm-alert nm-card-sm",
        ALERT_SEVERITY_CLASS[severity],
        !isRead && "ring-1 ring-[var(--nm-accent)]/10",
        onClick && "cursor-pointer active:scale-[0.98] transition-transform"
      )}
      onClick={onClick}
    >
      <div className="shrink-0 mt-0.5">
        <AlertTriangle size={16} color={ALERT_ICON_COLOR[severity]} strokeWidth={2.5} />
      </div>
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="nm-h3 text-[13px]">{title}</span>
          {!isRead && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--nm-accent)] shrink-0" />
          )}
        </div>
        <p className="nm-body text-[12px]">{message}</p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {location && (
            <span className="nm-caption flex items-center gap-0.5">
              <Info size={9} /> {location}
            </span>
          )}
          {timestamp && (
            <span className="nm-caption">{timestamp}</span>
          )}
          {source && (
            <span className="nm-caption opacity-70">via {source}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ===== MetricTile =====
interface MetricTileProps {
  label: string;
  value: string | number;
  unit?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "stable";
  accentColor?: string;
  className?: string;
}

export function MetricTile({ label, value, unit, icon, accentColor, className }: MetricTileProps) {
  return (
    <div className={clsx("nm-metric", className)}>
      <div className="flex items-center justify-between">
        <span className="nm-metric-label">{label}</span>
        {icon && (
          <span style={{ color: accentColor || "var(--nm-accent)" }}>{icon}</span>
        )}
      </div>
      <div className="flex items-baseline gap-1 mt-1">
        <span className="nm-metric-value" style={accentColor ? { color: accentColor } : {}}>
          {value}
        </span>
        {unit && <span className="nm-metric-unit">{unit}</span>}
      </div>
    </div>
  );
}

// ===== LoadingSkeleton =====
interface SkeletonProps {
  width?: string;
  height?: string;
  rounded?: boolean;
  className?: string;
}

export function Skeleton({ width = "100%", height = "16px", rounded, className }: SkeletonProps) {
  return (
    <div
      className={clsx("nm-skeleton", rounded && "rounded-full", className)}
      style={{ width, height }}
    />
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={clsx("nm-card p-4 flex flex-col gap-3", className)}>
      <Skeleton height="12px" width="40%" />
      <Skeleton height="28px" width="70%" />
      <Skeleton height="10px" width="55%" />
    </div>
  );
}

// ===== ConnectionStatus =====
interface ConnectionStatusProps {
  isConnected: boolean;
  lastUpdate?: string;
  className?: string;
}

export function ConnectionStatus({ isConnected, lastUpdate, className }: ConnectionStatusProps) {
  return (
    <div className={clsx("flex items-center gap-2", className)}>
      <div className={clsx("nm-status-dot", isConnected ? "nm-status-live" : "nm-status-offline")} />
      <span className="nm-caption">
        {isConnected ? "Connected" : "Offline"}
        {lastUpdate && <span className="ml-1 opacity-70">· {lastUpdate}</span>}
      </span>
    </div>
  );
}

// ===== EmptyState =====
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: { label: string; onClick: () => void };
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 px-6 text-center">
      <div className="nm-card w-16 h-16 flex items-center justify-center rounded-2xl text-[var(--nm-text-subtle)]">
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <span className="nm-h3">{title}</span>
        <p className="nm-body text-[12px]">{message}</p>
      </div>
      {action && (
        <button
          className="nm-btn px-5 py-2.5 text-sm font-semibold text-[var(--nm-accent)]"
          onClick={action.onClick}
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

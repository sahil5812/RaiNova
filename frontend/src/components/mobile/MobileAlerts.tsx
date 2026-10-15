"use client";

import React, { useState, useMemo } from "react";
import { clsx } from "clsx";
import {
  Bell, AlertTriangle, Shield, Droplets, Cloud, Route as RouteIcon,
  Info, Clock, CheckCheck, Filter, RefreshCw, Waves, Activity,
} from "lucide-react";
import { NeuCard, NeuToggle } from "./ui/NeuPrimitives";
import {
  AlertCard, DataStatusBadge, RiskBadge, EmptyState, MetricTile,
} from "./ui/NeuComponents";
import { SimulationResponse } from "../../lib/types";
import { LiveTelemetry } from "../../lib/api";

interface MobileAlertsProps {
  simResult: SimulationResponse | null;
  liveTelemetry: LiveTelemetry | null;
}

type FilterType = "ALL" | "CRITICAL" | "WARNING" | "INFO";

// Generate alerts from simulation data
function buildAlerts(simResult: SimulationResponse | null, liveTelemetry: LiveTelemetry | null) {
  const alerts: {
    id: string;
    severity: "critical" | "warning" | "info" | "safe";
    title: string;
    message: string;
    location?: string;
    timestamp: string;
    source: string;
    category: "flood" | "rain" | "road" | "forecast" | "general";
    isRead: boolean;
  }[] = [];

  const now = new Date();
  const fmt = (d: Date) =>
    d.toLocaleTimeString("en-IN", { hour12: true, hour: "2-digit", minute: "2-digit" });

  const summary = simResult?.city_summary;

  // Tide warning
  if (summary?.high_tide_warning) {
    alerts.push({
      id: "tide-001",
      severity: "critical",
      title: "High Tide Warning",
      message: "Tidal levels above 4.0m predicted. Coastal areas and low-lying zones at extreme flood risk.",
      timestamp: fmt(now),
      source: "IMD Tide Model",
      category: "flood",
      isRead: false,
    });
  }

  // Critical hotspots
  const critCount = simResult?.critical_hotspots_count ?? 0;
  if (critCount >= 3) {
    alerts.push({
      id: "hotspot-001",
      severity: "critical",
      title: `${critCount} Critical Waterlogging Sites`,
      message: `${critCount} locations currently experiencing dangerous flood depths (>60 cm). Avoid these areas.`,
      timestamp: fmt(new Date(now.getTime() - 5 * 60000)),
      source: "BMC Monitoring",
      category: "flood",
      isRead: false,
    });
  } else if (critCount > 0) {
    alerts.push({
      id: "hotspot-002",
      severity: "warning",
      title: `${critCount} Active Waterlogging Site${critCount > 1 ? "s" : ""}`,
      message: "Moderate waterlogging detected at monitored locations. Exercise caution.",
      timestamp: fmt(new Date(now.getTime() - 10 * 60000)),
      source: "BMC Monitoring",
      category: "flood",
      isRead: false,
    });
  }

  // Roads at risk
  const roadsAtRisk = simResult?.roads_at_risk_count ?? 0;
  if (roadsAtRisk >= 5) {
    alerts.push({
      id: "road-001",
      severity: "critical",
      title: `${roadsAtRisk} Roads at Risk`,
      message: "Multiple major roads including SV Road and Milan Subway corridor are flood-affected. Use elevated routes.",
      timestamp: fmt(new Date(now.getTime() - 8 * 60000)),
      source: "Traffic Management",
      category: "road",
      isRead: true,
    });
  } else if (roadsAtRisk > 0) {
    alerts.push({
      id: "road-002",
      severity: "warning",
      title: `${roadsAtRisk} Road${roadsAtRisk > 1 ? "s" : ""} Partially Flooded`,
      message: "Reduced passability on select arterial roads. Check route conditions before travel.",
      timestamp: fmt(new Date(now.getTime() - 15 * 60000)),
      source: "Traffic Management",
      category: "road",
      isRead: true,
    });
  }

  // Rainfall alert
  const rainfall = liveTelemetry?.rainfall_mm_hr ?? 0;
  if (rainfall >= 100) {
    alerts.push({
      id: "rain-001",
      severity: "critical",
      title: "Extreme Rainfall Alert",
      message: `${rainfall.toFixed(0)} mm/h observed. IMD RED ALERT in effect for Mumbai. Avoid travel.`,
      timestamp: fmt(now),
      source: "IMD / Open-Meteo",
      category: "rain",
      isRead: false,
    });
  } else if (rainfall >= 64) {
    alerts.push({
      id: "rain-002",
      severity: "warning",
      title: "Heavy Rainfall Warning",
      message: `${rainfall.toFixed(0)} mm/h recorded. IMD ORANGE ALERT for Mumbai Metropolitan Region.`,
      timestamp: fmt(new Date(now.getTime() - 3 * 60000)),
      source: "IMD / Open-Meteo",
      category: "rain",
      isRead: false,
    });
  } else if (rainfall > 10) {
    alerts.push({
      id: "rain-003",
      severity: "info",
      title: "Moderate Rainfall Active",
      message: `${rainfall.toFixed(0)} mm/h currently. Monitor conditions, drainage may be stressed.`,
      timestamp: fmt(new Date(now.getTime() - 20 * 60000)),
      source: "Open-Meteo",
      category: "rain",
      isRead: true,
    });
  }

  // Drain overflows
  const drainsOverflow = simResult?.drains_overflowing_count ?? 0;
  if (drainsOverflow >= 3) {
    alerts.push({
      id: "drain-001",
      severity: "warning",
      title: `${drainsOverflow} Drains Overflowing`,
      message: "Multiple storm drains and nullahs at or above capacity. Surface flooding expected in downstream zones.",
      timestamp: fmt(new Date(now.getTime() - 12 * 60000)),
      source: "BMC Drainage",
      category: "flood",
      isRead: true,
    });
  }

  // Top priority hotspots from simulation
  if (simResult?.top_priorities) {
    for (const p of simResult.top_priorities.slice(0, 3)) {
      const urgency = (p.urgency_level ?? p.urgency ?? "").toUpperCase();
      if (urgency.includes("CRITICAL")) {
        alerts.push({
          id: `priority-${p.component_id}`,
          severity: "critical",
          title: p.component_name ?? p.name ?? "Critical Site",
          message: p.recommended_intervention ?? p.recommended_action ?? "Immediate intervention required",
          location: p.ward,
          timestamp: fmt(new Date(now.getTime() - Math.random() * 30 * 60000)),
          source: "Priority Engine",
          category: "general",
          isRead: false,
        });
      }
    }
  }

  // All-clear when nothing is wrong
  if (alerts.length === 0) {
    alerts.push({
      id: "clear-001",
      severity: "safe",
      title: "All Clear",
      message: "No active flood warnings. Infrastructure operating within normal parameters.",
      timestamp: fmt(now),
      source: "RaiNOva System",
      category: "general",
      isRead: true,
    });
  }

  return alerts;
}

export function MobileAlerts({ simResult, liveTelemetry }: MobileAlertsProps) {
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  const allAlerts = useMemo(() => buildAlerts(simResult, liveTelemetry), [simResult, liveTelemetry]);

  const filtered = useMemo(() => {
    return allAlerts.filter((a) => {
      if (filter === "CRITICAL") return a.severity === "critical";
      if (filter === "WARNING") return a.severity === "warning";
      if (filter === "INFO") return a.severity === "info" || a.severity === "safe";
      return true;
    });
  }, [allAlerts, filter]);

  const unreadCount = allAlerts.filter((a) => !a.isRead && !readIds.has(a.id)).length;
  const criticalCount = allAlerts.filter((a) => a.severity === "critical").length;

  const markAllRead = () => {
    setReadIds(new Set(allAlerts.map((a) => a.id)));
  };

  const rainfall = liveTelemetry?.rainfall_mm_hr ?? 0;
  const summary = simResult?.city_summary;

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-2 nm-fade-in">

      {/* ===== HEADER ===== */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="nm-h2">Alert Center</h1>
            {unreadCount > 0 && (
              <span className="nm-badge nm-badge-high text-[10px] px-2 py-0.5">
                {unreadCount} new
              </span>
            )}
          </div>
          <p className="nm-caption mt-0.5">Mumbai Urban Flood Intelligence</p>
        </div>
        {unreadCount > 0 && (
          <button
            className="nm-btn px-3 py-1.5 text-[11px] font-semibold text-[var(--nm-accent)] flex items-center gap-1"
            onClick={markAllRead}
          >
            <CheckCheck size={12} />
            Mark all read
          </button>
        )}
      </div>

      {/* ===== SUMMARY METRICS ===== */}
      <div className="grid grid-cols-3 gap-2">
        <MetricTile
          label="Critical"
          value={criticalCount}
          icon={<AlertTriangle size={12} />}
          accentColor={criticalCount > 0 ? "#ef4444" : "#22c55e"}
        />
        <MetricTile
          label="Hotspots"
          value={simResult?.critical_hotspots_count ?? 0}
          icon={<Droplets size={12} />}
          accentColor={(simResult?.critical_hotspots_count ?? 0) > 0 ? "#f59e0b" : "#22c55e"}
        />
        <MetricTile
          label="Roads"
          value={simResult?.roads_at_risk_count ?? 0}
          unit="at risk"
          icon={<RouteIcon size={12} />}
          accentColor={(simResult?.roads_at_risk_count ?? 0) > 0 ? "#f59e0b" : "#22c55e"}
        />
      </div>

      {/* ===== SEVERITY FILTER ===== */}
      <NeuToggle
        options={[
          { value: "ALL", label: "All" },
          { value: "CRITICAL", label: "Critical" },
          { value: "WARNING", label: "Warning" },
          { value: "INFO", label: "Info" },
        ]}
        value={filter}
        onChange={setFilter}
        className="w-full"
      />

      {/* ===== DATA STATUS ===== */}
      <div className="flex items-center gap-2 px-1">
        <DataStatusBadge status={liveTelemetry ? "LIVE" : "SIMULATION"} />
        <span className="nm-caption opacity-70">
          Based on {liveTelemetry ? "live telemetry" : "simulation parameters"}
        </span>
      </div>

      {/* ===== ALERT LIST ===== */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Shield size={28} />}
          title="No alerts in this category"
          message="All monitored sites are operating within safe parameters."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((alert) => (
            <AlertCard
              key={alert.id}
              severity={alert.severity}
              title={alert.title}
              message={alert.message}
              location={alert.location}
              timestamp={alert.timestamp}
              source={alert.source}
              isRead={alert.isRead || readIds.has(alert.id)}
              onClick={() => {
                setReadIds((prev) => {
                  const next = new Set(prev);
                  next.add(alert.id);
                  return next;
                });
              }}
            />
          ))}
        </div>
      )}

      {/* ===== INFRASTRUCTURE HEALTH SUMMARY ===== */}
      {summary && (
        <NeuCard className="!p-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity size={14} color="var(--nm-accent)" />
            <span className="nm-h3 text-[13px]">Infrastructure Health</span>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="nm-caption">Overall Health</span>
              <span className="nm-mono font-bold" style={{
                color: summary.overall_infrastructure_health < 50 ? "#ef4444" :
                       summary.overall_infrastructure_health < 70 ? "#f59e0b" : "#22c55e"
              }}>
                {summary.overall_infrastructure_health}%
              </span>
            </div>
            <div className="nm-forecast-bar">
              <div
                className="nm-forecast-bar-fill"
                style={{
                  width: `${summary.overall_infrastructure_health}%`,
                  background: summary.overall_infrastructure_health < 50 ? "#ef4444" :
                              summary.overall_infrastructure_health < 70 ? "#f59e0b" : "#22c55e"
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-y-1.5 mt-1">
              {summary.average_traffic_speed_kmh !== undefined && (
                <span className="nm-caption">
                  Traffic: <strong>{summary.average_traffic_speed_kmh.toFixed(0)} km/h avg</strong>
                </span>
              )}
              {summary.active_submerged_hotspots !== undefined && (
                <span className="nm-caption">
                  Submerged: <strong>{summary.active_submerged_hotspots} sites</strong>
                </span>
              )}
              {summary.pumping_stations_active !== undefined && (
                <span className="nm-caption">
                  Pumps active: <strong>{summary.pumping_stations_active}</strong>
                </span>
              )}
              {summary.drains_overloaded_count !== undefined && (
                <span className="nm-caption">
                  Drains overloaded: <strong>{summary.drains_overloaded_count}</strong>
                </span>
              )}
            </div>
          </div>
        </NeuCard>
      )}

      {/* Push notification notice */}
      <div className="nm-inset rounded-xl px-4 py-3 flex items-start gap-2">
        <Bell size={13} color="var(--nm-text-subtle)" className="shrink-0 mt-0.5" />
        <p className="nm-caption text-[11px]">
          Push notifications require backend integration with FCM/APNs. Currently showing in-app alerts only.
        </p>
      </div>
    </div>
  );
}



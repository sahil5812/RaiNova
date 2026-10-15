"use client";

import React, { useState, useEffect } from "react";
import { clsx } from "clsx";
import {
  Droplets, Wind, Thermometer, Waves, AlertTriangle, Map as MapIcon,
  Navigation, ChevronRight, Activity, Shield, Clock, Zap, CloudRain,
  CloudLightning, Sun, Eye, TrendingUp, BarChart3,
} from "lucide-react";
import { NeuCard, NeuButton } from "./ui/NeuPrimitives";
import {
  MetricTile, Skeleton, CardSkeleton, RiskBadge, DataStatusBadge, AlertCard, ConnectionStatus
} from "./ui/NeuComponents";
import { ForecastTimeline } from "./ui/NeuInteractive";
import { SimulationResponse, SimulationRequest } from "../../lib/types";
import { LiveTelemetry } from "../../lib/api";

interface MobileHomeProps {
  simResult: SimulationResponse | null;
  simParams: SimulationRequest;
  liveTelemetry: LiveTelemetry | null;
  isLoading: boolean;
  onOpenMap: () => void;
  onOpenRoute: () => void;
  onOpenForecast: () => void;
  onOpenAlerts: () => void;
  onSimulateScenario: (name: string, rain: number, tide: number, silt: number) => void;
}

const SCENARIOS = [
  { name: "Clear Sky", rain: 0, tide: 2.4, silt: 20, icon: <Sun size={14} />, color: "#22c55e" },
  { name: "Light Rain", rain: 25, tide: 2.8, silt: 25, icon: <CloudRain size={14} />, color: "#0ea5e9" },
  { name: "Heavy Storm", rain: 120, tide: 4.2, silt: 45, icon: <CloudLightning size={14} />, color: "#ef4444" },
  { name: "Extreme Event", rain: 185, tide: 4.8, silt: 60, icon: <Waves size={14} />, color: "#7c3aed" },
];

export function MobileHome({
  simResult,
  simParams,
  liveTelemetry,
  isLoading,
  onOpenMap,
  onOpenRoute,
  onOpenForecast,
  onOpenAlerts,
  onSimulateScenario,
}: MobileHomeProps) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString("en-IN", { hour12: true, hour: "2-digit", minute: "2-digit" }));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const summary = simResult?.city_summary;
  const hotspots = simResult?.critical_hotspots_count ?? 0;
  const roadsAtRisk = simResult?.roads_at_risk_count ?? 0;
  const health = summary?.overall_infrastructure_health ?? 100;
  const rainfall = liveTelemetry?.rainfall_mm_hr ?? simParams.rainfall_mm_hr ?? 0;
  const tide = liveTelemetry?.tide_level_m ?? simParams.tide_level_m ?? 0;
  const temp = liveTelemetry?.temperature_c ?? 29;
  const wind = liveTelemetry?.wind_speed_kmh ?? 18;
  const isHighTide = summary?.high_tide_warning ?? false;
  const isCritical = (summary?.disruption_severity ?? "").includes("RED");
  const isMedium = (summary?.disruption_severity ?? "").includes("HIGH") || (summary?.disruption_severity ?? "").includes("AMBER");

  // Risk level derived
  const riskLevel: "LOW" | "MEDIUM" | "HIGH" =
    hotspots >= 4 || rainfall >= 100 ? "HIGH" :
    hotspots >= 2 || rainfall >= 50 ? "MEDIUM" : "LOW";

  const riskColor = riskLevel === "HIGH" ? "#ef4444" : riskLevel === "MEDIUM" ? "#f59e0b" : "#22c55e";

  // Forecast steps from timeline_forecast
  const timelineSteps = simResult?.timeline_forecast?.map((s) => ({
    time: s.time_offset,
    rainfallMmHr: Math.round(s.predicted_rainfall_mm_hr),
    riskLevel: (s.city_max_depth_cm >= 60 ? "HIGH" : s.city_max_depth_cm >= 25 ? "MEDIUM" : "LOW") as "LOW" | "MEDIUM" | "HIGH",
    depthCm: s.city_max_depth_cm,
  })) ?? [
    { time: "Now", rainfallMmHr: Math.round(rainfall), riskLevel: riskLevel as "LOW" | "MEDIUM" | "HIGH", depthCm: summary?.max_water_depth_cm ?? 0 },
    { time: "+30m", rainfallMmHr: Math.round(rainfall * 1.1), riskLevel: riskLevel, depthCm: (summary?.max_water_depth_cm ?? 0) * 1.1 },
    { time: "+1h", rainfallMmHr: Math.round(rainfall * 0.9), riskLevel: riskLevel, depthCm: (summary?.max_water_depth_cm ?? 0) * 0.85 },
    { time: "+2h", rainfallMmHr: Math.round(rainfall * 0.6), riskLevel: riskLevel === "HIGH" ? "MEDIUM" : riskLevel, depthCm: (summary?.max_water_depth_cm ?? 0) * 0.6 },
    { time: "+3h", rainfallMmHr: Math.round(rainfall * 0.3), riskLevel: "LOW", depthCm: 0 },
  ];

  const [selectedForecastIdx, setSelectedForecastIdx] = useState(0);

  // Top priorities as alerts
  const topAlerts = simResult?.top_priorities?.slice(0, 3) ?? [];

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-2 nm-fade-in">

      {/* ===== HEADER ===== */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            {/* Logo */}
            <div
              className="nm-card-sm flex items-center justify-center"
              style={{ width: 36, height: 36, borderRadius: 10, padding: 0 }}
            >
              <Waves size={18} color="var(--nm-accent)" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="nm-h2 leading-none">RaiNOva</h1>
              <p className="nm-caption mt-0.5">Mumbai Urban Digital Twin</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <ConnectionStatus
            isConnected={!!liveTelemetry}
            lastUpdate={time}
          />
          <DataStatusBadge status={liveTelemetry ? "LIVE" : "SIMULATION"} />
        </div>
      </div>

      {/* ===== RISK OVERVIEW HERO ===== */}
      {isLoading ? (
        <div className="nm-card p-5 flex flex-col gap-3">
          <Skeleton height="12px" width="30%" />
          <Skeleton height="36px" width="65%" />
          <Skeleton height="10px" />
        </div>
      ) : (
        <div
          className="nm-card-lg p-5 relative overflow-hidden"
          style={{
            background: isCritical
              ? "linear-gradient(135deg, rgba(239,68,68,0.06), rgba(220,38,38,0.03))"
              : isMedium
              ? "linear-gradient(135deg, rgba(245,158,11,0.06), rgba(245,158,11,0.02))"
              : "linear-gradient(135deg, rgba(22,163,74,0.06), rgba(22,163,74,0.02))",
          }}
        >
          {/* Decorative circle */}
          <div
            style={{
              position: "absolute",
              right: -30,
              top: -30,
              width: 120,
              height: 120,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${riskColor}18 0%, transparent 70%)`,
            }}
          />

          <div className="flex items-start justify-between">
            <div>
              <span className="nm-caption">FLOOD RISK STATUS</span>
              <div className="flex items-center gap-2 mt-1">
                <h2 className="nm-h1" style={{ color: riskColor }}>
                  {riskLevel}
                </h2>
                <RiskBadge level={riskLevel} />
              </div>
              <p className="nm-body text-[12px] mt-1.5">
                {hotspots} critical hotspot{hotspots !== 1 ? "s" : ""} · {roadsAtRisk} road{roadsAtRisk !== 1 ? "s" : ""} at risk
              </p>
            </div>
            <div className="flex flex-col items-center nm-card-sm p-2.5 rounded-2xl" style={{ minWidth: 56 }}>
              <span className="text-xs font-bold" style={{ color: riskColor }}>
                {health}%
              </span>
              <span className="nm-caption text-[9px] mt-0.5 text-center">
                Infra
                <br />Health
              </span>
            </div>
          </div>

          {/* High tide warning */}
          {isHighTide && (
            <div className="mt-3 flex items-center gap-2 bg-amber-50/60 rounded-xl px-3 py-2 border border-amber-200/60">
              <Waves size={13} color="#b45309" />
              <span className="nm-caption text-amber-700 font-semibold">High Tide Warning Active</span>
            </div>
          )}
        </div>
      )}

      {/* ===== WEATHER METRICS GRID ===== */}
      {isLoading ? (
        <div className="grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => <CardSkeleton key={i} className="p-3" />)}
        </div>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          <MetricTile
            label="Rain"
            value={rainfall.toFixed(0)}
            unit="mm/h"
            icon={<Droplets size={13} />}
            accentColor={rainfall >= 80 ? "#ef4444" : rainfall >= 40 ? "#f59e0b" : "#0ea5e9"}
            className="col-span-1"
          />
          <MetricTile
            label="Tide"
            value={tide.toFixed(1)}
            unit="m"
            icon={<Waves size={13} />}
            accentColor={tide >= 4.0 ? "#ef4444" : tide >= 3.5 ? "#f59e0b" : "#0ea5e9"}
          />
          <MetricTile
            label="Temp"
            value={temp.toFixed(0)}
            unit="°C"
            icon={<Thermometer size={13} />}
            accentColor="#f59e0b"
          />
          <MetricTile
            label="Wind"
            value={wind.toFixed(0)}
            unit="km/h"
            icon={<Wind size={13} />}
            accentColor="#64748b"
          />
        </div>
      )}

      {/* ===== 3-HOUR FORECAST TIMELINE ===== */}
      <NeuCard className="!p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 size={15} color="var(--nm-accent)" />
            <span className="nm-h3 text-[13px]">0–3 Hour Forecast</span>
          </div>
          <button
            className="nm-caption text-[var(--nm-accent)] flex items-center gap-0.5 font-semibold"
            onClick={onOpenForecast}
          >
            Full <ChevronRight size={12} />
          </button>
        </div>
        <ForecastTimeline
          steps={timelineSteps}
          selectedIndex={selectedForecastIdx}
          onSelect={setSelectedForecastIdx}
        />
        {/* Selected step detail */}
        {timelineSteps[selectedForecastIdx] && (
          <div className="mt-3 nm-inset-sm px-3 py-2 rounded-xl flex items-center justify-between">
            <span className="nm-caption">
              At <strong>{timelineSteps[selectedForecastIdx].time}</strong>
            </span>
            <div className="flex items-center gap-3">
              <span className="nm-caption">
                <span className="font-bold text-[var(--nm-accent)]">
                  {timelineSteps[selectedForecastIdx].rainfallMmHr}
                </span> mm/h
              </span>
              <RiskBadge level={timelineSteps[selectedForecastIdx].riskLevel} small />
            </div>
          </div>
        )}
      </NeuCard>

      {/* ===== QUICK ACTIONS ===== */}
      <div className="grid grid-cols-2 gap-3">
        <NeuButton
          variant="accent"
          size="md"
          fullWidth
          icon={<MapIcon size={16} />}
          onClick={onOpenMap}
        >
          Explore Live Map
        </NeuButton>
        <NeuButton
          variant="default"
          size="md"
          fullWidth
          icon={<Navigation size={16} />}
          onClick={onOpenRoute}
          className="text-[var(--nm-accent)]"
        >
          Safe Route
        </NeuButton>
      </div>

      {/* ===== QUICK SCENARIO SELECTOR ===== */}
      <NeuCard className="!p-4">
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} color="var(--nm-accent)" />
          <span className="nm-h3 text-[13px]">Quick Scenarios</span>
          <DataStatusBadge status="SIMULATION" />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {SCENARIOS.map((s) => {
            const isActive = simParams.active_scenario_name === s.name;
            return (
              <button
                key={s.name}
                onClick={() => onSimulateScenario(s.name, s.rain, s.tide, s.silt)}
                className={clsx(
                  "flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl text-center transition-all",
                  isActive
                    ? "nm-card-sm"
                    : "nm-icon-btn"
                )}
                style={isActive ? { borderColor: `${s.color}40` } : {}}
              >
                <span style={{ color: isActive ? s.color : "var(--nm-text-subtle)" }}>
                  {s.icon}
                </span>
                <span
                  className="text-[10px] font-semibold leading-tight"
                  style={{ color: isActive ? s.color : "var(--nm-text-muted)" }}
                >
                  {s.name}
                </span>
              </button>
            );
          })}
        </div>
      </NeuCard>

      {/* ===== TOP ALERTS ===== */}
      {topAlerts.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} color="#ef4444" />
              <span className="nm-h3 text-[13px]">Priority Alerts</span>
            </div>
            <button
              className="nm-caption text-[var(--nm-accent)] flex items-center gap-0.5 font-semibold"
              onClick={onOpenAlerts}
            >
              View all <ChevronRight size={12} />
            </button>
          </div>
          {topAlerts.map((p, i) => (
            <AlertCard
              key={p.component_id ?? i}
              severity={
                (p.urgency_level ?? p.urgency ?? "").toLowerCase().includes("critical")
                  ? "critical"
                  : (p.urgency_level ?? p.urgency ?? "").toLowerCase().includes("high")
                  ? "warning"
                  : "info"
              }
              title={p.component_name ?? p.name ?? `Alert #${i + 1}`}
              message={p.recommended_intervention ?? p.recommended_action ?? "Infrastructure monitoring alert"}
              location={p.ward}
              isRead={false}
            />
          ))}
        </div>
      )}

      {/* ===== NO ALERTS STATE ===== */}
      {!isLoading && topAlerts.length === 0 && rainfall < 5 && (
        <NeuCard className="!p-5">
          <div className="flex items-center gap-3">
            <div className="nm-card-sm w-10 h-10 flex items-center justify-center rounded-xl shrink-0">
              <Shield size={18} color="#22c55e" />
            </div>
            <div>
              <span className="nm-h3 text-[13px] text-[#16a34a]">All Clear</span>
              <p className="nm-body text-[12px] mt-0.5">No active flood warnings. Infrastructure operating normally.</p>
            </div>
          </div>
        </NeuCard>
      )}

      {/* ===== MONITORING FOOTER ===== */}
      <div className="flex items-center justify-between px-1 py-2 nm-divider">
        <span className="nm-caption">
          Data: Open-Meteo · IMD · BMC
        </span>
        <span className="nm-caption flex items-center gap-1">
          <Clock size={10} /> Updated {time}
        </span>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useMemo } from "react";
import { clsx } from "clsx";
import {
  CloudRain, Waves, AlertTriangle, BarChart3, ChevronDown, ChevronRight,
  MapPin, Clock, TrendingDown, TrendingUp, Minus, Info,
} from "lucide-react";
import { NeuCard, NeuButton } from "./ui/NeuPrimitives";
import {
  RiskBadge, DataStatusBadge, MetricTile, CardSkeleton, EmptyState,
  FloodDepthIndicator,
} from "./ui/NeuComponents";
import { ForecastTimeline } from "./ui/NeuInteractive";
import { SimulationResponse, SimulationRequest, TimelineForecastStep } from "../../lib/types";
import { LiveTelemetry } from "../../lib/api";

// ===== SVG Rainfall Chart (no extra deps) =====
interface RainfallChartProps {
  data: { time: string; value: number; max?: number }[];
  color?: string;
  height?: number;
  className?: string;
}

function RainfallChart({ data, color = "#0ea5e9", height = 80, className }: RainfallChartProps) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const w = 100 / Math.max(data.length - 1, 1);

  const points = data.map((d, i) => ({
    x: (i / Math.max(data.length - 1, 1)) * 100,
    y: height - (d.value / maxVal) * (height - 8),
  }));

  const pathD = points
    .map((p, i) => (i === 0 ? `M ${p.x},${p.y}` : `L ${p.x},${p.y}`))
    .join(" ");

  const areaD = `${pathD} L 100,${height} L 0,${height} Z`;

  return (
    <div className={clsx("relative overflow-hidden rounded-xl", className)}>
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        {/* Area fill */}
        <path d={areaD} fill={color} opacity={0.1} />
        {/* Line */}
        <path
          d={pathD}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
        {/* Dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="2"
            fill={color}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </div>
  );
}

// ===== Main Forecast Screen =====
interface MobileForecastProps {
  simResult: SimulationResponse | null;
  simParams: SimulationRequest;
  liveTelemetry: LiveTelemetry | null;
  isLoading: boolean;
  onTriggerSimulation: (params: SimulationRequest) => void;
}

const TIME_OFFSETS = [
  { label: "Now", offsetMin: 0 },
  { label: "+30m", offsetMin: 30 },
  { label: "+1h", offsetMin: 60 },
  { label: "+2h", offsetMin: 120 },
  { label: "+3h", offsetMin: 180 },
];

// Mumbai key monitoring locations (from existing backend hotspots)
const KEY_LOCATIONS = [
  { id: "WL_HND_01", name: "Hindmata Junction", ward: "F/S" },
  { id: "WL_MLN_01", name: "Milan Subway", ward: "H/W" },
  { id: "WL_AND_01", name: "Andheri Subway", ward: "K/W" },
  { id: "WL_KRL_01", name: "Kurla West", ward: "L" },
  { id: "MBR_ZONE", name: "Mumbra Corridor", ward: "Thane" },
];

export function MobileForecast({
  simResult,
  simParams,
  liveTelemetry,
  isLoading,
  onTriggerSimulation,
}: MobileForecastProps) {
  const [selectedTimeIdx, setSelectedTimeIdx] = useState(0);
  const [expandedLocation, setExpandedLocation] = useState<string | null>("WL_HND_01");
  const [rainfallSlider, setRainfallSlider] = useState(simParams.rainfall_mm_hr);

  const rainfall = liveTelemetry?.rainfall_mm_hr ?? simParams.rainfall_mm_hr ?? 0;
  const tide = simParams.tide_level_m;
  const summary = simResult?.city_summary;

  // Timeline data — from backend timeline_forecast or synthesized
  const timelineSteps = simResult?.timeline_forecast ?? [];

  // Build chart data
  const chartData = useMemo(() => {
    if (timelineSteps.length > 0) {
      return timelineSteps.map((s) => ({
        time: s.time_offset,
        value: s.predicted_rainfall_mm_hr,
      }));
    }
    // Fallback synthetic
    return TIME_OFFSETS.map((t, i) => ({
      time: t.label,
      value: Math.max(0, rainfall * Math.pow(0.75, i) * (0.9 + Math.random() * 0.2)),
    }));
  }, [timelineSteps, rainfall]);

  // Selected time step data
  const selectedStep = timelineSteps[selectedTimeIdx];
  const currentDepthCm = selectedStep?.city_max_depth_cm ?? summary?.max_water_depth_cm ?? 0;
  const currentRain = selectedStep?.predicted_rainfall_mm_hr ?? rainfall;
  const criticalCount = selectedStep?.critical_hotspots_count ?? simResult?.critical_hotspots_count ?? 0;

  const riskLevel: "LOW" | "MEDIUM" | "HIGH" =
    currentDepthCm >= 60 || currentRain >= 100 ? "HIGH" :
    currentDepthCm >= 25 || currentRain >= 50 ? "MEDIUM" : "LOW";

  // Forecast steps for ForecastTimeline component
  const forecastSteps = TIME_OFFSETS.map((t, i) => ({
    time: t.label,
    rainfallMmHr: Math.round(chartData[i]?.value ?? 0),
    riskLevel: (
      (chartData[i]?.value ?? 0) >= 100 ? "HIGH" :
      (chartData[i]?.value ?? 0) >= 50 ? "MEDIUM" : "LOW"
    ) as "LOW" | "MEDIUM" | "HIGH",
    depthCm: timelineSteps[i]?.city_max_depth_cm ?? currentDepthCm * Math.pow(0.8, i),
  }));

  // Flood depth by location (from simResult components)
  const locationDepths = useMemo(() => {
    if (!simResult?.components) return {};
    const map: Record<string, number> = {};
    for (const comp of simResult.components) {
      map[comp.component_id] = comp.water_depth_cm;
    }
    return map;
  }, [simResult]);

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-2 nm-fade-in">

      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="nm-h2">Flood Forecast</h1>
          <p className="nm-caption mt-0.5">Mumbai Metropolitan Region</p>
        </div>
        <DataStatusBadge status={liveTelemetry ? "LIVE" : "SIMULATION"} />
      </div>

      {/* ===== TIME SELECTOR ===== */}
      <NeuCard className="!p-4">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} color="var(--nm-accent)" />
          <span className="nm-h3 text-[13px]">Select Forecast Time</span>
        </div>
        <ForecastTimeline
          steps={forecastSteps}
          selectedIndex={selectedTimeIdx}
          onSelect={setSelectedTimeIdx}
        />
      </NeuCard>

      {/* ===== SELECTED TIME SUMMARY ===== */}
      {isLoading ? (
        <CardSkeleton />
      ) : (
        <div
          className="nm-card-lg p-5 relative overflow-hidden"
          style={{
            background:
              riskLevel === "HIGH"
                ? "linear-gradient(135deg, rgba(239,68,68,0.07), rgba(220,38,38,0.03))"
                : riskLevel === "MEDIUM"
                ? "linear-gradient(135deg, rgba(245,158,11,0.07), rgba(245,158,11,0.03))"
                : "linear-gradient(135deg, rgba(22,163,74,0.07), rgba(22,163,74,0.03))",
          }}
        >
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="nm-caption">{forecastSteps[selectedTimeIdx]?.time}</span>
                <RiskBadge level={riskLevel} />
              </div>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <span className="text-3xl font-black text-[var(--nm-text)]" style={{letterSpacing: "-0.04em"}}>
                  {currentRain.toFixed(0)}
                </span>
                <span className="nm-caption font-semibold">mm/h rainfall</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <MetricTile
                label="Max Depth"
                value={currentDepthCm.toFixed(0)}
                unit="cm"
                className="!p-2.5 !gap-1"
                accentColor={currentDepthCm >= 60 ? "#ef4444" : currentDepthCm >= 25 ? "#f59e0b" : "#22c55e"}
              />
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3">
            <span className="nm-caption">
              <span className="font-bold text-[var(--nm-text)]">{criticalCount}</span> critical sites
            </span>
            <span className="nm-caption">
              Tide: <span className="font-bold text-[var(--nm-text)]">{tide.toFixed(1)}</span>m
            </span>
          </div>
        </div>
      )}

      {/* ===== RAINFALL CHART ===== */}
      <NeuCard className="!p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 size={14} color="var(--nm-accent)" />
          <span className="nm-h3 text-[13px]">Rainfall Intensity</span>
          <span className="nm-caption ml-auto">0–3 hours</span>
        </div>
        <div className="nm-inset rounded-xl p-3">
          <RainfallChart
            data={chartData}
            color={riskLevel === "HIGH" ? "#ef4444" : riskLevel === "MEDIUM" ? "#f59e0b" : "#0ea5e9"}
            height={72}
          />
        </div>
        <div className="flex justify-between mt-2 px-1">
          {forecastSteps.map((s, i) => (
            <span
              key={i}
              className="nm-caption text-[9px]"
              style={{ color: selectedTimeIdx === i ? "var(--nm-accent)" : undefined }}
            >
              {s.time}
            </span>
          ))}
        </div>
      </NeuCard>

      {/* ===== FLOOD DEPTH BY LOCATION ===== */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <MapPin size={14} color="var(--nm-accent)" />
          <span className="nm-h3">Key Monitoring Locations</span>
          {simResult?.components?.length ? (
            <DataStatusBadge status="SIMULATION" />
          ) : (
            <DataStatusBadge status="UNAVAILABLE" />
          )}
        </div>

        {KEY_LOCATIONS.map((loc) => {
          const depth = locationDepths[loc.id] ??
            simResult?.components?.find((c) => c.component_id === loc.id)?.water_depth_cm ??
            null;
          const isExpanded = expandedLocation === loc.id;
          const riskLvl: "LOW" | "MEDIUM" | "HIGH" =
            depth === null ? "LOW" :
            depth >= 60 ? "HIGH" : depth >= 25 ? "MEDIUM" : "LOW";

          return (
            <button
              key={loc.id}
              className="w-full text-left nm-card p-4 transition-all active:scale-[0.99]"
              onClick={() => setExpandedLocation(isExpanded ? null : loc.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="nm-h3 text-[13px]">{loc.name}</span>
                  <span className="nm-caption">Ward {loc.ward}</span>
                </div>
                <div className="flex items-center gap-2">
                  {depth !== null ? (
                    <RiskBadge level={riskLvl} small />
                  ) : (
                    <DataStatusBadge status="UNAVAILABLE" />
                  )}
                  {isExpanded ? <ChevronDown size={14} className="text-[var(--nm-text-subtle)]" /> : <ChevronRight size={14} className="text-[var(--nm-text-subtle)]" />}
                </div>
              </div>

              {isExpanded && (
                <div className="mt-3 pt-3 border-t border-[var(--nm-border)] nm-fade-in">
                  {depth !== null ? (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="nm-caption">Water Depth</span>
                        <FloodDepthIndicator depthCm={depth} showBar={false} />
                      </div>
                      <div className="nm-forecast-bar mt-1">
                        <div
                          className="nm-forecast-bar-fill"
                          style={{
                            width: `${Math.min(100, (depth / 120) * 100)}%`,
                            background:
                              depth >= 60 ? "#ef4444" : depth >= 25 ? "#f59e0b" : "#22c55e",
                          }}
                        />
                      </div>
                      {depth >= 25 && (
                        <p className="nm-caption text-[11px] text-amber-600 mt-1">
                          ⚠ Wading not advised above 25 cm
                        </p>
                      )}
                      {depth >= 60 && (
                        <p className="nm-caption text-[11px] text-red-600">
                          🚫 Road impassable — use alternate route
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-[var(--nm-text-subtle)]">
                      <Info size={13} />
                      <span className="nm-caption">No sensor data available for this location</span>
                    </div>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* ===== SIMULATION CONTROLS ===== */}
      <NeuCard className="!p-4">
        <div className="flex items-center gap-2 mb-3">
          <span className="nm-h3 text-[13px]">Scenario Rainfall</span>
          <DataStatusBadge status="SIMULATION" />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="nm-caption">Rainfall intensity</span>
            <span className="nm-mono font-bold text-[var(--nm-accent)]">
              {rainfallSlider.toFixed(0)} mm/h
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={200}
            step={5}
            value={rainfallSlider}
            onChange={(e) => setRainfallSlider(Number(e.target.value))}
            className="w-full accent-sky-500"
            style={{ accentColor: "var(--nm-accent)" }}
          />
          <div className="flex justify-between nm-caption text-[9px]">
            <span>0 (Clear)</span>
            <span>50 (Moderate)</span>
            <span>100 (Heavy)</span>
            <span>200 (Extreme)</span>
          </div>
          <NeuButton
            variant="accent"
            size="sm"
            fullWidth
            onClick={() =>
              onTriggerSimulation({
                rainfall_mm_hr: rainfallSlider,
                tide_level_m: simParams.tide_level_m,
                siltation_pct: simParams.siltation_pct,
                active_scenario_name: `Custom ${rainfallSlider.toFixed(0)} mm/h`,
              })
            }
          >
            Run Forecast Simulation
          </NeuButton>
        </div>
      </NeuCard>

      {/* Data transparency note */}
      <div className="nm-inset rounded-xl px-4 py-3 flex items-start gap-2">
        <Info size={13} color="var(--nm-text-subtle)" className="shrink-0 mt-0.5" />
        <p className="nm-caption text-[11px]">
          Forecasts are <strong>SIMULATION</strong> — model-generated estimates using Mumbai DEM elevation, historical flood patterns, and BMC drainage capacity data. Not a real-time weather forecast.
        </p>
      </div>
    </div>
  );
}

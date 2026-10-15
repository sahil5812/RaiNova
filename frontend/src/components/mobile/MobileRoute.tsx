"use client";

import React, { useState, useRef, useCallback } from "react";
import { clsx } from "clsx";
import {
  Navigation, MapPin, Search, X, ChevronRight, AlertTriangle,
  Shield, Clock, Route as RouteIcon, Droplets, Info, Loader2,
  ArrowRight, Check, TrendingUp,
} from "lucide-react";
import { NeuCard, NeuButton, NeuInput } from "./ui/NeuPrimitives";
import {
  RiskBadge, DataStatusBadge, MetricTile, EmptyState, AlertCard, Skeleton,
} from "./ui/NeuComponents";
import { RouteSegmentBar } from "./ui/NeuInteractive";
import { SimulationResponse, SimulationRequest, CoordinateRouteResponse, EvaluatedRouteOption } from "../../lib/types";
import { fetchCoordinateRoute } from "../../lib/api";

// Known Mumbai locations for quick-pick
const QUICK_LOCATIONS = [
  { name: "Marine Drive", coord: [72.8240, 18.9400] as [number, number] },
  { name: "Bandra Station", coord: [72.8410, 19.0550] as [number, number] },
  { name: "Andheri Station", coord: [72.8490, 19.1193] as [number, number] },
  { name: "Kurla Station", coord: [72.8780, 19.0726] as [number, number] },
  { name: "Dadar TT", coord: [72.8404, 19.0212] as [number, number] },
  { name: "Thane Station", coord: [72.9781, 19.1942] as [number, number] },
  { name: "Mumbra", coord: [73.0229, 19.1906] as [number, number] },
  { name: "CST Mumbai", coord: [72.8347, 18.9398] as [number, number] },
];

interface MobileRouteProps {
  simResult: SimulationResponse | null;
  simParams: SimulationRequest;
}

type RouteStep = "idle" | "picking-start" | "picking-dest" | "loading" | "result";

export function MobileRoute({ simResult, simParams }: MobileRouteProps) {
  const [step, setStep] = useState<RouteStep>("idle");
  const [startName, setStartName] = useState("");
  const [destName, setDestName] = useState("");
  const [startCoord, setStartCoord] = useState<[number, number] | null>(null);
  const [destCoord, setDestCoord] = useState<[number, number] | null>(null);
  const [result, setResult] = useState<CoordinateRouteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);

  const rainfall = simParams.rainfall_mm_hr;
  const tide = simParams.tide_level_m;

  const handleSelectStart = (loc: { name: string; coord: [number, number] }) => {
    setStartName(loc.name);
    setStartCoord(loc.coord);
    setStep("idle");
  };

  const handleSelectDest = (loc: { name: string; coord: [number, number] }) => {
    setDestName(loc.name);
    setDestCoord(loc.coord);
    setStep("idle");
  };

  const handleCalculateRoute = useCallback(async () => {
    if (!startCoord || !destCoord) return;
    setStep("loading");
    setError(null);
    try {
      const res = await fetchCoordinateRoute(startCoord, destCoord, rainfall, tide, simParams.siltation_pct);
      setResult(res);
      setSelectedRouteIdx(res.best_route_index ?? 0);
      setStep("result");
    } catch (e) {
      setError("Route calculation failed. Showing fallback estimate.");
      setStep("result");
    }
  }, [startCoord, destCoord, rainfall, tide, simParams.siltation_pct]);

  const handleReset = () => {
    setStep("idle");
    setResult(null);
    setError(null);
    setStartName("");
    setDestName("");
    setStartCoord(null);
    setDestCoord(null);
    setSelectedRouteIdx(0);
  };

  const selectedRoute: EvaluatedRouteOption | null = result?.routes?.[selectedRouteIdx] ?? null;

  // Location picker panel
  const renderLocationPicker = (mode: "start" | "dest") => (
    <div className="flex flex-col gap-3 nm-fade-in">
      <div className="flex items-center justify-between">
        <span className="nm-h3 text-[13px]">
          Select {mode === "start" ? "Start" : "Destination"}
        </span>
        <button
          className="nm-icon-btn w-7 h-7"
          onClick={() => setStep("idle")}
        >
          <X size={13} />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} color="var(--nm-text-subtle)" />
        <input
          className="nm-input pl-9"
          placeholder="Search location…"
          readOnly
        />
      </div>

      <span className="nm-caption font-semibold">QUICK PICK — MUMBAI LANDMARKS</span>
      <div className="flex flex-col gap-2">
        {QUICK_LOCATIONS.map((loc) => (
          <button
            key={loc.name}
            className="nm-card p-3 flex items-center justify-between active:scale-[0.98] transition-all text-left"
            onClick={() =>
              mode === "start" ? handleSelectStart(loc) : handleSelectDest(loc)
            }
          >
            <div className="flex items-center gap-2.5">
              <MapPin size={14} color="var(--nm-accent)" />
              <span className="nm-body text-[13px] font-medium text-[var(--nm-text)]">{loc.name}</span>
            </div>
            <ChevronRight size={14} className="text-[var(--nm-text-subtle)]" />
          </button>
        ))}
      </div>
    </div>
  );

  // Loading state
  if (step === "loading") {
    return (
      <div className="flex flex-col gap-4 px-4 pt-4 nm-fade-in">
        <div className="nm-h2">Safe Route</div>
        <div className="nm-card-lg p-8 flex flex-col items-center gap-4">
          <div className="nm-card w-16 h-16 rounded-2xl flex items-center justify-center">
            <Navigation size={28} color="var(--nm-accent)" className="animate-pulse" />
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <span className="nm-h3">Calculating flood-safe route…</span>
            <p className="nm-body text-[12px]">Running Dijkstra with flood-risk penalties</p>
          </div>
          <div className="flex gap-2">
            <Skeleton width="80px" height="8px" rounded />
          </div>
        </div>
      </div>
    );
  }

  // Location pickers
  if (step === "picking-start") return <div className="px-4 pt-4">{renderLocationPicker("start")}</div>;
  if (step === "picking-dest") return <div className="px-4 pt-4">{renderLocationPicker("dest")}</div>;

  return (
    <div className="flex flex-col gap-4 px-4 pt-4 pb-2 nm-fade-in">

      {/* ===== HEADER ===== */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="nm-h2">Safe Route Planner</h1>
          <p className="nm-caption mt-0.5">Flood-aware navigation</p>
        </div>
        <DataStatusBadge status={rainfall > 0 ? "SIMULATION" : "LIVE"} />
      </div>

      {/* ===== ORIGIN / DESTINATION PICKERS ===== */}
      <NeuCard className="!p-4">
        {/* Start */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-200 shrink-0" />
          <button
            className="flex-1 nm-inset-sm rounded-xl px-3 py-2.5 text-left"
            onClick={() => setStep("picking-start")}
          >
            <span className={startName ? "nm-body text-[13px] font-medium text-[var(--nm-text)]" : "nm-caption"}>
              {startName || "Choose start location"}
            </span>
          </button>
          {startName && (
            <button className="nm-icon-btn w-7 h-7" onClick={() => { setStartName(""); setStartCoord(null); }}>
              <X size={11} />
            </button>
          )}
        </div>

        {/* Connector line */}
        <div className="ml-[5px] w-0.5 h-4 bg-[var(--nm-border)] mb-2" />

        {/* Destination */}
        <div className="flex items-center gap-3">
          <MapPin size={13} color="#ef4444" className="shrink-0" />
          <button
            className="flex-1 nm-inset-sm rounded-xl px-3 py-2.5 text-left"
            onClick={() => setStep("picking-dest")}
          >
            <span className={destName ? "nm-body text-[13px] font-medium text-[var(--nm-text)]" : "nm-caption"}>
              {destName || "Choose destination"}
            </span>
          </button>
          {destName && (
            <button className="nm-icon-btn w-7 h-7" onClick={() => { setDestName(""); setDestCoord(null); }}>
              <X size={11} />
            </button>
          )}
        </div>
      </NeuCard>

      {/* Current conditions badge */}
      <div className="flex items-center gap-2 px-1">
        <Droplets size={12} color="var(--nm-accent)" />
        <span className="nm-caption">
          Flood conditions: <strong>{rainfall.toFixed(0)} mm/h</strong> rain · Tide <strong>{tide.toFixed(1)}m</strong>
        </span>
      </div>

      {/* Calculate button */}
      {!result && (
        <NeuButton
          variant="accent"
          size="lg"
          fullWidth
          icon={<Navigation size={18} />}
          onClick={handleCalculateRoute}
          disabled={!startCoord || !destCoord}
        >
          Find Flood-Safe Route
        </NeuButton>
      )}

      {/* ===== RESULTS ===== */}
      {step === "result" && result && (
        <div className="flex flex-col gap-4 nm-fade-in">

          {/* Error notice */}
          {error && (
            <div className="nm-alert nm-alert-warning rounded-xl">
              <Info size={14} color="#f59e0b" />
              <span className="nm-caption">{error}</span>
            </div>
          )}

          {/* Route alternatives */}
          {result.routes && result.routes.length > 1 && (
            <NeuCard className="!p-4">
              <span className="nm-h3 text-[13px] mb-3 block">Route Alternatives</span>
              <div className="flex flex-col gap-2">
                {result.routes.map((route, i) => {
                  const isSelected = i === selectedRouteIdx;
                  const riskColor =
                    route.risk_level === "HIGH" ? "#ef4444" :
                    route.risk_level === "MEDIUM" ? "#f59e0b" : "#22c55e";
                  return (
                    <button
                      key={route.id}
                      onClick={() => setSelectedRouteIdx(i)}
                      className={clsx(
                        "flex items-center justify-between p-3 rounded-xl transition-all text-left",
                        isSelected
                          ? "nm-card-sm ring-1 ring-[var(--nm-accent)]/40"
                          : "nm-inset-sm"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {isSelected && <Check size={13} color="var(--nm-accent)" />}
                        {route.is_recommended && (
                          <span className="nm-badge nm-badge-safe text-[9px] px-1.5 py-0.5">BEST</span>
                        )}
                        <div>
                          <p className="nm-body text-[12px] font-semibold text-[var(--nm-text)]">
                            {route.name}
                          </p>
                          <p className="nm-caption">{route.distance_km.toFixed(1)} km · {route.duration_min.toFixed(0)} min</p>
                        </div>
                      </div>
                      <RiskBadge level={route.risk_level} small />
                    </button>
                  );
                })}
              </div>
            </NeuCard>
          )}

          {/* Selected route summary */}
          {selectedRoute && (
            <>
              {/* Hero summary card */}
              <div
                className="nm-card-lg p-5"
                style={{
                  background:
                    selectedRoute.is_impassable
                      ? "linear-gradient(135deg, rgba(239,68,68,0.08), rgba(220,38,38,0.04))"
                      : selectedRoute.risk_level === "HIGH"
                      ? "linear-gradient(135deg, rgba(245,158,11,0.08), rgba(245,158,11,0.04))"
                      : "linear-gradient(135deg, rgba(22,163,74,0.08), rgba(22,163,74,0.04))",
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      {selectedRoute.is_impassable ? (
                        <AlertTriangle size={16} color="#ef4444" />
                      ) : (
                        <Shield size={16} color="#22c55e" />
                      )}
                      <span className="nm-h3">
                        {selectedRoute.is_impassable ? "Route Impassable" : "Flood-Safe Route"}
                      </span>
                    </div>
                    <p className="nm-caption mt-1">
                      {result.origin_name} → {result.destination_name}
                    </p>
                  </div>
                  <RiskBadge level={selectedRoute.risk_level} />
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <MetricTile
                    label="Distance"
                    value={selectedRoute.distance_km.toFixed(1)}
                    unit="km"
                    className="!p-3 !gap-1"
                  />
                  <MetricTile
                    label="Est. Time"
                    value={Math.ceil(selectedRoute.duration_min)}
                    unit="min"
                    className="!p-3 !gap-1"
                    accentColor={selectedRoute.duration_min > selectedRoute.base_duration_min * 1.3 ? "#f59e0b" : undefined}
                  />
                  <MetricTile
                    label="Max Depth"
                    value={selectedRoute.max_flood_depth_cm.toFixed(0)}
                    unit="cm"
                    className="!p-3 !gap-1"
                    accentColor={
                      selectedRoute.max_flood_depth_cm >= 60 ? "#ef4444" :
                      selectedRoute.max_flood_depth_cm >= 25 ? "#f59e0b" : "#22c55e"
                    }
                  />
                </div>

                {/* Route segment color bar */}
                {selectedRoute.segments && selectedRoute.segments.length > 0 && (
                  <div>
                    <span className="nm-caption mb-2 block">Route Conditions</span>
                    <RouteSegmentBar
                      segments={selectedRoute.segments.map((s) => ({
                        status: s.segment_status,
                        lengthKm: s.distance_km,
                      }))}
                      totalKm={selectedRoute.distance_km}
                    />
                    <div className="flex items-center gap-4 mt-2">
                      {[
                        { color: "#22c55e", label: "Clear" },
                        { color: "#f59e0b", label: "Slow" },
                        { color: "#ef4444", label: "Blocked" },
                      ].map(({ color, label }) => (
                        <div key={label} className="flex items-center gap-1">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                          <span className="nm-caption text-[9px]">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Advisory */}
              {selectedRoute.advisory && (
                <div className="nm-alert nm-alert-info rounded-xl">
                  <Info size={14} color="#0ea5e9" className="shrink-0 mt-0.5" />
                  <div>
                    <p className="nm-h3 text-[12px] text-[#0284c7]">Route Advisory</p>
                    <p className="nm-body text-[12px] mt-0.5">{selectedRoute.advisory}</p>
                  </div>
                </div>
              )}

              {/* Hazards avoided */}
              {selectedRoute.hazards_avoided && selectedRoute.hazards_avoided.length > 0 && (
                <NeuCard className="!p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Shield size={14} color="#22c55e" />
                    <span className="nm-h3 text-[13px]">
                      {selectedRoute.hazards_avoided.length} Hazard{selectedRoute.hazards_avoided.length !== 1 ? "s" : ""} Avoided
                    </span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {selectedRoute.hazards_avoided.map((h, i) => (
                      <div key={i} className="flex items-start gap-2 p-2.5 nm-inset-sm rounded-xl">
                        <AlertTriangle size={13} color="#f59e0b" className="shrink-0 mt-0.5" />
                        <div>
                          <p className="nm-body text-[12px] font-semibold text-[var(--nm-text)]">{h.name}</p>
                          <p className="nm-caption">{h.water_depth_cm.toFixed(0)} cm flood depth</p>
                          {h.reason && <p className="nm-caption opacity-80 mt-0.5">{h.reason}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </NeuCard>
              )}

              {/* Segments breakdown */}
              {selectedRoute.segments && selectedRoute.segments.length > 0 && (
                <NeuCard className="!p-4">
                  <span className="nm-h3 text-[13px] mb-3 block">Segment Breakdown</span>
                  <div className="flex flex-col gap-2">
                    {selectedRoute.segments.map((seg, i) => {
                      const segColor =
                        seg.segment_status === "SUBMERGED" ? "#ef4444" :
                        seg.segment_status === "SLOW" ? "#f59e0b" : "#22c55e";
                      return (
                        <div key={i} className="flex items-center gap-3 py-2 border-b border-[var(--nm-border)] last:border-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: segColor }} />
                          <div className="flex-1 min-w-0">
                            <p className="nm-caption font-semibold text-[var(--nm-text)] truncate">
                              {seg.from_name} → {seg.to_name}
                            </p>
                            <p className="nm-caption">
                              {seg.distance_km.toFixed(1)} km · {seg.water_depth_cm.toFixed(0)} cm depth
                            </p>
                          </div>
                          <span
                            className="nm-badge text-[9px] px-1.5 py-0.5 shrink-0"
                            style={{
                              background: `${segColor}15`,
                              color: segColor,
                              border: `1px solid ${segColor}35`,
                            }}
                          >
                            {seg.segment_status.replace("_", " ")}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </NeuCard>
              )}
            </>
          )}

          {/* Reset */}
          <NeuButton variant="default" size="md" fullWidth onClick={handleReset}>
            Plan Another Route
          </NeuButton>

          {/* Disclaimer */}
          <div className="nm-inset rounded-xl px-4 py-3">
            <p className="nm-caption text-[11px]">
              ⚠️ Routes are <strong>flood-risk estimates</strong> based on simulation data. Conditions may change rapidly. Always follow official BMC/NDMA guidance during active flood events.
            </p>
          </div>
        </div>
      )}

      {/* Idle empty state */}
      {step === "idle" && !result && (
        <EmptyState
          icon={<Navigation size={28} />}
          title="Find a Safe Path"
          message="Select your start and destination to calculate the least-flooded route through Mumbai."
          action={{ label: "Pick Start Location", onClick: () => setStep("picking-start") }}
        />
      )}
    </div>
  );
}

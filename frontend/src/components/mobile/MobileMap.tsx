"use client";

import React, { useState, useRef, useEffect, Suspense } from "react";
import { clsx } from "clsx";
import dynamic from "next/dynamic";
import {
  Layers, ZoomIn, ZoomOut, Crosshair, Map as MapIcon, Navigation,
  ChevronDown, Info, X, Droplets, AlertTriangle, Route as RouteIcon,
  Radio, ShieldCheck, Shield, Eye,
} from "lucide-react";
import { NeuButton, NeuIconButton, NeuCard } from "./ui/NeuPrimitives";
import { RiskBadge, DataStatusBadge, MetricTile, Skeleton } from "./ui/NeuComponents";
import { BottomSheet, MapControlsPanel } from "./ui/NeuInteractive";
import { SimulationResponse, SimulationRequest, ComponentTelemetry } from "../../lib/types";
import { LiveTelemetry } from "../../lib/api";

// Dynamically import the existing DeckGL map — preserves all existing rendering
const DeckGLMapView = dynamic(
  () => import("../DeckGLMapView").then((m) => m.DeckGLMapView),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#0f172a]">
        <div className="flex flex-col items-center gap-3">
          <div className="nm-skeleton rounded-xl" style={{ width: 48, height: 48 }} />
          <span className="text-slate-400 text-sm">Loading 3D Map…</span>
        </div>
      </div>
    ),
  }
);

interface MobileMapProps {
  simResult: SimulationResponse | null;
  simParams: SimulationRequest;
  liveTelemetry: LiveTelemetry | null;
  onOpenRoute: () => void;
}

export function MobileMap({ simResult, simParams, liveTelemetry, onOpenRoute }: MobileMapProps) {
  const [selectedComponent, setSelectedComponent] = useState<ComponentTelemetry | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [viewMode, setViewMode] = useState<"2D" | "3D">("3D");

  const rainfall = liveTelemetry?.rainfall_mm_hr ?? simParams.rainfall_mm_hr ?? 0;
  const hotspots = simResult?.critical_hotspots_count ?? 0;

  function handleComponentSelect(comp: ComponentTelemetry | null) {
    setSelectedComponent(comp);
    if (comp) setIsSheetOpen(true);
  }

  const mapControls = [
    {
      id: "legend",
      icon: <Eye size={15} />,
      label: "Legend",
      active: showLegend,
      onPress: () => setShowLegend(!showLegend),
    },
    {
      id: "route",
      icon: <Navigation size={15} />,
      label: "Safe Route",
      onPress: onOpenRoute,
    },
  ];

  return (
    <div className="relative w-full" style={{ height: "100dvh" }}>
      {/* Full-screen Deck.gl Map — the existing 3D digital twin */}
      <div className="absolute inset-0">
        <DeckGLMapView
          components={simResult?.components || []}
          selectedComponentId={selectedComponent?.component_id || null}
          onSelectComponent={handleComponentSelect}
          viewMode={viewMode}
          rainfall_mm_hr={simParams.rainfall_mm_hr}
          tide_level_m={simParams.tide_level_m}
        />
      </div>

      {/* ===== TOP STATUS BAR ===== */}
      <div
        className="absolute top-0 left-0 right-0 z-20 px-3 pt-3 pb-2 flex items-center justify-between"
        style={{ background: "linear-gradient(180deg, rgba(15,23,42,0.8) 0%, transparent 100%)" }}
      >
        <div className="flex items-center gap-2">
          <div
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-white flex items-center gap-1.5"
            style={{ background: "rgba(15,23,42,0.7)", backdropFilter: "blur(8px)" }}
          >
            <MapIcon size={12} color="#0ea5e9" />
            Mumbai Digital Twin
          </div>
          {hotspots > 0 && (
            <div
              className="px-2 py-1 rounded-lg text-[10px] font-bold text-red-300 flex items-center gap-1"
              style={{ background: "rgba(239,68,68,0.25)", backdropFilter: "blur(8px)", border: "1px solid rgba(239,68,68,0.3)" }}
            >
              <AlertTriangle size={10} />
              {hotspots} critical
            </div>
          )}
        </div>
        {/* View toggle */}
        <button
          className="px-3 py-1.5 rounded-xl text-[11px] font-bold text-white"
          style={{ background: "rgba(15,23,42,0.7)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.15)" }}
          onClick={() => setViewMode(viewMode === "3D" ? "2D" : "3D")}
        >
          {viewMode}
        </button>
      </div>

      {/* ===== RIGHT CONTROLS PANEL ===== */}
      <div className="absolute right-3 top-1/3 z-20 flex flex-col gap-2">
        <MapControlsPanel controls={mapControls} />
      </div>

      {/* ===== BOTTOM QUICK INFO STRIP ===== */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 px-3 pb-4 pt-3"
        style={{ background: "linear-gradient(0deg, rgba(15,23,42,0.85) 0%, transparent 100%)" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-white/80">
              <Droplets size={12} color="#0ea5e9" />
              <span className="font-mono font-bold">{rainfall.toFixed(0)}</span>
              <span className="opacity-70">mm/h</span>
            </div>
            {liveTelemetry && (
              <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE
              </div>
            )}
          </div>
          <button
            className="px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5"
            style={{
              background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
              boxShadow: "0 2px 12px rgba(14,165,233,0.4)",
            }}
            onClick={onOpenRoute}
          >
            <Navigation size={13} />
            Safe Route
          </button>
        </div>

        {/* Tap location hint */}
        {!selectedComponent && (
          <p className="text-[10px] text-white/40 text-center mt-2">
            Tap any hotspot marker to view details
          </p>
        )}
      </div>

      {/* ===== LEGEND OVERLAY ===== */}
      {showLegend && (
        <div
          className="absolute right-14 top-1/3 z-20 rounded-2xl p-3 flex flex-col gap-2 text-white"
          style={{
            background: "rgba(15,23,42,0.85)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.1)",
            minWidth: 140,
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-bold uppercase tracking-wider opacity-60">Legend</span>
            <button onClick={() => setShowLegend(false)}>
              <X size={12} opacity={0.6} />
            </button>
          </div>
          {[
            { label: "Flood-free", color: "#22c55e" },
            { label: "Partially flooded", color: "#f59e0b" },
            { label: "Submerged", color: "#ef4444" },
            { label: "Safe Route", color: "#0ea5e9" },
            { label: "Drain Channel", color: "#38bdf8" },
            { label: "Road Network", color: "#6366f1" },
          ].map(({ label, color }) => (
            <div key={label} className="flex items-center gap-2 text-[11px]">
              <div className="w-3 h-3 rounded-sm shrink-0" style={{ background: color }} />
              <span className="opacity-80">{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ===== COMPONENT DETAIL SHEET ===== */}
      <BottomSheet
        isOpen={isSheetOpen}
        onClose={() => { setIsSheetOpen(false); setSelectedComponent(null); }}
        title={selectedComponent?.name ?? "Location Details"}
        initialSnap="half"
      >
        {selectedComponent && (
          <div className="flex flex-col gap-4 nm-fade-in">
            {/* Status badges */}
            <div className="flex flex-wrap items-center gap-2">
              <RiskBadge
                level={
                  selectedComponent.failure_risk_score >= 70 ? "HIGH" :
                  selectedComponent.failure_risk_score >= 40 ? "MEDIUM" : "LOW"
                }
              />
              <span className="nm-badge nm-badge-unavailable" style={{ textTransform: "none", letterSpacing: 0 }}>
                {selectedComponent.component_type}
              </span>
              <span className="nm-caption">Ward {selectedComponent.ward}</span>
            </div>

            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-3">
              <MetricTile
                label="Flood Depth"
                value={selectedComponent.water_depth_cm.toFixed(0)}
                unit="cm"
                icon={<Droplets size={13} />}
                accentColor={
                  selectedComponent.water_depth_cm >= 60 ? "#ef4444" :
                  selectedComponent.water_depth_cm >= 25 ? "#f59e0b" : "#22c55e"
                }
              />
              <MetricTile
                label="Health Score"
                value={`${selectedComponent.health_score}%`}
                icon={<Shield size={13} />}
                accentColor={
                  selectedComponent.health_score < 40 ? "#ef4444" :
                  selectedComponent.health_score < 65 ? "#f59e0b" : "#22c55e"
                }
              />
              <MetricTile
                label="Failure Risk"
                value={`${selectedComponent.failure_risk_score}%`}
                icon={<AlertTriangle size={13} />}
                accentColor={
                  selectedComponent.failure_risk_score >= 70 ? "#ef4444" :
                  selectedComponent.failure_risk_score >= 40 ? "#f59e0b" : "#22c55e"
                }
              />
              <MetricTile
                label="Traffic"
                value={selectedComponent.traffic_speed_kmh.toFixed(0)}
                unit="km/h"
                icon={<RouteIcon size={13} />}
                accentColor="#0ea5e9"
              />
            </div>

            {/* Recommended action */}
            {selectedComponent.recommended_action && (
              <div className="nm-alert nm-alert-info rounded-xl">
                <Info size={14} color="#0ea5e9" className="shrink-0 mt-0.5" />
                <div>
                  <p className="nm-h3 text-[12px] text-[#0284c7]">Recommended Action</p>
                  <p className="nm-body text-[12px] mt-1">{selectedComponent.recommended_action}</p>
                </div>
              </div>
            )}

            {/* Cascading impact */}
            {selectedComponent.cascading_impact_summary && (
              <div className="nm-inset rounded-xl p-3">
                <p className="nm-caption mb-1 font-semibold">CASCADE IMPACT</p>
                <p className="nm-body text-[12px]">{selectedComponent.cascading_impact_summary}</p>
              </div>
            )}

            {/* Coordinates */}
            <div className="flex items-center gap-2 nm-caption">
              <Crosshair size={10} />
              <span>{selectedComponent.latitude.toFixed(4)}°N, {selectedComponent.longitude.toFixed(4)}°E</span>
              <span className="opacity-50">·</span>
              <span>{selectedComponent.elevation_m.toFixed(1)}m elev.</span>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}

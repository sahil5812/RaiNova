"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { Navbar } from "../components/Navbar";
import { SubNavbar, SubNavTab } from "../components/SubNavbar";
import { WeatherPortalView } from "../components/WeatherPortalView";
import { EarlyWarningBanner } from "../components/EarlyWarningBanner";
import { ScenarioControls } from "../components/ScenarioControls";
import { DeckGLMapView } from "../components/DeckGLMapView";
import { ComponentInspector } from "../components/ComponentInspector";
import { runSimulation, fetchCascadingGraph, fetchLiveTelemetry, LiveTelemetry } from "../lib/api";
import { SimulationRequest, SimulationResponse, ComponentTelemetry, CascadingGraphResponse } from "../lib/types";
import { useLanguage } from "../lib/i18n/LanguageContext";
import { GitBranch, Trophy, Sliders, X, Minimize2, MapPin, AlertTriangle } from "lucide-react";

// Dynamic code-splitting for heavy modals to reduce initial JS bundle size and parse time
const CascadingGraphView = dynamic(
  () => import("../components/CascadingGraphView").then((mod) => mod.CascadingGraphView),
  { ssr: false }
);
const PriorityMatrix = dynamic(
  () => import("../components/PriorityMatrix").then((mod) => mod.PriorityMatrix),
  { ssr: false }
);
const CitizenReportModal = dynamic(
  () => import("../components/CitizenReportModal").then((mod) => mod.CitizenReportModal),
  { ssr: false }
);

export default function Home() {
  const { t, language } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [viewMode, setViewMode] = useState<"2D" | "3D">("3D");
  const [isGraphModalOpen, setIsGraphModalOpen] = useState(false);
  const [isPriorityModalOpen, setIsPriorityModalOpen] = useState(false);
  const [isCitizenModalOpen, setIsCitizenModalOpen] = useState(false);
  const [isScenarioControlsOpen, setIsScenarioControlsOpen] = useState(false);
  const [leftDockTab, setLeftDockTab] = useState<"SANDBOX" | "HOTSPOTS">("SANDBOX");
  const [isLoading, setIsLoading] = useState(false);

  // Sub-Navbar Active Tab State
  const [activeSubNavTab, setActiveSubNavTab] = useState<SubNavTab>("TODAY");

  // Portal View Mode ("MAP" for 3D digital twin map by default, "PORTAL" for weather dashboard)
  const [portalViewMode, setPortalViewMode] = useState<"PORTAL" | "MAP">("MAP");

  // Top Navbar auto-hide on scroll state (active only in Weather Portal mode)
  // In 3D Twin Map mode, Navbar is ALWAYS visible and never hidden
  const [isNavbarVisible, setIsNavbarVisible] = useState(true);

  // 0-3h Timeline Selection State
  const [selectedTimelineIndex, setSelectedTimelineIndex] = useState<number>(0);

  // Live Mode State
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [liveTelemetry, setLiveTelemetry] = useState<LiveTelemetry | null>(null);

  // Simulation State - Starts with Clear Sky (No Rain) Baseline
  const [simParams, setSimParams] = useState<SimulationRequest>({
    rainfall_mm_hr: 0.0,
    tide_level_m: 2.4,
    siltation_pct: 25.0,
    active_scenario_name: "Clear Weather Baseline",
  });

  const [simResult, setSimResult] = useState<SimulationResponse | null>(null);
  const [graphData, setGraphData] = useState<CascadingGraphResponse | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<ComponentTelemetry | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initial Load & Param Change Simulation
  const triggerSimulation = useCallback(async (params: SimulationRequest) => {
    setIsLoading(true);
    try {
      const res = await runSimulation(params);
      setSimResult(res);
      setSelectedTimelineIndex(0);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mounted) return;
    triggerSimulation(simParams);
    fetchCascadingGraph().then(setGraphData).catch(console.error);
    fetchLiveTelemetry().then(setLiveTelemetry).catch(console.error);
  }, [mounted]);

  // Live Telemetry Polling (Every 60s when LIVE ON)
  useEffect(() => {
    if (!mounted || !isLiveMode) return;

    let isSubscribed = true;

    const syncLive = async () => {
      try {
        const live = await fetchLiveTelemetry();
        if (live && isSubscribed) {
          setLiveTelemetry(live);
          const peakRain = live.citywide_max_rain_mm_hr ?? live.rainfall_mm_hr ?? 0;
          const activeScenarioName = live.primary_active_zone
            ? `Live Weather (${live.primary_active_zone.zone_name})`
            : "Real-Time Live Weather";
          const newP: SimulationRequest = {
            rainfall_mm_hr: peakRain,
            tide_level_m: live.tide_level_m || 2.8,
            siltation_pct: simParams.siltation_pct,
            active_scenario_name: activeScenarioName,
          };
          setSimParams(newP);
          triggerSimulation(newP);
        }
      } catch (e) {
        console.error("Live sync notice:", e);
      }
    };

    syncLive();
    const interval = setInterval(syncLive, 60000);

    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, [mounted, isLiveMode]);

  const simTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (simTimeoutRef.current) clearTimeout(simTimeoutRef.current);
    };
  }, []);

  const handleToggleLiveMode = useCallback(() => {
    setIsLiveMode((prev) => !prev);
  }, []);

  const handleParamChange = useCallback((newParams: SimulationRequest) => {
    setSimParams(newParams);
    if (simTimeoutRef.current) {
      clearTimeout(simTimeoutRef.current);
    }
    simTimeoutRef.current = setTimeout(() => {
      triggerSimulation(newParams);
    }, 150);
  }, [triggerSimulation]);

  const handleApplyPreset = useCallback((presetName: string, rain: number, tide: number, silt: number) => {
    if (simTimeoutRef.current) {
      clearTimeout(simTimeoutRef.current);
    }
    const newP: SimulationRequest = {
      rainfall_mm_hr: rain,
      tide_level_m: tide,
      siltation_pct: silt,
      active_scenario_name: presetName,
    };
    setSimParams(newP);
    triggerSimulation(newP);
  }, [triggerSimulation]);

  const handleSelectComponentById = useCallback((id: string) => {
    if (!simResult) return;
    const found = simResult.components.find((c) => c.component_id === id);
    if (found) {
      setSelectedComponent(found);
    }
  }, [simResult]);

  const handleToggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === "2D" ? "3D" : "2D"));
  }, []);

  const handleOpenCitizenModal = useCallback(() => {
    setIsCitizenModalOpen(true);
  }, []);

  const handleCloseCitizenModal = useCallback(() => {
    setIsCitizenModalOpen(false);
  }, []);

  const handleOpenPriorityModal = useCallback(() => {
    setIsPriorityModalOpen(true);
  }, []);

  const handleClosePriorityModal = useCallback(() => {
    setIsPriorityModalOpen(false);
  }, []);

  const handleOpenGraphModal = useCallback(() => {
    setIsGraphModalOpen(true);
  }, []);

  const handleCloseGraphModal = useCallback(() => {
    setIsGraphModalOpen(false);
  }, []);

  const handleResetSimulation = useCallback(() => {
    handleApplyPreset("Normal Monsoon", 35, 2.5, 20);
  }, [handleApplyPreset]);

  const handleTogglePortalViewMode = useCallback(() => {
    setPortalViewMode((prev) => {
      const nextMode = prev === "PORTAL" ? "MAP" : "PORTAL";
      setActiveSubNavTab(nextMode === "MAP" ? "RADAR" : "TODAY");
      return nextMode;
    });
  }, []);

  const handleSubNavTabChange = useCallback((tab: SubNavTab) => {
    setActiveSubNavTab(tab);
    if (tab === "RADAR") {
      setPortalViewMode("MAP");
      setIsScenarioControlsOpen(true);
    } else if (tab === "HOURLY" || tab === "10-DAY" || tab === "TODAY" || tab === "MINUTECAST") {
      setPortalViewMode("PORTAL");
    }
  }, []);

  const handleToggleScenarioControls = useCallback(() => {
    setIsScenarioControlsOpen((prev) => !prev);
  }, []);

  const handleOpenMapFromPortal = useCallback(() => {
    setPortalViewMode("MAP");
    setActiveSubNavTab("RADAR");
  }, []);

  const handleSelectComponent = useCallback((c: ComponentTelemetry) => {
    setSelectedComponent(c);
  }, []);

  const handleCloseComponentInspector = useCallback(() => {
    setSelectedComponent(null);
  }, []);

  const handleSelectTimelineStep = useCallback((idx: number) => {
    setSelectedTimelineIndex(idx);
  }, []);

  // Active Components to render on 3D Map (respects 0-3h timeline scrubber)
  const displayedComponents = useMemo(() => {
    if (simResult?.timeline_forecast && simResult.timeline_forecast[selectedTimelineIndex]) {
      return simResult.timeline_forecast[selectedTimelineIndex].components;
    }
    return simResult?.components || [];
  }, [simResult, selectedTimelineIndex]);

  // Derived Top High-Risk Inundation Hotspots for Left Command Dock
  const topHotspots = useMemo(() => {
    return [...displayedComponents]
      .filter((c) => c.component_type === "HOTSPOT" || (c.water_depth_cm || 0) > 5.0 || (c.failure_risk_score || 0) > 25.0)
      .sort((a, b) => (b.failure_risk_score || 0) - (a.failure_risk_score || 0))
      .slice(0, 4);
  }, [displayedComponents]);

  // Reset Navbar visibility on tab change or mode change
  useEffect(() => {
    setIsNavbarVisible(true);
  }, [activeSubNavTab, portalViewMode]);

  // Auto-hide Navbar on scroll down, show on scroll up (ONLY in Weather Portal mode)
  // When in 3D Twin Map mode ("MAP"), Navbar is ALWAYS visible and never hidden.
  useEffect(() => {
    if (portalViewMode === "MAP") {
      setIsNavbarVisible(true);
      return;
    }

    let lastScrollTop = 0;
    let ticking = false;

    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement | Document | null;
      let currentScrollTop = 0;

      if (target && "scrollTop" in target && typeof (target as HTMLElement).scrollTop === "number") {
        const el = target as HTMLElement;
        // Ignore small modals/flyouts
        if (el.clientHeight < 200) return;
        currentScrollTop = el.scrollTop;
      } else if (typeof window !== "undefined") {
        currentScrollTop = window.scrollY || document.documentElement?.scrollTop || 0;
      }

      if (!ticking) {
        window.requestAnimationFrame(() => {
          const delta = currentScrollTop - lastScrollTop;

          // Always show when near the very top (<= 30px)
          if (currentScrollTop <= 30) {
            setIsNavbarVisible(true);
          } else if (delta > 8 && currentScrollTop > 60) {
            // Scrolling down past threshold: hide navbar
            setIsNavbarVisible(false);
          } else if (delta < -8) {
            // Scrolling up: show navbar
            setIsNavbarVisible(true);
          }

          lastScrollTop = Math.max(0, currentScrollTop);
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, [portalViewMode]);

  if (!mounted) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center text-slate-400 font-mono text-xs select-none">
        INITIALIZING DIGITAL TWIN...
      </div>
    );
  }

  return (
    <main className="h-screen w-screen bg-transparent text-slate-100 flex flex-col font-sans overflow-hidden">
      {/* Top Tactical Command Header (Unified 56px Single Bar) */}
      <Navbar
        viewMode={viewMode}
        onToggleViewMode={handleToggleViewMode}
        disruptionSeverity={simResult?.city_summary.disruption_severity || "NORMAL"}
        overallHealth={simResult?.city_summary.overall_infrastructure_health || 85}
        highTideWarning={simResult?.city_summary.high_tide_warning || false}
        onOpenCitizenModal={handleOpenCitizenModal}
        onResetSimulation={handleResetSimulation}
        isLiveMode={isLiveMode}
        onToggleLiveMode={handleToggleLiveMode}
        liveTelemetry={liveTelemetry}
        portalViewMode={portalViewMode}
        isVisible={portalViewMode === "MAP" ? true : isNavbarVisible}
        onTogglePortalViewMode={handleTogglePortalViewMode}
      />

      {/* Weather / Nowcasting Sub-Navbar - ONLY rendered when in Weather Portal mode! */}
      {portalViewMode === "PORTAL" && (
        <SubNavbar
          activeTab={activeSubNavTab}
          onTabChange={handleSubNavTabChange}
          onOpenPriorityModal={handleOpenPriorityModal}
          onOpenGraphModal={handleOpenGraphModal}
          onToggleScenarioControls={handleToggleScenarioControls}
          isLiveMode={isLiveMode}
          viewModeType={portalViewMode}
          onToggleViewModeType={handleTogglePortalViewMode}
        />
      )}

      {/* Main Viewport: Either Full Weather Portal Dashboard OR 3D Digital Twin Map */}
      {portalViewMode === "PORTAL" ? (
        <div className="flex-1 min-h-0 relative w-full overflow-hidden bg-transparent">
          <WeatherPortalView
            currentRainfallMmHr={simParams.rainfall_mm_hr}
            currentTideLevelM={simParams.tide_level_m}
            liveTelemetry={liveTelemetry}
            activeTab={activeSubNavTab}
            onSimulateScenario={handleApplyPreset}
            onOpenMap={handleOpenMapFromPortal}
            onOpenPriorityModal={handleOpenPriorityModal}
          />
        </div>
      ) : (
        <div className="flex-1 relative w-full overflow-hidden">
          {/* Full-Screen Background Deck.gl 3D Digital Twin Map (~90% Unobstructed Viewport) */}
          <DeckGLMapView
            components={displayedComponents}
            selectedComponentId={selectedComponent?.component_id || null}
            onSelectComponent={handleSelectComponent}
            viewMode={viewMode}
            rainfall_mm_hr={simParams.rainfall_mm_hr}
            tide_level_m={simParams.tide_level_m}
          />

          {/* Unified Left Slide-out Command Deck (Sandbox + High-Risk Hotspots) */}
          <div className="absolute top-16 left-4 z-20 flex flex-col items-start gap-2">
            {isScenarioControlsOpen ? (
              <div
                className="w-[460px] max-h-[calc(100vh-180px)] flex flex-col glass-panel rounded-3xl border border-white/15 shadow-[0_24px_50px_rgba(0,0,0,0.7)] backdrop-blur-2xl overflow-hidden animate-fadeIn"
                style={{ position: "relative", bottom: "50px", width: "460px" }}
              >
                {/* Header with Segmented Tab */}
                <div className="flex items-center justify-between p-2.5 border-b border-white/10 bg-white/[0.02]">
                  <div className="flex items-center gap-1 bg-white/[0.06] p-1 rounded-xl border border-white/10">
                    <button
                      type="button"
                      onClick={() => setLeftDockTab("SANDBOX")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        leftDockTab === "SANDBOX"
                          ? "bg-amber-400 text-black shadow-md border border-amber-300"
                          : "text-black/70 hover:text-black"
                      }`}
                      style={{ color: "black" }}
                    >
                      <Sliders className="w-3.5 h-3.5 text-black" style={{ color: "black" }} />
                      <span style={{ color: "black" }}>{t("tabSandbox", "Sandbox")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLeftDockTab("HOTSPOTS")}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                        leftDockTab === "HOTSPOTS"
                          ? "bg-red-400 text-black shadow-md border border-red-300"
                          : "text-black/70 hover:text-black"
                      }`}
                      style={{ color: "black" }}
                    >
                      <AlertTriangle className="w-3.5 h-3.5 text-black" style={{ color: "black" }} />
                      <span style={{ color: "black" }}>{t("tabHotspots", "Hotspots")} ({topHotspots.length})</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsScenarioControlsOpen(false); }}
                    className="p-1.5 rounded-xl glass-button text-slate-300 hover:text-white"
                    title="Minimize Command Dock"
                  >
                    <Minimize2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Content Body */}
                <div className="p-3 overflow-y-auto max-h-[calc(100vh-250px)] custom-scrollbar">
                  {leftDockTab === "SANDBOX" ? (
                    <ScenarioControls
                      params={simParams}
                      onChange={handleParamChange}
                      isLoading={isLoading}
                      onApplyPreset={handleApplyPreset}
                      timelineForecast={simResult?.timeline_forecast || []}
                      selectedTimelineIndex={selectedTimelineIndex}
                      onSelectTimelineStep={handleSelectTimelineStep}
                    />
                  ) : (
                    <div className="flex flex-col gap-2.5">
                      <div className="text-[11px] text-slate-400 font-mono mb-1">
                        {language === 'hi' ? 'उच्च जोखिम वाले सबवे एवं जलभराव स्थल:' : language === 'mr' ? 'अतिधोकादायक सबवे व पाणी साचण्याची ठिकाणे:' : 'High-Risk Subways & Chronic Inundation Nodes:'}
                      </div>
                      {topHotspots.map((zone) => (
                        <div
                          key={zone.component_id}
                          onClick={() => setSelectedComponent(zone)}
                          className={`glass-panel-subtle p-3 rounded-2xl border transition-all cursor-pointer hover:scale-[1.02] ${
                            selectedComponent?.component_id === zone.component_id
                              ? "border-cyan-400/80 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                              : "border-white/10 hover:border-amber-400/50"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-white text-xs flex items-center gap-1.5 truncate">
                              <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              {zone.name}
                            </span>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-lg border font-bold ${
                              zone.status === "CRITICAL"
                                ? "bg-red-500/20 text-red-300 border-red-400/40"
                                : "bg-amber-500/20 text-amber-300 border-amber-400/40"
                            }`}>
                              {zone.failure_risk_score}% {language === 'hi' ? 'जोखिम' : language === 'mr' ? 'धोका' : 'RISK'}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400">{t("wardLabel", "Ward")} {zone.ward} • Elev: +{zone.elevation_m}m</div>
                          <div className="flex items-center justify-between text-[10px] mt-2 font-mono text-cyan-300 border-t border-white/10 pt-1.5">
                            <span>{language === 'hi' ? 'गहराई' : language === 'mr' ? 'खोली' : 'Depth'}: <b className="text-white">{zone.water_depth_cm} cm</b></span>
                            <span>{language === 'hi' ? 'गति' : language === 'mr' ? 'वेग' : 'Speed'}: <b className="text-white">{zone.traffic_speed_kmh} km/h</b></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsScenarioControlsOpen(true); }}
                className="glass-button flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold text-black shadow-[0_16px_36px_rgba(0,0,0,0.5),inset_0_1px_1px_rgba(255,255,255,0.2)] hover:border-black/50 hover:text-black transition-all hover:scale-105"
                style={{ position: "relative", bottom: "50px", color: "black" }}
              >
                <Sliders className="w-4 h-4 text-black" style={{ color: "black" }} />
                <span style={{ color: "black" }}>{t("commandDeckTitle", "Command Deck & Hotspots")} ({topHotspots.length})</span>
              </button>
            )}
          </div>

          {/* Floating Right: Component Inspector Panel */}
          {selectedComponent && (
            <div
              className="absolute top-[68px] right-4 z-20 animate-fadeIn"
              style={{ position: "absolute", top: "68px" }}
            >
              <ComponentInspector
                component={selectedComponent}
                onClose={handleCloseComponentInspector}
              />
            </div>
          )}

          {/* Floating Action Bar: Cascading Failure Graph */}
          <div className="absolute bottom-11 left-1/2 -translate-x-1/2 z-20 flex items-center gap-3 glass-panel p-2 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.6),inset_0_1px_1px_rgba(255,255,255,0.2)] border border-white/15">
            <button
              type="button"
              onClick={handleOpenGraphModal}
              className="glass-button flex items-center gap-2.5 px-4 py-2 rounded-xl text-xs font-bold text-purple-200 shadow-[0_0_16px_rgba(168,85,247,0.25),inset_0_1px_0_rgba(255,255,255,0.18)] border border-purple-500/40 hover:scale-105 transition-all"
            >
              <GitBranch className="w-4 h-4 text-purple-400" />
              <span>{language === 'hi' ? 'कैस्केडिंग विफलता ग्राफ' : language === 'mr' ? 'कॅस्केडिंग फॉल्ट आलेख' : 'Cascading Failure Graph'}</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-500/25 text-purple-200 font-mono text-[10px] font-bold border border-purple-400/30">
                {graphData?.total_impacted_nodes || 4}
              </span>
            </button>
          </div>

          {/* Bottom Live Radar Telemetry Ticker (Idea 3: Slim Bloomberg Ticker) */}
          <div className="absolute bottom-0 left-0 right-0 z-20">
            <EarlyWarningBanner
              telemetry={liveTelemetry}
              components={displayedComponents}
              currentRainfallMmHr={simParams.rainfall_mm_hr}
              onSimulateRainfall={(rain) => handleApplyPreset("Incoming Storm (+30m Nowcast)", rain, 4.1, 45)}
              onSelectComponent={handleSelectComponent}
            />
          </div>
        </div>
      )}

      {/* Cascading Failure Graph Modal Overlay */}
      {isGraphModalOpen && graphData && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xl z-50 flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div className="glass-modal rounded-3xl p-6 w-full max-w-5xl shadow-[0_25px_60px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.2)] text-slate-100 flex flex-col gap-4 max-h-[90vh] border border-white/15">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-purple-400 font-bold">
                <GitBranch className="w-5 h-5 drop-shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                <h3 className="text-sm uppercase tracking-wider text-white glass-text-glow">
                  Infrastructure Graph Cascading Failure Explorer
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseGraphModal}
                className="glass-button p-1.5 rounded-xl text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <CascadingGraphView
                graphData={graphData}
                components={displayedComponents}
                selectedNodeId={selectedComponent?.component_id || null}
                rainfallMmHr={simParams.rainfall_mm_hr}
                siltationPct={simParams.siltation_pct}
                onSelectNode={handleSelectComponentById}
                onCloseAndFocus={(id) => {
                  handleSelectComponentById(id);
                  handleCloseGraphModal();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* SIH Priority Queue Modal Overlay */}
      {isPriorityModalOpen && simResult && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xl z-50 flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
          <div className="glass-modal rounded-3xl p-6 w-full max-w-5xl shadow-[0_25px_60px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.2)] text-slate-100 flex flex-col gap-4 max-h-[90vh] border border-white/15">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <Trophy className="w-5 h-5 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                <h3 className="text-sm uppercase tracking-wider text-white glass-text-glow">
                  SIH Multi-Sector Priority Repair & Dispatch Matrix
                </h3>
              </div>
              <button
                type="button"
                onClick={handleClosePriorityModal}
                className="glass-button p-1.5 rounded-xl text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <PriorityMatrix
                priorities={simResult.top_priorities}
                onSelectHotspot={(id) => {
                  handleSelectComponentById(id);
                  handleClosePriorityModal();
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Citizen Grievance Reporting Modal */}
      <CitizenReportModal
        isOpen={isCitizenModalOpen}
        onClose={handleCloseCitizenModal}
      />
    </main>
  );
}

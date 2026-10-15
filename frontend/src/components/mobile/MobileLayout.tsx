"use client";

import React, { useState } from "react";
import { clsx } from "clsx";
import { Home, Map, CloudRain, Navigation, Bell, Settings } from "lucide-react";
import { MobileBackground } from "./MobileBackground";
import { MobileHome } from "./MobileHome";
import { MobileMap } from "./MobileMap";
import { MobileForecast } from "./MobileForecast";
import { MobileRoute } from "./MobileRoute";
import { MobileAlerts } from "./MobileAlerts";

export type MobileTab = "HOME" | "MAP" | "FORECAST" | "ROUTE" | "ALERTS";

interface MobileLayoutProps {
  // Passed from parent page.tsx
  simResult: any;
  simParams: any;
  liveTelemetry: any;
  isLoading: boolean;
  onSimulateScenario: (name: string, rain: number, tide: number, silt: number) => void;
  onTriggerSimulation: (params: any) => void;
}

const NAV_ITEMS: { id: MobileTab; label: string; icon: React.ComponentType<any> }[] = [
  { id: "HOME", label: "Home", icon: Home },
  { id: "MAP", label: "Live Map", icon: Map },
  { id: "FORECAST", label: "Forecast", icon: CloudRain },
  { id: "ROUTE", label: "Routes", icon: Navigation },
  { id: "ALERTS", label: "Alerts", icon: Bell },
];

export function MobileLayout({
  simResult,
  simParams,
  liveTelemetry,
  isLoading,
  onSimulateScenario,
  onTriggerSimulation,
}: MobileLayoutProps) {
  const [activeTab, setActiveTab] = useState<MobileTab>("HOME");
  const [alertCount] = useState(
    simResult?.top_priorities?.length ?? 0
  );

  function renderScreen() {
    switch (activeTab) {
      case "HOME":
        return (
          <MobileHome
            simResult={simResult}
            simParams={simParams}
            liveTelemetry={liveTelemetry}
            isLoading={isLoading}
            onOpenMap={() => setActiveTab("MAP")}
            onOpenRoute={() => setActiveTab("ROUTE")}
            onOpenForecast={() => setActiveTab("FORECAST")}
            onOpenAlerts={() => setActiveTab("ALERTS")}
            onSimulateScenario={onSimulateScenario}
          />
        );
      case "MAP":
        return (
          <MobileMap
            simResult={simResult}
            simParams={simParams}
            liveTelemetry={liveTelemetry}
            onOpenRoute={() => setActiveTab("ROUTE")}
          />
        );
      case "FORECAST":
        return (
          <MobileForecast
            simResult={simResult}
            simParams={simParams}
            liveTelemetry={liveTelemetry}
            isLoading={isLoading}
            onTriggerSimulation={onTriggerSimulation}
          />
        );
      case "ROUTE":
        return (
          <MobileRoute
            simResult={simResult}
            simParams={simParams}
          />
        );
      case "ALERTS":
        return (
          <MobileAlerts
            simResult={simResult}
            liveTelemetry={liveTelemetry}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="nm-mobile-container">
      {/* Neumorphic atmospheric background */}
      <MobileBackground />

      {/* Main scrollable content area */}
      <main
        className="flex-1 overflow-y-auto overflow-x-hidden nm-scroll"
        style={{ paddingBottom: "calc(68px + env(safe-area-inset-bottom))" }}
      >
        {renderScreen()}
      </main>

      {/* Bottom Navigation Bar */}
      <nav
        className="nm-bottom-nav fixed bottom-0 left-0 right-0 z-30 flex items-center nm-safe-bottom"
        style={{ height: "calc(60px + env(safe-area-inset-bottom))" }}
      >
        {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          const hasAlert = id === "ALERTS" && alertCount > 0;
          return (
            <button
              key={id}
              className={clsx("nm-nav-item relative", isActive && "active")}
              onClick={() => setActiveTab(id)}
              aria-label={label}
              aria-current={isActive ? "page" : undefined}
            >
              <div className={clsx("nm-nav-icon", isActive && "active")}>
                <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className="nm-nav-label">{label}</span>
              {/* Alert dot */}
              {hasAlert && !isActive && (
                <span className="absolute top-1 right-[calc(50%-16px)] w-2 h-2 bg-[var(--nm-high)] rounded-full ring-1 ring-[var(--nm-bg)]" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

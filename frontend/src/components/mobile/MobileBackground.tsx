"use client";

import React from "react";

/**
 * RaiNOva Neumorphic Mobile Background
 * Soft mist-grey base with subtle topographic, hydrological motifs.
 * Replaces the WebGL Ocean shader on mobile screens.
 */
export function MobileBackground() {
  return (
    <div className="nm-background" aria-hidden="true">
      {/* SVG topographic overlay */}
      <div className="nm-topo-overlay" />

      {/* Soft atmospheric glow — top-left */}
      <div
        style={{
          position: "absolute",
          top: "-10%",
          left: "-5%",
          width: "65%",
          height: "55%",
          background:
            "radial-gradient(ellipse at 30% 30%, rgba(186, 215, 235, 0.38) 0%, rgba(186, 215, 235, 0.1) 45%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Soft atmospheric glow — bottom-right */}
      <div
        style={{
          position: "absolute",
          bottom: "5%",
          right: "-10%",
          width: "55%",
          height: "50%",
          background:
            "radial-gradient(ellipse at 65% 65%, rgba(147, 197, 253, 0.22) 0%, rgba(147, 197, 253, 0.06) 50%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Subtle centre warmth */}
      <div
        style={{
          position: "absolute",
          top: "35%",
          left: "20%",
          right: "20%",
          height: "30%",
          background:
            "radial-gradient(ellipse at center, rgba(226, 235, 246, 0.3) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Hydrological flow hint — SVG wave lines at bottom */}
      <svg
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          opacity: 0.04,
          pointerEvents: "none",
        }}
        width="100%"
        height="180"
        viewBox="0 0 400 180"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M0 120 Q50 90 100 120 T200 120 T300 120 T400 120 V180 H0 Z"
          fill="#2563eb"
          opacity="0.3"
        />
        <path
          d="M0 140 Q60 110 120 140 T240 140 T360 140 T400 140 V180 H0 Z"
          fill="#0ea5e9"
          opacity="0.2"
        />
        <path
          d="M0 158 Q70 132 140 158 T280 158 T400 158 V180 H0 Z"
          fill="#38bdf8"
          opacity="0.15"
        />
      </svg>

      {/* Subtle elevation contour dots */}
      <svg
        style={{
          position: "absolute",
          top: "10%",
          right: "5%",
          opacity: 0.025,
          pointerEvents: "none",
        }}
        width="160"
        height="160"
        viewBox="0 0 160 160"
        fill="none"
      >
        {[70, 55, 40, 28, 18, 10].map((r, i) => (
          <circle
            key={i}
            cx="80"
            cy="80"
            r={r}
            stroke="#2563eb"
            strokeWidth="1"
          />
        ))}
      </svg>

      {/* Fine grid — very subtle */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(100, 116, 139, 0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(100, 116, 139, 0.025) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

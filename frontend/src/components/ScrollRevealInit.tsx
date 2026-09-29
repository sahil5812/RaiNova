"use client";

import React, { useEffect } from "react";

/**
 * ScrollRevealInit
 * Initializes a high-performance IntersectionObserver to trigger smooth,
 * natural ease-out fade-in and upward glide animations on containers/cards
 * with staggered delays as they enter the viewport during scroll.
 */
export const ScrollRevealInit: React.FC = () => {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Graceful fallback for environments without IntersectionObserver
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".scroll-reveal").forEach((el) => {
        el.classList.add("is-revealed");
      });
      return;
    }

    let batchQueue: HTMLElement[] = [];
    let batchTimeout: ReturnType<typeof setTimeout> | null = null;

    // Flush intersecting elements in a batch with staggered delay
    const flushBatch = () => {
      batchQueue.forEach((el, index) => {
        // Natural stagger delay between 0ms and 350ms
        const staggerDelay = Math.min(index * 70, 350);
        el.style.transitionDelay = `${staggerDelay}ms`;
        el.classList.add("is-revealed");
      });
      batchQueue = [];
      batchTimeout = null;
    };

    const observer = new IntersectionObserver(
      (entries) => {
        let hasNew = false;
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            if (!el.classList.contains("is-revealed")) {
              batchQueue.push(el);
              hasNew = true;
            }
            // Once revealed, unobserve so it stays revealed and never replays unnecessarily
            observer.unobserve(el);
          }
        });

        if (hasNew) {
          if (batchTimeout) clearTimeout(batchTimeout);
          // Group sibling cards entering viewport in the same frame
          batchTimeout = setTimeout(flushBatch, 30);
        }
      },
      {
        root: null, // Viewport
        rootMargin: "150px 0px 150px 0px", // Trigger comfortably before card enters viewport
        threshold: 0.01,
      }
    );

    const observeElements = () => {
      const targets = document.querySelectorAll(".scroll-reveal:not(.is-revealed)");
      targets.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight + 150 && rect.bottom > -150) {
          el.classList.add("is-revealed");
        } else {
          observer.observe(el);
        }
      });
    };

    // Initial pass on mount
    observeElements();

    // Re-observe when dynamic tabs or routes mount new elements (debounced by 150ms)
    let mutationDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    const mutationObserver = new MutationObserver(() => {
      if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
      mutationDebounceTimer = setTimeout(() => {
        observeElements();
      }, 150);
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Auto-recover from chunk mismatch during live Vercel deployments
    const handleChunkError = (e: ErrorEvent) => {
      const msg = e.message || "";
      if (
        msg.includes("Loading chunk") ||
        msg.includes("Failed to fetch dynamically imported module") ||
        msg.includes("Failed to load module script")
      ) {
        const lastReload = sessionStorage.getItem("chunk_reload_ts");
        const now = Date.now();
        if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
          sessionStorage.setItem("chunk_reload_ts", now.toString());
          window.location.reload();
        }
      }
    };
    window.addEventListener("error", handleChunkError);

    return () => {
      window.removeEventListener("error", handleChunkError);
      if (batchTimeout) clearTimeout(batchTimeout);
      if (mutationDebounceTimer) clearTimeout(mutationDebounceTimer);
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return null;
};

"use client";

import { useEffect, useState } from "react";

type SplashState = "opening" | "closing" | "hidden";

export default function BrandSplash() {
  const [state, setState] = useState<SplashState>("opening");

  useEffect(() => {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const closeDelay = reducedMotion ? 500 : 2100;
    const hideDelay = reducedMotion ? 800 : 2700;

    document.body.classList.add("agriregistry-splash-open");

    const closeTimer = window.setTimeout(() => setState("closing"), closeDelay);
    const hideTimer = window.setTimeout(() => {
      setState("hidden");
      document.body.classList.remove("agriregistry-splash-open");
    }, hideDelay);

    return () => {
      window.clearTimeout(closeTimer);
      window.clearTimeout(hideTimer);
      document.body.classList.remove("agriregistry-splash-open");
    };
  }, []);

  if (state === "hidden") return null;

  return (
    <div
      className={`agriregistry-splash ${state === "closing" ? "is-closing" : ""}`}
      role="status"
      aria-live="polite"
      aria-label="Opening AgriRegistry"
    >
      <div className="agriregistry-splash-orb orb-a" />
      <div className="agriregistry-splash-orb orb-b" />
      <div className="agriregistry-splash-particles" />

      <div className="agriregistry-splash-card">
        <div className="agriregistry-splash-logo-surface">
          <img
            src="/agriregistry-logo.png"
            alt="AgriSpecimen Registry, powered by Luntian"
            className="agriregistry-splash-logo"
          />
        </div>

        <p>Microbes <span>â€¢</span> isolates <span>â€¢</span> invertebrates</p>

        <div className="agriregistry-splash-progress" aria-hidden="true">
          <span />
        </div>
      </div>
    </div>
  );
}
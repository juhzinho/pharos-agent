"use client";

import WaveBackground from "@/components/WaveBackground";

interface SiteBackgroundProps {
  variant?: "full" | "subtle";
  showWaves?: boolean;
}

export default function SiteBackground({ variant = "full", showWaves = true }: SiteBackgroundProps) {
  const isFull = variant === "full";

  return (
    <div className="fixed inset-0 pointer-events-none select-none overflow-hidden" aria-hidden>
      <div className="absolute inset-0 site-bg-gradient" />

      <div
        className="aurora-blob absolute -top-[20%] left-[15%] w-[55vw] h-[55vw] rounded-full opacity-35"
        style={{ background: "radial-gradient(circle, rgba(37,99,184,0.28) 0%, transparent 70%)" }}
      />
      <div
        className="aurora-blob aurora-blob-delay absolute top-[5%] right-[5%] w-[45vw] h-[45vw] rounded-full opacity-25"
        style={{ background: "radial-gradient(circle, rgba(60,100,180,0.2) 0%, transparent 70%)" }}
      />
      {isFull && (
        <div
          className="aurora-blob aurora-blob-slow absolute bottom-[10%] left-[30%] w-[50vw] h-[50vw] rounded-full opacity-20"
            style={{ background: "radial-gradient(circle, rgba(0,64,255,0.12) 0%, transparent 70%)" }}
        />
      )}

      <div className="absolute inset-0 site-grid opacity-[0.03]" />
      <div className="absolute inset-0 noise-overlay opacity-[0.03]" />

      {showWaves && (
        <div className="absolute inset-0">
          <WaveBackground intensity={isFull ? "full" : "subtle"} />
        </div>
      )}

      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(6,16,24,0.6) 100%)" }}
      />
    </div>
  );
}

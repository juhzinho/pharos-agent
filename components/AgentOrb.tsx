"use client";

interface AgentOrbProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  show3d?: boolean;
}

const SIZES = {
  sm: { box: "w-9 h-9 rounded-full", icon: "w-full h-full p-1.5", r: 3.5 },
  md: { box: "w-16 h-16 rounded-2xl", icon: "w-10 h-10", r: 5 },
  lg: { box: "w-32 h-32 rounded-3xl", icon: "w-16 h-16", r: 9 },
};

export default function AgentOrb({ size = "md", className = "", show3d = true }: AgentOrbProps) {
  const s = SIZES[size];

  return (
    <div className={`relative agent-orb-3d-wrap ${className}`}>
      {show3d && size !== "sm" && (
        <>
          <div className="agent-orb-3d-ring opacity-30" />
          <div
            className="absolute inset-0 rounded-full opacity-25 blur-xl"
        style={{ background: "radial-gradient(circle, rgba(0,100,255,0.45), transparent 70%)", transform: "scale(1.4)" }}
          />
        </>
      )}

      <div className={`${s.box} flex items-center justify-center relative z-10 agent-orb-core`}>
        <svg viewBox="0 0 52 52" className={s.icon} fill="none">
          <circle cx="26" cy="26" r={s.r} fill="rgba(0,100,255,0.95)" style={{ animation: "orbPulseEl 3s ease-in-out infinite" }} />
          <circle cx="26" cy="26" r="17" stroke="rgba(0,100,255,0.35)" strokeWidth="1" />
          <circle cx="26" cy="26" r="25" stroke="rgba(0,100,255,0.15)" strokeWidth="0.75" />
        </svg>
      </div>
    </div>
  );
}

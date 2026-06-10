"use client";
import { useEffect, useRef } from "react";

interface WaveBackgroundProps {
  intensity?: "full" | "subtle";
}

// Deterministic word config — positions chosen to spread nicely over the viewport
const FLOAT_WORDS = [
  { word: "RWA",          x:  7, y: 10, fontSize: 112, delay: 0,   dur: 14 },
  { word: "DeFi",         x: 72, y:  6, fontSize: 128, delay: 3,   dur: 17 },
  { word: "TradFi",       x: 44, y: 82, fontSize: 96,  delay: 5,   dur: 15 },
  { word: "Yield",        x: 85, y: 45, fontSize: 120, delay: 1.5, dur: 18 },
  { word: "Staking",      x: 15, y: 55, fontSize: 100, delay: 7,   dur: 13 },
  { word: "RealFi",       x: 58, y: 22, fontSize: 144, delay: 2,   dur: 20 },
  { word: "Liquidity",    x: 28, y: 72, fontSize: 88,  delay: 9,   dur: 16 },
  { word: "Bonds",        x: 78, y: 74, fontSize: 104, delay: 4,   dur: 14 },
  { word: "T-Bills",      x: 50, y: 48, fontSize: 96,  delay: 6,   dur: 19 },
  { word: "Swap",         x:  5, y: 38, fontSize: 120, delay: 8,   dur: 12 },
  { word: "Bridge",       x: 63, y: 90, fontSize: 88,  delay: 11,  dur: 15 },
  { word: "stPROS",       x: 22, y: 20, fontSize: 108, delay: 2.5, dur: 17 },
  { word: "USDC",         x: 88, y: 18, fontSize: 96,  delay: 10,  dur: 13 },
  { word: "Tokenization", x: 35, y: 60, fontSize: 80,  delay: 13,  dur: 21 },
];

export default function WaveBackground({ intensity = "full" }: WaveBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let t = 0;

    function resize() {
      if (!canvas) return;
      canvas.width  = canvas.offsetWidth  * (window.devicePixelRatio || 1);
      canvas.height = canvas.offsetHeight * (window.devicePixelRatio || 1);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    const opacityMul = intensity === "subtle" ? 0.55 : 1;

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      const ROWS = 26;
      const COLS = 32;

      // Horizontal wave lines (perspective: near=bottom=wide, far=top=narrow)
      for (let r = 0; r < ROWS; r++) {
        const progress = r / (ROWS - 1); // 0=far/top, 1=near/bottom
        const perspX   = 0.12 + 0.88 * progress;
        const baseY    = h * (0.22 + 0.72 * progress);
        const alpha    = (0.025 + 0.055 * progress) * opacityMul;
        const lineW    = 0.4 + progress * 0.5;
        ctx.strokeStyle = `rgba(0,212,255,${alpha})`;
        ctx.lineWidth   = lineW;
        ctx.beginPath();
        for (let c = 0; c <= COLS; c++) {
          const u  = c / COLS;
          const x  = w / 2 + (u - 0.5) * w * perspX;
          const wz = Math.sin(u * 4.5 + t * 0.65 + r * 0.38) * 18 * progress;
          const y  = baseY + wz;
          c === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Vertical grid lines (every 4th column)
      for (let c = 0; c <= COLS; c += 4) {
        const u = c / COLS;
        ctx.strokeStyle = `rgba(0,212,255,${0.015 * opacityMul})`;
        ctx.lineWidth   = 0.4;
        ctx.beginPath();
        for (let r = 0; r < ROWS; r++) {
          const progress = r / (ROWS - 1);
          const perspX   = 0.12 + 0.88 * progress;
          const x  = w / 2 + (u - 0.5) * w * perspX;
          const baseY = h * (0.22 + 0.72 * progress);
          const wz = Math.sin(u * 4.5 + t * 0.65 + r * 0.38) * 18 * progress;
          const y  = baseY + wz;
          r === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Soft radial glow at center-top
      const gx = w * 0.5;
      const gy = h * 0.35;
      const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, w * 0.45);
      gr.addColorStop(0, `rgba(0,80,160,${0.04 * opacityMul})`);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gr;
      ctx.fillRect(0, 0, w, h);

      t += 0.010;
      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, [intensity]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />

      {/* Floating finance words */}
      {FLOAT_WORDS.map(({ word, x, y, fontSize, delay, dur }) => (
        <span
          key={word}
          className="absolute font-display font-extrabold leading-none"
          style={{
            left:       `${x}%`,
            top:        `${y}%`,
            fontSize:   `${intensity === "subtle" ? fontSize * 0.7 : fontSize}px`,
            color:      "rgba(255,255,255,1)",
            opacity:    0,
            fontFamily: "var(--font-display), var(--font-inter), sans-serif",
            animation:  `floatWord ${dur}s ease-in-out ${delay}s infinite`,
            willChange: "opacity, transform",
          }}
        >
          {word}
        </span>
      ))}
    </div>
  );
}

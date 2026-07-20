"use client";

import { useEffect, useRef } from "react";

/** Animated 3D-style navy background for the chat workspace. */
export default function ChatBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId = 0;
    let t = 0;

    type Particle = { x: number; y: number; z: number; vx: number; vy: number; size: number };
    const particles: Particle[] = Array.from({ length: 48 }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: Math.random(),
      vx: (Math.random() - 0.5) * 0.00015,
      vy: (Math.random() - 0.5) * 0.00012,
      size: 0.5 + Math.random() * 1.5,
    }));

    function resize() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    function drawGrid(w: number, h: number) {
      const horizon = h * 0.38;
      const rows = 18;
      const cols = 24;

      for (let r = 0; r <= rows; r++) {
        const progress = r / rows;
        const y = horizon + (h - horizon) * progress * progress;
        const alpha = 0.04 + progress * 0.1;
        ctx!.strokeStyle = `rgba(74, 130, 210, ${alpha})`;
        ctx!.lineWidth = 0.6 + progress * 0.4;
        ctx!.beginPath();
        for (let c = 0; c <= cols; c++) {
          const u = c / cols;
          const persp = 0.15 + 0.85 * progress;
          const wave = Math.sin(u * 5 + t * 0.8 + r * 0.35) * 6 * progress;
          const x = w / 2 + (u - 0.5) * w * persp;
          c === 0 ? ctx!.moveTo(x, y + wave) : ctx!.lineTo(x, y + wave);
        }
        ctx!.stroke();
      }

      for (let c = 0; c <= cols; c += 2) {
        const u = c / cols;
        ctx!.strokeStyle = "rgba(50, 100, 180, 0.04)";
        ctx!.lineWidth = 0.5;
        ctx!.beginPath();
        for (let r = 0; r <= rows; r++) {
          const progress = r / rows;
          const y = horizon + (h - horizon) * progress * progress;
          const persp = 0.15 + 0.85 * progress;
          const wave = Math.sin(u * 5 + t * 0.8 + r * 0.35) * 6 * progress;
          const x = w / 2 + (u - 0.5) * w * persp;
          r === 0 ? ctx!.moveTo(x, y + wave) : ctx!.lineTo(x, y + wave);
        }
        ctx!.stroke();
      }
    }

    function draw() {
      if (!canvas || !ctx) return;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const grad = ctx.createRadialGradient(w * 0.5, h * 0.2, 0, w * 0.5, h * 0.5, w * 0.7);
      grad.addColorStop(0, "rgba(30, 70, 130, 0.25)");
      grad.addColorStop(0.5, "rgba(10, 25, 50, 0.08)");
      grad.addColorStop(1, "rgba(5, 12, 28, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      drawGrid(w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > 1) p.vx *= -1;
        if (p.y < 0 || p.y > 1) p.vy *= -1;

        const depth = 0.3 + p.z * 0.7;
        const px = p.x * w;
        const py = p.y * h;
        const alpha = 0.15 + p.z * 0.45;
        const radius = p.size * depth * 2;

        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(120, 180, 255, ${alpha})`;
        ctx.fill();
      }

      t += 0.012;
      animId = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
    };
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden>
      <div className="absolute inset-0 chat-bg-base" />
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full opacity-90" />
      <div className="chat-float-orb chat-float-orb-a" />
      <div className="chat-float-orb chat-float-orb-b" />
      <div className="chat-float-orb chat-float-orb-c" />
      <div className="absolute inset-0 chat-bg-vignette" />
    </div>
  );
}

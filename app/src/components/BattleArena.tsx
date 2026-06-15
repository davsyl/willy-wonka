"use client";

/**
 * Top-down battle arena visualiser.
 * Plays back a BattleResult frame-by-frame at 30 fps.
 */

import { useEffect, useRef, useState } from "react";
import type { BattleResult, BattleFrame } from "../lib/battle-engine";
import type { SpinxBuild } from "../types/spinx";

interface Props {
  result:  BattleResult;
  spinxA:  SpinxBuild;
  spinxB:  SpinxBuild;
  onDone?: (winnerIsA: boolean) => void;
}

const CANVAS_SIZE = 480;
const ARENA_R     = 200;
const TOP_R       = 18;

export function BattleArena({ result, spinxA, spinxB, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef  = useRef(0);
  const rafRef    = useRef<number>(0);

  const [currentFrame, setCurrentFrame] = useState<BattleFrame | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const frames = result.frames;
    let tick = 0;

    const step = () => {
      if (tick >= frames.length) {
        onDone?.(result.winnerIsA);
        return;
      }
      const frame = frames[tick];
      setCurrentFrame(frame);

      // ── Arena background ────────────────────────────────────────────────────
      ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      // Arena ring
      ctx.beginPath();
      ctx.arc(CANVAS_SIZE / 2, CANVAS_SIZE / 2, ARENA_R, 0, Math.PI * 2);
      ctx.strokeStyle = "#334155";
      ctx.lineWidth   = 3;
      ctx.stroke();

      // ── Top positions — sinusoidal orbit ───────────────────────────────────
      const angleA = (tick / frames.length) * Math.PI * 8;
      const orbitA = ARENA_R * 0.55 * (frame.staminaA / Math.max(1, spinxA.stats.stamina));
      const xA = CANVAS_SIZE / 2 + Math.cos(angleA) * orbitA;
      const yA = CANVAS_SIZE / 2 + Math.sin(angleA) * orbitA * 0.6;

      const angleB = angleA + Math.PI + 0.4;
      const orbitB = ARENA_R * 0.55 * (frame.staminaB / Math.max(1, spinxB.stats.stamina));
      const xB = CANVAS_SIZE / 2 + Math.cos(angleB) * orbitB;
      const yB = CANVAS_SIZE / 2 + Math.sin(angleB) * orbitB * 0.6;

      // Spinx A — indigo
      ctx.beginPath();
      ctx.arc(xA, yA, TOP_R * (0.5 + 0.5 * frame.staminaA / Math.max(1, spinxA.stats.stamina)), 0, Math.PI * 2);
      ctx.fillStyle = "#6366f1";
      ctx.fill();
      ctx.strokeStyle = "#a5b4fc";
      ctx.lineWidth   = 2;
      ctx.stroke();

      // Spinx B — rose
      ctx.beginPath();
      ctx.arc(xB, yB, TOP_R * (0.5 + 0.5 * frame.staminaB / Math.max(1, spinxB.stats.stamina)), 0, Math.PI * 2);
      ctx.fillStyle = "#f43f5e";
      ctx.fill();
      ctx.strokeStyle = "#fda4af";
      ctx.lineWidth   = 2;
      ctx.stroke();

      // Spark if close
      const dist = Math.hypot(xA - xB, yA - yB);
      if (dist < TOP_R * 3) {
        ctx.fillStyle = "#fbbf24";
        for (let i = 0; i < 4; i++) {
          const sx = (xA + xB) / 2 + (Math.random() - 0.5) * 20;
          const sy = (yA + yB) / 2 + (Math.random() - 0.5) * 20;
          ctx.fillRect(sx, sy, 3, 3);
        }
      }

      tick++;
      // 30 fps playback (one frame every ~33 ms)
      rafRef.current = window.setTimeout(step, 33) as unknown as number;
    };

    step();
    return () => clearTimeout(rafRef.current);
  }, [result]);

  const maxSta = Math.max(spinxA.stats.stamina, spinxB.stats.stamina, 1);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <canvas ref={canvasRef} width={CANVAS_SIZE} height={CANVAS_SIZE}
        style={{ borderRadius: 12, border: "1px solid #334155" }} />

      {currentFrame && (
        <div style={{ display: "flex", gap: 32, color: "#f9fafb", fontSize: 13 }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#a5b4fc" }}>Spinx #{spinxA.id}</div>
            <div>STA {currentFrame.staminaA} / {spinxA.stats.stamina}</div>
            <div style={{ background: "#1e1b4b", borderRadius: 4, height: 6, width: 120, marginTop: 4 }}>
              <div style={{ background: "#6366f1", width: `${(currentFrame.staminaA / maxSta) * 100}%`, height: "100%", borderRadius: 4 }} />
            </div>
            {currentFrame.eventA && <div style={{ color: "#fbbf24", marginTop: 4 }}>{currentFrame.eventA}</div>}
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ color: "#fda4af" }}>Spinx #{spinxB.id}</div>
            <div>STA {currentFrame.staminaB} / {spinxB.stats.stamina}</div>
            <div style={{ background: "#4c0519", borderRadius: 4, height: 6, width: 120, marginTop: 4 }}>
              <div style={{ background: "#f43f5e", width: `${(currentFrame.staminaB / maxSta) * 100}%`, height: "100%", borderRadius: 4 }} />
            </div>
            {currentFrame.eventB && <div style={{ color: "#fbbf24", marginTop: 4 }}>{currentFrame.eventB}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

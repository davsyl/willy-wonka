"use client";

import type { SpinxBuild } from "../types/spinx";

interface Props {
  build:    SpinxBuild;
  selected?: boolean;
  onClick?:  () => void;
}

const variantLabel = (v: object) => Object.keys(v)[0];

const rarityColour: Record<string, string> = {
  common:    "#9ca3af",
  uncommon:  "#4ade80",
  rare:      "#60a5fa",
  epic:      "#c084fc",
  legendary: "#fbbf24",
};

function StatBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.round((value / 300) * 100));
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div style={{ background: "#1f2937", borderRadius: 4, height: 6 }}>
        <div style={{ background: "#6366f1", width: `${pct}%`, height: "100%", borderRadius: 4 }} />
      </div>
    </div>
  );
}

export function SpinxCard({ build, selected, onClick }: Props) {
  const coreRarity = variantLabel(build.core.rarity);
  const colour     = rarityColour[coreRarity] ?? "#9ca3af";

  return (
    <div
      onClick={onClick}
      style={{
        border:        `2px solid ${selected ? "#6366f1" : colour}`,
        borderRadius:  12,
        padding:       "12px 16px",
        background:    "#111827",
        cursor:        onClick ? "pointer" : "default",
        color:         "#f9fafb",
        minWidth:      200,
        boxShadow:     selected ? `0 0 16px ${colour}88` : "none",
        transition:    "box-shadow 0.2s",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <strong style={{ fontSize: 14 }}>Spinx #{build.id}</strong>
        <span style={{ color: colour, fontSize: 11, textTransform: "capitalize" }}>
          {coreRarity}
        </span>
      </div>

      <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}>
        <div>Core:   {variantLabel(build.core.variant)}</div>
        <div>Ring:   {variantLabel(build.ring.variant)}</div>
        <div>Weight: {variantLabel(build.weight.variant)}</div>
        <div>Drive:  {variantLabel(build.drive.variant)}</div>
        <div>Lock:   {variantLabel(build.lock.variant)}</div>
      </div>

      <StatBar label="ATK" value={build.stats.attack}  />
      <StatBar label="DEF" value={build.stats.defense} />
      <StatBar label="STA" value={build.stats.stamina} />
      <StatBar label="CTL" value={build.stats.control} />
      <StatBar label="SPD" value={build.stats.speed}   />
    </div>
  );
}

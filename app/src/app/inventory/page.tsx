"use client";

import { useState } from "react";
import { useSpinxClient } from "../../hooks/useSpinxClient";
import { usePlayerProfile } from "../../hooks/usePlayerProfile";
import { SpinxCard } from "../../components/SpinxCard";
import { PartCategory } from "../../types/spinx";
import type { CoreData, RingData, WeightData, DriveData, LockData } from "../../types/spinx";

const CATEGORY_LABELS = ["Core", "Ring", "Weight", "Drive", "Lock"] as const;

const variantLabel = (v: object) => Object.keys(v)[0];
const rarityLabel  = (v: object) => Object.keys(v)[0];

const rarityColour: Record<string, string> = {
  common:    "#9ca3af",
  uncommon:  "#4ade80",
  rare:      "#60a5fa",
  epic:      "#c084fc",
  legendary: "#fbbf24",
};

function PartBadge({ variant, rarity, id }: { variant: object; rarity: object; id: number }) {
  const rl = rarityLabel(rarity);
  return (
    <div style={{
      border: `1px solid ${rarityColour[rl] ?? "#334155"}`,
      borderRadius: 8,
      padding: "6px 10px",
      background: "#1e293b",
      fontSize: 12,
      color: "#f9fafb",
      display: "flex",
      justifyContent: "space-between",
      gap: 12,
    }}>
      <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{variantLabel(variant)}</span>
      <span style={{ color: rarityColour[rl], textTransform: "capitalize" }}>{rl}</span>
      <span style={{ color: "#475569" }}>#{id}</span>
    </div>
  );
}

export default function InventoryPage() {
  const client = useSpinxClient();
  const { profile, loading, error, refresh } = usePlayerProfile();

  const [activeTab, setActiveTab]           = useState(0);
  const [opening, setOpening]               = useState(false);
  const [packError, setPackError]           = useState<string | null>(null);
  const [assembling, setAssembling]         = useState(false);
  const [assembleError, setAssembleError]   = useState<string | null>(null);
  const [assembleSuccess, setAssembleSuccess] = useState(false);

  // Assembly form state — selected part ids
  const [selCore,   setSelCore  ] = useState<number | null>(null);
  const [selRing,   setSelRing  ] = useState<number | null>(null);
  const [selWeight, setSelWeight] = useState<number | null>(null);
  const [selDrive,  setSelDrive ] = useState<number | null>(null);
  const [selLock,   setSelLock  ] = useState<number | null>(null);

  async function openPack(cat: number) {
    if (!client) return;
    setOpening(true);
    setPackError(null);
    try {
      await client.openPack(cat as PartCategory);
      await refresh();
    } catch (e) {
      setPackError((e as Error).message);
    } finally {
      setOpening(false);
    }
  }

  async function handleAssemble() {
    if (!client || selCore === null || selRing === null || selWeight === null || selDrive === null || selLock === null) return;
    setAssembling(true);
    setAssembleError(null);
    setAssembleSuccess(false);
    try {
      await client.assembleSpinx(selCore, selRing, selWeight, selDrive, selLock);
      setAssembleSuccess(true);
      setSelCore(null); setSelRing(null); setSelWeight(null); setSelDrive(null); setSelLock(null);
      await refresh();
    } catch (e) {
      setAssembleError((e as Error).message);
    } finally {
      setAssembling(false);
    }
  }

  if (loading) return <div style={{ color: "#94a3b8", padding: 32 }}>Loading inventory…</div>;
  if (error)   return <div className="error-banner">{error.message}</div>;
  if (!profile) return <div style={{ color: "#94a3b8", padding: 32 }}>Connect wallet and create a profile first.</div>;

  const categoryParts = [
    profile.cores,
    profile.rings,
    profile.weights,
    profile.drives,
    profile.locks,
  ] as (CoreData | RingData | WeightData | DriveData | LockData)[][];

  const activeParts = categoryParts[activeTab];

  function makeOption(part: any) {
    return { id: part.id, label: `${variantLabel(part.variant)} (${rarityLabel(part.rarity)}) #${part.id}` };
  }

  function PartSelect({ parts, value, onChange }: { parts: any[]; value: number | null; onChange: (id: number) => void }) {
    return (
      <select
        value={value ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "#1e293b", color: "#f9fafb", border: "1px solid #334155", fontSize: 13 }}
      >
        <option value="">— choose —</option>
        {parts.map((p: any) => (
          <option key={p.id} value={p.id}>{variantLabel(p.variant)} · {rarityLabel(p.rarity)} · #{p.id}</option>
        ))}
      </select>
    );
  }

  const canAssemble = selCore !== null && selRing !== null && selWeight !== null && selDrive !== null && selLock !== null;

  return (
    <div>
      <h2 style={{ color: "#f9fafb", marginBottom: 24 }}>Inventory</h2>

      {/* ── Parts section ──────────────────────────────────────────────── */}
      <section className="card" style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: "#f9fafb" }}>Parts</h3>
          <button
            className="btn-primary"
            onClick={() => openPack(activeTab)}
            disabled={opening}
            style={{ fontSize: 13, padding: "8px 16px", opacity: opening ? 0.6 : 1 }}
          >
            {opening ? "Opening…" : `Open ${CATEGORY_LABELS[activeTab]} Pack (10 $SPRK)`}
          </button>
        </div>

        {packError && <div className="error-banner" style={{ marginBottom: 12 }}>{packError}</div>}

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {CATEGORY_LABELS.map((label, i) => (
            <button
              key={i}
              onClick={() => setActiveTab(i)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: "none",
                background: activeTab === i ? "#6366f1" : "#1e293b",
                color: activeTab === i ? "#fff" : "#94a3b8",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              {label} ({categoryParts[i].length})
            </button>
          ))}
        </div>

        {activeParts.length === 0 ? (
          <p style={{ color: "#475569", fontSize: 13 }}>No {CATEGORY_LABELS[activeTab]}s yet — open a pack!</p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
            {activeParts.map((p: any) => (
              <PartBadge key={p.id} variant={p.variant} rarity={p.rarity} id={p.id} />
            ))}
          </div>
        )}
      </section>

      {/* ── Assembled Spinx ────────────────────────────────────────────── */}
      <section className="card" style={{ marginBottom: 32 }}>
        <h3 style={{ margin: "0 0 16px", color: "#f9fafb" }}>Assembled Spinx ({profile.spinxBuilds.length})</h3>
        {profile.spinxBuilds.length === 0 ? (
          <p style={{ color: "#475569", fontSize: 13 }}>No Spinx built yet — assemble one below.</p>
        ) : (
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            {profile.spinxBuilds.map((build) => (
              <SpinxCard key={build.id} build={build} />
            ))}
          </div>
        )}
      </section>

      {/* ── Assemble form ──────────────────────────────────────────────── */}
      <section className="card">
        <h3 style={{ margin: "0 0 16px", color: "#f9fafb" }}>Assemble Spinx</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          {(["Core", "Ring", "Weight", "Drive", "Lock"] as const).map((label, i) => {
            const parts = categoryParts[i];
            const values = [selCore, selRing, selWeight, selDrive, selLock];
            const setters = [setSelCore, setSelRing, setSelWeight, setSelDrive, setSelLock];
            return (
              <div key={label}>
                <label style={{ display: "block", color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>{label}</label>
                <PartSelect parts={parts as any[]} value={values[i]} onChange={setters[i]} />
              </div>
            );
          })}
        </div>

        {assembleError   && <div className="error-banner" style={{ marginBottom: 12 }}>{assembleError}</div>}
        {assembleSuccess && <div style={{ color: "#4ade80", marginBottom: 12, fontSize: 13 }}>✓ Spinx assembled!</div>}

        <button
          className="btn-primary"
          onClick={handleAssemble}
          disabled={!canAssemble || assembling}
          style={{ opacity: (!canAssemble || assembling) ? 0.5 : 1, padding: "10px 24px" }}
        >
          {assembling ? "Assembling…" : "Assemble Spinx"}
        </button>
      </section>
    </div>
  );
}

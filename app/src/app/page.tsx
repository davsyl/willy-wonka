"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRouter } from "next/navigation";
import { useSpinxClient } from "../hooks/useSpinxClient";
import { usePlayerProfile } from "../hooks/usePlayerProfile";

const ONE_SPRK = 1_000_000n;

export default function HomePage() {
  const { connected } = useWallet();
  const client = useSpinxClient();
  const { profile, loading, error, refresh } = usePlayerProfile();
  const router = useRouter();

  const [username, setUsername]     = useState("");
  const [creating, setCreating]     = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreateProfile() {
    if (!client || !username.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      await client.initializePlayer(username.trim());
      await refresh();
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  if (!connected) {
    return (
      <div style={{ textAlign: "center", marginTop: 80 }}>
        <h1 style={{ fontSize: 72, fontWeight: 900, color: "#6366f1", letterSpacing: "0.1em", margin: 0 }}>
          SPINX
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 18, marginTop: 12 }}>
          On-chain battle tops — powered by Solana
        </p>
        <p style={{ color: "#64748b", marginTop: 32 }}>Connect your wallet to begin</p>
      </div>
    );
  }

  if (loading) {
    return <div style={{ textAlign: "center", marginTop: 80, color: "#94a3b8" }}>Loading…</div>;
  }

  if (error) {
    return (
      <div className="error-banner" style={{ marginTop: 40 }}>
        Error loading profile: {error.message}
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{ maxWidth: 400, margin: "80px auto", textAlign: "center" }}>
        <h2 style={{ color: "#f9fafb", marginBottom: 8 }}>Create your account</h2>
        <p style={{ color: "#94a3b8", marginBottom: 24 }}>
          You'll receive <strong style={{ color: "#fbbf24" }}>100 $SPRK</strong> to get started.
        </p>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Choose a username"
          maxLength={32}
          style={{
            width: "100%",
            padding: "10px 14px",
            borderRadius: 8,
            border: "1px solid #334155",
            background: "#1e293b",
            color: "#f9fafb",
            fontSize: 16,
            boxSizing: "border-box",
            marginBottom: 12,
          }}
        />
        {createError && (
          <div className="error-banner" style={{ marginBottom: 12 }}>
            {createError}
          </div>
        )}
        <button
          className="btn-primary"
          onClick={handleCreateProfile}
          disabled={creating || !username.trim()}
          style={{ width: "100%", fontSize: 16, padding: "12px 0", opacity: creating ? 0.6 : 1 }}
        >
          {creating ? "Creating…" : "Create Profile"}
        </button>
      </div>
    );
  }

  const sprkDisplay = profile ? "—" : "—"; // balance fetched via token account separately

  return (
    <div>
      <h1 style={{ color: "#f9fafb", marginBottom: 4 }}>
        Welcome back, <span style={{ color: "#6366f1" }}>{profile.username.map(b => String.fromCharCode(b)).join("").replace(/\0/g, "")}</span>
      </h1>
      <p style={{ color: "#64748b", marginTop: 0, marginBottom: 32 }}>Ready to battle?</p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 40 }}>
        <div className="card" style={{ minWidth: 140 }}>
          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>WINS</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#4ade80" }}>{profile.wins}</div>
        </div>
        <div className="card" style={{ minWidth: 140 }}>
          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>LOSSES</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#f87171" }}>{profile.losses}</div>
        </div>
        <div className="card" style={{ minWidth: 140 }}>
          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>WIN RATE</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#fbbf24" }}>
            {profile.wins + profile.losses > 0
              ? `${Math.round((profile.wins / (profile.wins + profile.losses)) * 100)}%`
              : "—"}
          </div>
        </div>
        <div className="card" style={{ minWidth: 140 }}>
          <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 4 }}>SPINX BUILT</div>
          <div style={{ fontSize: 32, fontWeight: 700, color: "#a5b4fc" }}>{profile.spinxBuilds.length}</div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 12 }}>
        <button className="btn-primary" onClick={() => router.push("/inventory")} style={{ fontSize: 15, padding: "12px 24px" }}>
          Inventory
        </button>
        <button className="btn-secondary" onClick={() => router.push("/lobby")} style={{ fontSize: 15, padding: "12px 24px" }}>
          Battle Lobby
        </button>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSpinxClient } from "../../hooks/useSpinxClient";
import { usePlayerProfile } from "../../hooks/usePlayerProfile";
import { SpinxCard } from "../../components/SpinxCard";
import type { LobbyAccount, SpinxBuild } from "../../types/spinx";
import type { PublicKey } from "@solana/web3.js";

const ONE_SPRK = 1_000_000n;
const truncate = (pk: string) => `${pk.slice(0, 4)}…${pk.slice(-4)}`;

export default function LobbyPage() {
  const router = useRouter();
  const { publicKey } = useWallet();
  const client = useSpinxClient();
  const { profile } = usePlayerProfile();

  // ── Create lobby form ─────────────────────────────────────────────────────
  const [selSpinxId,  setSelSpinxId ] = useState<number | null>(null);
  const [charge,      setCharge     ] = useState(70);
  const [wager,       setWager      ] = useState(5);
  const [creating,    setCreating   ] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // ── Open lobbies ──────────────────────────────────────────────────────────
  const [lobbies,     setLobbies    ] = useState<{ publicKey: PublicKey; account: LobbyAccount }[]>([]);
  const [loadingLobbies, setLoadingLobbies] = useState(false);

  // ── Join modal ────────────────────────────────────────────────────────────
  const [joining,        setJoining       ] = useState<LobbyAccount | null>(null);
  const [joinSpinxId,    setJoinSpinxId   ] = useState<number | null>(null);
  const [joinCharge,     setJoinCharge    ] = useState(70);
  const [joinInProgress, setJoinInProgress] = useState(false);
  const [joinError,      setJoinError     ] = useState<string | null>(null);

  const fetchLobbies = useCallback(async () => {
    if (!client) return;
    setLoadingLobbies(true);
    try {
      const open = await client.fetchOpenLobbies();
      setLobbies(open);
    } catch {
      // silently ignore fetch errors
    } finally {
      setLoadingLobbies(false);
    }
  }, [client]);

  useEffect(() => {
    fetchLobbies();
    const interval = setInterval(fetchLobbies, 5000);
    return () => clearInterval(interval);
  }, [fetchLobbies]);

  async function handleCreate() {
    if (!client || selSpinxId === null) return;
    setCreating(true);
    setCreateError(null);
    try {
      const lobbyId = BigInt(Date.now());
      await client.createLobby(lobbyId, selSpinxId, charge, BigInt(wager) * ONE_SPRK);
      router.push(`/battle/${lobbyId.toString()}`);
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleJoin() {
    if (!client || !joining || joinSpinxId === null) return;
    setJoinInProgress(true);
    setJoinError(null);
    try {
      await client.joinLobby(joining.id, joinSpinxId, joinCharge);
      router.push(`/battle/${joining.id.toString()}`);
    } catch (e) {
      setJoinError((e as Error).message);
    } finally {
      setJoinInProgress(false);
    }
  }

  const selectedBuild = profile?.spinxBuilds.find((b) => b.id === selSpinxId) ?? null;

  return (
    <div>
      <h2 style={{ color: "#f9fafb", marginBottom: 24 }}>Battle Lobby</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, alignItems: "start" }}>

        {/* ── Create Lobby ─────────────────────────────────────────── */}
        <section className="card">
          <h3 style={{ margin: "0 0 20px", color: "#f9fafb" }}>Create Lobby</h3>

          <label style={{ color: "#94a3b8", fontSize: 12, display: "block", marginBottom: 4 }}>Choose Spinx</label>
          <select
            value={selSpinxId ?? ""}
            onChange={(e) => setSelSpinxId(Number(e.target.value))}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "#1e293b", color: "#f9fafb", border: "1px solid #334155", fontSize: 13, marginBottom: 16 }}
          >
            <option value="">— select —</option>
            {profile?.spinxBuilds.map((b) => (
              <option key={b.id} value={b.id}>Spinx #{b.id}</option>
            ))}
          </select>

          {selectedBuild && (
            <div style={{ marginBottom: 16 }}>
              <SpinxCard build={selectedBuild} />
            </div>
          )}

          <label style={{ color: "#94a3b8", fontSize: 12, display: "block", marginBottom: 4 }}>
            Charge: {charge}%
            {charge > 85 && <span style={{ color: "#f87171", marginLeft: 8 }}>⚠ Overcharge! (-stamina)</span>}
          </label>
          <input
            type="range" min={0} max={100} value={charge}
            onChange={(e) => setCharge(Number(e.target.value))}
            style={{ width: "100%", marginBottom: 16, accentColor: charge > 85 ? "#f87171" : "#6366f1" }}
          />

          <label style={{ color: "#94a3b8", fontSize: 12, display: "block", marginBottom: 4 }}>Wager ($SPRK)</label>
          <input
            type="number" min={1} max={1000} value={wager}
            onChange={(e) => setWager(Number(e.target.value))}
            style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "#1e293b", color: "#f9fafb", border: "1px solid #334155", fontSize: 13, marginBottom: 16, boxSizing: "border-box" }}
          />

          {createError && <div className="error-banner" style={{ marginBottom: 12 }}>{createError}</div>}

          <button
            className="btn-primary"
            onClick={handleCreate}
            disabled={creating || selSpinxId === null}
            style={{ width: "100%", padding: "12px 0", fontSize: 15, opacity: (creating || selSpinxId === null) ? 0.5 : 1 }}
          >
            {creating ? "Creating…" : "Create Lobby"}
          </button>
        </section>

        {/* ── Open Lobbies ─────────────────────────────────────────── */}
        <section className="card">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <h3 style={{ margin: 0, color: "#f9fafb" }}>Open Lobbies</h3>
            <button className="btn-secondary" onClick={fetchLobbies} style={{ fontSize: 12, padding: "6px 12px" }}>
              Refresh
            </button>
          </div>

          {loadingLobbies && <p style={{ color: "#94a3b8", fontSize: 13 }}>Loading…</p>}

          {!loadingLobbies && lobbies.length === 0 && (
            <p style={{ color: "#475569", fontSize: 13 }}>No open lobbies — create one!</p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {lobbies.map(({ account: lobby }) => {
              const isOwn = lobby.creator === publicKey?.toBase58();
              return (
                <div key={lobby.id.toString()} style={{ background: "#1e293b", borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12 }}>Creator: {truncate(lobby.creator as string)}</div>
                    <div style={{ color: "#fbbf24", fontWeight: 600, marginTop: 2 }}>
                      {(Number(lobby.wagerSprk) / 1_000_000).toFixed(0)} $SPRK
                    </div>
                  </div>
                  {!isOwn && (
                    <button
                      className="btn-primary"
                      onClick={() => { setJoining(lobby); setJoinSpinxId(null); setJoinCharge(70); setJoinError(null); }}
                      style={{ fontSize: 13, padding: "8px 16px" }}
                    >
                      Join
                    </button>
                  )}
                  {isOwn && <span style={{ color: "#475569", fontSize: 12 }}>Your lobby</span>}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ── Join Modal ───────────────────────────────────────────────────── */}
      {joining && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 50,
        }}>
          <div className="card" style={{ width: 400, maxWidth: "90vw" }}>
            <h3 style={{ margin: "0 0 16px", color: "#f9fafb" }}>
              Join Lobby — {(Number(joining.wagerSprk) / 1_000_000).toFixed(0)} $SPRK wager
            </h3>

            <label style={{ color: "#94a3b8", fontSize: 12, display: "block", marginBottom: 4 }}>Your Spinx</label>
            <select
              value={joinSpinxId ?? ""}
              onChange={(e) => setJoinSpinxId(Number(e.target.value))}
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "#1e293b", color: "#f9fafb", border: "1px solid #334155", fontSize: 13, marginBottom: 16 }}
            >
              <option value="">— select —</option>
              {profile?.spinxBuilds.map((b) => (
                <option key={b.id} value={b.id}>Spinx #{b.id}</option>
              ))}
            </select>

            <label style={{ color: "#94a3b8", fontSize: 12, display: "block", marginBottom: 4 }}>
              Charge: {joinCharge}%
              {joinCharge > 85 && <span style={{ color: "#f87171", marginLeft: 8 }}>⚠ Overcharge!</span>}
            </label>
            <input
              type="range" min={0} max={100} value={joinCharge}
              onChange={(e) => setJoinCharge(Number(e.target.value))}
              style={{ width: "100%", marginBottom: 16, accentColor: joinCharge > 85 ? "#f87171" : "#6366f1" }}
            />

            {joinError && <div className="error-banner" style={{ marginBottom: 12 }}>{joinError}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button
                className="btn-primary"
                onClick={handleJoin}
                disabled={joinInProgress || joinSpinxId === null}
                style={{ flex: 1, padding: "10px 0", opacity: (joinInProgress || joinSpinxId === null) ? 0.5 : 1 }}
              >
                {joinInProgress ? "Joining…" : "Confirm Join"}
              </button>
              <button className="btn-secondary" onClick={() => setJoining(null)} style={{ flex: 1, padding: "10px 0" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

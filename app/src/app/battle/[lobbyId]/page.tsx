"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useSpinxClient } from "../../../hooks/useSpinxClient";
import { BattleArena } from "../../../components/BattleArena";
import { previewBattle } from "../../../lib/battle-engine";
import type { LobbyAccount, SpinxBuild } from "../../../types/spinx";
import type { BattleResult } from "../../../lib/battle-engine";

const lobbyStatusKey = (s: object) => Object.keys(s)[0];

export default function BattlePage() {
  const { lobbyId: lobbyIdParam } = useParams<{ lobbyId: string }>();
  const lobbyId = BigInt(lobbyIdParam);
  const router = useRouter();
  const { publicKey } = useWallet();
  const client = useSpinxClient();

  const [lobby,       setLobby      ] = useState<LobbyAccount | null>(null);
  const [loading,     setLoading    ] = useState(true);
  const [error,       setError      ] = useState<string | null>(null);
  const [countdown,   setCountdown  ] = useState<number | null>(null);
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null);
  const [resolving,   setResolving  ] = useState(false);
  const [winner,      setWinner     ] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function fetchLobby() {
    if (!client) return;
    try {
      const l = await client.fetchLobby(lobbyId);
      setLobby(l);
      return l;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!client) return;
    fetchLobby();
  }, [client]);

  // Poll every 3 seconds while waiting for opponent
  useEffect(() => {
    if (!lobby) return;
    const status = lobbyStatusKey(lobby.status as object);

    if (status === "waitingForOpponent") {
      pollRef.current = setInterval(async () => {
        const updated = await fetchLobby();
        if (updated && lobbyStatusKey(updated.status as object) !== "waitingForOpponent") {
          clearInterval(pollRef.current!);
        }
      }, 3000);
    }

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [lobby?.status]);

  // Start countdown + battle preview when inProgress
  useEffect(() => {
    if (!lobby || lobbyStatusKey(lobby.status as object) !== "inProgress") return;
    if (battleResult) return; // already started

    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c === null || c <= 1) {
          clearInterval(interval);
          startBattlePreview(lobby);
          return null;
        }
        return c - 1;
      });
    }, 1000);
  }, [lobby?.status]);

  function startBattlePreview(lobby: LobbyAccount) {
    const slotB = lobby.slotB!;
    const result = previewBattle(
      lobby.slotA.spinx,
      lobby.slotA.chargePercent,
      slotB.spinx,
      slotB.chargePercent,
      BigInt(Date.now()), // approximate slot — matches on-chain within a second
      new PublicKey(lobby.slotA.player as string).toBytes(),
      new PublicKey(slotB.player as string).toBytes(),
    );
    setBattleResult(result);
  }

  async function handleBattleDone(winnerIsA: boolean) {
    if (!client || !lobby) return;
    setResolving(true);

    const creatorKey     = new PublicKey(lobby.creator as string);
    const challengerKey  = new PublicKey((lobby.slotB!.player) as string);
    const predictedWinner = winnerIsA ? creatorKey : challengerKey;

    setWinner(predictedWinner.toBase58());

    try {
      await client.resolveBattle(lobbyId, creatorKey, challengerKey, predictedWinner);
      const updated = await fetchLobby();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setResolving(false);
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) return <div style={{ color: "#94a3b8", padding: 40, textAlign: "center" }}>Loading battle…</div>;
  if (error)   return <div className="error-banner">{error}</div>;
  if (!lobby)  return <div style={{ color: "#94a3b8", padding: 40 }}>Lobby not found.</div>;

  const status = lobbyStatusKey(lobby.status as object);

  if (status === "waitingForOpponent") {
    return (
      <div style={{ textAlign: "center", marginTop: 80 }}>
        <h2 style={{ color: "#f9fafb" }}>Waiting for opponent…</h2>
        <p style={{ color: "#64748b" }}>Lobby #{lobbyId.toString()} · Wager: {(Number(lobby.wagerSprk) / 1_000_000).toFixed(0)} $SPRK</p>
        <div style={{ marginTop: 24, color: "#6366f1", fontSize: 13 }}>Polling every 3 seconds</div>
        <button className="btn-secondary" onClick={() => router.push("/lobby")} style={{ marginTop: 16 }}>
          ← Back to lobby
        </button>
      </div>
    );
  }

  if (status === "resolved") {
    const resolvedWinner = winner ?? (lobby.winner as string);
    const isMe = resolvedWinner === publicKey?.toBase58();
    return (
      <div style={{ textAlign: "center", marginTop: 60 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>{isMe ? "🏆" : "💀"}</div>
        <h2 style={{ color: isMe ? "#fbbf24" : "#f87171", marginBottom: 8 }}>
          {isMe ? "You won!" : "You lost!"}
        </h2>
        <p style={{ color: "#94a3b8" }}>Winner: {(resolvedWinner as string).slice(0, 8)}…</p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", marginTop: 24 }}>
          <button className="btn-primary" onClick={() => router.push("/lobby")}>Find another battle</button>
          <button className="btn-secondary" onClick={() => router.push("/inventory")}>Back to inventory</button>
        </div>
      </div>
    );
  }

  // inProgress — show countdown or arena
  const slotA = lobby.slotA;
  const slotB = lobby.slotB!;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ color: "#94a3b8", fontSize: 13 }}>
          <span style={{ color: "#a5b4fc" }}>{(lobby.creator as string).slice(0, 6)}…</span>
          {" "}vs{" "}
          <span style={{ color: "#fda4af" }}>{(slotB.player as string).slice(0, 6)}…</span>
        </div>
        <div style={{ color: "#fbbf24", fontWeight: 600 }}>
          {(Number(lobby.wagerSprk) / 1_000_000).toFixed(0)} $SPRK pot
        </div>
      </div>

      {countdown !== null && (
        <div style={{ textAlign: "center", fontSize: 96, fontWeight: 900, color: "#6366f1", marginTop: 60 }}>
          {countdown}
        </div>
      )}

      {battleResult && (
        <BattleArena
          result={battleResult}
          spinxA={slotA.spinx}
          spinxB={slotB.spinx}
          onDone={handleBattleDone}
        />
      )}

      {resolving && (
        <p style={{ textAlign: "center", color: "#94a3b8", marginTop: 16 }}>
          Submitting result on-chain…
        </p>
      )}

      {winner && !resolving && lobbyStatusKey(lobby.status as object) !== "resolved" && (
        <p style={{ textAlign: "center", color: "#4ade80", marginTop: 16 }}>
          Winner: {winner.slice(0, 8)}… — awaiting confirmation
        </p>
      )}
    </div>
  );
}

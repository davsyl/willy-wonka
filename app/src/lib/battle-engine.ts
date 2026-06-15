/**
 * Client-side battle preview engine.
 *
 * Mirrors the on-chain simulation in TypeScript so the frontend can render
 * a frame-by-frame animation BEFORE the tx confirms.  Must stay byte-for-byte
 * identical to the Rust logic in resolve_battle.rs.
 */

import type { SpinxBuild } from "../types/spinx";
import { sha256 } from "@noble/hashes/sha256";

// ─── Constants (must match programs/spinx/src/constants.rs) ──────────────────
const BATTLE_TICKS = 100;
const OVERCHARGE_THRESHOLD = 85;
const OVERCHARGE_SPEED_PENALTY = 2;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BattleFrame {
  tick:      number;
  staminaA:  number;
  staminaB:  number;
  speedA:    number;
  speedB:    number;
  eventA:    string | null;
  eventB:    string | null;
}

export interface BattleResult {
  winnerIsA: boolean;
  frames:    BattleFrame[];
  seed:      Uint8Array;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Deterministic preview — call before submitting resolve_battle. */
export function previewBattle(
  spinxA:   SpinxBuild,
  chargeA:  number,
  spinxB:   SpinxBuild,
  chargeB:  number,
  slotNumber: bigint,
  playerAKey: Uint8Array,
  playerBKey: Uint8Array
): BattleResult {
  // Mirror the on-chain seed derivation.
  const slotBuf = new ArrayBuffer(8);
  new DataView(slotBuf).setBigUint64(0, slotNumber, true);
  const seedInput = new Uint8Array([
    ...new Uint8Array(slotBuf),
    ...playerAKey,
    ...playerBKey,
  ]);
  const seed = sha256(seedInput);
  return simulateBattle(spinxA, chargeA, spinxB, chargeB, seed);
}

// ─── Core simulation ──────────────────────────────────────────────────────────

function simulateBattle(
  spinxA: SpinxBuild,
  chargeA: number,
  spinxB: SpinxBuild,
  chargeB: number,
  seed: Uint8Array
): BattleResult {
  let staminaA = applyChargeToStamina(spinxA.stats.stamina, chargeA);
  let staminaB = applyChargeToStamina(spinxB.stats.stamina, chargeB);
  let speedA   = applyChargeToSpeed(spinxA.stats.speed, chargeA);
  let speedB   = applyChargeToSpeed(spinxB.stats.speed, chargeB);

  const initStaminaA = staminaA;
  const initStaminaB = staminaB;

  let phaseTrigA = false;
  let phaseTrigB = false;

  const frames: BattleFrame[] = [];

  for (let tick = 0; tick < BATTLE_TICKS; tick++) {
    const rndA = seed[(tick * 2)     % 32];
    const rndB = seed[(tick * 2 + 1) % 32];
    const eventA: string[] = [];
    const eventB: string[] = [];

    // Nova late-game
    if (hasCore(spinxA, "nova") && tick > 60) speedA += (tick - 60) * 2;
    if (hasCore(spinxB, "nova") && tick > 60) speedB += (tick - 60) * 2;

    // Phase Lock trigger
    if (!phaseTrigA && hasLock(spinxA, "phase") && staminaA < initStaminaA / 2) {
      phaseTrigA = true;
      eventA.push("Phase Lock activated!");
    }
    if (!phaseTrigB && hasLock(spinxB, "phase") && staminaB < initStaminaB / 2) {
      phaseTrigB = true;
      eventB.push("Phase Lock activated!");
    }

    let atkA = phaseTrigA ? spinxA.stats.defense : spinxA.stats.attack;
    let atkB = phaseTrigB ? spinxB.stats.defense : spinxB.stats.attack;

    // Speed first-strike
    if (speedA > speedB) atkA += Math.floor(atkA / 10);
    else if (speedB > speedA) atkB += Math.floor(atkB / 10);

    // Crescent spin-steal
    if (hasRing(spinxA, "crescent") && rndA > 180) { speedB = Math.max(0, speedB - 5); eventA.push("Spin steal!"); }
    if (hasRing(spinxB, "crescent") && rndB > 180) { speedA = Math.max(0, speedA - 5); eventB.push("Spin steal!"); }

    // Void disruption
    if (hasCore(spinxA, "void") && rndA > 200) { atkB -= Math.floor(atkB / 5); eventA.push("Void disruption!"); }
    if (hasCore(spinxB, "void") && rndB > 200) { atkA -= Math.floor(atkA / 5); eventB.push("Void disruption!"); }

    // Over Lock self-destabilisation
    if (hasLock(spinxA, "over") && rndA < 30) { staminaA = Math.max(0, staminaA - rndA); eventA.push("Self-destabilised!"); }
    if (hasLock(spinxB, "over") && rndB < 30) { staminaB = Math.max(0, staminaB - rndB); eventB.push("Self-destabilised!"); }

    // Split / Drift random bonus
    if (hasWeight(spinxA, "split") || hasDrive(spinxA, "drift")) atkA += rndA % 20;
    if (hasWeight(spinxB, "split") || hasDrive(spinxB, "drift")) atkB += rndB % 20;

    // Pulse stamina recovery
    if (hasCore(spinxA, "pulse") && tick % 10 === 0) { staminaA += Math.floor(spinxA.stats.stamina / 20); eventA.push("Pulse recovery"); }
    if (hasCore(spinxB, "pulse") && tick % 10 === 0) { staminaB += Math.floor(spinxB.stats.stamina / 20); eventB.push("Pulse recovery"); }

    // Damage
    staminaB = Math.max(0, staminaB - computeDamage(atkA, spinxB.stats.defense));
    staminaA = Math.max(0, staminaA - computeDamage(atkB, spinxA.stats.defense));

    frames.push({
      tick,
      staminaA, staminaB,
      speedA,   speedB,
      eventA: eventA.join(", ") || null,
      eventB: eventB.join(", ") || null,
    });

    if (staminaA === 0 || staminaB === 0) break;
  }

  const lastFrame = frames[frames.length - 1];
  let winnerIsA: boolean;
  if (lastFrame.staminaA === 0 && lastFrame.staminaB === 0) {
    winnerIsA = spinxA.stats.stamina >= spinxB.stats.stamina;
  } else {
    winnerIsA = lastFrame.staminaA > lastFrame.staminaB;
  }

  return { winnerIsA, frames, seed };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function applyChargeToStamina(base: number, charge: number): number {
  if (charge > OVERCHARGE_THRESHOLD) {
    const excess   = charge - OVERCHARGE_THRESHOLD;
    const penalty  = excess * OVERCHARGE_SPEED_PENALTY;
    return Math.max(0, base - Math.floor(base * penalty / 100));
  }
  return base;
}

function applyChargeToSpeed(base: number, charge: number): number {
  const effective = Math.min(charge, OVERCHARGE_THRESHOLD);
  return base + Math.floor(base * effective / 200);
}

function computeDamage(attack: number, defense: number): number {
  return Math.max(1, attack - Math.floor(defense / 2));
}

const variantKey = (v: object) => Object.keys(v)[0];
const hasCore   = (s: SpinxBuild, k: string) => variantKey(s.core.variant)   === k;
const hasRing   = (s: SpinxBuild, k: string) => variantKey(s.ring.variant)   === k;
const hasWeight = (s: SpinxBuild, k: string) => variantKey(s.weight.variant) === k;
const hasDrive  = (s: SpinxBuild, k: string) => variantKey(s.drive.variant)  === k;
const hasLock   = (s: SpinxBuild, k: string) => variantKey(s.lock.variant)   === k;

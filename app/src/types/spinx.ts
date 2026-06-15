// ─── Mirrors of the Rust enums / structs ─────────────────────────────────────

export const PartCategory = {
  Core:   0,
  Ring:   1,
  Weight: 2,
  Drive:  3,
  Lock:   4,
} as const;
export type PartCategory = (typeof PartCategory)[keyof typeof PartCategory];

export const Rarity = {
  Common:    { common:    {} },
  Uncommon:  { uncommon:  {} },
  Rare:      { rare:      {} },
  Epic:      { epic:      {} },
  Legendary: { legendary: {} },
} as const;

export const CoreVariant = {
  Flare:  { flare:  {} },
  Anchor: { anchor: {} },
  Pulse:  { pulse:  {} },
  Void:   { void:   {} },
  Nova:   { nova:   {} },
} as const;

export const RingVariant = {
  Fang:     { fang:     {} },
  Guard:    { guard:    {} },
  Rebound:  { rebound:  {} },
  Crescent: { crescent: {} },
  Hammer:   { hammer:   {} },
} as const;

export const WeightVariant = {
  Center: { center: {} },
  Edge:   { edge:   {} },
  Split:  { split:  {} },
  Low:    { low:    {} },
  Heavy:  { heavy:  {} },
} as const;

export const DriveVariant = {
  Needle: { needle: {} },
  Flat:   { flat:   {} },
  Orbit:  { orbit:  {} },
  Drift:  { drift:  {} },
  Grip:   { grip:   {} },
  Dash:   { dash:   {} },
} as const;

export const LockVariant = {
  Tight: { tight: {} },
  Flex:  { flex:  {} },
  Quick: { quick: {} },
  Over:  { over:  {} },
  Phase: { phase: {} },
} as const;

export const LobbyStatus = {
  WaitingForOpponent: { waitingForOpponent: {} },
  InProgress:         { inProgress:         {} },
  Resolved:           { resolved:           {} },
  Cancelled:          { cancelled:          {} },
} as const;

// ─── Decoded account shapes ───────────────────────────────────────────────────

export interface SpinxStats {
  attack:  number;
  defense: number;
  stamina: number;
  control: number;
  speed:   number;
}

export interface CoreData   { variant: object; rarity: object; id: number; }
export interface RingData   { variant: object; rarity: object; id: number; }
export interface WeightData { variant: object; rarity: object; id: number; }
export interface DriveData  { variant: object; rarity: object; id: number; }
export interface LockData   { variant: object; rarity: object; id: number; }

export interface SpinxBuild {
  id:     number;
  core:   CoreData;
  ring:   RingData;
  weight: WeightData;
  drive:  DriveData;
  lock:   LockData;
  stats:  SpinxStats;
}

export interface LobbySlot {
  player:        string;
  spinx:         SpinxBuild;
  chargePercent: number;
  wagerAmount:   bigint;
}

export interface PlayerProfileAccount {
  owner:          string;
  username:       number[];
  wins:           number;
  losses:         number;
  totalSprkWon:   bigint;
  totalSprkLost:  bigint;
  cores:          CoreData[];
  rings:          RingData[];
  weights:        WeightData[];
  drives:         DriveData[];
  locks:          LockData[];
  spinxBuilds:    SpinxBuild[];
  nextSpinxId:    number;
  nextCoreId:     number;
  nextRingId:     number;
  nextWeightId:   number;
  nextDriveId:    number;
  nextLockId:     number;
  bump:           number;
}

export interface LobbyAccount {
  id:          bigint;
  creator:     string;
  slotA:       LobbySlot;
  slotB:       LobbySlot | null;
  wagerSprk:   bigint;
  status:      object;
  createdAt:   bigint;
  winner:      string | null;
  battleSeed:  number[] | null;
  bump:        number;
  escrowBump:  number;
}

use anchor_lang::prelude::*;

// ─── Part-type taxonomy ───────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum PartCategory {
    Core,
    Ring,
    Weight,
    Drive,
    Lock,
}

// ─── Rarity ───────────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum Rarity {
    Common,
    Uncommon,
    Rare,
    Epic,
    Legendary,
}

impl Rarity {
    /// Stat multiplier scaled to 100 (Common = 100, Legendary = 175).
    pub fn stat_multiplier_bps(&self) -> u16 {
        match self {
            Rarity::Common    => 100,
            Rarity::Uncommon  => 115,
            Rarity::Rare      => 130,
            Rarity::Epic      => 150,
            Rarity::Legendary => 175,
        }
    }
}

// ─── Variant enums ────────────────────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum CoreVariant {
    Flare,   // aggressive burst damage — high attack, low stamina
    Anchor,  // heaviest, resists knockouts — high defense
    Pulse,   // regains stability post-impact — stamina recovery
    Void,    // disrupts opponent spin — attack + control debuff
    Nova,    // late-game power spike — speed scales with time elapsed
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum RingVariant {
    Fang,     // high attack, unstable — attack+, defense-
    Guard,    // absorbs hits — defense+, attack-
    Rebound,  // bounces opponents — control+
    Crescent, // spin-steal on contact — drains opponent stamina
    Hammer,   // heavy smash — attack++, speed-
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum WeightVariant {
    Center, // stable and balanced — all stats moderate
    Edge,   // high attack momentum — attack+, stamina-
    Split,  // unpredictable — randomness bonus
    Low,    // improves balance — defense+, control+
    Heavy,  // resists knockouts, slower — defense++, speed-
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum DriveVariant {
    Needle, // stable stamina — stamina+
    Flat,   // fast and aggressive — speed++, stamina-
    Orbit,  // circles arena — control+, stamina+
    Drift,  // unpredictable — randomness bonus
    Grip,   // high control — control++
    Dash,   // sudden bursts — speed spikes
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum LockVariant {
    Tight,  // resists breakage, limits special charge — defense+
    Flex,   // absorbs impact — stamina+, stability under hit
    Quick,  // faster launch, weaker stability — speed+, defense-
    Over,   // high power, risk of self-destabilisation — attack++, penalty
    Phase,  // can shift form mid-battle — triggers a stat swap at 50% health
}

// ─── PartData — what gets stored per part in the player's inventory ───────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct CoreData {
    pub variant: CoreVariant,
    pub rarity:  Rarity,
    pub id:      u16, // sequential ID within the player's core collection
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct RingData {
    pub variant: RingVariant,
    pub rarity:  Rarity,
    pub id:      u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct WeightData {
    pub variant: WeightVariant,
    pub rarity:  Rarity,
    pub id:      u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct DriveData {
    pub variant: DriveVariant,
    pub rarity:  Rarity,
    pub id:      u16,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct LockData {
    pub variant: LockVariant,
    pub rarity:  Rarity,
    pub id:      u16,
}

// ─── Assembled Spinx ──────────────────────────────────────────────────────────

/// A built Spinx ready for battle. Stored in the player's profile.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct SpinxBuild {
    pub id:     u8,
    pub core:   CoreData,
    pub ring:   RingData,
    pub weight: WeightData,
    pub drive:  DriveData,
    pub lock:   LockData,
    /// Computed at assemble time. Cached to avoid repeated calculation.
    pub stats:  SpinxStats,
}

/// Composite stats used by the battle engine.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default)]
pub struct SpinxStats {
    pub attack:  u16, // raw damage per tick
    pub defense: u16, // damage reduction
    pub stamina: u16, // total hit-points for spin durability
    pub control: u16, // influences hit accuracy and arena positioning
    pub speed:   u16, // determines first-strike order and arena coverage
}

impl SpinxStats {
    /// Derive composite stats from parts. All base values are in [0,100].
    /// Rarity multiplier is applied last.
    pub fn derive(
        core:   &CoreData,
        ring:   &RingData,
        weight: &WeightData,
        drive:  &DriveData,
        lock:   &LockData,
    ) -> Self {
        // ── Base contributions ────────────────────────────────────────────────
        let (ca, cd, cs, cc, csp) = core_bases(&core.variant);
        let (ra, rd, rs, rc, rsp) = ring_bases(&ring.variant);
        let (wa, wd, ws, wc, wsp) = weight_bases(&weight.variant);
        let (da, dd, ds, dc, dsp) = drive_bases(&drive.variant);
        let (la, ld, ls, lc, lsp) = lock_bases(&lock.variant);

        let raw_attack  = ca + ra + wa + da + la;
        let raw_defense = cd + rd + wd + dd + ld;
        let raw_stamina = cs + rs + ws + ds + ls;
        let raw_control = cc + rc + wc + dc + lc;
        let raw_speed   = csp + rsp + wsp + dsp + lsp;

        // ── Average rarity multiplier (bps → %) ──────────────────────────────
        let mult = (core.rarity.stat_multiplier_bps()
            + ring.rarity.stat_multiplier_bps()
            + weight.rarity.stat_multiplier_bps()
            + drive.rarity.stat_multiplier_bps()
            + lock.rarity.stat_multiplier_bps()) as u32
            / 5;

        Self {
            attack:  (raw_attack  as u32 * mult / 100) as u16,
            defense: (raw_defense as u32 * mult / 100) as u16,
            stamina: (raw_stamina as u32 * mult / 100) as u16,
            control: (raw_control as u32 * mult / 100) as u16,
            speed:   (raw_speed   as u32 * mult / 100) as u16,
        }
    }
}

// ─── Part base stat tables ────────────────────────────────────────────────────
// Returns (attack, defense, stamina, control, speed) all in [0, 50].

fn core_bases(v: &CoreVariant) -> (u16, u16, u16, u16, u16) {
    match v {
        CoreVariant::Flare  => (50, 10, 20, 20, 30),
        CoreVariant::Anchor => (20, 50, 30, 20, 10),
        CoreVariant::Pulse  => (20, 25, 50, 20, 15),
        CoreVariant::Void   => (35, 15, 20, 40, 20),
        CoreVariant::Nova   => (30, 20, 20, 20, 40),
    }
}

fn ring_bases(v: &RingVariant) -> (u16, u16, u16, u16, u16) {
    match v {
        RingVariant::Fang     => (45, 5,  10, 10, 15),
        RingVariant::Guard    => (10, 45, 15, 15, 10),
        RingVariant::Rebound  => (20, 20, 15, 35, 20),
        RingVariant::Crescent => (30, 15, 20, 30, 15),
        RingVariant::Hammer   => (50, 15, 15, 10, 5),
    }
}

fn weight_bases(v: &WeightVariant) -> (u16, u16, u16, u16, u16) {
    match v {
        WeightVariant::Center => (20, 20, 25, 25, 20),
        WeightVariant::Edge   => (35, 10, 10, 15, 25),
        WeightVariant::Split  => (20, 15, 20, 15, 25),
        WeightVariant::Low    => (10, 30, 20, 35, 15),
        WeightVariant::Heavy  => (15, 45, 30, 10, 5),
    }
}

fn drive_bases(v: &DriveVariant) -> (u16, u16, u16, u16, u16) {
    match v {
        DriveVariant::Needle => (10, 15, 45, 20, 15),
        DriveVariant::Flat   => (25, 5,  10, 10, 50),
        DriveVariant::Orbit  => (15, 15, 30, 30, 20),
        DriveVariant::Drift  => (20, 10, 15, 15, 35),
        DriveVariant::Grip   => (10, 20, 20, 45, 15),
        DriveVariant::Dash   => (30, 10, 10, 15, 45),
    }
}

fn lock_bases(v: &LockVariant) -> (u16, u16, u16, u16, u16) {
    match v {
        LockVariant::Tight => (10, 35, 20, 20, 15),
        LockVariant::Flex  => (10, 25, 40, 15, 10),
        LockVariant::Quick => (15, 10, 15, 20, 40),
        LockVariant::Over  => (40, 5,  10, 10, 25),
        LockVariant::Phase => (20, 20, 20, 25, 25),
    }
}

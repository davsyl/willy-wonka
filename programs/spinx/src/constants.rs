// ─── Token ────────────────────────────────────────────────────────────────────

/// Decimals for the $SPRK SPL token (6 like USDC).
pub const SPRK_DECIMALS: u8 = 6;

/// Shorthand for 1 $SPRK in native units.
pub const ONE_SPRK: u64 = 1_000_000;

/// Cost of one part-pack in $SPRK.
pub const PACK_PRICE_SPRK: u64 = 10 * ONE_SPRK;

/// Starter-pack grant given to a new player (enough for 2 extra packs).
pub const STARTER_SPRK_GRANT: u64 = 100 * ONE_SPRK;

// ─── Battle ───────────────────────────────────────────────────────────────────

/// Minimum wager per battle side.
pub const MIN_WAGER_SPRK: u64 = ONE_SPRK;

/// Maximum wager per battle side.
pub const MAX_WAGER_SPRK: u64 = 1_000 * ONE_SPRK;

/// Battle simulation tick count.
pub const BATTLE_TICKS: u32 = 100;

/// Overcharge threshold: twisting past this percentage loses control.
pub const OVERCHARGE_THRESHOLD: u8 = 85;

/// Speed penalty applied per percent above overcharge threshold.
pub const OVERCHARGE_SPEED_PENALTY: u8 = 2;

// ─── Parts ────────────────────────────────────────────────────────────────────

/// Maximum player-owned Spinx builds stored on-chain.
pub const MAX_SPINX_PER_PLAYER: u8 = 10;

/// Maximum parts in each category stored per player.
pub const MAX_PARTS_PER_CATEGORY: u8 = 30;

// ─── PDA Seeds ────────────────────────────────────────────────────────────────

pub const SEED_GAME_CONFIG: &[u8] = b"game_config";
pub const SEED_PLAYER_PROFILE: &[u8] = b"player_profile";
pub const SEED_SPINX: &[u8] = b"spinx";
pub const SEED_LOBBY: &[u8] = b"lobby";
pub const SEED_SPRK_VAULT: &[u8] = b"sprk_vault";
pub const SEED_LOBBY_ESCROW: &[u8] = b"lobby_escrow";

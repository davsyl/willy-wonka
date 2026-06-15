use anchor_lang::prelude::*;
use crate::state::spinx::SpinxBuild;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum LobbyStatus {
    WaitingForOpponent,
    InProgress,
    Resolved,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug)]
pub struct LobbySlot {
    pub player:         Pubkey,
    pub spinx:          SpinxBuild,
    /// Twist-charge 0–100.  >85 = overcharge risk.
    pub charge_percent: u8,
    pub wager_amount:   u64,
}

/// Battle lobby PDA.
/// Seeds: ["lobby", lobby_id (u64 as le bytes)]
#[account]
#[derive(Debug)]
pub struct Lobby {
    pub id:         u64,
    pub creator:    Pubkey,
    pub slot_a:     LobbySlot,
    pub slot_b:     Option<LobbySlot>,
    pub wager_sprk: u64, // per-side wager (must match when joining)
    pub status:     LobbyStatus,
    /// Slot at which the lobby was created; used for expiry.
    pub created_at: i64,
    /// Winner pubkey; set on resolution.
    pub winner:     Option<Pubkey>,
    /// Random seed derived from slot hash + player keys, set on resolution.
    pub battle_seed: Option<[u8; 32]>,
    pub bump:       u8,
    pub escrow_bump: u8,
}

impl Lobby {
    pub const LEN: usize = 8    // discriminator
        + 8                     // id
        + 32                    // creator
        // LobbySlot = 32 + SpinxBuild(31) + 1 + 8 = 72
        + 72                    // slot_a
        + 1 + 72                // slot_b (Option)
        + 8                     // wager_sprk
        + 1                     // status
        + 8                     // created_at
        + 1 + 32                // winner (Option)
        + 1 + 32                // battle_seed (Option)
        + 1                     // bump
        + 1;                    // escrow_bump
}

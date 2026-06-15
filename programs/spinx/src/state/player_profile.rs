use anchor_lang::prelude::*;
use crate::state::spinx::*;
use crate::constants::*;

/// Per-player account.
/// Seeds: ["player_profile", player.key()]
#[account]
#[derive(Debug)]
pub struct PlayerProfile {
    pub owner:          Pubkey,
    pub username:       [u8; 32],   // UTF-8, null-padded
    pub wins:           u32,
    pub losses:         u32,
    pub total_sprk_won: u64,
    pub total_sprk_lost: u64,

    // ── Part inventories ────────────────────────────────────────────────────
    pub cores:   Vec<CoreData>,
    pub rings:   Vec<RingData>,
    pub weights: Vec<WeightData>,
    pub drives:  Vec<DriveData>,
    pub locks:   Vec<LockData>,

    // ── Assembled Spinx builds ───────────────────────────────────────────────
    pub spinx_builds:   Vec<SpinxBuild>,
    pub next_spinx_id:  u8,

    // ── Sequential IDs for each part category ───────────────────────────────
    pub next_core_id:   u16,
    pub next_ring_id:   u16,
    pub next_weight_id: u16,
    pub next_drive_id:  u16,
    pub next_lock_id:   u16,

    pub bump: u8,
}

impl PlayerProfile {
    /// Approximate maximum serialised length.
    /// Vecs are bounded by MAX_PARTS_PER_CATEGORY.
    pub const LEN: usize = 8                 // discriminator
        + 32                                 // owner
        + 32                                 // username
        + 4 + 4                              // wins, losses
        + 8 + 8                              // sprk won/lost
        // CoreData = variant(1) + rarity(1) + id(2) = 4
        + 4 + (4 * MAX_PARTS_PER_CATEGORY as usize)
        // RingData = 4
        + 4 + (4 * MAX_PARTS_PER_CATEGORY as usize)
        // WeightData = 4
        + 4 + (4 * MAX_PARTS_PER_CATEGORY as usize)
        // DriveData = 4
        + 4 + (4 * MAX_PARTS_PER_CATEGORY as usize)
        // LockData = 4
        + 4 + (4 * MAX_PARTS_PER_CATEGORY as usize)
        // SpinxBuild = 1 + 4 + 4 + 4 + 4 + 4 + (5*2) = 31
        + 4 + (31 * MAX_SPINX_PER_PLAYER as usize)
        + 1                                  // next_spinx_id
        + 2 + 2 + 2 + 2 + 2                 // next_*_id
        + 1;                                 // bump

    pub fn username_str(&self) -> &str {
        let end = self.username.iter().position(|&b| b == 0).unwrap_or(32);
        std::str::from_utf8(&self.username[..end]).unwrap_or("???")
    }

    pub fn set_username(&mut self, name: &str) {
        let bytes = name.as_bytes();
        let len = bytes.len().min(32);
        self.username[..len].copy_from_slice(&bytes[..len]);
        for b in &mut self.username[len..] { *b = 0; }
    }
}

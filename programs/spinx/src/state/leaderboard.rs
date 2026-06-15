use anchor_lang::prelude::*;

/// A single entry in the on-chain leaderboard.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct LeaderboardEntry {
    pub player:         Pubkey,
    pub wins:           u32,
    pub losses:         u32,
    pub total_sprk_won: u64,
    /// wins / (wins+losses) * 10_000, or 0 if no games played.
    pub win_rate_bps:   u16,
}

/// Singleton leaderboard PDA.
/// Seeds: ["leaderboard"]
#[account]
#[derive(Debug)]
pub struct Leaderboard {
    /// Up to 100 player entries, sorted descending by win_rate_bps then total_sprk_won.
    pub entries: Vec<LeaderboardEntry>,
    pub bump:    u8,
}

impl Leaderboard {
    // 8 discriminator
    // + 4 vec length prefix
    // + 100 * (32 player + 4 wins + 4 losses + 8 sprk + 2 bps) = 100 * 50 = 5_000
    // + 1 bump
    // + 32 slack
    pub const LEN: usize = 8 + 4 + 100 * 50 + 1 + 32;
}

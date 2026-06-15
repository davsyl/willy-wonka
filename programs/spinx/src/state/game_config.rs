use anchor_lang::prelude::*;

/// Singleton PDA owned by the game authority.
/// Seeds: ["game_config"]
#[account]
#[derive(Debug)]
pub struct GameConfig {
    /// The wallet that can update config and mint starter grants.
    pub authority: Pubkey,
    /// The $SPRK SPL mint address.
    pub sprk_mint: Pubkey,
    /// Treasury ATA that receives pack purchase fees.
    pub treasury: Pubkey,
    /// Total $SPRK ever minted via starter grants.
    pub total_sprk_granted: u64,
    /// Total battles ever resolved.
    pub total_battles: u64,
    /// Bump for this PDA.
    pub bump: u8,
}

impl GameConfig {
    pub const LEN: usize = 8   // discriminator
        + 32  // authority
        + 32  // sprk_mint
        + 32  // treasury
        + 8   // total_sprk_granted
        + 8   // total_battles
        + 1;  // bump
}

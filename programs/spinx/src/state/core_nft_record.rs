use anchor_lang::prelude::*;

/// On-chain mapping from a player's Core part to its minted NFT.
/// Seeds: ["core_nft", player.key(), core_id.to_le_bytes()]
#[account]
#[derive(Debug)]
pub struct CoreNftRecord {
    pub player:   Pubkey,
    pub core_id:  u16,
    pub nft_mint: Pubkey,
    pub bump:     u8,
}

impl CoreNftRecord {
    pub const LEN: usize = 8   // discriminator
        + 32  // player
        + 2   // core_id
        + 32  // nft_mint
        + 1;  // bump
}

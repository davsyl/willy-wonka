use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token};
use crate::state::GameConfig;
use crate::constants::*;

/// One-time call by the game authority to set up the singleton config PDA
/// and create the $SPRK mint.
pub fn handler(ctx: Context<InitializeGame>) -> Result<()> {
    let config = &mut ctx.accounts.game_config;
    config.authority       = ctx.accounts.authority.key();
    config.sprk_mint       = ctx.accounts.sprk_mint.key();
    config.treasury        = ctx.accounts.treasury.key();
    config.total_sprk_granted = 0;
    config.total_battles   = 0;
    config.bump            = ctx.bumps.game_config;
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeGame<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer  = authority,
        space  = GameConfig::LEN,
        seeds  = [SEED_GAME_CONFIG],
        bump,
    )]
    pub game_config: Account<'info, GameConfig>,

    /// The $SPRK SPL mint — created by the client before this call,
    /// or initialised here as a zero-supply mint.
    #[account(
        init,
        payer     = authority,
        mint::decimals   = SPRK_DECIMALS,
        mint::authority  = game_config,
        mint::freeze_authority = game_config,
    )]
    pub sprk_mint: Account<'info, Mint>,

    /// CHECK: Validated as a token account by the client; we just record the pubkey.
    pub treasury: UncheckedAccount<'info>,

    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent:           Sysvar<'info, Rent>,
}

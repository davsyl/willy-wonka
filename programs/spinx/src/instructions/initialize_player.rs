use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, MintTo, Token, TokenAccount};
use crate::state::{GameConfig, PlayerProfile};
use crate::constants::*;

/// Create a player profile and mint the starter $SPRK grant + one free pack
/// of each part category.
pub fn handler(ctx: Context<InitializePlayer>, username: String) -> Result<()> {
    // ── Populate profile ─────────────────────────────────────────────────────
    let profile = &mut ctx.accounts.player_profile;
    profile.owner           = ctx.accounts.player.key();
    profile.wins            = 0;
    profile.losses          = 0;
    profile.total_sprk_won  = 0;
    profile.total_sprk_lost = 0;
    profile.next_spinx_id   = 0;
    profile.next_core_id    = 0;
    profile.next_ring_id    = 0;
    profile.next_weight_id  = 0;
    profile.next_drive_id   = 0;
    profile.next_lock_id    = 0;
    profile.bump            = ctx.bumps.player_profile;
    profile.set_username(&username);

    // ── Mint starter $SPRK grant ──────────────────────────────────────────────
    let config_seeds: &[&[u8]] = &[SEED_GAME_CONFIG, &[ctx.accounts.game_config.bump]];
    let signer = &[config_seeds];

    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint:      ctx.accounts.sprk_mint.to_account_info(),
                to:        ctx.accounts.player_sprk_ata.to_account_info(),
                authority: ctx.accounts.game_config.to_account_info(),
            },
            signer,
        ),
        STARTER_SPRK_GRANT,
    )?;

    ctx.accounts.game_config.total_sprk_granted = ctx
        .accounts
        .game_config
        .total_sprk_granted
        .checked_add(STARTER_SPRK_GRANT)
        .ok_or(crate::errors::SpinxError::Overflow)?;

    Ok(())
}

#[derive(Accounts)]
#[instruction(username: String)]
pub struct InitializePlayer<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        seeds = [SEED_GAME_CONFIG],
        bump  = game_config.bump,
    )]
    pub game_config: Account<'info, GameConfig>,

    #[account(
        init,
        payer  = player,
        space  = PlayerProfile::LEN,
        seeds  = [SEED_PLAYER_PROFILE, player.key().as_ref()],
        bump,
    )]
    pub player_profile: Account<'info, PlayerProfile>,

    #[account(
        mut,
        address = game_config.sprk_mint,
    )]
    pub sprk_mint: Account<'info, Mint>,

    /// Player's associated $SPRK token account (created by the client).
    #[account(
        mut,
        token::mint      = sprk_mint,
        token::authority = player,
    )]
    pub player_sprk_ata: Account<'info, TokenAccount>,

    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

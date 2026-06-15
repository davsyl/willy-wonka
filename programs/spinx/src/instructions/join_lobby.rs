use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{Lobby, LobbySlot, LobbyStatus, PlayerProfile, GameConfig};
use crate::constants::*;
use crate::errors::SpinxError;

/// Challenger joins an open lobby, escrows their matching wager, and
/// sets the lobby status to InProgress (ready to resolve).
pub fn handler(
    ctx: Context<JoinLobby>,
    spinx_id:       u8,
    charge_percent: u8,
) -> Result<()> {
    require!(charge_percent <= 100, SpinxError::InvalidCharge);

    let lobby = &mut ctx.accounts.lobby;
    require!(lobby.status == LobbyStatus::WaitingForOpponent, SpinxError::LobbyFull);
    require!(
        ctx.accounts.challenger.key() != lobby.creator,
        SpinxError::AlreadyInLobby
    );

    let profile = &ctx.accounts.challenger_profile;
    let spinx = profile
        .spinx_builds
        .iter()
        .find(|s| s.id == spinx_id)
        .cloned()
        .ok_or(SpinxError::SpinxNotFound)?;

    // ── Escrow challenger's wager ─────────────────────────────────────────────
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.challenger_sprk_ata.to_account_info(),
                to:        ctx.accounts.lobby_escrow.to_account_info(),
                authority: ctx.accounts.challenger.to_account_info(),
            },
        ),
        lobby.wager_sprk,
    )?;

    lobby.slot_b = Some(LobbySlot {
        player:         ctx.accounts.challenger.key(),
        spinx,
        charge_percent,
        wager_amount:   lobby.wager_sprk,
    });
    lobby.status = LobbyStatus::InProgress;

    Ok(())
}

#[derive(Accounts)]
pub struct JoinLobby<'info> {
    #[account(mut)]
    pub challenger: Signer<'info>,

    #[account(
        seeds = [SEED_GAME_CONFIG],
        bump  = game_config.bump,
    )]
    pub game_config: Account<'info, GameConfig>,

    #[account(
        seeds  = [SEED_PLAYER_PROFILE, challenger.key().as_ref()],
        bump   = challenger_profile.bump,
        has_one = owner @ SpinxError::PartNotOwned,
    )]
    pub challenger_profile: Account<'info, PlayerProfile>,

    #[account(
        mut,
        seeds = [SEED_LOBBY, &lobby.id.to_le_bytes()],
        bump  = lobby.bump,
    )]
    pub lobby: Account<'info, Lobby>,

    #[account(
        mut,
        address = game_config.sprk_mint,
    )]
    pub sprk_mint: Account<'info, Mint>,

    #[account(
        mut,
        token::mint      = sprk_mint,
        token::authority = challenger,
    )]
    pub challenger_sprk_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [SEED_LOBBY_ESCROW, &lobby.id.to_le_bytes()],
        bump  = lobby.escrow_bump,
    )]
    pub lobby_escrow: Account<'info, TokenAccount>,

    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

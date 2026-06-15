use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{Lobby, LobbyStatus};
use crate::constants::*;
use crate::errors::SpinxError;

pub fn handler(ctx: Context<CancelLobby>) -> Result<()> {
    let lobby = &ctx.accounts.lobby;

    // Must still be waiting — can't cancel an in-progress or already-resolved lobby.
    require!(
        lobby.status == LobbyStatus::WaitingForOpponent,
        SpinxError::LobbyResolved
    );

    let clock     = Clock::get()?;
    let creator   = ctx.accounts.creator.key();
    let is_creator = lobby.creator == creator;
    let is_expired = clock.unix_timestamp >= lobby.created_at + LOBBY_EXPIRY_SECONDS;

    require!(
        is_creator || is_expired,
        SpinxError::LobbyCannotBeCancelled
    );

    // ── Return escrow to creator ──────────────────────────────────────────────
    let lobby_id_bytes = lobby.id.to_le_bytes();
    let lobby_seeds: &[&[u8]] = &[
        SEED_LOBBY,
        &lobby_id_bytes,
        &[lobby.bump],
    ];
    let signer = &[lobby_seeds];

    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.lobby_escrow.to_account_info(),
                to:        ctx.accounts.creator_sprk_ata.to_account_info(),
                authority: ctx.accounts.lobby.to_account_info(),
            },
            signer,
        ),
        lobby.wager_sprk,
    )?;

    // ── Mark lobby cancelled ──────────────────────────────────────────────────
    ctx.accounts.lobby.status = LobbyStatus::Cancelled;

    // TODO: close_account CPI to reclaim rent from lobby + lobby_escrow PDAs.

    Ok(())
}

#[derive(Accounts)]
pub struct CancelLobby<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [SEED_LOBBY, &lobby.id.to_le_bytes()],
        bump  = lobby.bump,
    )]
    pub lobby: Account<'info, Lobby>,

    #[account(
        mut,
        seeds = [SEED_LOBBY_ESCROW, &lobby.id.to_le_bytes()],
        bump  = lobby.escrow_bump,
    )]
    pub lobby_escrow: Account<'info, TokenAccount>,

    #[account(
        mut,
        token::mint      = sprk_mint,
        token::authority = creator,
    )]
    pub creator_sprk_ata: Account<'info, TokenAccount>,

    pub sprk_mint:      Account<'info, Mint>,
    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{GameConfig, Lobby, LobbySlot, LobbyStatus, PlayerProfile};
use crate::constants::*;
use crate::errors::SpinxError;

/// Creator opens a lobby, picks their Spinx + charge, and escrows their wager.
pub fn handler(
    ctx: Context<CreateLobby>,
    lobby_id:       u64,
    spinx_id:       u8,
    charge_percent: u8,
    wager_sprk:     u64,
) -> Result<()> {
    require!(charge_percent <= 100, SpinxError::InvalidCharge);
    require!(wager_sprk >= MIN_WAGER_SPRK, SpinxError::WagerTooLow);
    require!(wager_sprk <= MAX_WAGER_SPRK, SpinxError::WagerTooHigh);

    let profile = &ctx.accounts.player_profile;

    let spinx = profile
        .spinx_builds
        .iter()
        .find(|s| s.id == spinx_id)
        .cloned()
        .ok_or(SpinxError::SpinxNotFound)?;

    // ── Escrow wager into lobby escrow ATA ───────────────────────────────────
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.creator_sprk_ata.to_account_info(),
                to:        ctx.accounts.lobby_escrow.to_account_info(),
                authority: ctx.accounts.creator.to_account_info(),
            },
        ),
        wager_sprk,
    )?;

    // ── Initialise lobby ──────────────────────────────────────────────────────
    let clock = Clock::get()?;
    let lobby = &mut ctx.accounts.lobby;
    lobby.id         = lobby_id;
    lobby.creator    = ctx.accounts.creator.key();
    lobby.wager_sprk = wager_sprk;
    lobby.status     = LobbyStatus::WaitingForOpponent;
    lobby.created_at = clock.unix_timestamp;
    lobby.winner     = None;
    lobby.battle_seed = None;
    lobby.bump       = ctx.bumps.lobby;
    lobby.escrow_bump = ctx.bumps.lobby_escrow;

    lobby.slot_a = LobbySlot {
        player:         ctx.accounts.creator.key(),
        spinx,
        charge_percent,
        wager_amount:   wager_sprk,
    };
    lobby.slot_b = None;

    Ok(())
}

#[derive(Accounts)]
#[instruction(lobby_id: u64)]
pub struct CreateLobby<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        seeds = [SEED_GAME_CONFIG],
        bump  = game_config.bump,
    )]
    pub game_config: Account<'info, GameConfig>,

    #[account(
        seeds  = [SEED_PLAYER_PROFILE, creator.key().as_ref()],
        bump   = player_profile.bump,
        has_one = owner @ SpinxError::PartNotOwned,
    )]
    pub player_profile: Account<'info, PlayerProfile>,

    #[account(
        init,
        payer  = creator,
        space  = Lobby::LEN,
        seeds  = [SEED_LOBBY, &lobby_id.to_le_bytes()],
        bump,
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
        token::authority = creator,
    )]
    pub creator_sprk_ata: Account<'info, TokenAccount>,

    /// Escrow ATA owned by the lobby PDA — holds both sides' wagers.
    #[account(
        init,
        payer  = creator,
        token::mint      = sprk_mint,
        token::authority = lobby,
        seeds  = [SEED_LOBBY_ESCROW, &lobby_id.to_le_bytes()],
        bump,
    )]
    pub lobby_escrow: Account<'info, TokenAccount>,

    pub token_program:       Program<'info, Token>,
    pub system_program:      Program<'info, System>,
    pub rent:                Sysvar<'info, Rent>,
}

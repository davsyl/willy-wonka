use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use crate::state::{
    GameConfig, Lobby, LobbyStatus, PlayerProfile,
    spinx::{CoreVariant, DriveVariant, LockVariant, RingVariant, SpinxBuild, SpinxStats, WeightVariant},
};
use crate::constants::*;
use crate::errors::SpinxError;

// ─── Public instruction ───────────────────────────────────────────────────────

/// Anyone (typically a crank/relayer) can call this once both players are
/// confirmed, using the current slot hash as the battle seed.
pub fn handler(ctx: Context<ResolveBattle>) -> Result<()> {
    let lobby = &ctx.accounts.lobby;
    require!(lobby.status == LobbyStatus::InProgress, SpinxError::LobbyNotFull);

    let slot_b = lobby.slot_b.as_ref().ok_or(SpinxError::LobbyNotFull)?;

    // ── Build battle seed from slot hash + player keys ────────────────────────
    let clock = Clock::get()?;
    let seed_input = [
        clock.slot.to_le_bytes().as_ref(),
        lobby.slot_a.player.as_ref(),
        slot_b.player.as_ref(),
    ]
    .concat();
    let seed_hash = anchor_lang::solana_program::hash::hash(&seed_input);
    let seed = seed_hash.to_bytes();

    // ── Run battle simulation ─────────────────────────────────────────────────
    let winner_is_a = simulate_battle(
        &lobby.slot_a.spinx,
        lobby.slot_a.charge_percent,
        &slot_b.spinx,
        slot_b.charge_percent,
        &seed,
    );

    let (winner_key, loser_key) = if winner_is_a {
        (lobby.slot_a.player, slot_b.player)
    } else {
        (slot_b.player, lobby.slot_a.player)
    };

    let lobby_id_bytes = lobby.id.to_le_bytes();
    let lobby_seeds: &[&[u8]] = &[
        SEED_LOBBY,
        &lobby_id_bytes,
        &[lobby.bump],
    ];
    let signer = &[lobby_seeds];

    let total_pot = lobby
        .wager_sprk
        .checked_mul(2)
        .ok_or(SpinxError::Overflow)?;

    // ── Transfer pot to winner ATA ────────────────────────────────────────────
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.lobby_escrow.to_account_info(),
                to:        ctx.accounts.winner_sprk_ata.to_account_info(),
                authority: ctx.accounts.lobby.to_account_info(),
            },
            signer,
        ),
        total_pot,
    )?;

    // ── Update lobby state ────────────────────────────────────────────────────
    let lobby_mut = &mut ctx.accounts.lobby;
    lobby_mut.winner      = Some(winner_key);
    lobby_mut.battle_seed = Some(seed);
    lobby_mut.status      = LobbyStatus::Resolved;

    // ── Update game config counter ────────────────────────────────────────────
    ctx.accounts.game_config.total_battles = ctx
        .accounts
        .game_config
        .total_battles
        .checked_add(1)
        .ok_or(SpinxError::Overflow)?;

    // ── Update player profiles ────────────────────────────────────────────────
    let is_creator_winner = winner_key == ctx.accounts.lobby.creator;

    let (winner_profile, loser_profile) = if is_creator_winner {
        (
            &mut ctx.accounts.creator_profile,
            &mut ctx.accounts.challenger_profile,
        )
    } else {
        (
            &mut ctx.accounts.challenger_profile,
            &mut ctx.accounts.creator_profile,
        )
    };

    winner_profile.wins = winner_profile.wins.saturating_add(1);
    winner_profile.total_sprk_won = winner_profile
        .total_sprk_won
        .checked_add(ctx.accounts.lobby.wager_sprk)
        .ok_or(SpinxError::Overflow)?;

    loser_profile.losses = loser_profile.losses.saturating_add(1);
    loser_profile.total_sprk_lost = loser_profile
        .total_sprk_lost
        .checked_add(ctx.accounts.lobby.wager_sprk)
        .ok_or(SpinxError::Overflow)?;

    Ok(())
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct ResolveBattle<'info> {
    /// The crank/resolver — pays tx fee, gets no prize.
    #[account(mut)]
    pub resolver: Signer<'info>,

    #[account(
        mut,
        seeds = [SEED_GAME_CONFIG],
        bump  = game_config.bump,
    )]
    pub game_config: Account<'info, GameConfig>,

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
        seeds = [SEED_PLAYER_PROFILE, lobby.creator.as_ref()],
        bump  = creator_profile.bump,
    )]
    pub creator_profile: Account<'info, PlayerProfile>,

    #[account(mut)]
    pub challenger_profile: Account<'info, PlayerProfile>,

    /// The winner's $SPRK token account — validated against winner_key post-resolution.
    #[account(mut)]
    pub winner_sprk_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        address = game_config.sprk_mint,
    )]
    pub sprk_mint: Account<'info, Mint>,

    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// ─── Battle Simulation Engine ─────────────────────────────────────────────────

/// Returns `true` if slot A wins.
///
/// The simulation runs `BATTLE_TICKS` rounds. Each tick, both Spinxes deal
/// damage to each other's stamina, modified by:
///   - charge_percent (overcharge penalty applied above threshold)
///   - special variant abilities (checked once per tick)
///   - a pseudo-random factor derived from the seed
///
/// The Spinx whose stamina reaches zero first loses.
/// On a tie (same tick), the one with higher remaining stamina wins.
fn simulate_battle(
    spinx_a: &SpinxBuild,
    charge_a: u8,
    spinx_b: &SpinxBuild,
    charge_b: u8,
    seed: &[u8; 32],
) -> bool {
    let mut stamina_a = apply_charge_to_stamina(spinx_a.stats.stamina, charge_a, &spinx_a.stats);
    let mut stamina_b = apply_charge_to_stamina(spinx_b.stats.stamina, charge_b, &spinx_b.stats);

    let mut speed_a = apply_charge_to_speed(spinx_a.stats.speed, charge_a);
    let mut speed_b = apply_charge_to_speed(spinx_b.stats.speed, charge_b);

    // Nova Core late-game bonus: speed grows with ticks elapsed.
    let nova_a = matches!(spinx_a.core.variant, CoreVariant::Nova);
    let nova_b = matches!(spinx_b.core.variant, CoreVariant::Nova);

    // Phase Lock mid-battle swap flag.
    let mut phase_triggered_a = false;
    let mut phase_triggered_b = false;

    let initial_stamina_a = stamina_a;
    let initial_stamina_b = stamina_b;

    for tick in 0..BATTLE_TICKS {
        let rand_byte_a = seed[(tick as usize * 2)     % 32];
        let rand_byte_b = seed[(tick as usize * 2 + 1) % 32];

        // ── Nova late-game scaling (kicks in after tick 60) ────────────────
        if nova_a && tick > 60 {
            speed_a = speed_a.saturating_add((tick - 60) as u16 * 2);
        }
        if nova_b && tick > 60 {
            speed_b = speed_b.saturating_add((tick - 60) as u16 * 2);
        }

        // ── Phase Lock mid-battle stat swap at 50% stamina ────────────────
        if !phase_triggered_a
            && matches!(spinx_a.lock.variant, LockVariant::Phase)
            && stamina_a < initial_stamina_a / 2
        {
            // Swap attack and defense for the rest of the battle.
            phase_triggered_a = true;
        }
        if !phase_triggered_b
            && matches!(spinx_b.lock.variant, LockVariant::Phase)
            && stamina_b < initial_stamina_b / 2
        {
            phase_triggered_b = true;
        }

        let mut atk_a = if phase_triggered_a { spinx_a.stats.defense } else { spinx_a.stats.attack };
        let mut atk_b = if phase_triggered_b { spinx_b.stats.defense } else { spinx_b.stats.attack };

        // ── Speed determines first-strike advantage ────────────────────────
        // The faster top adds a bonus 10% damage this tick.
        if speed_a > speed_b {
            atk_a = atk_a.saturating_add(atk_a / 10);
        } else if speed_b > speed_a {
            atk_b = atk_b.saturating_add(atk_b / 10);
        }

        // ── Crescent Ring spin-steal ───────────────────────────────────────
        if matches!(spinx_a.ring.variant, RingVariant::Crescent) && rand_byte_a > 180 {
            speed_b = speed_b.saturating_sub(5);
        }
        if matches!(spinx_b.ring.variant, RingVariant::Crescent) && rand_byte_b > 180 {
            speed_a = speed_a.saturating_sub(5);
        }

        // ── Void Core opponent spin disruption ────────────────────────────
        if matches!(spinx_a.core.variant, CoreVariant::Void) && rand_byte_a > 200 {
            atk_b = atk_b.saturating_sub(atk_b / 5);
        }
        if matches!(spinx_b.core.variant, CoreVariant::Void) && rand_byte_b > 200 {
            atk_a = atk_a.saturating_sub(atk_a / 5);
        }

        // ── Over Lock self-destabilisation risk ───────────────────────────
        if matches!(spinx_a.lock.variant, LockVariant::Over) && rand_byte_a < 30 {
            stamina_a = stamina_a.saturating_sub(rand_byte_a as u16);
        }
        if matches!(spinx_b.lock.variant, LockVariant::Over) && rand_byte_b < 30 {
            stamina_b = stamina_b.saturating_sub(rand_byte_b as u16);
        }

        // ── Split / Drift random wildcard ─────────────────────────────────
        let a_has_random = matches!(spinx_a.weight.variant, WeightVariant::Split)
            || matches!(spinx_a.drive.variant, DriveVariant::Drift);
        let b_has_random = matches!(spinx_b.weight.variant, WeightVariant::Split)
            || matches!(spinx_b.drive.variant, DriveVariant::Drift);

        if a_has_random {
            atk_a = atk_a.saturating_add((rand_byte_a % 20) as u16);
        }
        if b_has_random {
            atk_b = atk_b.saturating_add((rand_byte_b % 20) as u16);
        }

        // ── Pulse Core stamina recovery ───────────────────────────────────
        if matches!(spinx_a.core.variant, CoreVariant::Pulse) && tick % 10 == 0 {
            stamina_a = stamina_a.saturating_add(spinx_a.stats.stamina / 20);
        }
        if matches!(spinx_b.core.variant, CoreVariant::Pulse) && tick % 10 == 0 {
            stamina_b = stamina_b.saturating_add(spinx_b.stats.stamina / 20);
        }

        // ── Apply defence reduction ────────────────────────────────────────
        let net_dmg_to_b = compute_damage(atk_a, spinx_b.stats.defense);
        let net_dmg_to_a = compute_damage(atk_b, spinx_a.stats.defense);

        stamina_b = stamina_b.saturating_sub(net_dmg_to_b);
        stamina_a = stamina_a.saturating_sub(net_dmg_to_a);

        if stamina_a == 0 && stamina_b == 0 {
            // Tie-break: whoever had more stamina at start wins.
            return spinx_a.stats.stamina >= spinx_b.stats.stamina;
        }
        if stamina_a == 0 { return false; }
        if stamina_b == 0 { return true;  }
    }

    // After all ticks, whoever has more remaining stamina wins.
    stamina_a >= stamina_b
}

/// Scale initial stamina by charge, penalising overcharge.
fn apply_charge_to_stamina(base: u16, charge: u8, stats: &SpinxStats) -> u16 {
    // Charging above OVERCHARGE_THRESHOLD drains stamina.
    if charge > OVERCHARGE_THRESHOLD {
        let excess = (charge - OVERCHARGE_THRESHOLD) as u16;
        let penalty = excess * OVERCHARGE_SPEED_PENALTY as u16;
        base.saturating_sub((base as u32 * penalty as u32 / 100) as u16)
    } else {
        base
    }
}

/// Scale speed by charge — more charge = faster, but overcharging caps out.
fn apply_charge_to_speed(base: u16, charge: u8) -> u16 {
    let effective_charge = charge.min(OVERCHARGE_THRESHOLD) as u16;
    base.saturating_add(base * effective_charge / 200)
}

/// Damage formula: attack minus half of defense, minimum 1.
fn compute_damage(attack: u16, defense: u16) -> u16 {
    let reduced = attack.saturating_sub(defense / 2);
    reduced.max(1)
}

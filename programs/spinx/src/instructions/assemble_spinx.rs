use anchor_lang::prelude::*;
use crate::state::{PlayerProfile};
use crate::state::spinx::{SpinxBuild, SpinxStats};
use crate::errors::SpinxError;
use crate::constants::*;

/// Combine five parts (by their inventory IDs) into an assembled SpinxBuild.
/// The five parts must already be in the player's inventory.
pub fn handler(
    ctx: Context<AssembleSpinx>,
    core_id:   u16,
    ring_id:   u16,
    weight_id: u16,
    drive_id:  u16,
    lock_id:   u16,
) -> Result<()> {
    let profile = &mut ctx.accounts.player_profile;

    require!(
        (profile.spinx_builds.len() as u8) < MAX_SPINX_PER_PLAYER,
        SpinxError::SpinxInventoryFull
    );

    // ── Find and clone each part ──────────────────────────────────────────────
    let core = profile
        .cores
        .iter()
        .find(|c| c.id == core_id)
        .cloned()
        .ok_or(SpinxError::SpinxNotFound)?;

    let ring = profile
        .rings
        .iter()
        .find(|r| r.id == ring_id)
        .cloned()
        .ok_or(SpinxError::SpinxNotFound)?;

    let weight = profile
        .weights
        .iter()
        .find(|w| w.id == weight_id)
        .cloned()
        .ok_or(SpinxError::SpinxNotFound)?;

    let drive = profile
        .drives
        .iter()
        .find(|d| d.id == drive_id)
        .cloned()
        .ok_or(SpinxError::SpinxNotFound)?;

    let lock = profile
        .locks
        .iter()
        .find(|l| l.id == lock_id)
        .cloned()
        .ok_or(SpinxError::SpinxNotFound)?;

    // ── Compute stats ─────────────────────────────────────────────────────────
    let stats = SpinxStats::derive(&core, &ring, &weight, &drive, &lock);

    let build = SpinxBuild {
        id: profile.next_spinx_id,
        core,
        ring,
        weight,
        drive,
        lock,
        stats,
    };

    profile.next_spinx_id = profile.next_spinx_id.saturating_add(1);
    profile.spinx_builds.push(build);

    Ok(())
}

#[derive(Accounts)]
pub struct AssembleSpinx<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        seeds  = [SEED_PLAYER_PROFILE, player.key().as_ref()],
        bump   = player_profile.bump,
        has_one = owner @ SpinxError::PartNotOwned,
    )]
    pub player_profile: Account<'info, PlayerProfile>,

    pub system_program: Program<'info, System>,
}

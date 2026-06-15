use anchor_lang::prelude::*;
use crate::state::{Leaderboard, LeaderboardEntry, PlayerProfile};
use crate::constants::{SEED_LEADERBOARD, SEED_PLAYER_PROFILE};

pub fn handler(ctx: Context<UpdateLeaderboard>) -> Result<()> {
    let profile = &ctx.accounts.player_profile;
    let player  = profile.owner;

    let wins   = profile.wins;
    let losses = profile.losses;
    let total  = profile.total_sprk_won;
    let bps    = (wins as u64)
        .checked_mul(10_000)
        .unwrap_or(u64::MAX)
        / (wins as u64).saturating_add(losses as u64).max(1);
    let bps = bps.min(10_000) as u16;

    let lb = &mut ctx.accounts.leaderboard;

    // ── Find existing entry and update in place ───────────────────────────────
    if let Some(entry) = lb.entries.iter_mut().find(|e| e.player == player) {
        entry.wins           = wins;
        entry.losses         = losses;
        entry.total_sprk_won = total;
        entry.win_rate_bps   = bps;
    } else {
        let new_entry = LeaderboardEntry {
            player,
            wins,
            losses,
            total_sprk_won: total,
            win_rate_bps: bps,
        };

        if lb.entries.len() < 100 {
            lb.entries.push(new_entry);
        } else {
            // Replace last entry only if this player beats its win_rate_bps
            let last = lb.entries.last().unwrap();
            if bps > last.win_rate_bps
                || (bps == last.win_rate_bps && total > last.total_sprk_won)
            {
                let last_idx = lb.entries.len() - 1;
                lb.entries[last_idx] = new_entry;
            }
        }
    }

    // ── Sort descending: win_rate_bps first, total_sprk_won as tiebreak ──────
    lb.entries.sort_unstable_by(|a, b| {
        b.win_rate_bps
            .cmp(&a.win_rate_bps)
            .then_with(|| b.total_sprk_won.cmp(&a.total_sprk_won))
    });

    Ok(())
}

#[derive(Accounts)]
pub struct UpdateLeaderboard<'info> {
    #[account(
        mut,
        seeds = [SEED_LEADERBOARD],
        bump  = leaderboard.bump,
    )]
    pub leaderboard: Account<'info, Leaderboard>,

    #[account(
        seeds = [SEED_PLAYER_PROFILE, player_profile.owner.as_ref()],
        bump  = player_profile.bump,
    )]
    pub player_profile: Account<'info, PlayerProfile>,
}

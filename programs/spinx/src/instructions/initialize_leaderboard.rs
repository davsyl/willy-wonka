use anchor_lang::prelude::*;
use crate::state::Leaderboard;
use crate::constants::SEED_LEADERBOARD;

pub fn handler(ctx: Context<InitializeLeaderboard>) -> Result<()> {
    let lb = &mut ctx.accounts.leaderboard;
    lb.entries = Vec::new();
    lb.bump    = ctx.bumps.leaderboard;
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeLeaderboard<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer  = authority,
        space  = Leaderboard::LEN,
        seeds  = [SEED_LEADERBOARD],
        bump,
    )]
    pub leaderboard: Account<'info, Leaderboard>,

    pub system_program: Program<'info, System>,
}

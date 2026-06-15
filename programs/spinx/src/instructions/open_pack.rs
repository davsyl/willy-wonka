use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount, Transfer};
use crate::state::{GameConfig, PlayerProfile};
use crate::state::spinx::*;
use crate::constants::*;
use crate::errors::SpinxError;

/// Buy and open a single part-pack for the specified category.
/// Burns PACK_PRICE_SPRK from the player's wallet and adds a randomly
/// generated part to the matching inventory slot.
pub fn handler(ctx: Context<OpenPack>, category: u8) -> Result<()> {
    // ── Validate category ────────────────────────────────────────────────────
    let part_category = parse_category(category)?;

    let profile = &mut ctx.accounts.player_profile;

    // ── Transfer PACK_PRICE_SPRK to treasury ──────────────────────────────────
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from:      ctx.accounts.player_sprk_ata.to_account_info(),
                to:        ctx.accounts.treasury_ata.to_account_info(),
                authority: ctx.accounts.player.to_account_info(),
            },
        ),
        PACK_PRICE_SPRK,
    )?;

    // ── Derive a pseudo-random seed from available on-chain entropy ───────────
    // In production, integrate a VRF (e.g. Switchboard / Pyth entropy).
    // Here we use a hash of slot, player key, and inventory size — sufficient
    // for a casual game, but not VRF-grade randomness.
    let clock = Clock::get()?;
    let seed_input = [
        clock.slot.to_le_bytes().as_ref(),
        ctx.accounts.player.key().as_ref(),
        &[profile.next_core_id as u8, category],
    ]
    .concat();
    let hash = anchor_lang::solana_program::hash::hash(&seed_input);
    let rand_bytes = hash.to_bytes();

    // ── Mint part into inventory ──────────────────────────────────────────────
    match part_category {
        PartCategory::Core => {
            require!(
                (profile.cores.len() as u8) < MAX_PARTS_PER_CATEGORY,
                SpinxError::PartInventoryFull
            );
            let variant = roll_core_variant(rand_bytes[0]);
            let rarity  = roll_rarity(rand_bytes[1]);
            let id      = profile.next_core_id;
            profile.next_core_id = profile.next_core_id.saturating_add(1);
            profile.cores.push(CoreData { variant, rarity, id });
        }
        PartCategory::Ring => {
            require!(
                (profile.rings.len() as u8) < MAX_PARTS_PER_CATEGORY,
                SpinxError::PartInventoryFull
            );
            let variant = roll_ring_variant(rand_bytes[0]);
            let rarity  = roll_rarity(rand_bytes[1]);
            let id      = profile.next_ring_id;
            profile.next_ring_id = profile.next_ring_id.saturating_add(1);
            profile.rings.push(RingData { variant, rarity, id });
        }
        PartCategory::Weight => {
            require!(
                (profile.weights.len() as u8) < MAX_PARTS_PER_CATEGORY,
                SpinxError::PartInventoryFull
            );
            let variant = roll_weight_variant(rand_bytes[0]);
            let rarity  = roll_rarity(rand_bytes[1]);
            let id      = profile.next_weight_id;
            profile.next_weight_id = profile.next_weight_id.saturating_add(1);
            profile.weights.push(WeightData { variant, rarity, id });
        }
        PartCategory::Drive => {
            require!(
                (profile.drives.len() as u8) < MAX_PARTS_PER_CATEGORY,
                SpinxError::PartInventoryFull
            );
            let variant = roll_drive_variant(rand_bytes[0]);
            let rarity  = roll_rarity(rand_bytes[1]);
            let id      = profile.next_drive_id;
            profile.next_drive_id = profile.next_drive_id.saturating_add(1);
            profile.drives.push(DriveData { variant, rarity, id });
        }
        PartCategory::Lock => {
            require!(
                (profile.locks.len() as u8) < MAX_PARTS_PER_CATEGORY,
                SpinxError::PartInventoryFull
            );
            let variant = roll_lock_variant(rand_bytes[0]);
            let rarity  = roll_rarity(rand_bytes[1]);
            let id      = profile.next_lock_id;
            profile.next_lock_id = profile.next_lock_id.saturating_add(1);
            profile.locks.push(LockData { variant, rarity, id });
        }
    }

    Ok(())
}

// ─── Accounts ─────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct OpenPack<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        seeds = [SEED_GAME_CONFIG],
        bump  = game_config.bump,
    )]
    pub game_config: Account<'info, GameConfig>,

    #[account(
        mut,
        seeds = [SEED_PLAYER_PROFILE, player.key().as_ref()],
        bump  = player_profile.bump,
        has_one = owner @ SpinxError::PartNotOwned,
    )]
    pub player_profile: Account<'info, PlayerProfile>,

    #[account(
        mut,
        address = game_config.sprk_mint,
    )]
    pub sprk_mint: Account<'info, Mint>,

    #[account(
        mut,
        token::mint      = sprk_mint,
        token::authority = player,
    )]
    pub player_sprk_ata: Account<'info, TokenAccount>,

    /// Treasury ATA receives pack fees.
    #[account(
        mut,
        address = game_config.treasury,
    )]
    pub treasury_ata: Account<'info, TokenAccount>,

    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

// ─── Roll helpers ─────────────────────────────────────────────────────────────

fn parse_category(raw: u8) -> Result<PartCategory> {
    match raw {
        0 => Ok(PartCategory::Core),
        1 => Ok(PartCategory::Ring),
        2 => Ok(PartCategory::Weight),
        3 => Ok(PartCategory::Drive),
        4 => Ok(PartCategory::Lock),
        _ => err!(SpinxError::InvalidPartType),
    }
}

/// 5-tier weighted rarity table.
/// Common ~50%, Uncommon ~25%, Rare ~15%, Epic ~7%, Legendary ~3%
fn roll_rarity(byte: u8) -> Rarity {
    match byte {
        0..=126  => Rarity::Common,
        127..=189 => Rarity::Uncommon,
        190..=227 => Rarity::Rare,
        228..=244 => Rarity::Epic,
        _         => Rarity::Legendary,
    }
}

fn roll_core_variant(byte: u8) -> CoreVariant {
    match byte % 5 {
        0 => CoreVariant::Flare,
        1 => CoreVariant::Anchor,
        2 => CoreVariant::Pulse,
        3 => CoreVariant::Void,
        _ => CoreVariant::Nova,
    }
}

fn roll_ring_variant(byte: u8) -> RingVariant {
    match byte % 5 {
        0 => RingVariant::Fang,
        1 => RingVariant::Guard,
        2 => RingVariant::Rebound,
        3 => RingVariant::Crescent,
        _ => RingVariant::Hammer,
    }
}

fn roll_weight_variant(byte: u8) -> WeightVariant {
    match byte % 5 {
        0 => WeightVariant::Center,
        1 => WeightVariant::Edge,
        2 => WeightVariant::Split,
        3 => WeightVariant::Low,
        _ => WeightVariant::Heavy,
    }
}

fn roll_drive_variant(byte: u8) -> DriveVariant {
    match byte % 6 {
        0 => DriveVariant::Needle,
        1 => DriveVariant::Flat,
        2 => DriveVariant::Orbit,
        3 => DriveVariant::Drift,
        4 => DriveVariant::Grip,
        _ => DriveVariant::Dash,
    }
}

fn roll_lock_variant(byte: u8) -> LockVariant {
    match byte % 5 {
        0 => LockVariant::Tight,
        1 => LockVariant::Flex,
        2 => LockVariant::Quick,
        3 => LockVariant::Over,
        _ => LockVariant::Phase,
    }
}

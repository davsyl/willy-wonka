use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod state;
pub mod instructions;

use instructions::*;
use state::spinx::PartCategory;

declare_id!("SpinxGame11111111111111111111111111111111111");

#[program]
pub mod spinx {
    use super::*;

    // ── Setup ─────────────────────────────────────────────────────────────────

    /// One-time: initialise the singleton game config and $SPRK mint.
    pub fn initialize_game(ctx: Context<InitializeGame>) -> Result<()> {
        instructions::initialize_game::handler(ctx)
    }

    /// Create a new player profile and mint the starter $SPRK grant.
    pub fn initialize_player(ctx: Context<InitializePlayer>, username: String) -> Result<()> {
        instructions::initialize_player::handler(ctx, username)
    }

    // ── Parts / Economy ───────────────────────────────────────────────────────

    /// Purchase and open one part-pack for a given category (0=Core…4=Lock).
    pub fn open_pack(ctx: Context<OpenPack>, category: u8) -> Result<()> {
        instructions::open_pack::handler(ctx, category)
    }

    /// Assemble five parts into a ready-to-battle Spinx build.
    pub fn assemble_spinx(
        ctx: Context<AssembleSpinx>,
        core_id:   u16,
        ring_id:   u16,
        weight_id: u16,
        drive_id:  u16,
        lock_id:   u16,
    ) -> Result<()> {
        instructions::assemble_spinx::handler(ctx, core_id, ring_id, weight_id, drive_id, lock_id)
    }

    // ── Battle ────────────────────────────────────────────────────────────────

    /// Open a battle lobby, deposit wager into escrow.
    pub fn create_lobby(
        ctx: Context<CreateLobby>,
        lobby_id:       u64,
        spinx_id:       u8,
        charge_percent: u8,
        wager_sprk:     u64,
    ) -> Result<()> {
        instructions::create_lobby::handler(ctx, lobby_id, spinx_id, charge_percent, wager_sprk)
    }

    /// Join an existing lobby as the challenger.
    pub fn join_lobby(
        ctx: Context<JoinLobby>,
        spinx_id:       u8,
        charge_percent: u8,
    ) -> Result<()> {
        instructions::join_lobby::handler(ctx, spinx_id, charge_percent)
    }

    /// Resolve a full lobby — run the battle sim and pay out the winner.
    pub fn resolve_battle(ctx: Context<ResolveBattle>) -> Result<()> {
        instructions::resolve_battle::handler(ctx)
    }

    // ── Leaderboard ───────────────────────────────────────────────────────────

    /// One-time: initialise the singleton leaderboard account.
    pub fn initialize_leaderboard(ctx: Context<InitializeLeaderboard>) -> Result<()> {
        instructions::initialize_leaderboard::handler(ctx)
    }

    /// Upsert a player's stats into the leaderboard.
    pub fn update_leaderboard(ctx: Context<UpdateLeaderboard>) -> Result<()> {
        instructions::update_leaderboard::handler(ctx)
    }

    // ── Lobby lifecycle ───────────────────────────────────────────────────────

    /// Cancel a waiting lobby and refund the creator's escrow.
    pub fn cancel_lobby(ctx: Context<CancelLobby>) -> Result<()> {
        instructions::cancel_lobby::handler(ctx)
    }

    // ── NFT Minting ───────────────────────────────────────────────────────────

    /// Mint an on-chain Metaplex NFT for an owned Core part.
    pub fn mint_core_nft(ctx: Context<MintCoreNft>, core_id: u16) -> Result<()> {
        instructions::mint_core_nft::handler(ctx, core_id)
    }
}

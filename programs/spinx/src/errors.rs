use anchor_lang::prelude::*;

#[error_code]
pub enum SpinxError {
    // ── Part / Inventory ──────────────────────────────────────────────────────
    #[msg("Invalid part type discriminant")]
    InvalidPartType,
    #[msg("Invalid rarity discriminant")]
    InvalidRarity,
    #[msg("Part does not belong to this player")]
    PartNotOwned,
    #[msg("Part inventory is full for this category")]
    PartInventoryFull,
    #[msg("Spinx inventory is full")]
    SpinxInventoryFull,
    #[msg("Spinx ID not found on this player")]
    SpinxNotFound,
    #[msg("Spinx is already assembled — disassemble first")]
    SpinxAlreadyAssembled,

    // ── Battle ────────────────────────────────────────────────────────────────
    #[msg("Lobby is full")]
    LobbyFull,
    #[msg("Player is already in this lobby")]
    AlreadyInLobby,
    #[msg("Lobby is not ready to resolve — waiting for second player")]
    LobbyNotFull,
    #[msg("Lobby is already resolved")]
    LobbyResolved,
    #[msg("Wager is below the minimum allowed")]
    WagerTooLow,
    #[msg("Wager is above the maximum allowed")]
    WagerTooHigh,
    #[msg("Wager amounts must match")]
    WagerMismatch,
    #[msg("Charge must be between 0 and 100")]
    InvalidCharge,
    #[msg("Only the lobby creator can resolve an expired lobby")]
    UnauthorisedResolve,

    // ── Economy ───────────────────────────────────────────────────────────────
    #[msg("Insufficient $SPRK balance")]
    InsufficientSprk,

    // ── Auth ──────────────────────────────────────────────────────────────────
    #[msg("Arithmetic overflow")]
    Overflow,
}

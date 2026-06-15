use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    metadata::{
        create_master_edition_v3, create_metadata_accounts_v3,
        mpl_token_metadata::types::{Collection, Creator, DataV2, Uses},
        CreateMasterEditionV3, CreateMetadataAccountsV3, Metadata,
    },
    token::{mint_to, Mint, MintTo, Token, TokenAccount},
};

use crate::{
    errors::SpinxError,
    state::{CoreNftRecord, GameConfig, PlayerProfile},
};

#[derive(Accounts)]
#[instruction(core_id: u16)]
pub struct MintCoreNft<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    // Alias: player == payer (same signer used as both authority and owner check)
    /// CHECK: same as payer — used as mint/freeze authority and ATA authority
    #[account(mut, address = payer.key())]
    pub player: AccountInfo<'info>,

    #[account(
        seeds = [b"game_config"],
        bump = game_config.bump,
    )]
    pub game_config: Account<'info, GameConfig>,

    #[account(
        mut,
        seeds = [b"player_profile", payer.key().as_ref()],
        bump = player_profile.bump,
        has_one = owner @ SpinxError::PartNotOwned,
    )]
    pub player_profile: Account<'info, PlayerProfile>,

    #[account(
        init,
        payer = payer,
        mint::decimals = 0,
        mint::authority = payer,
        mint::freeze_authority = payer,
    )]
    pub nft_mint: Account<'info, Mint>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = nft_mint,
        associated_token::authority = payer,
    )]
    pub nft_ata: Account<'info, TokenAccount>,

    /// CHECK: Created by mpl-token-metadata CPI
    #[account(mut)]
    pub metadata: UncheckedAccount<'info>,

    /// CHECK: Created by mpl-token-metadata CPI
    #[account(mut)]
    pub master_edition: UncheckedAccount<'info>,

    #[account(
        init,
        payer = payer,
        space = CoreNftRecord::LEN,
        seeds = [b"core_nft", payer.key().as_ref(), &core_id.to_le_bytes()],
        bump,
    )]
    pub core_nft_record: Account<'info, CoreNftRecord>,

    pub token_metadata_program: Program<'info, Metadata>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<MintCoreNft>, core_id: u16) -> Result<()> {
    // 1. Find the core by id in the player's inventory
    let core = ctx
        .accounts
        .player_profile
        .cores
        .iter()
        .find(|c| c.id == core_id)
        .ok_or(SpinxError::SpinxNotFound)?
        .clone();

    // 2. Build metadata strings
    let raw_name = format!("Spinx Core #{} — {:?}", core.id, core.variant);
    let name = if raw_name.len() > 32 {
        raw_name[..32].to_string()
    } else {
        raw_name
    };
    let symbol = "SPRX".to_string();
    let uri = format!("https://metadata.spinx.gg/core/{}.json", core.id);

    // 3. Mint 1 token to the ATA
    let mint_to_ctx = CpiContext::new(
        ctx.accounts.token_program.to_account_info(),
        MintTo {
            mint: ctx.accounts.nft_mint.to_account_info(),
            to: ctx.accounts.nft_ata.to_account_info(),
            authority: ctx.accounts.payer.to_account_info(),
        },
    );
    mint_to(mint_to_ctx, 1)?;

    // 4. CPI: create_metadata_accounts_v3
    let creators = Some(vec![Creator {
        address: ctx.accounts.payer.key(),
        verified: false,
        share: 100,
    }]);

    let data = DataV2 {
        name,
        symbol,
        uri,
        seller_fee_basis_points: 500,
        creators,
        collection: None::<Collection>,
        uses: None::<Uses>,
    };

    let metadata_ctx = CpiContext::new(
        ctx.accounts.token_metadata_program.to_account_info(),
        CreateMetadataAccountsV3 {
            metadata: ctx.accounts.metadata.to_account_info(),
            mint: ctx.accounts.nft_mint.to_account_info(),
            mint_authority: ctx.accounts.payer.to_account_info(),
            payer: ctx.accounts.payer.to_account_info(),
            update_authority: ctx.accounts.payer.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        },
    );
    create_metadata_accounts_v3(metadata_ctx, data, true, true, None)?;

    // 5. CPI: create_master_edition_v3 (max_supply = 0 → 1/1)
    let edition_ctx = CpiContext::new(
        ctx.accounts.token_metadata_program.to_account_info(),
        CreateMasterEditionV3 {
            edition: ctx.accounts.master_edition.to_account_info(),
            mint: ctx.accounts.nft_mint.to_account_info(),
            update_authority: ctx.accounts.payer.to_account_info(),
            mint_authority: ctx.accounts.payer.to_account_info(),
            payer: ctx.accounts.payer.to_account_info(),
            metadata: ctx.accounts.metadata.to_account_info(),
            token_program: ctx.accounts.token_program.to_account_info(),
            system_program: ctx.accounts.system_program.to_account_info(),
            rent: ctx.accounts.rent.to_account_info(),
        },
    );
    create_master_edition_v3(edition_ctx, Some(0))?;

    // 6. Populate the CoreNftRecord
    let record = &mut ctx.accounts.core_nft_record;
    record.player = ctx.accounts.payer.key();
    record.core_id = core_id;
    record.nft_mint = ctx.accounts.nft_mint.key();
    record.bump = ctx.bumps.core_nft_record;

    Ok(())
}

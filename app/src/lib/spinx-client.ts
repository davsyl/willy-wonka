/**
 * SpinxClient — high-level TypeScript wrapper around the on-chain program.
 *
 * Usage:
 *   const client = new SpinxClient(program, wallet.publicKey);
 *   await client.initializePlayer("Ash");
 *   await client.openPack(PartCategory.Core);
 */

import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  type TransactionSignature,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import type { SpinxProgram } from "./anchor";
import { gameConfigPda, playerProfilePda, lobbyPda, lobbyEscrowPda } from "./pda";
import { PartCategory } from "../types/spinx";
import type { PlayerProfileAccount, LobbyAccount } from "../types/spinx";

export class SpinxClient {
  constructor(
    private readonly program: SpinxProgram,
    private readonly wallet: PublicKey
  ) {}

  // ── Game config ─────────────────────────────────────────────────────────────

  /** Fetch the on-chain GameConfig singleton. */
  async fetchGameConfig() {
    const [pda] = gameConfigPda();
    return this.program.account.gameConfig.fetch(pda);
  }

  // ── Player profile ──────────────────────────────────────────────────────────

  /** Fetch the caller's player profile (throws if not initialised). */
  async fetchPlayerProfile(player = this.wallet): Promise<PlayerProfileAccount> {
    const [pda] = playerProfilePda(player);
    return this.program.account.playerProfile.fetch(pda) as any;
  }

  /**
   * Create a player profile and mint the starter $SPRK grant.
   * The caller's associated $SPRK token account is created if needed.
   */
  async initializePlayer(username: string): Promise<TransactionSignature> {
    const [gameConfigPDA] = gameConfigPda();
    const gameConfig = await this.fetchGameConfig();

    const playerSprkAta = getAssociatedTokenAddressSync(
      gameConfig.sprkMint,
      this.wallet
    );

    const [profilePda] = playerProfilePda(this.wallet);

    // Create the ATA in the same transaction if it doesn't exist.
    const ataIx = createAssociatedTokenAccountInstruction(
      this.wallet,
      playerSprkAta,
      this.wallet,
      gameConfig.sprkMint
    );

    const initIx = await this.program.methods
      .initializePlayer(username)
      .accounts({
        player:           this.wallet,
        gameConfig:       gameConfigPDA,
        playerProfile:    profilePda,
        sprkMint:         gameConfig.sprkMint,
        playerSprkAta,
        tokenProgram:     TOKEN_PROGRAM_ID,
        systemProgram:    SystemProgram.programId,
      })
      .instruction();

    return this.program.provider.sendAndConfirm!(
      new (await import("@solana/web3.js")).Transaction().add(ataIx, initIx)
    );
  }

  // ── Parts / Packs ───────────────────────────────────────────────────────────

  /** Buy and open a single part-pack for the given category. */
  async openPack(category: PartCategory): Promise<TransactionSignature> {
    const [gameConfigPDA] = gameConfigPda();
    const gameConfig = await this.fetchGameConfig();

    const playerSprkAta = getAssociatedTokenAddressSync(
      gameConfig.sprkMint,
      this.wallet
    );

    const [profilePda] = playerProfilePda(this.wallet);

    return this.program.methods
      .openPack(category)
      .accounts({
        player:          this.wallet,
        gameConfig:      gameConfigPDA,
        playerProfile:   profilePda,
        sprkMint:        gameConfig.sprkMint,
        playerSprkAta,
        treasuryAta:     gameConfig.treasury,
        tokenProgram:    TOKEN_PROGRAM_ID,
        systemProgram:   SystemProgram.programId,
      })
      .rpc();
  }

  /** Open one pack for each of the five categories in a single batch. */
  async openStarterBundle(): Promise<TransactionSignature[]> {
    const categories: PartCategory[] = [
      PartCategory.Core,
      PartCategory.Ring,
      PartCategory.Weight,
      PartCategory.Drive,
      PartCategory.Lock,
    ];
    return Promise.all(categories.map((c) => this.openPack(c)));
  }

  // ── Assembly ─────────────────────────────────────────────────────────────────

  /** Combine five part IDs into a Spinx build on-chain. */
  async assembleSpinx(
    coreId:   number,
    ringId:   number,
    weightId: number,
    driveId:  number,
    lockId:   number
  ): Promise<TransactionSignature> {
    const [profilePda] = playerProfilePda(this.wallet);

    return this.program.methods
      .assembleSpinx(coreId, ringId, weightId, driveId, lockId)
      .accounts({
        player:        this.wallet,
        playerProfile: profilePda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  // ── Battle ──────────────────────────────────────────────────────────────────

  /**
   * Open a battle lobby.
   * @param lobbyId    Client-generated unique u64 (e.g. Date.now())
   * @param spinxId    The assembled Spinx to use
   * @param charge     Twist-charge 0–100 (>85 risks overcharge)
   * @param wagerSprk  Wager in native $SPRK units
   */
  async createLobby(
    lobbyId:    bigint,
    spinxId:    number,
    charge:     number,
    wagerSprk:  bigint
  ): Promise<TransactionSignature> {
    const [gameConfigPDA] = gameConfigPda();
    const gameConfig = await this.fetchGameConfig();

    const [profilePda] = playerProfilePda(this.wallet);
    const [lobbyPDA]   = lobbyPda(lobbyId);
    const [escrowPDA]  = lobbyEscrowPda(lobbyId);

    const creatorSprkAta = getAssociatedTokenAddressSync(
      gameConfig.sprkMint,
      this.wallet
    );

    return this.program.methods
      .createLobby(lobbyId, spinxId, charge, wagerSprk)
      .accounts({
        creator:         this.wallet,
        gameConfig:      gameConfigPDA,
        playerProfile:   profilePda,
        lobby:           lobbyPDA,
        sprkMint:        gameConfig.sprkMint,
        creatorSprkAta,
        lobbyEscrow:     escrowPDA,
        tokenProgram:    TOKEN_PROGRAM_ID,
        systemProgram:   SystemProgram.programId,
        rent:            SYSVAR_RENT_PUBKEY,
      })
      .rpc();
  }

  /** Join an existing lobby as challenger. */
  async joinLobby(
    lobbyId:   bigint,
    spinxId:   number,
    charge:    number
  ): Promise<TransactionSignature> {
    const [gameConfigPDA] = gameConfigPda();
    const gameConfig = await this.fetchGameConfig();

    const [profilePda]  = playerProfilePda(this.wallet);
    const [lobbyPDA]    = lobbyPda(lobbyId);
    const [escrowPDA]   = lobbyEscrowPda(lobbyId);

    const challengerSprkAta = getAssociatedTokenAddressSync(
      gameConfig.sprkMint,
      this.wallet
    );

    return this.program.methods
      .joinLobby(spinxId, charge)
      .accounts({
        challenger:           this.wallet,
        gameConfig:           gameConfigPDA,
        challengerProfile:    profilePda,
        lobby:                lobbyPDA,
        sprkMint:             gameConfig.sprkMint,
        challengerSprkAta,
        lobbyEscrow:          escrowPDA,
        tokenProgram:         TOKEN_PROGRAM_ID,
        systemProgram:        SystemProgram.programId,
      })
      .rpc();
  }

  /**
   * Trigger battle resolution.
   * Typically called by a relayer crank, but any wallet can pay the tx fee.
   */
  async resolveBattle(
    lobbyId:     bigint,
    creatorKey:  PublicKey,
    challengerKey: PublicKey,
    winnerKey:   PublicKey
  ): Promise<TransactionSignature> {
    const [gameConfigPDA] = gameConfigPda();
    const gameConfig = await this.fetchGameConfig();

    const [lobbyPDA]             = lobbyPda(lobbyId);
    const [escrowPDA]            = lobbyEscrowPda(lobbyId);
    const [creatorProfilePda]    = playerProfilePda(creatorKey);
    const [challengerProfilePda] = playerProfilePda(challengerKey);

    const winnerSprkAta = getAssociatedTokenAddressSync(
      gameConfig.sprkMint,
      winnerKey
    );

    return this.program.methods
      .resolveBattle()
      .accounts({
        resolver:            this.wallet,
        gameConfig:          gameConfigPDA,
        lobby:               lobbyPDA,
        lobbyEscrow:         escrowPDA,
        creatorProfile:      creatorProfilePda,
        challengerProfile:   challengerProfilePda,
        winnerSprkAta,
        sprkMint:            gameConfig.sprkMint,
        tokenProgram:        TOKEN_PROGRAM_ID,
        systemProgram:       SystemProgram.programId,
      })
      .rpc();
  }

  // ── Convenience fetchers ─────────────────────────────────────────────────────

  async fetchLobby(lobbyId: bigint): Promise<LobbyAccount> {
    const [pda] = lobbyPda(lobbyId);
    return this.program.account.lobby.fetch(pda) as any;
  }

  // ── Leaderboard ─────────────────────────────────────────────────────────────

  async fetchLeaderboard() {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("leaderboard")],
      this.program.programId
    );
    return this.program.account.leaderboard.fetch(pda);
  }

  async updateLeaderboard(playerKey = this.wallet): Promise<TransactionSignature> {
    const [gameConfigPDA]  = gameConfigPda();
    const [profilePda]     = playerProfilePda(playerKey);
    const [leaderboardPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("leaderboard")],
      this.program.programId
    );
    return this.program.methods
      .updateLeaderboard()
      .accounts({
        playerProfile: profilePda,
        leaderboard:   leaderboardPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  // ── Lobby cancellation ───────────────────────────────────────────────────────

  async cancelLobby(lobbyId: bigint): Promise<TransactionSignature> {
    const gameConfig     = await this.fetchGameConfig();
    const [lobbyPDA]     = lobbyPda(lobbyId);
    const [escrowPDA]    = lobbyEscrowPda(lobbyId);
    const creatorSprkAta = getAssociatedTokenAddressSync(gameConfig.sprkMint, this.wallet);

    return this.program.methods
      .cancelLobby()
      .accounts({
        creator:         this.wallet,
        lobby:           lobbyPDA,
        lobbyEscrow:     escrowPDA,
        creatorSprkAta,
        sprkMint:        gameConfig.sprkMint,
        tokenProgram:    TOKEN_PROGRAM_ID,
        systemProgram:   SystemProgram.programId,
      })
      .rpc();
  }

  async fetchOpenLobbies(): Promise<{ publicKey: PublicKey; account: LobbyAccount }[]> {
    const lobbies = await (this.program.account.lobby as any).all([
      {
        memcmp: {
          offset: 8 + 8 + 32 + 72 + 1 + 72 + 8, // offset to status field
          bytes:  Buffer.from([0]).toString("base64"), // WaitingForOpponent = 0
        },
      },
    ]);
    return lobbies;
  }
}

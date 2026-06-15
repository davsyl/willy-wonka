import { PublicKey } from "@solana/web3.js";
import { SPINX_PROGRAM_ID } from "./anchor";

const enc = (s: string) => Buffer.from(s);

export function gameConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [enc("game_config")],
    SPINX_PROGRAM_ID
  );
}

export function playerProfilePda(player: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [enc("player_profile"), player.toBuffer()],
    SPINX_PROGRAM_ID
  );
}

export function lobbyPda(lobbyId: bigint): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(lobbyId);
  return PublicKey.findProgramAddressSync([enc("lobby"), buf], SPINX_PROGRAM_ID);
}

export function lobbyEscrowPda(lobbyId: bigint): [PublicKey, number] {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(lobbyId);
  return PublicKey.findProgramAddressSync(
    [enc("lobby_escrow"), buf],
    SPINX_PROGRAM_ID
  );
}

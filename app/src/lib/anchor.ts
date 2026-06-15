import {
  AnchorProvider,
  Program,
  setProvider,
  workspace,
} from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  clusterApiUrl,
  type Commitment,
} from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import type { Spinx } from "../../../target/types/spinx";
import IDL from "../../../target/idl/spinx.json";

export const SPINX_PROGRAM_ID = new PublicKey(
  "SpinxGame11111111111111111111111111111111111"
);

export type SpinxProgram = Program<Spinx>;

/** Build an AnchorProvider + Program for browser usage. */
export function getSpinxProgram(
  wallet: AnchorWallet,
  endpoint = clusterApiUrl("devnet"),
  commitment: Commitment = "confirmed"
): SpinxProgram {
  const connection = new Connection(endpoint, commitment);
  const provider = new AnchorProvider(connection, wallet, { commitment });
  setProvider(provider);
  return new Program<Spinx>(IDL as Spinx, SPINX_PROGRAM_ID, provider);
}

/** Build a read-only Program (no wallet needed for fetches). */
export function getReadonlySpinxProgram(
  endpoint = clusterApiUrl("devnet")
): SpinxProgram {
  const connection = new Connection(endpoint, "confirmed");
  // Anchor's NodeWallet will fail in a browser with no keypair — for
  // read-only calls we construct a no-op provider.
  const provider = new AnchorProvider(
    connection,
    {
      publicKey: PublicKey.default,
      signTransaction: async (tx) => tx,
      signAllTransactions: async (txs) => txs,
    },
    { commitment: "confirmed" }
  );
  return new Program<Spinx>(IDL as Spinx, SPINX_PROGRAM_ID, provider);
}

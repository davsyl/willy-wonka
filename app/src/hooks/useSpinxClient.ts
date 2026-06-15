/**
 * React hook that provides a ready-to-use SpinxClient tied to the
 * connected wallet adapter.
 */

import { useMemo } from "react";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { SpinxClient } from "../lib/spinx-client";
import { SPINX_PROGRAM_ID } from "../lib/anchor";
import type { Spinx } from "../../../target/types/spinx";
import IDL from "../../../target/idl/spinx.json";

export function useSpinxClient(): SpinxClient | null {
  const wallet = useAnchorWallet();
  const { connection } = useConnection();

  return useMemo(() => {
    if (!wallet) return null;

    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });

    const program = new Program<Spinx>(
      IDL as Spinx,
      SPINX_PROGRAM_ID,
      provider
    );

    return new SpinxClient(program, wallet.publicKey);
  }, [wallet, connection]);
}

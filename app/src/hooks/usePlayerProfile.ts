/**
 * React hook that polls the player's on-chain profile and returns it.
 */

import { useState, useEffect, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useSpinxClient } from "./useSpinxClient";
import type { PlayerProfileAccount } from "../types/spinx";

export interface UsePlayerProfileResult {
  profile:   PlayerProfileAccount | null;
  loading:   boolean;
  error:     Error | null;
  refresh:   () => Promise<void>;
}

export function usePlayerProfile(): UsePlayerProfileResult {
  const { publicKey } = useWallet();
  const client = useSpinxClient();

  const [profile, setProfile] = useState<PlayerProfileAccount | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError  ] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!client || !publicKey) return;
    setLoading(true);
    setError(null);
    try {
      const p = await client.fetchPlayerProfile(publicKey);
      setProfile(p);
    } catch (e) {
      // Profile not yet initialised — treat as null, not an error.
      if ((e as Error).message?.includes("Account does not exist")) {
        setProfile(null);
      } else {
        setError(e as Error);
      }
    } finally {
      setLoading(false);
    }
  }, [client, publicKey]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { profile, loading, error, refresh };
}

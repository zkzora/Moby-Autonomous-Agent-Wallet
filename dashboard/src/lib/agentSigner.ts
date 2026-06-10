import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { AGENT_SECRET } from './moby.config';

/**
 * The dapp's autonomous agent keypair, rebuilt from the bundled `suiprivkey…`.
 * TESTNET ONLY. Cached after first decode. Returns null when no agent is
 * configured (or the secret is malformed), so callers fall back to manual mode.
 */
let cached: Ed25519Keypair | null = null;

export function getAgentKeypair(): Ed25519Keypair | null {
  if (!AGENT_SECRET) return null;
  if (cached) return cached;
  try {
    const { secretKey } = decodeSuiPrivateKey(AGENT_SECRET);
    cached = Ed25519Keypair.fromSecretKey(secretKey);
    return cached;
  } catch {
    return null;
  }
}

/** The autonomous agent's address, or null if not configured. */
export function getAgentAddress(): string | null {
  return getAgentKeypair()?.toSuiAddress() ?? null;
}

import { type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createNetworkConfig,
  SuiClientProvider,
  WalletProvider,
} from '@mysten/dapp-kit';
import { getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { MOBY_NETWORK } from '../lib/moby.config';

import '@mysten/dapp-kit/dist/index.css';

/**
 * Sui network registry. Phase 1 is testnet-first by design — `defaultNetwork`
 * below pins the app to testnet. Devnet/localnet are registered only so the
 * dapp-kit network switcher has somewhere to go during local development; the
 * app never defaults to mainnet.
 */
const { networkConfig } = createNetworkConfig({
  testnet: { url: getJsonRpcFullnodeUrl('testnet'), network: 'testnet' },
  devnet: { url: getJsonRpcFullnodeUrl('devnet'), network: 'devnet' },
  localnet: { url: getJsonRpcFullnodeUrl('localnet'), network: 'localnet' },
});

// One client for the whole app. Sui reads are cheap and change often, so keep
// data fresh-ish but avoid hammering the fullnode on every focus.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 10_000, retry: 1, refetchOnWindowFocus: false },
  },
});

/**
 * Wraps the app in the three providers dapp-kit needs, in order:
 * react-query → SuiClient (testnet) → Wallet. `autoConnect` restores the
 * previously approved wallet on reload for a one-click return experience.
 */
export function SuiProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork={MOBY_NETWORK}>
        <WalletProvider autoConnect>{children}</WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  );
}

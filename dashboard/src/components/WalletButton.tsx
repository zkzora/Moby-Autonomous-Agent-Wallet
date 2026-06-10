import { ConnectButton } from '@mysten/dapp-kit';

/**
 * Real wallet connection, replacing the old mock `0x7a4f…3f2c` button.
 * dapp-kit's `ConnectButton` handles connect, the account dropdown, and
 * disconnect; the surrounding `.moby-connect` scope (see app.css) restyles its
 * internals to the ultra-thin wireframe / dark-capsule aesthetic.
 */
export function WalletButton() {
  return (
    <div className="moby-connect">
      <ConnectButton connectText="Connect Wallet" />
    </div>
  );
}

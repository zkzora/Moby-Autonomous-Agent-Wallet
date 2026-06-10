import { Pill } from './Pill';
import { WalletButton } from './WalletButton';

export function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a className="brand-mark" href="/" aria-label="Moby home">
          <span className="brand-glyph" aria-hidden="true">
            M
          </span>
          Moby
        </a>

        <div className="topbar-meta">
          <span className="hide-sm">
            <Pill c="outline">deepbook/testnet</Pill>
          </span>

          {/* Real wallet connection (testnet) */}
          <WalletButton />
        </div>
      </div>
    </header>
  );
}

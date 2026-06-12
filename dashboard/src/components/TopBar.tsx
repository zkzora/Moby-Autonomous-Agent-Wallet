import { Link } from '../lib/router';
import { Pill } from './Pill';
import { WalletButton } from './WalletButton';

export function TopBar() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="brand-mark" to="/" aria-label="Moby home">
          <img className="brand-logo" src="/moby-logo.png" alt="" aria-hidden="true" />
          Moby
        </Link>

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

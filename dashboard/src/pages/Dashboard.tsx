import { MobyAgentProvider } from '../hooks/useMobyAgent';
import { AutonomousAgent } from '../components/AutonomousAgent';
import { SwapToast } from '../components/SwapToast';
import { TopBar } from '../components/TopBar';
import { Footer } from '../components/Footer';
import { StatStrip } from '../components/StatStrip';
import { CommandCenter } from '../components/CommandCenter';
import { Pill } from '../components/Pill';

/**
 * Dashboard — Moby's live on-chain command center.
 *
 * The Sui + Policy providers are mounted once at the app root (App.tsx) so the
 * autonomous agent and policy state persist across route changes. This page
 * owns the simulation layer (whale + activity feed) and the dashboard chrome.
 */
export default function Dashboard() {
  return (
    <>
      <AutonomousAgent />
      <MobyAgentProvider>
        <div className="shell">
          <TopBar />

          <main className="page">
            <div className="page-head">
              <h1 className="section-h">
                Command Center
                <Pill c="outline">Testnet</Pill>
              </h1>
              <p className="section-sub">
                Deploy a Move Policy ceiling, delegate execution to your agent,
                and watch Moby run micro-strategies on Deepbook inside that
                budget. Hit the kill-switch any time for instant on-chain
                revocation.
              </p>
            </div>

            <StatStrip />
            <CommandCenter />
          </main>

          <Footer />
        </div>
        <SwapToast />
      </MobyAgentProvider>
    </>
  );
}

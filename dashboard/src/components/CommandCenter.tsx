import { ChromeBar } from './ChromeBar';
import { MobyPanel } from './MobyPanel';
import { ActivityLog } from './ActivityLog';
import { StrategySelector } from './StrategySelector';
import { AgentExecution } from './AgentExecution';

/**
 * The live dashboard window: a mock browser chrome bar over an asymmetric
 * split view — 320px agent controller on the left, the strategy selector +
 * live feed on the right. Stacks to a single column under 768px.
 */
export function CommandCenter() {
  return (
    <div className="dashboard-card">
      <ChromeBar label="moby.agent.sui · deepbook/testnet" />
      <div className="dash-grid">
        <div className="dash-left">
          <MobyPanel />
        </div>
        <div className="dash-right">
          <StrategySelector />
          <AgentExecution />
          <ActivityLog />
        </div>
      </div>
    </div>
  );
}

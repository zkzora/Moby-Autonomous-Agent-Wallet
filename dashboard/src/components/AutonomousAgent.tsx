import { useAutonomousAgent } from '../hooks/useAutonomousAgent';

/**
 * Headless mount point for the autonomous agent loop. Renders nothing — it just
 * keeps `useAutonomousAgent` alive for the lifetime of the app so the agent can
 * sign `record_spend` on Moby's behalf.
 */
export function AutonomousAgent() {
  useAutonomousAgent();
  return null;
}

import { BrowserRouter, Routes, Route, Navigate } from './lib/router';
import { SuiProviders } from './providers/SuiProviders';
import { PolicyProvider } from './providers/PolicyProvider';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Docs from './pages/Docs';

/**
 * Moby — unified single-page application.
 *
 * Routes:
 *   /          → Landing (public marketing + animated demo)
 *   /dashboard → Dashboard (live on-chain command center)
 *   /docs      → Docs (technical documentation)
 *
 * The Sui + Policy providers wrap the whole router so wallet connection and
 * on-chain policy state persist across client-side navigations (no reloads).
 */
export default function App() {
  return (
    <SuiProviders>
      <PolicyProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </PolicyProvider>
    </SuiProviders>
  );
}

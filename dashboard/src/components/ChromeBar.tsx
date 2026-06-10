/** Mock browser chrome bar — red/yellow/green dots + a mono address label. */
export function ChromeBar({ label }: { label: string }) {
  return (
    <div className="dash-chrome">
      <span className="chrome-dot" style={{ background: 'rgba(240,82,82,0.5)' }} />
      <span className="chrome-dot" style={{ background: 'rgba(245,158,11,0.5)' }} />
      <span className="chrome-dot" style={{ background: 'rgba(16,185,129,0.5)' }} />
      <span className="mono" style={{ marginLeft: 'auto' }}>
        {label}
      </span>
    </div>
  );
}

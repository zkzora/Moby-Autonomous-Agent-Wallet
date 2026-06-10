export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <span
          style={{
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: '-0.02em',
            color: 'var(--ink)',
          }}
        >
          Moby
        </span>
        <span className="mono">
          Autonomous Agent Wallet · Sui Overflow 2025 · Non-custodial · Move-native
        </span>
      </div>
    </footer>
  );
}

import { useEffect, type ReactNode } from 'react';
import { Link } from '../lib/router';

/* ════════════════════════════════════════════════════════════════════
   Docs — the unified documentation page. Ported from docs.html into a
   React component: sticky sidebar + scroll-spy + syntax-highlighted code.
   ════════════════════════════════════════════════════════════════════ */

const TOC: { id: string; label: string; sub?: boolean }[] = [
  { id: 'abstract', label: 'Abstract' },
  { id: 'problem', label: 'The Problem' },
  { id: 'solution', label: 'The Solution' },
  { id: 'architecture', label: 'Core Architecture' },
  { id: 'policy-layer', label: '1 · On-Chain Policy Layer', sub: true },
  { id: 'wallet-engine', label: '2 · Autonomous Wallet Engine', sub: true },
  { id: 'lifecycle', label: '3 · Policy Lifecycle', sub: true },
  { id: 'deployment', label: 'Deployment' },
];

/** A code block with the brand's faux-editor titlebar. */
function CodeBlock({ label, children }: { label: string; children: ReactNode }) {
  return (
    <pre>
      <span className="code-head">
        <span className="code-dot" style={{ background: '#FF6B35' }} />
        <span className="code-dot" style={{ background: '#C8FF00' }} />
        <span className="code-dot" style={{ background: '#10B981' }} />
        <span className="code-label">{label}</span>
      </span>
      <code>{children}</code>
    </pre>
  );
}

const K = ({ children }: { children: ReactNode }) => (
  <span className="tok-key">{children}</span>
);
const Fn = ({ children }: { children: ReactNode }) => (
  <span className="tok-fn">{children}</span>
);
const Ty = ({ children }: { children: ReactNode }) => (
  <span className="tok-type">{children}</span>
);
const Co = ({ children }: { children: ReactNode }) => (
  <span className="tok-com">{children}</span>
);
const Nu = ({ children }: { children: ReactNode }) => (
  <span className="tok-num">{children}</span>
);
const IC = ({ children }: { children: ReactNode }) => (
  <code className="ic">{children}</code>
);

export default function Docs() {
  // Scroll-spy: highlight the active section link as the reader scrolls.
  useEffect(() => {
    const links = Array.from(
      document.querySelectorAll<HTMLAnchorElement>('#doc-toc a'),
    );
    const map = new Map<Element, HTMLAnchorElement>();
    links.forEach((a) => {
      const id = a.getAttribute('href')?.slice(1);
      const el = id && document.getElementById(id);
      if (el) map.set(el, a);
    });

    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            links.forEach((l) => l.classList.remove('active'));
            map.get(entry.target)?.classList.add('active');
          }
        });
      },
      { rootMargin: '-88px 0px -65% 0px', threshold: 0 },
    );
    map.forEach((_, el) => spy.observe(el));
    return () => spy.disconnect();
  }, []);

  return (
    <div className="docs-root">
      <nav className="lp-nav" aria-label="Documentation navigation">
        <div className="lp-nav-inner" style={{ justifyContent: 'space-between' }}>
          <Link to="/" className="docs-brand">
            <img className="brand-logo" src="/moby-logo.png" alt="" aria-hidden="true" />
            Moby
          </Link>
          <Link className="docs-back" to="/">
            ← Back to site
          </Link>
        </div>
      </nav>

      <div className="docs">
        {/* Sidebar */}
        <aside className="docs-sidebar">
          <div className="docs-sidebar-title">Documentation</div>
          <ul className="docs-toc" id="doc-toc">
            {TOC.map((t) => (
              <li key={t.id} className={t.sub ? 'docs-toc-sub' : undefined}>
                <a href={`#${t.id}`}>{t.label}</a>
              </li>
            ))}
          </ul>
        </aside>

        {/* Content */}
        <main className="docs-content">
          <h1 className="docs-title">Moby Documentation</h1>
          <p className="docs-lede">
            The autonomous AI agent wallet framework for Sui — where agents trade
            on your behalf inside mathematically enforced, on-chain budget
            boundaries you control.
          </p>

          {/* Abstract */}
          <section className="doc-section" id="abstract">
            <h2>Abstract</h2>
            <p>
              <strong>Moby</strong> is a non-custodial agent wallet on Sui. It
              lets an autonomous AI agent run high-frequency micro-strategies on
              Deepbook's central limit order book (CLOB) — yet the agent is{' '}
              <strong>mathematically incapable</strong> of moving a single unit
              beyond a ceiling you define. Authority is delegated through an
              on-chain <span className="pill pill-blue">Move Policy Object</span>,
              not by surrendering a private key.
            </p>
            <p>
              The result is the best of both worlds: the convenience of a fully
              autonomous, popup-free trading agent, with the safety of a hard,
              un-breachable spend limit and an instant on-chain kill-switch.
            </p>
          </section>

          {/* Problem */}
          <section className="doc-section" id="problem">
            <h2>The Problem</h2>
            <p>
              Today's "AI crypto agents" force an impossible choice between
              usability and safety:
            </p>
            <ul className="doc-list">
              <li>
                <strong>Manual signing is unusable for automation.</strong> An
                agent that must surface a wallet popup for every trade cannot
                operate at the speed micro-strategies demand. A signature prompt
                every few seconds is not autonomy.
              </li>
              <li>
                <strong>Key sharing is catastrophic.</strong> The alternative —
                handing an AI bot your master private key, or granting unlimited
                token approval — means a single hallucination, exploit, or bad
                trade can drain the <em>entire</em> portfolio. There is zero
                granular control.
              </li>
            </ul>
            <blockquote className="danger">
              <strong>The core bottleneck:</strong> there has been no way to grant
              an agent <em>enough</em> authority to act autonomously, while{' '}
              <em>strictly</em> bounding what it can do if it goes wrong.
            </blockquote>
          </section>

          {/* Solution */}
          <section className="doc-section" id="solution">
            <h2>The Solution</h2>
            <p>
              Moby flips the trust model. Instead of trusting the AI, you trust a
              Sui Move smart contract. The user delegates execution to an agent
              address through a shared <IC>AgentPolicy</IC> object that encodes
              three guarantees, enforced in Move:
            </p>
            <ul className="doc-list">
              <li>
                <strong>Capped budget.</strong> The agent can spend only up to{' '}
                <IC>allowance_limit</IC>. The boundary is enforced by the chain,
                not the UI.
              </li>
              <li>
                <strong>Cryptographic kill-switch.</strong> The owner retains an
                absolute, instant <span className="pill pill-red">Revoke</span> —
                one transaction severs the agent permanently, with no cooldown.
              </li>
              <li>
                <strong>Non-custodial.</strong> The policy delegates a spend
                ceiling, never custody. The owner alone can revoke, top up, or
                reset.
              </li>
            </ul>
          </section>

          {/* Architecture */}
          <section className="doc-section" id="architecture">
            <h2>Core Architecture</h2>
            <p>
              Moby is three layers: a Move contract that enforces the rules, an
              autonomous engine that acts within them, and a lifecycle that lets
              an owner govern the relationship over time.
            </p>

            <h3 id="policy-layer">
              <span className="step">01</span> On-Chain Policy Layer
            </h3>
            <p>
              The <IC>moby_policy</IC> Move package defines a shared{' '}
              <IC>AgentPolicy</IC> object — the "Capped Budget Ceiling." It is
              shared (not owned) precisely so the delegated agent, a distinct
              address, can transact against it autonomously, while every mutation
              is authority-checked against <IC>ctx.sender()</IC>.
            </p>
            <CodeBlock label="moby_policy.move">
              <K>public struct</K> <Ty>AgentPolicy</Ty> <K>has</K> key, store {'{'}
              {'\n'}    id: <Ty>UID</Ty>,{'\n'}    owner: <Ty>address</Ty>,
              {'            '}
              <Co>// revoke / top-up / reset authority</Co>
              {'\n'}    agent: <Ty>address</Ty>,{'            '}
              <Co>// delegated executor</Co>
              {'\n'}    allowance_limit: <Ty>u64</Ty>,{'       '}
              <Co>// the hard ceiling</Co>
              {'\n'}    amount_spent: <Ty>u64</Ty>,{'          '}
              <Co>{'// cumulative, enforced <= limit'}</Co>
              {'\n'}    is_active: <Ty>bool</Ty>,{'            '}
              <Co>// the kill-switch</Co>
              {'\n'}
              {'}'}
            </CodeBlock>
            <p>
              The single chokepoint that enforces the budget on-chain is{' '}
              <IC>record_spend</IC>. It reverts unless the caller is the delegated
              agent, the policy is active, and the spend fits under the ceiling —
              so an over-budget trade is impossible, not merely discouraged:
            </p>
            <CodeBlock label="record_spend">
              <K>public fun</K> <Fn>record_spend</Fn>(policy: &<K>mut</K>{' '}
              <Ty>AgentPolicy</Ty>, amount: <Ty>u64</Ty>, ctx: &<Ty>TxContext</Ty>){' '}
              {'{'}
              {'\n'}    <Fn>assert!</Fn>(ctx.<Fn>sender</Fn>() =={' '}
              policy.agent, <Ty>ENotAgent</Ty>);
              {'\n'}    <Fn>assert!</Fn>(policy.is_active, <Ty>EPolicyRevoked</Ty>);
              {'\n'}    <Fn>assert!</Fn>(
              {'\n'}        {'policy.amount_spent + amount <= policy.allowance_limit,'}
              {'\n'}        <Ty>EBudgetExceeded</Ty>,
              {'\n'}    );
              {'\n'}    policy.amount_spent = policy.amount_spent + amount;
              {'\n'}
              {'}'}
            </CodeBlock>
            <blockquote>
              Because the ceiling is enforced in Move, the dashboard's budget
              meter is not a guard — it is a <em>mirror</em> of on-chain truth.
              Every figure is read straight back from the <IC>AgentPolicy</IC>{' '}
              object.
            </blockquote>

            <h3 id="wallet-engine">
              <span className="step">02</span> Autonomous Wallet Engine
            </h3>
            <p>
              To make the agent truly autonomous — no wallet popups — the dApp
              holds a dedicated <strong>Ed25519 agent keypair</strong>. When a
              policy delegates to that agent address, the engine signs{' '}
              <IC>record_spend</IC> itself on a fixed cadence, debiting the
              on-chain ceiling as it "trades."
            </p>
            <blockquote className="warn">
              <strong>Testnet only.</strong> The agent key is a low-value,
              gas-only keypair scoped to a single delegated budget. It can spend
              strictly within the policy ceiling and nothing more — the worst case
              is bounded by design.
            </blockquote>
            <p>
              <strong>Budget clamping.</strong> Before every signature, the
              generated trade amount is clamped to the remaining allowance. This
              guarantees the final trade lands <em>exactly</em> on the ceiling —
              e.g. with 2 USDC left, a generated 6 becomes 2, for a clean finish —
              and the agent then stops:
            </p>
            <CodeBlock label="useAutonomousAgent.ts">
              <K>const</K> remaining = policy.allowanceLimit - policy.amountSpent;
              {'\n'}
              <K>if</K> {'(remaining <= '}
              <Nu>0n</Nu>
              {') '}
              <K>return</K>;{'            '}
              <Co>{'// strict stop -> Resting'}</Co>
              {'\n\n'}
              <K>const</K> generated = <Fn>toBaseUnits</Fn>(randomTradeSize());
              {'\n'}
              <Co>// clamp: never overshoot — perfect finish on the last trade</Co>
              {'\n'}
              <K>const</K> amount = generated {'>'} remaining ? remaining :
              generated;
              {'\n\n'}
              <K>await</K> client.<Fn>signAndExecuteTransaction</Fn>({'{'} signer:
              agentKeypair, transaction {'}'});
              {'\n'}
              <K>await</K> client.<Fn>waitForTransaction</Fn>({'{'} digest {'}'});
              {'  '}
              <Co>// read-after-write</Co>
              {'\n'}
              <K>await</K> <Fn>refetchPolicy</Fn>();{'                       '}
              <Co>// live UI re-sync</Co>
            </CodeBlock>
            <p>
              <strong>Strategy templates.</strong> The agent's "brain" is an
              off-chain strategy config (the contract enforces the budget; the
              strategy shapes the behaviour). One strategy runs at a time:
            </p>
            <div className="docs-card-grid">
              <div className="docs-card">
                <h4>
                  Micro-Arbitrage <span className="mono">SUI/USDC</span>
                </h4>
                <p>Captures sub-second price gaps across Deepbook order books.</p>
              </div>
              <div className="docs-card">
                <h4>
                  Deepbook Liquidity Sniping <span className="mono">CLOB</span>
                </h4>
                <p>Fills resting size the instant spreads widen past threshold.</p>
              </div>
              <div className="docs-card">
                <h4>
                  Smart DCA Smoothing <span className="mono">SUI/USDC</span>
                </h4>
                <p>Spreads accumulation across volatility to flatten entry price.</p>
              </div>
            </div>

            <h3 id="lifecycle">
              <span className="step">03</span> Policy Lifecycle
            </h3>
            <p>
              A policy is governed by its owner across its whole life. The v2
              contract adds an in-place recovery path so a demo — or a real
              session — never requires a redeploy.
            </p>
            <ul className="doc-list">
              <li>
                <strong>Pause / Resume</strong>{' '}
                <span className="pill pill-orange">soft stop</span> — the owner can
                halt autonomous execution instantly from the dashboard without
                touching the policy. The ceiling and delegation stay intact.
              </li>
              <li>
                <strong>Revoke</strong>{' '}
                <span className="pill pill-red">kill-switch</span> —{' '}
                <IC>revoke_policy</IC> flips <IC>is_active</IC> to{' '}
                <IC>false</IC> permanently. Any further <IC>record_spend</IC>{' '}
                aborts with <IC>EPolicyRevoked</IC>. This severance has no cooldown
                and cannot be undone — by design.
              </li>
              <li>
                <strong>Reset &amp; Top Up</strong>{' '}
                <span className="pill pill-green">recovery</span> — when the budget
                is exhausted and the agent is resting, <IC>reset_policy</IC> zeroes{' '}
                <IC>amount_spent</IC> (with an optional ceiling increase) for a
                clean slate. The owner can switch strategy and the agent resumes —
                no new object, no redeploy.
              </li>
            </ul>
            <CodeBlock label="reset_policy">
              <K>public fun</K> <Fn>reset_policy</Fn>(policy: &<K>mut</K>{' '}
              <Ty>AgentPolicy</Ty>, extra: <Ty>u64</Ty>, ctx: &<Ty>TxContext</Ty>){' '}
              {'{'}
              {'\n'}    <Fn>assert!</Fn>(ctx.<Fn>sender</Fn>() =={' '}
              policy.owner, <Ty>ENotOwner</Ty>);
              {'\n'}    <Fn>assert!</Fn>(policy.is_active, <Ty>EPolicyRevoked</Ty>);
              {'  '}
              <Co>// revoke stays permanent</Co>
              {'\n'}    policy.amount_spent = <Nu>0</Nu>;
              {'\n'}    policy.allowance_limit = policy.allowance_limit + extra;
              {'\n'}
              {'}'}
            </CodeBlock>
          </section>

          {/* Deployment */}
          <section className="doc-section" id="deployment">
            <h2>Deployment</h2>
            <p>
              Moby's <IC>moby_policy</IC> package (v2) is live on{' '}
              <strong>Sui Testnet</strong>. All policy actions — create, spend,
              reset, revoke — are real on-chain transactions, each verifiable on
              Suiscan.
            </p>
            <div className="docs-card-grid">
              <div className="docs-card">
                <h4>Package ID</h4>
                <p className="docs-addr">
                  0x11c76b435d2b96e22ce7f589c1ffaca48d88ab745102e73d37e784a9655412b8
                </p>
              </div>
              <div className="docs-card">
                <h4>Module</h4>
                <p className="docs-addr">moby_policy &nbsp;·&nbsp; network: testnet</p>
              </div>
            </div>
            <p>
              The contract exposes the owner/agent entry points —{' '}
              <IC>create_policy</IC>, <IC>record_spend</IC>,{' '}
              <IC>top_up_allowance</IC>, <IC>reset_policy</IC>, and{' '}
              <IC>revoke_policy</IC> — each guarded by explicit <IC>assert!</IC>{' '}
              authority checks and covered by the package test suite.
            </p>
            <blockquote>
              Connect a Sui testnet wallet, grant an allowance, and watch Moby
              execute on Deepbook inside that budget — then hit Revoke and confirm
              the agent can no longer move funds. That full loop is the demo.
            </blockquote>
            <div style={{ marginTop: 28 }}>
              <Link className="btn btn-solid" to="/dashboard">
                Launch the dashboard →
              </Link>
            </div>
          </section>

          <p className="docs-footnote">
            Moby — Autonomous Agent Wallet · Sui Overflow 2025 · Non-custodial ·
            Move-native
          </p>
        </main>
      </div>
    </div>
  );
}

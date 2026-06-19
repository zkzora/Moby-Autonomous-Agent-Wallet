import { LOG_STYLE } from '../lib/logData';
import { txExplorerUrl } from '../lib/moby.config';
import type { LogEntry } from '../lib/types';

interface LogRowProps {
  entry: LogEntry;
  /** Top row flashes the `.fresh` entrance animation. */
  fresh?: boolean;
}

/** A single on-chain activity row: typed badge + mono message. Rows backed by a
 *  real transaction carry a digest and get a click-through Suiscan link. */
export function LogRow({ entry, fresh = false }: LogRowProps) {
  const s = LOG_STYLE[entry.type] ?? LOG_STYLE.scan;
  return (
    <div className={`log-row${fresh ? ' fresh' : ''}`}>
      <span
        className="log-badge"
        style={{ background: s.bg, color: s.color, borderColor: `${s.color}25` }}
      >
        {s.label}
      </span>
      <span className="log-text">{entry.msg}</span>
      {entry.digest && (
        <a
          className="log-link"
          href={txExplorerUrl(entry.digest)}
          target="_blank"
          rel="noopener noreferrer"
          title="Verify this transaction on Suiscan"
          aria-label="View transaction on Suiscan"
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M4.5 2.5H2.5v7h7V7" stroke="currentColor" strokeLinecap="round" />
            <path d="M7 2.5h2.5V5" stroke="currentColor" strokeLinecap="round" />
            <path d="M9.5 2.5 5.25 6.75" stroke="currentColor" strokeLinecap="round" />
          </svg>
        </a>
      )}
    </div>
  );
}

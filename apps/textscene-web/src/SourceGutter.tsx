/**
 * Issue #202 — Source pane linter gutter: one row per source line, an
 * error/warning/info dot on lines with diagnostics (highest severity per
 * line — see `lineDiagnostics.ts`), and a hover/focus popover listing that
 * line's message(s). Scroll-synced with the textarea via the `scrollTop`
 * prop so the dots track the visible lines as the pane scrolls.
 */
import { memo, useMemo, useState } from 'react';
import type { Severity } from '@textscene/core/linter';
import type { LineDiagnostics } from './lineDiagnostics';
import styles from './r3f-main.module.css';

export interface SourceGutterProps {
  /** Total number of lines in the buffer (at least 1, even for an empty buffer). */
  lineCount: number;
  byLine: ReadonlyMap<number, LineDiagnostics>;
  /** The textarea's current `scrollTop`, so the gutter's rows track it. */
  scrollTop: number;
}

const SEVERITY_CLASS: Record<Severity, string> = {
  error: styles.severityError ?? '',
  warning: styles.severityWarning ?? '',
  info: styles.severityInfo ?? '',
};

/**
 * `React.memo`'d: `byLine` is already memoized upstream (`groupDiagnosticsByLine`)
 * and `lineCount` is a stable number, so without this the gutter would rebuild
 * its full N-row list on every unrelated `R3FApp` render (every keystroke,
 * every scroll) even when none of its own props changed.
 */
export const SourceGutter = memo(function SourceGutter({
  lineCount,
  byLine,
  scrollTop,
}: SourceGutterProps) {
  const [hoverLine, setHoverLine] = useState<number | null>(null);
  const lines = useMemo(
    () => Array.from({ length: Math.max(lineCount, 1) }, (_, i) => i + 1),
    [lineCount]
  );

  function leave(line: number) {
    setHoverLine((current) => (current === line ? null : current));
  }

  return (
    <div className={styles.gutter} data-testid="source-gutter" aria-hidden="true">
      <div className={styles.gutterInner} style={{ transform: `translateY(${-scrollTop}px)` }}>
        {lines.map((line) => {
          const entry = byLine.get(line);
          return (
            <div key={line} className={styles.gutterRow}>
              {entry && (
                <>
                  <button
                    type="button"
                    tabIndex={-1}
                    className={`${styles.gutterDot} ${SEVERITY_CLASS[entry.severity]}`}
                    data-testid={`gutter-dot-${line}`}
                    aria-label={`Line ${line}: ${entry.messages.join('; ')}`}
                    onMouseEnter={() => setHoverLine(line)}
                    onMouseLeave={() => leave(line)}
                    onFocus={() => setHoverLine(line)}
                    onBlur={() => leave(line)}
                  />
                  {hoverLine === line && (
                    <div
                      role="tooltip"
                      className={styles.gutterPopover}
                      data-testid={`gutter-popover-${line}`}
                    >
                      {entry.messages.map((message, i) => (
                        <div key={i}>{message}</div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});

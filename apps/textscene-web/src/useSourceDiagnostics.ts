/**
 * Everything the Source pane's gutter is drawn from: the buffer's diagnostics,
 * grouped by line, plus the two summaries around them.
 */

import { useEffect, useMemo, useState } from 'react';
import { Linter, type Diagnostic } from '@textscene/core/linter';
import {
  groupDiagnosticsByLine,
  summarizeDiagnostics,
  formatProblemBadge,
  countLines,
  type LineDiagnostics,
} from './lineDiagnostics';
import { DEBOUNCE_MS } from './useSceneSource';

/**
 * The web app is the first browser consumer of `@textscene/core/linter`.
 * One instance for the app's lifetime — `Linter` carries no per-call state,
 * and the rule/validator registries it reads from are populated once at
 * import time (self-registration side effects in `linter/index.ts`).
 */
const linter = new Linter();

export interface SourceDiagnostics {
  diagnosticsByLine: Map<number, LineDiagnostics>;
  /** Compact problem-count text (e.g. "✖ 1 / ⚠ 2"), or `null` when the buffer is clean. */
  problemBadge: string | null;
  lineCount: number;
}

export function useSourceDiagnostics(buffer: string): SourceDiagnostics {
  // Lint the buffer continuously, debounced at the same cadence as
  // useSceneSource's render-forward — but independent of its gate (a buffer
  // that fails to RENDER can still be LINTED; the gutter is what tells the
  // user why). Re-runs whenever the buffer changes for any reason (typing,
  // fixture load, upload).
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  useEffect(() => {
    const timer = setTimeout(() => {
      setDiagnostics(linter.lint(buffer));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [buffer]);

  const diagnosticsByLine = useMemo(() => groupDiagnosticsByLine(diagnostics), [diagnostics]);
  const problemBadge = useMemo(
    () => formatProblemBadge(summarizeDiagnostics(diagnostics)),
    [diagnostics]
  );
  // Counts newlines directly instead of `buffer.split('\n').length`, which
  // would materialize a full array of every source line on every render
  // (this recomputes on each keystroke, since `buffer` is R3FApp state).
  const lineCount = useMemo(() => countLines(buffer), [buffer]);

  return { diagnosticsByLine, problemBadge, lineCount };
}

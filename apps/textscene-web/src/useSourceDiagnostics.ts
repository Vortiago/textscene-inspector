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
 * One instance for the app's lifetime: `Linter` carries no per-call state, and
 * `linter/index.ts` fills its registries once, at import.
 */
const linter = new Linter();

export interface SourceDiagnostics {
  diagnosticsByLine: Map<number, LineDiagnostics>;
  /** Compact problem-count text ("✖ 1 / ⚠ 2"), or `null` when the buffer is clean. */
  problemBadge: string | null;
  lineCount: number;
}

export function useSourceDiagnostics(buffer: string): SourceDiagnostics {
  // Debounced like the render forward but outside its gate: a buffer that fails to render is
  // still linted, and the gutter tells the user why.
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
  // Counts newlines rather than `buffer.split('\n').length`, which builds an array of every
  // line on each keystroke.
  const lineCount = useMemo(() => countLines(buffer), [buffer]);

  return { diagnosticsByLine, problemBadge, lineCount };
}

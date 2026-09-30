/**
 * Everything the Source pane's linter surface is drawn from: the buffer's diagnostics,
 * grouped by line and for the file-level section, plus the badge and line count.
 */

import { useEffect, useMemo, useState } from 'react';
import { Linter, type Diagnostic, type ResourceProvider } from '@textscene/core/linter';
import { error as logError } from '@textscene/core/logger';
import {
  groupDiagnostics,
  summarizeDiagnostics,
  formatProblemBadge,
  countLines,
  type DiagnosticGroup,
} from './lineDiagnostics';
import { DEBOUNCE_MS } from './useSceneSource';

/**
 * One instance for the app's lifetime: `Linter` carries no per-call state, and
 * `linter/index.ts` fills its registries once, at import.
 */
const linter = new Linter();

export interface SourceDiagnostics {
  diagnosticsByLine: Map<number, DiagnosticGroup>;
  /** The diagnostics that name no line, for the file-level section, or `null` for none. */
  fileDiagnostics: DiagnosticGroup | null;
  /** Compact problem-count text ("✖ 1 / ⚠ 2"), or `null` when the buffer is clean. */
  problemBadge: string | null;
  lineCount: number;
}

/**
 * @param provider - The scene's resources, read for the diagnostics its dependencies add.
 */
export function useSourceDiagnostics(buffer: string, provider: ResourceProvider): SourceDiagnostics {
  // Debounced like the render forward but outside its gate: a buffer that fails to render is
  // still linted, and the gutter tells the user why. The buffer's own diagnostics show at once,
  // and the cross-file lint replaces them only while the buffer it read is still the pane's.
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  useEffect(() => {
    let isCurrent = true;
    const timer = setTimeout(() => {
      const { diagnostics: local, withDependencies } = linter.lintProject(buffer, provider);
      setDiagnostics(local);
      withDependencies
        ?.then((merged) => {
          if (isCurrent) setDiagnostics(merged);
        })
        .catch((reason: unknown) => logError('[SourceDiagnostics] Cross-file lint failed:', reason));
    }, DEBOUNCE_MS);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [buffer, provider]);

  // Counts newlines rather than `buffer.split('\n').length`, which builds an array of every
  // line on each keystroke.
  const lineCount = useMemo(() => countLines(buffer), [buffer]);
  // The badge and the two groups read one `diagnostics`, so the badge counts what they show.
  // The live `lineCount`, not the linted one: until the debounced lint catches up, a line
  // deleted since has no gutter row, so its finding shows in the file-level section.
  const grouped = useMemo(() => groupDiagnostics(diagnostics, lineCount), [diagnostics, lineCount]);
  const problemBadge = useMemo(
    () => formatProblemBadge(summarizeDiagnostics(diagnostics)),
    [diagnostics]
  );

  return {
    diagnosticsByLine: grouped.byLine,
    fileDiagnostics: grouped.fileLevel,
    problemBadge,
    lineCount,
  };
}

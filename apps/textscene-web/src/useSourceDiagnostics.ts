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
 * One instance for the app's lifetime, so every pane's session shares what it reads per
 * provider. `linter/index.ts` fills its registries once, at import.
 */
const linter = new Linter();

const NO_DIAGNOSTICS: Diagnostic[] = [];

/** Whether `complete` holds exactly the objects of `shown`, in order, so showing it changes nothing. */
function isSameList(complete: readonly Diagnostic[], shown: readonly Diagnostic[]): boolean {
  return complete.length === shown.length && complete.every((diagnostic, i) => diagnostic === shown[i]);
}

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
 * @param filesRevision - Changes whenever a file the provider holds changes, such as an upload,
 *   so the unchanged buffer is linted again against it.
 */
export function useSourceDiagnostics(
  buffer: string,
  provider: ResourceProvider,
  filesRevision: number
): SourceDiagnostics {
  // Debounced like the render forward but outside its gate: a buffer that fails to render is
  // still linted, and the gutter tells the user why. The session shows the buffer's own
  // diagnostics at once, beside the cross-file ones of its last read, and the full list only
  // while the buffer it read is the pane's.
  const [session] = useState(() => linter.session());
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>(NO_DIAGNOSTICS);
  useEffect(() => {
    let isCurrent = true;
    const timer = setTimeout(() => {
      const { now, later } = session.lint(buffer, provider);
      setDiagnostics(now);
      later
        ?.then((complete) => {
          if (isCurrent && complete && !isSameList(complete, now)) setDiagnostics(complete);
        })
        .catch((reason: unknown) => logError('[SourceDiagnostics] Cross-file lint failed:', reason));
    }, DEBOUNCE_MS);
    return () => {
      isCurrent = false;
      clearTimeout(timer);
    };
  }, [session, buffer, provider, filesRevision]);

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

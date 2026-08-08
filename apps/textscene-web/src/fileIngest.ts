/**
 * What happens when files arrive — from a drop or from the toolbar's file
 * input — up to the point where the pipeline and the scene take over.
 *
 * A plain factory rather than a hook: the handler it builds closes over
 * per-render values and is rebuilt on every render, exactly as it was when it
 * lived inside `R3FApp`.
 */

import { info, warn } from '@textscene/core/logger';
import {
  pickRootMostTscn,
  matchResourceFiles,
  extResourcePaths,
  type MatchResult,
} from './multiFileUpload';

export interface FileIngestDeps {
  /** The corpus root of the scene ON SCREEN. */
  resourceRoot: string;
  /** Latest missing-paths set, as last reported by the shell. */
  missingPathsRef: { current: ReadonlySet<string> };
  confirmDiscardEdits: () => boolean;
  tearDownIfCrossingCorpus: (nextRoot: string) => void;
  onTscnUpload: (file: File, text: string) => void;
  onResourceUpload: (path: string, file: File) => void;
  reportUploadError: (message: string) => void;
  clearUploadError: () => void;
}

/**
 * Shared entry point for BOTH drag-and-drop and the toolbar's (now
 * multi-select) file input, implementing the Multi-file matching contract:
 *
 * 1. Root-most scene pick: the .tscn whose basename no other dropped .tscn
 *    references becomes the active scene; tie/cycle falls back to first.
 * 2. Missing-list matching: every other file is matched against the picked
 *    scene's ExtResources AND the current missing paths (as last reported
 *    by the shell), so a sub-scene's own dependencies arrive by
 *    repeated drops.
 * 3. No-.tscn drop: when there are no .tscn files, attempt to fulfill the
 *    missing paths directly instead of surfacing an error.
 */
export function createFileIngest(
  deps: FileIngestDeps
): (files: readonly File[]) => Promise<void> {
  const {
    resourceRoot,
    missingPathsRef,
    confirmDiscardEdits,
    tearDownIfCrossingCorpus,
    onTscnUpload,
    onResourceUpload,
    reportUploadError,
    clearUploadError,
  } = deps;

  // Surfaces one matching round's diagnostics and wires every matched file
  // into the resource pipeline.
  function applyMatchResult({ matches, ambiguousMatches, unmatched }: MatchResult) {
    for (const { candidates, file } of ambiguousMatches) {
      warn(
        `[MultiFileUpload] Ambiguous basename match for "${file.name}": candidates are ${candidates.join(', ')}. Using first match.`
      );
    }
    if (unmatched.length > 0) {
      info(`[MultiFileUpload] ${unmatched.length} dropped file(s) matched no res:// reference and were ignored.`);
    }
    for (const { path, file } of matches) {
      onResourceUpload(path, file);
    }
  }

  return async function handleFilesUpload(files: readonly File[]) {
    const missingPaths = missingPathsRef.current;
    const tscnFiles = files.filter((f) => f.name.toLowerCase().endsWith('.tscn'));

    // A batch with a .tscn replaces the active scene (and the pane buffer);
    // a resource-only batch fulfills missing rows without touching edits.
    if (tscnFiles.length > 0) {
      if (!confirmDiscardEdits()) return;
      // An uploaded scene lives in the base ('') corpus, so this drop may cross
      // a boundary. This MUST stay ahead of the awaited reads below: the
      // viewport is r3f's own reconciler root, so the teardown's flushSync
      // commits the DOM tree but only SCHEDULES r3f's unmount. The awaited read
      // is the gap in which that unmount actually lands, and without it
      // handleTscnUpload clears the caches while the outgoing scene's consumers
      // are still subscribed — measured to refetch their res:// paths under the
      // incoming corpus, which is the leak this whole change exists to close.
      // The cost is that a read which then throws leaves the viewport empty.
      tearDownIfCrossingCorpus('');
    }

    if (tscnFiles.length === 0) {
      // No .tscn — the drop can still fulfill currently-missing res:// rows.
      const result = matchResourceFiles([], files, missingPaths);
      if (result.matches.length === 0) {
        reportUploadError('No .tscn file found among the dropped/selected files.');
        return;
      }
      clearUploadError();
      applyMatchResult(result);
      return;
    }

    // Read all tscn texts for the root-most pick.
    let tscnPairs: { file: File; text: string }[];
    try {
      tscnPairs = await Promise.all(
        tscnFiles.map(async (file) => ({ file, text: await file.text() }))
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reportUploadError(`Failed to read TSCN file: ${message}`);
      return;
    }

    const picked = pickRootMostTscn(tscnPairs);
    if (picked.ambiguous) {
      info(
        '[MultiFileUpload] Could not determine root-most scene unambiguously; using first .tscn file.'
      );
    }

    clearUploadError();
    onTscnUpload(picked.file, picked.text);

    const others = files.filter((f) => f !== picked.file);
    if (others.length > 0) {
      // Tier-2 (missing-list) matching exists for the repeated-drop workflow
      // WITHIN the '' upload corpus. When this drop leaves a fixture corpus
      // (resourceRoot !== ''), the outgoing scene's missing paths belong to a
      // namespace the upload keying just abandoned — matching against them
      // would silently store files under keys the new scene can never request.
      const replaceMissingPaths = resourceRoot === '' ? missingPaths : new Set<string>();
      // A multi-.tscn pick already parsed the scene — reuse those paths; a
      // single-.tscn batch parses here, only because there are files to match.
      applyMatchResult(
        matchResourceFiles(
          picked.extResourcePaths ?? extResourcePaths(picked.text),
          others,
          replaceMissingPaths
        )
      );
    }
  };
}

/**
 * What happens when files arrive, from a drop or the toolbar's file input, until
 * the pipeline and the scene take over. A plain factory, not a hook: the handler
 * closes over per-render values and is rebuilt on every render.
 */

import { info, warn } from '@textscene/core/logger';
import {
  pickRootMostTscn,
  matchResourceFiles,
  extResourcePaths,
  type MatchResult,
} from './multiFileUpload';

export interface FileIngestDeps {
  /** The corpus root of the scene on screen. */
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
 * The Multi-file matching contract, for a drop and the file input alike. The .tscn
 * no other dropped .tscn references becomes the scene, the first on a tie or cycle.
 * Other files match its ExtResources and the shell's missing paths, so repeated drops
 * bring a sub-scene's dependencies. With no .tscn, files fill missing paths.
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
    // Nothing arrived, so nothing failed: an empty batch is a no-op, not the
    // "no .tscn among them" error the resource-only branch below would raise.
    if (files.length === 0) {
      return;
    }

    const missingPaths = missingPathsRef.current;
    const tscnFiles = files.filter((f) => f.name.toLowerCase().endsWith('.tscn'));

    // A batch with a .tscn replaces the active scene (and the pane buffer);
    // a resource-only batch fulfills missing rows without touching edits.
    if (tscnFiles.length > 0) {
      if (!confirmDiscardEdits()) return;
      // An upload lives in the '' corpus. Keep this ahead of the awaited reads: r3f
      // is its own reconciler root, so flushSync only schedules its unmount, which
      // lands during the read. Otherwise old consumers refetch under the new corpus.
      // The cost: a read that throws leaves the viewport empty.
      tearDownIfCrossingCorpus('');
    }

    if (tscnFiles.length === 0) {
      // With no .tscn, the drop can still fill missing res:// rows.
      const result = matchResourceFiles([], files, missingPaths);
      if (result.matches.length === 0) {
        reportUploadError('No .tscn file found among the dropped/selected files.');
        return;
      }
      clearUploadError();
      applyMatchResult(result);
      return;
    }

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
      // Missing-list matching serves repeated drops within the '' corpus. A drop out
      // of a fixture corpus skips the old missing paths, whose keys the new scene
      // never requests.
      const replaceMissingPaths = resourceRoot === '' ? missingPaths : new Set<string>();
      // A multi-.tscn pick already parsed the scene, so its paths are reused. A
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

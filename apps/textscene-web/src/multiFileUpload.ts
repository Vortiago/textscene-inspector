/**
 * Multi-file / drag-and-drop upload: pick the active `.tscn` among a batch
 * of dropped/selected files and match every other file to a `res://` external-
 * resource path by case-insensitive basename, so a scene plus its textures (or
 * a sub-scene's own dependencies) can arrive in one gesture.
 *
 * Contract:
 * 1. Root-most scene pick: the `.tscn` whose basename no other dropped `.tscn`
 *    references becomes the active scene; tie/cycle falls back to first.
 * 2. Missing-list matching: non-`.tscn` files are matched against the picked
 *    scene's direct ExtResources AND the caller-supplied set of currently-
 *    missing `res://` paths, so repeated drops can fulfill a sub-scene's own
 *    dependencies.
 * 3. No-`.tscn` batch: when there are no `.tscn` files the caller should
 *    attempt to fulfill missing rows directly instead of erroring.
 */
import { info } from '@textscene/core/logger';
import { TscnParser } from '@textscene/core';

/** A non-`.tscn` file matched to the `res://` path it fulfills. */
export interface ResourceFileMatch {
  path: string;
  file: File;
}

/** A file that matched multiple `res://` candidates by basename. */
export interface AmbiguousMatch {
  file: File;
  /** All candidate paths that share this file's basename. First one is used. */
  candidates: string[];
}

/** Return value of `matchResourceFiles`. */
export interface MatchResult {
  /** Files that were matched to a `res://` path. */
  matches: ResourceFileMatch[];
  /** Files that matched multiple candidates (logged as a warning). First candidate used. */
  ambiguousMatches: AmbiguousMatch[];
  /** Files that matched nothing — ignored per contract. */
  unmatched: File[];
}

/** Result of `pickRootMostTscn`. */
export interface RootMostTscnResult {
  file: File;
  /** True when the pick was ambiguous (tie or cycle) and fell back to first. */
  ambiguous: boolean;
}

/** The last path segment of a `res://`-or-plain slash-separated path. */
function basename(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? path : path.slice(idx + 1);
}

/** The first `.tscn` file among `files` (case-insensitive extension), or `undefined` if none. */
export function pickTscnFile(files: readonly File[]): File | undefined {
  return files.find((f) => f.name.toLowerCase().endsWith('.tscn'));
}

/**
 * Picks the root-most `.tscn` from a batch: the file whose basename no other
 * file in the batch references. Tie or cycle falls back to the first file,
 * with `ambiguous: true`.
 *
 * `filesWithText` must contain all `.tscn` files in the batch with their
 * already-read text content.
 */
export function pickRootMostTscn(
  filesWithText: readonly { file: File; text: string }[]
): RootMostTscnResult {
  if (filesWithText.length === 0) {
    throw new Error('pickRootMostTscn requires at least one entry');
  }
  const first = filesWithText[0]!;
  if (filesWithText.length === 1) {
    return { file: first.file, ambiguous: false };
  }

  // Collect all basenames of .tscn files referenced across every file in the batch.
  const referencedBasenames = new Set<string>();
  for (const { text } of filesWithText) {
    try {
      const { externalResources } = new TscnParser().parse(text);
      for (const r of externalResources) {
        if (r.path.toLowerCase().endsWith('.tscn')) {
          referencedBasenames.add(basename(r.path).toLowerCase());
        }
      }
    } catch {
      // Unparseable — skip reference extraction for this file.
    }
  }

  // Root-most: a tscn whose basename no other tscn in the batch references.
  const rootMost = filesWithText.find(
    ({ file }) => !referencedBasenames.has(file.name.toLowerCase())
  );

  if (rootMost) {
    return { file: rootMost.file, ambiguous: false };
  }

  // Tie or cycle — fall back to first.
  info(
    '[MultiFileUpload] Ambiguous root-most pick: all dropped .tscn files reference each other or form a cycle; falling back to first.'
  );
  return { file: first.file, ambiguous: true };
}

/**
 * Matches every file in `others` to a `res://` path by case-insensitive basename.
 *
 * Matching priority:
 * 1. Direct ExtResource reference in `tscnText` (scene's own dependencies).
 * 2. Currently-missing `res://` paths in `missingPaths` (fulfills a sub-scene's
 *    dependencies on repeated drops).
 *
 * Ambiguous matches (multiple candidates share the same basename) use the first
 * candidate and record the collision in `ambiguousMatches` for the caller to log.
 * Files matching nothing are collected in `unmatched`.
 */
export function matchResourceFiles(
  tscnText: string,
  others: readonly File[],
  missingPaths: ReadonlySet<string>
): MatchResult {
  if (others.length === 0) {
    return { matches: [], ambiguousMatches: [], unmatched: [] };
  }

  const { externalResources } = new TscnParser().parse(tscnText);

  const matches: ResourceFileMatch[] = [];
  const ambiguousMatches: AmbiguousMatch[] = [];
  const unmatched: File[] = [];

  for (const file of others) {
    const nameLower = file.name.toLowerCase();

    // Priority 1: direct ExtResource match (first-declared wins for ties).
    const directMatches = externalResources.filter(
      (r) => basename(r.path).toLowerCase() === nameLower
    );
    if (directMatches.length > 0) {
      if (directMatches.length > 1) {
        ambiguousMatches.push({
          file,
          candidates: directMatches.map((r) => r.path),
        });
      }
      matches.push({ path: directMatches[0]!.path, file });
      continue;
    }

    // Priority 2: missing-path match.
    const missingCandidates = Array.from(missingPaths).filter(
      (p) => basename(p).toLowerCase() === nameLower
    );
    if (missingCandidates.length > 0) {
      if (missingCandidates.length > 1) {
        ambiguousMatches.push({ file, candidates: missingCandidates });
      }
      matches.push({ path: missingCandidates[0]!, file });
      continue;
    }

    unmatched.push(file);
  }

  return { matches, ambiguousMatches, unmatched };
}

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
 * 3. No-`.tscn` batch: the caller passes `tscnText: null` to match purely
 *    against the missing paths, fulfilling missing rows instead of erroring.
 */
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
  /** Files that matched multiple candidates (for the caller to log). First candidate used. */
  ambiguousMatches: AmbiguousMatch[];
  /** Files that matched nothing — ignored per contract. */
  unmatched: File[];
}

/** Result of `pickRootMostTscn`: the picked file with its already-read text. */
export interface RootMostTscnResult {
  file: File;
  text: string;
  /** True when the pick was ambiguous (tie or cycle) and fell back to the first candidate — for the caller to log. */
  ambiguous: boolean;
}

/** The last path segment of a `res://`-or-plain slash-separated path. */
function basename(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? path : path.slice(idx + 1);
}

/**
 * Picks the root-most `.tscn` from a batch: the file whose basename no other
 * file in the batch references. A tie (several unreferenced scenes) picks the
 * first of them; a cycle (every scene referenced by another) picks the first
 * file overall — both flagged `ambiguous: true`.
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
    return { ...first, ambiguous: false };
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

  // Root-most candidates: tscns whose basename no other tscn in the batch references.
  const candidates = filesWithText.filter(
    ({ file }) => !referencedBasenames.has(file.name.toLowerCase())
  );
  if (candidates.length === 1) {
    return { ...candidates[0]!, ambiguous: false };
  }
  return { ...(candidates[0] ?? first), ambiguous: true };
}

/**
 * Matches every file in `others` to a `res://` path by case-insensitive basename.
 *
 * Matching priority:
 * 1. Direct ExtResource reference in `tscnText` (scene's own dependencies).
 *    Pass `null` when the batch carries no scene — matching then runs purely
 *    against `missingPaths`.
 * 2. Currently-missing `res://` paths in `missingPaths` (fulfills a sub-scene's
 *    dependencies on repeated drops).
 *
 * Ambiguous matches (multiple candidates share the same basename) use the first
 * candidate and record the collision in `ambiguousMatches` for the caller to log.
 * Files matching nothing are collected in `unmatched`.
 */
export function matchResourceFiles(
  tscnText: string | null,
  others: readonly File[],
  missingPaths: ReadonlySet<string>
): MatchResult {
  if (others.length === 0) {
    return { matches: [], ambiguousMatches: [], unmatched: [] };
  }

  const externalResources =
    tscnText === null ? [] : new TscnParser().parse(tscnText).externalResources;
  const missingList = Array.from(missingPaths);

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
    const missingCandidates = missingList.filter(
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

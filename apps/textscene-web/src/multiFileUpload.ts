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
 * 3. No-`.tscn` batch: the caller passes an empty ext-resource list to match
 *    purely against the missing paths, fulfilling missing rows instead of
 *    erroring.
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
  /**
   * The picked scene's ext-resource paths when the pick already parsed it
   * (multi-`.tscn` batches — the pick and the subsequent resource matching
   * share one parse). `null` when the pick needed no parse (single `.tscn`);
   * callers that then need the paths parse lazily via `extResourcePaths`.
   */
  extResourcePaths: readonly string[] | null;
}

/** The last path segment of a `res://`-or-plain slash-separated path. */
function basename(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? path : path.slice(idx + 1);
}

/** All ExtResource paths of a scene text; `[]` when the text doesn't parse. */
export function extResourcePaths(text: string): readonly string[] {
  try {
    return new TscnParser().parse(text).externalResources.map((r) => r.path);
  } catch {
    return [];
  }
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
    return { ...first, ambiguous: false, extResourcePaths: null };
  }

  // Parse each scene ONCE — the same parse answers "which .tscn basenames does
  // each file reference?" for the pick AND supplies the picked file's paths
  // for the resource matching that follows.
  const entries = filesWithText.map((entry) => ({
    entry,
    paths: extResourcePaths(entry.text),
  }));

  // Collect all basenames of .tscn files referenced across every file in the
  // batch. A file's reference to its OWN basename (e.g. `door.tscn` instancing
  // `res://variants/door.tscn`) is skipped — a scene can't instance itself, so
  // such a reference must point at a different, same-named file and must not
  // disqualify the referencing scene from being the root.
  const referencedBasenames = new Set<string>();
  for (const { entry, paths } of entries) {
    const ownName = entry.file.name.toLowerCase();
    for (const path of paths) {
      const refName = basename(path).toLowerCase();
      if (refName.endsWith('.tscn') && refName !== ownName) {
        referencedBasenames.add(refName);
      }
    }
  }

  // Root-most candidates: tscns whose basename no other tscn in the batch references.
  const candidates = entries.filter(
    ({ entry }) => !referencedBasenames.has(entry.file.name.toLowerCase())
  );
  const pick = candidates[0] ?? entries[0]!;
  return { ...pick.entry, ambiguous: candidates.length !== 1, extResourcePaths: pick.paths };
}

/**
 * Matches every file in `others` to a `res://` path by case-insensitive basename.
 *
 * Matching priority:
 * 1. Direct ExtResource path of the active scene (`extResourcePaths` — the
 *    scene's own dependencies). Pass `[]` when the batch carries no scene;
 *    matching then runs purely against `missingPaths`.
 * 2. Currently-missing `res://` paths in `missingPaths` (fulfills a sub-scene's
 *    dependencies on repeated drops).
 *
 * Ambiguous matches (multiple candidates in the winning tier share the same
 * basename) use the first candidate and record the collision in
 * `ambiguousMatches` for the caller to log. Files matching nothing are
 * collected in `unmatched`.
 */
export function matchResourceFiles(
  extResources: readonly string[],
  others: readonly File[],
  missingPaths: ReadonlySet<string>
): MatchResult {
  const matches: ResourceFileMatch[] = [];
  const ambiguousMatches: AmbiguousMatch[] = [];
  const unmatched: File[] = [];

  // Priority tiers: the first tier with any basename match wins for a file
  // (first-declared candidate wins within the tier).
  const tiers = [extResources, Array.from(missingPaths)];

  for (const file of others) {
    const nameLower = file.name.toLowerCase();
    const candidates = tiers
      // Dedup within the tier: a scene declaring the same res:// path in two
      // ext_resource headers is one candidate, not a fake ambiguity.
      .map((tier) => [
        ...new Set(tier.filter((path) => basename(path).toLowerCase() === nameLower)),
      ])
      .find((tierMatches) => tierMatches.length > 0);

    if (candidates === undefined) {
      unmatched.push(file);
      continue;
    }
    if (candidates.length > 1) {
      ambiguousMatches.push({ file, candidates });
    }
    matches.push({ path: candidates[0]!, file });
  }

  return { matches, ambiguousMatches, unmatched };
}

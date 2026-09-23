/**
 * Multi-file upload: pick the active `.tscn` of a dropped or selected batch, and
 * match every other file to a `res://` path by case-insensitive basename, so a
 * scene and its textures, or a sub-scene's dependencies, arrive in one gesture.
 * `createFileIngest` states the contract.
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
  /** Files that matched nothing, which the contract ignores. */
  unmatched: File[];
}

/** Result of `pickRootMostTscn`: the picked file with its already-read text. */
export interface RootMostTscnResult {
  file: File;
  text: string;
  /** True when the pick was ambiguous (tie or cycle) and fell back to the first candidate, for the caller to log. */
  ambiguous: boolean;
  /**
   * The picked scene's ext-resource paths when a multi-`.tscn` pick parsed it, so
   * matching shares that parse. `null` for a single `.tscn`, whose caller parses
   * lazily through `extResourcePaths`.
   */
  extResourcePaths: readonly string[] | null;
}

/** The last path segment of a `res://`-or-plain slash-separated path. */
function basename(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? path : path.slice(idx + 1);
}

/** All ExtResource paths of a scene text, or `[]` when the text does not parse. */
export function extResourcePaths(text: string): readonly string[] {
  try {
    return new TscnParser().parse(text).externalResources.map((r) => r.path);
  } catch {
    return [];
  }
}

/**
 * Picks the root-most `.tscn`: the file whose basename no other file references.
 * A tie picks the first unreferenced scene, and a cycle the first file, both
 * flagged `ambiguous: true`. `filesWithText` holds every `.tscn` of the batch with
 * its text.
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

  // One parse per scene serves the pick and the picked file's resource matching.
  const entries = filesWithText.map((entry) => ({
    entry,
    paths: extResourcePaths(entry.text),
  }));

  // A reference to a file's own basename (`door.tscn` instancing
  // `res://variants/door.tscn`) is skipped: a scene cannot instance itself, so it
  // names a different file and does not disqualify the root.
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
 * Matches each file in `others` to a `res://` path by case-insensitive basename:
 * first the active scene's `extResourcePaths` (`[]` with no scene), then
 * `missingPaths`. A basename shared in the winning tier takes the first candidate
 * and lands in `ambiguousMatches`, and a file matching nothing in `unmatched`.
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

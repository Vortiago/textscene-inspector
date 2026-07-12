/**
 * Issue #221 — multi-file / drag-and-drop upload: pick the `.tscn` among a
 * batch of dropped/selected files and map every OTHER file onto one of the
 * scene's `res://` external-resource paths by basename, so a scene + its
 * textures can open in one gesture instead of requiring the per-path
 * Resources-tab upload for each missing file individually.
 */
import { TscnParser } from '@textscene/core';

/** A non-`.tscn` file matched to the `res://` path it fulfills. */
export interface ResourceFileMatch {
  path: string;
  file: File;
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
 * Matches every file in `others` to an external-resource `res://` path
 * declared in `tscnText`, by basename (case-insensitive). A file that
 * doesn't match any reference is silently dropped — it simply isn't wired
 * to anything the scene asked for.
 */
export function matchResourceFiles(
  tscnText: string,
  others: readonly File[]
): ResourceFileMatch[] {
  if (others.length === 0) return [];
  const { externalResources } = new TscnParser().parse(tscnText);
  const matches: ResourceFileMatch[] = [];
  for (const file of others) {
    const ref = externalResources.find(
      (r) => basename(r.path).toLowerCase() === file.name.toLowerCase()
    );
    if (ref) matches.push({ path: ref.path, file });
  }
  return matches;
}

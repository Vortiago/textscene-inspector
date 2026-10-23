/**
 * Find All References for a `res://` path: every exact occurrence of the path under the cursor in the text resources
 * of the project. It is the editor twin of Godot's "View Owners" dialog (`dependency_editor.cpp:376-402`). The host
 * lists the project and reads its files through a {@link ReferenceSource}, so the engine owns the matching.
 */

import { isGodotTextResourcePath } from '../godot/project/resourceFormats.js';
import { inPathOrder } from '../resources/resPath.js';
import type { LanguageDocument } from './document.js';
import { resPathAt, resPathOccurrencesInText } from './navigation.js';
import type { Position, Range } from './types.js';

/** What a host gives {@link resPathReferencesAt}: the project's files, the text of each, and the request's state. */
export interface ReferenceSource {
  /** The `res://` path of every file of the project, as path completion lists them, in any order. */
  listPaths(): Promise<readonly string[]>;
  /**
   * The unsaved text of an open editor that holds the file at a `res://` path, or undefined when none does. It wins
   * over the file on disk, because a range from the disk's text lands on the wrong line in the editor.
   */
  openText(path: string): string | undefined;
  /** The text of the file at a `res://` path on disk, or null for a file the host cannot read. It never throws. */
  readFile(path: string): Promise<string | null>;
  /** Whether the client cancelled the request. The engine reads no further file once it has. */
  isCancelled(): boolean;
}

/** One occurrence of the path: the file that holds it and the span it fills. */
export interface ResPathReference {
  /** The `res://` path of the file. */
  readonly file: string;
  readonly range: Range;
}

/**
 * The reads in flight at once. A read holds a file handle, and a project can hold thousands of scenes, so an
 * unbounded `Promise.all` would pass the default limit of 1024 handles on Linux and macOS.
 */
const READS_IN_FLIGHT = 32;

/** `visit` over `items`, with at most {@link READS_IN_FLIGHT} calls in flight. The results come back in the order of `items`. */
async function mapBounded<Item, Result>(
  items: readonly Item[],
  visit: (item: Item) => Promise<Result>
): Promise<Result[]> {
  const results = new Array<Result>(items.length);
  let next = 0;
  const work = async (): Promise<void> => {
    for (let index = next++; index < items.length; index = next++) {
      results[index] = await visit(items[index]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(READS_IN_FLIGHT, items.length) }, work));
  return results;
}

/** The occurrences of `path` in `text`. A file that does not hold the path as a substring holds no occurrence. */
function occurrencesOf(path: string, text: string): Range[] {
  if (!text.includes(path)) return [];
  return resPathOccurrencesInText(text)
    .filter((occurrence) => occurrence.path === path)
    .map(({ range }) => range);
}

/**
 * Every occurrence of the `res://` path under the cursor, sorted by the path of its file, then in line order, so each
 * host gives one order whatever order its listing walks in. It matches the whole path, so `res://a.tscn` finds neither
 * `res://a.tscn.import` nor `res://dir/a.tscn`. It reads the path's text only: an `ext_resource` whose `uid=` names the
 * file but whose `path=` is stale is not found. A cursor off a `res://` path gives none, and reads nothing. A
 * cancelled request gives whatever the reads before the cancel found, which the host drops.
 */
export async function resPathReferencesAt(
  document: LanguageDocument,
  position: Position,
  source: ReferenceSource
): Promise<readonly ResPathReference[]> {
  const target = resPathAt(document, position);
  if (target === undefined) return [];
  // Code-unit order, not `localeCompare`: the order must not move with the user's locale.
  const files = inPathOrder((await source.listPaths()).filter(isGodotTextResourcePath));
  const perFile = await mapBounded(files, async (file) => {
    if (source.isCancelled()) return [];
    const text = source.openText(file) ?? (await source.readFile(file));
    return text === null ? [] : occurrencesOf(target.path, text).map((range) => ({ file, range }));
  });
  return perFile.flat();
}

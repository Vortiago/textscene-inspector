/**
 * The answers both editor hosts must give for the shared Godot fixture project in
 * `scenes/language-features/`: the VS Code suites and the `tscn-lsp` end-to-end test read one
 * `answers.json` through this module, so a pass in both proves the two hosts agree (ADR-0049).
 * The JSON lies outside every package's `rootDir`, so it is read from disk, not imported.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** The fixture directory, from the repository root. */
const FIXTURE_PATH = join('scenes', 'language-features');

/** `[startLine, startCharacter, endLine, endCharacter]`, zero-based. */
export type RangeTuple = [number, number, number, number];

/**
 * A cursor in a project file: the line that starts with `line`, moved down `below` lines,
 * at one character inside `inside`, or just past `after`.
 */
export interface CursorSpec {
  readonly file: string;
  readonly line: string;
  readonly below?: number;
  readonly inside?: string;
  readonly after?: string;
}

interface Named {
  readonly name: string;
  readonly at: CursorSpec;
}

export interface LanguageFeatureAnswers {
  /** A null `markdown` means the position has no hover. */
  readonly hover: ReadonlyArray<Named & { readonly markdown: string | null; readonly range?: RangeTuple }>;
  readonly completion: ReadonlyArray<
    Named & {
      readonly includes?: readonly string[];
      readonly excludes?: readonly string[];
      readonly exactly?: readonly string[];
      /** The completion item kind of every item, by its name in either host's enum. */
      readonly kind?: string;
    }
  >;
  readonly definition: ReadonlyArray<
    Named & { readonly targets: ReadonlyArray<{ readonly file: string; readonly range: RangeTuple }> }
  >;
  readonly highlights: ReadonlyArray<Named & { readonly ranges: readonly RangeTuple[] }>;
  readonly folding: { readonly file: string; readonly ranges: ReadonlyArray<[number, number]> };
  readonly links: {
    readonly file: string;
    readonly links: ReadonlyArray<{ readonly range: RangeTuple; readonly target: string }>;
  };
  readonly symbols: {
    readonly file: string;
    readonly outline: readonly string[];
    /** Every symbol in outline order, with its symbol kind by its name in either host's enum. */
    readonly symbols: ReadonlyArray<{
      readonly name: string;
      readonly kind: string;
      readonly range: RangeTuple;
      readonly selectionRange: RangeTuple;
    }>;
  };
  readonly quickFix: Named & { readonly title: string; readonly fixedLine: string };
  readonly diagnostics: ReadonlyArray<{ readonly file: string; readonly codes: readonly string[] }>;
}

/**
 * The fixture directory, found by walking up from `fromDir`. A test bundle sits at its own
 * depth under its package's output directory, so no fixed number of `..` holds for all.
 */
export function answersFixtureDir(fromDir: string): string {
  for (let dir = fromDir; ; dir = dirname(dir)) {
    const candidate = join(dir, FIXTURE_PATH);
    if (existsSync(join(candidate, 'answers.json'))) return candidate;
    if (dirname(dir) === dir) throw new Error(`expected ${FIXTURE_PATH} above ${fromDir}, found none`);
  }
}

export function loadAnswers(fixtureDir: string): LanguageFeatureAnswers {
  return JSON.parse(readFileSync(join(fixtureDir, 'answers.json'), 'utf8')) as LanguageFeatureAnswers;
}

/**
 * The zero-based position a cursor spec names, over a host's own lines. Throws when the spec
 * matches nothing, so a stale answer fails loudly rather than testing the wrong place.
 */
export function cursorIn(lines: readonly string[], spec: CursorSpec): { line: number; character: number } {
  const start = lines.findIndex((candidate) => candidate.startsWith(spec.line));
  if (start === -1)
    throw new Error(`expected a line starting with ${JSON.stringify(spec.line)} in ${spec.file}`);
  const line = start + (spec.below ?? 0);
  const needle = spec.inside ?? spec.after ?? '';
  const column = (lines[line] ?? '').indexOf(needle);
  if (column === -1)
    throw new Error(`expected ${JSON.stringify(needle)} on line ${line + 1} of ${spec.file}`);
  return { line, character: spec.inside !== undefined ? column + 1 : column + needle.length };
}

/** A host's range as a tuple. LSP and VS Code ranges both have this shape. */
export function rangeTuple(range: {
  readonly start: { readonly line: number; readonly character: number };
  readonly end: { readonly line: number; readonly character: number };
}): RangeTuple {
  return [range.start.line, range.start.character, range.end.line, range.end.character];
}

/** Ranges in document order, since neither host promises an order for highlights. */
export function sortedRanges(ranges: readonly RangeTuple[]): RangeTuple[] {
  return [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

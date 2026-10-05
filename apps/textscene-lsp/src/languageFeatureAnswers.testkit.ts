/**
 * The answers both editor hosts must give for the shared Godot fixture project in
 * `scenes/language-features/`. The VS Code suites read the same `answers.json`, so a test
 * here and its twin there prove the two hosts agree (ADR-0046). The JSON lies outside this
 * package's `rootDir`, so it is read from disk, not imported.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './lspClient.testkit';

export const FIXTURE_DIR = join(repoRoot, 'scenes', 'language-features');
export const PROJECT_DIR = join(FIXTURE_DIR, 'project');

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

export function loadAnswers(): LanguageFeatureAnswers {
  return JSON.parse(readFileSync(join(FIXTURE_DIR, 'answers.json'), 'utf8')) as LanguageFeatureAnswers;
}

/** The text of a project file, as committed. */
export function projectText(file: string): string {
  return readFileSync(join(PROJECT_DIR, file), 'utf8');
}

/** The zero-based position a cursor spec names in `text`. Throws when the spec matches nothing. */
export function cursorIn(text: string, spec: CursorSpec): { line: number; character: number } {
  const lines = text.split('\n');
  const start = lines.findIndex((candidate) => candidate.startsWith(spec.line));
  if (start === -1)
    throw new Error(`expected a line starting with ${JSON.stringify(spec.line)} in ${spec.file}`);
  const line = start + (spec.below ?? 0);
  const content = lines[line] ?? '';
  const needle = spec.inside ?? spec.after ?? '';
  const column = content.indexOf(needle);
  if (column === -1)
    throw new Error(`expected ${JSON.stringify(needle)} on line ${line + 1} of ${spec.file}`);
  return { line, character: spec.inside !== undefined ? column + 1 : column + needle.length };
}

interface LspRange {
  readonly start: { readonly line: number; readonly character: number };
  readonly end: { readonly line: number; readonly character: number };
}

export function rangeTuple(range: LspRange): RangeTuple {
  return [range.start.line, range.start.character, range.end.line, range.end.character];
}

/** Ranges in document order, since neither host promises an order for highlights. */
export function sortedRanges(ranges: readonly RangeTuple[]): RangeTuple[] {
  return [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

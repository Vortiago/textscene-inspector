/**
 * The answers both editor hosts must give for the shared Godot fixture project in
 * `scenes/language-features/`. The `tscn-lsp` end-to-end test reads the same `answers.json`,
 * so a test here and its twin there prove the two hosts agree (ADR-0046). The JSON lies
 * outside this package's `rootDir`, so it is read from disk, not imported.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * The fixture directory. `__dirname` is the bundle's output directory,
 * `<repo>/apps/textscene-vscode/dist/test/<suite>/suite`, six levels below the repository root.
 */
const FIXTURE_DIR = path.resolve(__dirname, '../../../../../../scenes/language-features');

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
  return JSON.parse(
    fs.readFileSync(path.join(FIXTURE_DIR, 'answers.json'), 'utf8')
  ) as LanguageFeatureAnswers;
}

/**
 * Recreates `destination` as a copy of the fixture project. `cpSync` keeps the PNG bytes and
 * the dot-named `.godot` and `.gdignore` entries, which the path-completion answer depends on.
 */
export function copyFixtureProject(destination: string): void {
  removeFixtureProject(destination);
  fs.cpSync(path.join(FIXTURE_DIR, 'project'), destination, { recursive: true });
}

/** Removes a copy that `copyFixtureProject` made. */
export function removeFixtureProject(destination: string): void {
  fs.rmSync(destination, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
}

/** The zero-based position a cursor spec names in `document`. Throws when the spec matches nothing. */
export function cursorIn(document: vscode.TextDocument, spec: CursorSpec): vscode.Position {
  let start = -1;
  for (let line = 0; line < document.lineCount && start === -1; line++) {
    if (document.lineAt(line).text.startsWith(spec.line)) start = line;
  }
  if (start === -1)
    throw new Error(`expected a line starting with ${JSON.stringify(spec.line)} in ${spec.file}`);
  const line = start + (spec.below ?? 0);
  const needle = spec.inside ?? spec.after ?? '';
  const column = document.lineAt(line).text.indexOf(needle);
  if (column === -1)
    throw new Error(`expected ${JSON.stringify(needle)} on line ${line + 1} of ${spec.file}`);
  return new vscode.Position(line, spec.inside !== undefined ? column + 1 : column + needle.length);
}

export function rangeTuple(range: vscode.Range): RangeTuple {
  return [range.start.line, range.start.character, range.end.line, range.end.character];
}

/** Ranges in document order, since neither host promises an order for highlights. */
export function sortedRanges(ranges: readonly RangeTuple[]): RangeTuple[] {
  return [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/** A path under `projectDir` with forward slashes, so an answer reads the same on Windows. */
export function projectPath(projectDir: string, fsPath: string): string {
  return path.relative(projectDir, fsPath).split(path.sep).join('/');
}

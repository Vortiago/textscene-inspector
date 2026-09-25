/**
 * Source read as text, for the drift guards that assert over spelling rather than
 * behaviour. A match inside a comment is prose, not a use. Test-only: the `testing/`
 * directories under `src` are excluded from the build.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { repoRoot } from '../../parser/testing/parserKit';

export interface SourceFile {
  /** Absolute. */
  readonly file: string;
  readonly source: string;
}

/**
 * Never walked: generated output and installed packages are nobody's source.
 * `.vscode-test` is a downloaded, gitignored VS Code, so walking it makes every
 * corpus depend on whether the machine has run the extension gate.
 */
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  '.vscode-test',
]);

const REPO_ROOT = repoRoot();

/** Repo-relative, so an offender reads the way it would be typed into an editor. */
export const repoPath = (file: string): string => relative(REPO_ROOT, file);

/** A line whose match is prose. Covers a block body, a `//` line and a `/*` opener. */
export function isCommentLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*');
}

/**
 * Whether the comment block immediately above line `index` carries `marker`.
 * Walks the block rather than a fixed window, so a reason worth writing down is
 * never truncated into silence.
 */
function hasExemptionAbove(lines: string[], index: number, marker: string): boolean {
  for (let i = index - 1; i >= 0 && isCommentLine(lines[i]!); i--) {
    if (lines[i]!.includes(marker)) return true;
  }
  return false;
}

/**
 * Whether any of the `window` lines above `index` carries `marker`. A scan over JSX
 * uses this, not the block walk: a braced JSX comment's continuation lines read as
 * code to `isCommentLine`, and the marker often sits above a `return (`.
 */
export function hasExemptionWithin(
  lines: string[],
  index: number,
  marker: string,
  window = 10
): boolean {
  return lines
    .slice(Math.max(0, index - window), index)
    .join('\n')
    .includes(marker);
}

/**
 * Index just past a JSX tag's own `>`, tracking `{…}` so a prop value holding a
 * `>` cannot close it. `start` indexes into `text`; -1 when the tag is unclosed.
 */
export function tagEnd(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (char === '{') depth++;
    else if (char === '}') depth--;
    else if (char === '>' && depth === 0) return i + 1;
  }
  return -1;
}

/** One JSX opener, read whole and collapsed to a single line. */
export interface JsxTag {
  /** 1-based line the opener starts on. */
  readonly line: number;
  /** `<name … />` or `<name …>`, whitespace collapsed to single spaces. */
  readonly tag: string;
}

/**
 * Every JSX opener matching `opener`, read to its own `>` across lines, since a prop
 * value may hold a `>`. Every match on a line is read. A comment line between two
 * props drops out, since a `>` or brace in it would end the read early.
 */
export function jsxTags(source: string, opener: RegExp): JsxTag[] {
  const lines = source.split('\n');
  const scan = new RegExp(opener.source, opener.flags.includes('g') ? opener.flags : `${opener.flags}g`);
  const tags: JsxTag[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (isCommentLine(lines[i]!)) continue;
    // Suffix-only strip, so a match index still addresses the raw line below.
    const code = lines[i]!.replace(/\/\/.*$/, '');
    scan.lastIndex = 0;
    for (let match = scan.exec(code); match; match = scan.exec(code)) {
      const start = match.index;
      let text = '';
      let end = -1;
      for (let j = i; j < lines.length && end < 0; j++) {
        text += (j > i ? '\n' : '') + (j > i && isCommentLine(lines[j]!) ? '' : lines[j]);
        end = tagEnd(text, start);
      }
      if (end >= 0) tags.push({ line: i + 1, tag: text.slice(start, end).replace(/\s+/g, ' ') });
      if (scan.lastIndex === match.index) scan.lastIndex++;
    }
  }
  return tags;
}

/**
 * The top-level arguments of the call whose `(` sits at `open`, or null when the
 * closing `)` is not in `text` yet. Nested calls, arrays, object literals and
 * string bodies are all skipped over, so neither a nested comma nor a `)` inside
 * a `'res://…'` can end an argument or the call early.
 */
function callArguments(text: string, open: number): string[] | null {
  const args: string[] = [];
  let current = '';
  let depth = 0;
  let quote: string | null = null;

  for (let i = open; i < text.length; i++) {
    const char = text[i]!;
    if (quote !== null) {
      current += char;
      if (char === '\\') current += text[++i] ?? '';
      else if (char === quote) quote = null;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      current += char;
    } else if (char === '(' || char === '[' || char === '{') {
      if (depth++ > 0) current += char;
    } else if (char === ')' || char === ']' || char === '}') {
      if (--depth === 0) {
        if (current.trim() !== '') args.push(current.trim());
        return args;
      }
      current += char;
    } else if (char === ',' && depth === 1) {
      args.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  return null;
}

/** One call, read whole: where it starts, what it names and what it was passed. */
export interface CallSite {
  /** 1-based line the callee starts on. */
  readonly line: number;
  /** The matched opener, up to and including its `(`. */
  readonly callee: string;
  /** Top-level arguments, each trimmed. */
  readonly args: readonly string[];
}

/**
 * Every call matching `opener` (up to and including the `(`), read to its own `)`
 * across lines. The `jsxTags` counterpart for a rule over argument positions. A
 * comment line between two arguments drops out.
 */
export function callSites(source: string, opener: RegExp): CallSite[] {
  const lines = source.split('\n');
  const scan = new RegExp(opener.source, opener.flags.includes('g') ? opener.flags : `${opener.flags}g`);
  const sites: CallSite[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (isCommentLine(lines[i]!)) continue;
    // Suffix-only strip, so a match index still addresses the raw line below.
    const code = lines[i]!.replace(/\/\/.*$/, '');
    scan.lastIndex = 0;
    for (let match = scan.exec(code); match; match = scan.exec(code)) {
      const open = match.index + match[0].length - 1;
      let text = '';
      let args: string[] | null = null;
      for (let j = i; j < lines.length && args === null; j++) {
        text += (j > i ? '\n' : '') + (j > i && isCommentLine(lines[j]!) ? '' : lines[j]);
        args = callArguments(text, open);
      }
      if (args !== null) sites.push({ line: i + 1, callee: match[0], args });
      if (scan.lastIndex === match.index) scan.lastIndex++;
    }
  }
  return sites;
}

/**
 * Lines matching `pattern` in code. A trailing `//` comment is prose too, and
 * can launder nothing. Pass `marker` to allow a per-line opt-out; omit it for a
 * rule that takes none.
 */
export function offendingLines(source: string, pattern: RegExp, marker?: string): number[] {
  const lines = source.split('\n');
  const offenders: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (isCommentLine(lines[i]!)) continue;
    if (!pattern.test(lines[i]!.replace(/\/\/.*$/, ''))) continue;
    // Consulted only for a line that already matched: an exemption only suppresses.
    if (marker !== undefined && hasExemptionAbove(lines, i, marker)) continue;
    offenders.push(i + 1);
  }
  return offenders;
}

/** Every file under `roots` whose NAME `accept` takes, walked recursively. */
export function walkSources(roots: readonly string[], accept: (name: string) => boolean): SourceFile[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) walk(path);
      } else if (accept(entry.name)) found.push(path);
    }
  };
  for (const root of roots) walk(root);
  return found.map((file) => ({ file, source: readFileSync(file, 'utf8') }));
}

/** `.ts` or `.tsx` that is not a test: the shape every guard here scans. */
export const isProductionSource = (name: string): boolean =>
  /\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name);

/** `path:line` per offence, ready to name in a failure message. */
export function reportOffenders(
  sources: readonly SourceFile[],
  scan: (source: string) => number[]
): string[] {
  return sources.flatMap(({ file, source }) => scan(source).map((line) => `${repoPath(file)}:${line}`));
}

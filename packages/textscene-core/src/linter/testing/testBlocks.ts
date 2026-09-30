/**
 * The `it` and `test` blocks of a test file, read from its source: each block's
 * title, line and body. A scan, not a parse, so the title-tier guard and its
 * pins can run it over every test file in well under a second.
 */

import { stripComments } from '@textscene/dev-kit';

/**
 * Where a block begins. The lookbehind keeps a method call out: `\b` holds
 * between `.` and `test`, so `SOME_RE.test(value)` would truncate the real block.
 * The dotted chain is one capture, since only the last repetition of a repeated
 * group survives.
 */
const BLOCK_START_RE = /(?<![.$\w])(it|test|describe)((?:\.\w+)*)\s*\(/g;

/** The index just past the balanced `(` at `open`, or -1 when it never closes. */
export function afterBalanced(src: string, open: number): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++;
    else if (src[i] === ')' && --depth === 0) return i + 1;
  }
  return -1;
}

/** Module level: this is tested once per source character between two calls. */
const WHITESPACE = /\s/;

/** The `(` at `from`, past any whitespace, or -1 when something else is there. */
function openParenAt(src: string, from: number): number {
  if (from < 0) return -1;
  let i = from;
  while (i < src.length && WHITESPACE.test(src[i]!)) i++;
  return src[i] === '(' ? i : -1;
}

/**
 * The block's title, when its first argument is a string literal, and where it
 * ends. Sticky, since a windowed slice drops a long title. Closed by the quote
 * it opened with, since `[^'"`]` cuts `(the "no maximum" sentinel)` short.
 */
const TITLE_RE = /\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/y;
function titleAt(src: string, from: number): { text: string; end: number } | null {
  TITLE_RE.lastIndex = from;
  const m = TITLE_RE.exec(src);
  return m ? { text: m[2]!, end: TITLE_RE.lastIndex } : null;
}

export interface Block {
  readonly file: string;
  readonly line: number;
  readonly title: string;
  readonly body: string;
}

/**
 * The body of the block opened at `at`: its own call, never a table declared
 * below it. Parentheses in a string count too, so the close is believed only
 * when it lands on `})` at or before the next start, which bounds it otherwise.
 */
function bodyOf(src: string, at: number, callOpen: number, nextAt: number): string {
  const close = afterBalanced(src, callOpen);
  // `Math.max`: a negative `slice` start counts from the end of the file, so a
  // block closing inside the first 16 characters would be judged on the tail.
  const closes =
    close > at && close <= nextAt && /\}\s*\)$/.test(src.slice(Math.max(0, close - 16), close));
  return src.slice(at, closes ? close : nextAt);
}

/**
 * The `it`/`test` blocks in one file, each body bounded by `bodyOf`. Comments
 * are blanked first, at preserved offsets, since they spell block starts and
 * `severity:` assertions alike.
 */
export function blocksIn(file: string, source: string): Block[] {
  const src = stripComments(source);
  const starts: { at: number; callOpen: number; title: string | null; isCase: boolean }[] = [];
  // How far a title already read reaches. A block start inside one is prose:
  // `the setter never checks it (tile_map.cpp:996)` opens a block exactly the
  // way `SOME_RE.test(` does, and truncates the block it sits in.
  let readThrough = 0;
  for (const m of src.matchAll(BLOCK_START_RE)) {
    if (m.index < readThrough) continue;
    const open = m.index + m[0].length - 1;
    // `it.each(<table>)(<title>, …)`: the title sits in the second call, so
    // the table is skipped by counting parentheses rather than matched.
    const callOpen = m[2]!.includes('.each') ? openParenAt(src, afterBalanced(src, open)) : open;
    if (callOpen < 0) continue;
    const title = titleAt(src, callOpen + 1);
    readThrough = title?.end ?? callOpen + 1;
    starts.push({ at: m.index, callOpen, title: title?.text ?? null, isCase: m[1] !== 'describe' });
  }
  const blocks: Block[] = [];
  // One forward pass for line numbers: a per-block `slice(0, at).split('\n')`
  // rebuilds the whole file once per block.
  let scanned = 0;
  let line = 1;
  for (const [i, s] of starts.entries()) {
    while (scanned < s.at) {
      if (src[scanned] === '\n') line++;
      scanned++;
    }
    if (!s.isCase || s.title === null) continue;
    const body = bodyOf(src, s.at, s.callOpen, starts[i + 1]?.at ?? src.length);
    blocks.push({ file, line, title: s.title, body });
  }
  return blocks;
}

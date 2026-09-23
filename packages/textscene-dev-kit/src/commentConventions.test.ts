/**
 * The AGENTS.md convention that a code comment carries no issue or WI tracker reference, as a
 * red/green guard, since a one-off sweep drifts back. It reads comments in source files, CSS
 * block comments included. String literals such as test titles, `docs/` and other non-code
 * material are out of scope.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { commentSpans } from './commentSpans';

const repoRoot = resolve(import.meta.dirname, '../../..');

const SCAN_ROOTS = ['packages', 'apps', 'scripts'];
const SOURCE_EXT = /\.(?:ts|tsx|js|mjs|css)$/;
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'out',
  'coverage',
  '.test-workspace',
  '.godot',
  // Machine-local gitignored trees full of third-party sources whose comments
  // would fail the guard on dev boxes only (never on a fresh CI checkout).
  '.vscode-test',
  'public',
]);

/** The tracker reference shapes: keep in sync with AGENTS.md. */
const TRACKER_REF = [
  /\bWI-\d+\b/, // WI-<n>
  /\b(?:issue|fixes|closes|resolves|pr)s?\s*#\d+/i, // issue #<n>, closes #<n>
  /\(#\d+\)/, // (#<n>)
  /(?<![\w#&])#\d{1,4}(?![\dA-Fa-f])/, // #<n>, but not a hex colour
];

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        yield* sourceFiles(join(dir, entry.name));
      }
    } else if (SOURCE_EXT.test(entry.name)) {
      yield join(dir, entry.name);
    }
  }
}

function lineOf(source: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

describe('code-comment conventions (AGENTS.md)', () => {
  it('no comment references an issue/WI tracker item', () => {
    const offenders: string[] = [];
    let scanned = 0;
    let spans = 0;

    for (const root of SCAN_ROOTS) {
      for (const file of sourceFiles(join(repoRoot, root))) {
        scanned++;
        const source = readFileSync(file, 'utf8');
        for (const span of commentSpans(source, { blockOnly: file.endsWith('.css') })) {
          spans++;
          for (const ref of TRACKER_REF) {
            const hit = span.text.match(ref);
            if (hit) {
              offenders.push(
                `${relative(repoRoot, file)}:${lineOf(source, span.index)} — "${hit[0]}"`
              );
              break;
            }
          }
        }
      }
    }

    // `offenders` is empty both when the convention holds and when nothing was read: a widened
    // SKIP_DIRS, a moved root or a lexer that stops returning spans all report clean.
    expect(scanned).toBeGreaterThan(3000);
    expect(spans).toBeGreaterThan(10000);
    expect(
      offenders,
      `Tracker references in code comments (AGENTS.md forbids them — state the ` +
        `rationale in words instead):\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});

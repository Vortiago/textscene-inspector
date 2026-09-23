/**
 * The AGENTS.md convention that a code comment carries no issue or WI tracker reference, as a
 * red/green guard, since a one-off sweep drifts back. It reads comments in source files, CSS
 * block comments included. String literals such as test titles, `docs/` and other non-code
 * material are out of scope.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { commentSpans } from './commentSpans';
import { lineOf, REPO_ROOT, workingTreeFiles } from './repoFiles';

/** The tracker reference shapes: keep in sync with AGENTS.md. */
const TRACKER_REF = [
  /\bWI-\d+\b/, // WI-<n>
  /\b(?:issue|fixes|closes|resolves|pr)s?\s*#\d+/i, // issue #<n>, closes #<n>
  /\(#\d+\)/, // (#<n>)
  /(?<![\w#&])#\d{1,4}(?![\dA-Fa-f])/, // #<n>, but not a hex colour
];

describe('code-comment conventions (AGENTS.md)', () => {
  it('no comment references an issue/WI tracker item', () => {
    const offenders: string[] = [];
    let spans = 0;

    const files = workingTreeFiles('*.ts', '*.tsx', '*.js', '*.mjs', '*.css');
    for (const file of files) {
      const source = readFileSync(resolve(REPO_ROOT, file), 'utf8');
      for (const span of commentSpans(source, { blockOnly: file.endsWith('.css') })) {
        spans++;
        for (const ref of TRACKER_REF) {
          const hit = span.text.match(ref);
          if (hit) {
            offenders.push(`${file}:${lineOf(source, span.index)} — "${hit[0]}"`);
            break;
          }
        }
      }
    }

    // `offenders` is empty both when the convention holds and when nothing was read: a narrowed
    // pathspec or a lexer that stops returning spans both report clean.
    expect(files.length).toBeGreaterThan(3000);
    expect(spans).toBeGreaterThan(10000);
    expect(
      offenders,
      `Tracker references in code comments (AGENTS.md forbids them — state the ` +
        `rationale in words instead):\n${offenders.join('\n')}`
    ).toEqual([]);
  });
});

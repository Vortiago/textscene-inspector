/**
 * Repo prose guard: code comments, `.tscn` comments and markdown keep the
 * mechanical subset of the prose rules in `proseRules.ts`. Vendored, legal and
 * generated files keep their owner's text.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  commentBlocks,
  commentViolations,
  isGeneratedSource,
  markdownViolations,
  tscnCommentBlocks,
  type CommentBlock,
} from './proseRules';
import { lineOf, REPO_ROOT, workingTreeFiles } from './repoFiles';

/** Vendored from Godot's demo projects, legal text, or written by a generator. */
const VERBATIM_PATH =
  /^scenes\/(?:demos|isometric)\/|(?:^|\/)(?:THIRD-PARTY-NOTICES|SECURITY)\.md$|\.generated\.ts$/;

/** The working tree's files, minus the verbatim ones. */
function trackedFiles(...pathspecs: string[]): string[] {
  return workingTreeFiles(...pathspecs).filter((path) => !VERBATIM_PATH.test(path));
}

/** Offenders of every block in the files, and how many blocks were read. */
function scanComments(
  files: string[],
  blocksOf: (source: string, path: string) => CommentBlock[]
): { offenders: string[]; blocks: number } {
  const offenders: string[] = [];
  let blocks = 0;
  for (const path of files) {
    const source = readFileSync(resolve(REPO_ROOT, path), 'utf8');
    for (const block of blocksOf(source, path)) {
      blocks++;
      for (const { rule, found } of commentViolations(block.text)) {
        offenders.push(`${path}:${lineOf(source, block.index)} ${rule}: "${found}"`);
      }
    }
  }
  return { offenders, blocks };
}

const failureMessage = (offenders: string[]): string =>
  `Prose that breaks the repo prose rules (${offenders.length}):\n${offenders.join('\n')}`;

describe('prose conventions', () => {
  it('code comments keep the prose rules', () => {
    const files = trackedFiles('*.ts', '*.tsx', '*.js', '*.mjs', '*.css');
    const { offenders, blocks } = scanComments(files, (source, path) =>
      isGeneratedSource(source) ? [] : commentBlocks(source, { blockOnly: path.endsWith('.css') })
    );
    // An empty list also means nothing was read, so the floors prove the scan saw the tree.
    expect(files.length).toBeGreaterThan(3000);
    expect(blocks).toBeGreaterThan(10000);
    expect(offenders, failureMessage(offenders)).toEqual([]);
  });

  it('.tscn comments keep the prose rules', () => {
    const files = trackedFiles('*.tscn');
    const { offenders, blocks } = scanComments(files, (source) => tscnCommentBlocks(source));
    expect(files.length).toBeGreaterThan(500);
    expect(blocks).toBeGreaterThan(300);
    expect(offenders, failureMessage(offenders)).toEqual([]);
  });

  it('markdown keeps the prose rules', () => {
    const files = trackedFiles('*.md');
    const offenders = files.flatMap((path) =>
      markdownViolations(readFileSync(resolve(REPO_ROOT, path), 'utf8')).map(
        ({ line, violation }) => `${path}:${line} ${violation.rule}: "${violation.found}"`
      )
    );
    expect(files.length).toBeGreaterThan(250);
    expect(offenders, failureMessage(offenders)).toEqual([]);
  });
});

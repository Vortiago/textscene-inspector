/**
 * `commentSpans` agrees with the TypeScript parser on every tracked source file.
 *
 * The hand-written scanner exists because the guards that read it must not need
 * a compiler, and it is fast enough to run per-file in a dozen test suites. But
 * a hand-written lexer drifts from the language, and its failures are SILENT in
 * both directions: blanked real source is absent rather than wrong, and a
 * missed comment lets commented-out code answer a scan. Three rounds of review
 * found lexer bugs one construct at a time — a regex after `return`, a nested
 * template flipping backtick parity, a regex holding a quote inside `${ … }` —
 * so the fix is to stop reviewing the lexer and compare it against the real
 * one.
 *
 * The oracle is the TypeScript PARSER, not its scanner: `ts.createScanner`
 * cannot tell `/` division from a regex literal without parser context, so a
 * bare scanner is wrong on exactly the inputs at issue here. Literal ranges are
 * taken from the AST instead, and any comment opener outside all of them is a
 * comment.
 *
 * `typescript` is a dev-kit devDependency and this runs in ~3s over ~2,000
 * files, so it is an ordinary test rather than a script.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { commentSpans } from './commentSpans';

const REPO_ROOT = resolve(dirname(new URL(import.meta.url).pathname), '../../..');

function trackedSources(): string[] {
  return execFileSync('git', ['ls-files', '*.ts', '*.tsx', '*.mjs'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
    .split('\n')
    .filter((f) => f !== '' && !f.includes('/dist/'));
}

function scriptKind(file: string): ts.ScriptKind {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.mjs')) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

/** Every offset the TypeScript parser puts inside a comment. */
function parserComments(source: string, file: string): Set<number> {
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, scriptKind(file));
  const literals: [number, number][] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteral(node) ||
      ts.isRegularExpressionLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
      ts.isJsxText(node)
    ) {
      literals.push([node.getStart(sf), node.getEnd()]);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  literals.sort((a, b) => a[0] - b[0]);

  const insideLiteral = (at: number): boolean => {
    let lo = 0;
    let hi = literals.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (at < literals[mid]![0]) hi = mid - 1;
      else if (at >= literals[mid]![1]) lo = mid + 1;
      else return true;
    }
    return false;
  };

  const offsets = new Set<number>();
  let i = 0;
  while (i < source.length) {
    const block = source[i] === '/' && source[i + 1] === '*';
    const line = source[i] === '/' && source[i + 1] === '/';
    if ((block || line) && !insideLiteral(i)) {
      const close = block ? source.indexOf('*/', i + 2) : source.indexOf('\n', i);
      const end = close === -1 ? source.length : block ? close + 2 : close;
      for (let k = i; k < end; k++) offsets.add(k);
      i = end;
    } else i++;
  }
  return offsets;
}

describe('commentSpans against the TypeScript parser', () => {
  const files = trackedSources();

  it('has a corpus to compare, so an empty file list cannot pass this', () => {
    expect(files.length).toBeGreaterThan(1000);
  });

  it('never blanks real source, and never misses a comment', () => {
    // Both directions in one sweep: a divergence either hides code from a scan
    // or exposes commented-out code to one, and each is a silent guard failure.
    const blanked: string[] = [];
    const missed: string[] = [];

    for (const file of files) {
      const source = readFileSync(resolve(REPO_ROOT, file), 'utf8');
      const truth = parserComments(source, file);
      const ours = new Set<number>();
      for (const span of commentSpans(source)) {
        for (let k = span.index; k < span.index + span.text.length; k++) ours.add(k);
      }
      // Newlines are excluded: a line comment's span stops before its newline
      // while a block comment's contains them, and neither is a divergence
      // anything can read.
      const lineOf = (at: number): number => source.slice(0, at).split('\n').length;
      for (const at of ours) {
        if (!truth.has(at) && source[at] !== '\n') {
          blanked.push(`${file}:${lineOf(at)} treats real source as a comment`);
          break;
        }
      }
      for (const at of truth) {
        if (!ours.has(at) && source[at] !== '\n') {
          missed.push(`${file}:${lineOf(at)} does not see a real comment`);
          break;
        }
      }
    }

    expect({ blanked, missed }).toEqual({ blanked: [], missed: [] });
    // Parsing ~2,000 files takes ~4s alone and ~8s sharing cores with the rest
    // of the root suite, so the 5s default made this fail as a TIMEOUT in
    // `pnpm validate` while passing standalone. The budget is generous rather
    // than tight: a slow machine failing this says nothing about the lexer.
  }, 120_000);
});

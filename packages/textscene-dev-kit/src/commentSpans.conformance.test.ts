/**
 * `commentSpans` agrees with the TypeScript parser on every tracked source file. The hand-written
 * lexer keeps the guards free of a compiler, and its silent drift is caught here. The oracle is the
 * parser, not `ts.createScanner`, which cannot tell division from a regex without parser context:
 * literal ranges come from the AST, and a comment opener outside all of them is a comment.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { commentSpans } from './commentSpans';

const REPO_ROOT = resolve(dirname(new URL(import.meta.url).pathname), '../../..');

function trackedSources(): string[] {
  // `.js` too: the TypeScript parser reads it, and `commentConventions` scans it.
  return execFileSync('git', ['ls-files', '*.ts', '*.tsx', '*.mjs', '*.js'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
    .split('\n')
    .filter((f) => f !== '' && !f.includes('/dist/'))
    // A file the index lists but the worktree removed has no source, as in
    // `godot-source-decoupling.test.mjs`. The corpus floor below stops this hiding a collapsed list.
    .filter((f) => existsSync(resolve(REPO_ROOT, f)));
}

function scriptKind(file: string): ts.ScriptKind {
  if (file.endsWith('.tsx')) return ts.ScriptKind.TSX;
  if (file.endsWith('.mjs') || file.endsWith('.js')) return ts.ScriptKind.JS;
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

/**
 * How many block comments a CSS file opens, counted by delimiter. It knows only the two block
 * delimiters and quoted strings, so it shares no branch with the lexer it checks: a
 * `calc(100% / 3)` read as a regex drops the lexer's count and not this one.
 */
function blockDelimiters(source: string): number {
  let count = 0;
  let i = 0;
  while (i < source.length) {
    const c = source[i];
    if (c === '"' || c === "'") {
      i++;
      while (i < source.length && source[i] !== c) i += source[i] === '\\' ? 2 : 1;
      i++;
      continue;
    }
    if (c === '/' && source[i + 1] === '*') {
      count++;
      const close = source.indexOf('*/', i + 2);
      i = close === -1 ? source.length : close + 2;
      continue;
    }
    i++;
  }
  return count;
}

describe('commentSpans against the TypeScript parser', () => {
  const files = trackedSources();

  it('has a corpus to compare, so an empty file list cannot pass this', () => {
    expect(files.length).toBeGreaterThan(1000);
  });

  it('keeps every lexed class in the corpus, not just the biggest one', () => {
    // The sweep above is one aggregate, where a class that stopped being lexed would vanish in the
    // total while its comments left the tracker-reference guard. A floor per class catches that.
    const counted = new Map<string, number>();
    for (const file of files) {
      const ext = file.slice(file.lastIndexOf('.'));
      counted.set(ext, (counted.get(ext) ?? 0) + 1);
    }
    const thin = ['.ts', '.tsx', '.mjs', '.js'].filter((ext) => (counted.get(ext) ?? 0) < 3);
    expect(thin).toEqual([]);
  });

  it('lexes the CSS block-comment branch, which no parser oracle covers', () => {
    // `blockOnly` is a second code path: CSS has no `//` comment, so `url(//…)` opens none.
    // TypeScript is no oracle for CSS, so the claim is narrower: the branch finds the comments
    // that are there.
    const css = execFileSync('git', ['ls-files', '*.css'], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
    })
      .split('\n')
      .filter((f) => f !== '' && existsSync(resolve(REPO_ROOT, f)));
    expect(css.length).toBeGreaterThan(5);

    let spans = 0;
    const disagree: string[] = [];
    for (const file of css) {
      const source = readFileSync(resolve(REPO_ROOT, file), 'utf8');
      const found = [...commentSpans(source, { blockOnly: true })];
      spans += found.length;
      const expected = blockDelimiters(source);
      if (found.length !== expected) {
        disagree.push(`${file}: lexed ${found.length}, the file opens ${expected}`);
      }
    }
    expect(disagree).toEqual([]);
    expect(spans).toBeGreaterThan(50);
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
      // Newlines are excluded: a line comment's span stops before its newline while a block
      // comment's holds them, and no scan reads that difference.
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
    // The parse outlasts the 5s default when it shares cores with the root suite in
    // `pnpm validate`. The budget is generous: a slow machine says nothing about the lexer.
  }, 120_000);
});

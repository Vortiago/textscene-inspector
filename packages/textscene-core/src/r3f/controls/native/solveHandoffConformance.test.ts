/**
 * Drift guard: the three things `solveHandoff.ts` promises that neither the
 * type checker nor any per-slice test can see.
 *
 * 1. A **share**'s callback reads only the node and the theme. `ShareNode`
 *    already makes `n.children` a type error and the callback is handed no
 *    `SolveContext` at all — this scan is what closes the ways around both: a
 *    cast back to `SolveNode`, and a `ctx` captured from an enclosing scope.
 *    The memo is only safe while this holds, because a share computed for the
 *    SOLVER is handed straight back to the PAINTER.
 *
 * 2. No painter hand-rolls an opener. Before this, ten painters carried an
 *    `isFooShape(meta)` guard plus a fallback arm, and no painter test ever
 *    set `meta` — so every unit test exercised the fallback while production
 *    took the other arm. A shape guard also cannot tell a value this slice
 *    produced from any object of the same shape; a channel's opener compares
 *    the channel by reference, so provenance is what it answers.
 *
 * 3. Every value that actually reaches `SolvedControl.meta` in a real solve is
 *    sealed. `SealedHandoff` makes a raw one a type error at the producer, and
 *    this is the runtime half — it also proves the two class-B producers
 *    attach unconditionally, which is what lets their painters take the cached
 *    arm in production.
 *
 * Deliberately NOT asserted: a hit rate, or that a share ran once. The solver
 * is handed `sortableView(n)` (`solveTree.ts:336-339`), a FRESH object wherever
 * a child is promoted, and `presetTimeMinimumSize`/`buildInternalTabBarNode`
 * mint nodes no painter ever sees. A miss is a recompute, never a wrong answer.
 */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isCommentLine,
  repoPath,
  reportOffenders,
  walkSources,
  type SourceFile,
} from '../../testing/sourceScan';
import { isSealedHandoff } from './solveHandoff';
import { createSolveContext, solveControlTree } from './controlRectSolver';
import { nativeTheme } from './nativeTheme';
import { solveNode } from './testing/solveNode';
import type { SolveNode } from './solveTree';
import type { TscnNode } from '../../../parser/types';
// Side-effect import: registers every Control slice's solvers and painters.
import '../index';

const UI_ROOT = join(import.meta.dirname, '../../../nodes/2d/ui');

/** The two file kinds a solve handoff can be spelled in: the producer and the consumer. */
const HANDOFF_FILES = ['nativeSolver.ts', 'Component.tsx'];

/** Read once: the tree cannot change mid-run, and each scan reads all of it. */
const HANDOFF_SOURCES: SourceFile[] = walkSources([UI_ROOT], (name) => HANDOFF_FILES.includes(name));

/** Code only — a match inside prose is not a read, on its own line or trailing one. */
function codeLines(source: string): (string | null)[] {
  return source
    .split('\n')
    .map((line) => (isCommentLine(line) ? null : line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')));
}

// --- Guard 1: what a share's callback may read -------------------------------

/**
 * Every `defineShare(` callback's source, paired with the 1-based line it
 * starts on. Read to its OWN closing paren by depth so a callback spanning a
 * hundred lines is scanned whole and the code after it is not.
 */
function shareCallbacks(source: string): { line: number; body: string }[] {
  const found: { line: number; body: string }[] = [];
  const opener = /\bdefineShare\s*(?:<[^>]*>)?\s*\(/g;
  let match: RegExpExecArray | null;
  while ((match = opener.exec(source)) !== null) {
    const start = match.index + match[0].length;
    let depth = 1;
    let end = start;
    while (end < source.length && depth > 0) {
      const char = source[end];
      if (char === '(') depth++;
      else if (char === ')') depth--;
      end++;
    }
    found.push({
      line: source.slice(0, match.index).split('\n').length,
      body: source.slice(start, end - 1),
    });
  }
  return found;
}

/**
 * `n.children` (the SolveNode list `sortableView` rewrites), or any spelling of
 * a `SolveContext` read. `.node.children` is the RAW child list, untouched by
 * `sortableView` and identical for the solver and the painter, so it is
 * excluded by name.
 */
const FORBIDDEN_IN_SHARE =
  /(?<!\.node)\.children\b|\bctx\b|\bcombinedMinimumSize\b|\btentativeRect\b|\bmeasureText\b/;

function shareInvariantOffenders(source: string): number[] {
  const offenders: number[] = [];
  for (const { line, body } of shareCallbacks(source)) {
    codeLines(body).forEach((code, i) => {
      if (code !== null && FORBIDDEN_IN_SHARE.test(code)) offenders.push(line + i);
    });
  }
  return offenders;
}

// --- Guard 2: nobody hand-rolls an opener ------------------------------------

/**
 * The four spellings of `meta` that are not a read: taking it off the painter's
 * props, handing it to a channel's opener, sealing one in a solver, and the two
 * JSX sites that pass `undefined` to a painter they render themselves
 * (`tabcontainer`, `subviewportcontainer`).
 *
 * `import.meta` is stripped first — `\bmeta\b` matches inside it.
 */
function stripAllowedMeta(code: string): string {
  return code
    .replace(/\bimport\.meta\b/g, '')
    .replace(/\.open\(\s*meta\s*\)/g, '')
    .replace(/\bmeta:\s*[A-Za-z_$][\w$]*\.seal\(/g, '')
    .replace(/\bmeta=\{undefined\}/g, '')
    .replace(/(^|[{,])\s*meta\s*(?=[,}])/g, '$1');
}

function handRolledOpenerLines(source: string): number[] {
  const offenders: number[] = [];
  codeLines(source).forEach((code, i) => {
    if (code !== null && /\bmeta\b/.test(stripAllowedMeta(code))) offenders.push(i + 1);
  });
  return offenders;
}

// --- Guard 3: what actually reaches `SolvedControl.meta` ---------------------

function tscn(name: string, type: string, properties: Record<string, unknown>, children: TscnNode[] = []): TscnNode {
  return { name, type, properties, children };
}

/**
 * A two-child container of `type` at the viewport origin — the shape both
 * class-B producers need before they compute anything (a split reports no
 * boundary below two sortable children, and a scroll container needs content
 * to overflow).
 */
function containerTree(type: string): SolveNode[] {
  const childNodes = ['A', 'B'].map((name) =>
    tscn(name, 'Panel', { customMinimumSize: { x: 400, y: 400 } })
  );
  const root = tscn('Root', type, {}, childNodes);
  const children = childNodes.map((node, i) => ({
    ...solveNode(),
    path: `Root/${['A', 'B'][i]!}`,
    node,
  }));
  return [{ ...solveNode(), path: 'Root', node: root, children }];
}

const VIEWPORT = { x: 0, y: 0, w: 300, h: 300 };

/** Every type whose registered `ContainerLayoutFn` seals a channel value. */
const CHANNEL_TYPES = ['ScrollContainer', 'HSplitContainer', 'VSplitContainer', 'SplitContainer'];

describe('solve handoff conformance', () => {
  it('reads every 2D-UI solver and painter, so a new slice cannot escape unnoticed', () => {
    expect(HANDOFF_SOURCES.length).toBeGreaterThanOrEqual(45);
  });

  it('no share reads the solve context or the sortable child list', () => {
    const offenders = reportOffenders(HANDOFF_SOURCES, shareInvariantOffenders);
    expect(
      offenders,
      `a share is memoised per (node, theme) and handed to BOTH the solver and the painter — these reads make the two disagree: ${offenders.join(', ')}`
    ).toEqual([]);
  });

  it('declares at least one share per class-A producer, so the scan above has subjects', () => {
    const shares = HANDOFF_SOURCES.flatMap(({ file, source }) =>
      shareCallbacks(source).map(({ line }) => `${repoPath(file)}:${line}`)
    );
    expect(shares.length).toBeGreaterThanOrEqual(6);
  });

  it('opens `meta` only through a channel — no painter hand-rolls a shape guard', () => {
    const offenders = reportOffenders(HANDOFF_SOURCES, handRolledOpenerLines);
    expect(
      offenders,
      `a shape guard cannot tell this slice's value from any object shaped like it, and its fallback arm is what every painter test exercises: ${offenders.join(', ')}`
    ).toEqual([]);
  });

  it('seals every value a real solve puts on `SolvedControl.meta`', () => {
    const unsealed: string[] = [];
    for (const type of CHANNEL_TYPES) {
      const solved = solveControlTree(containerTree(type), VIEWPORT, createSolveContext(nativeTheme(1)));
      for (const [path, entry] of solved) {
        if (entry.meta !== undefined && !isSealedHandoff(entry.meta)) unsealed.push(`${type} ${path}`);
      }
    }
    expect(unsealed, `a raw value on \`meta\` opens against nothing: ${unsealed.join(', ')}`).toEqual([]);
  });

  it('attaches a channel value unconditionally, so a painter never falls back in production', () => {
    for (const type of CHANNEL_TYPES) {
      const solved = solveControlTree(containerTree(type), VIEWPORT, createSolveContext(nativeTheme(1)));
      expect(isSealedHandoff(solved.get('Root')?.meta), `${type} sealed nothing`).toBe(true);
    }
  });

  it('puts nothing on a minimum-size-only node — `MinimumSizeResult` no longer carries a handoff', () => {
    const label = tscn('Root', 'Label', { text: 'hello' });
    const solved = solveControlTree(
      [{ ...solveNode(), path: 'Root', node: label }],
      VIEWPORT,
      createSolveContext(nativeTheme(1), () => ({ x: 0, y: 0 }))
    );
    expect(solved.get('Root')?.meta).toBeUndefined();
  });

  it('would catch a share reading the context or the child list — the checks are not vacuous', () => {
    const read = (body: string): number[] =>
      shareInvariantOffenders(`export const s = defineShare((n, theme) => {\n${body}\n});`);
    expect(read('  for (const c of n.children) sum += c.x;')).toEqual([2]);
    expect(read('  const min = ctx.combinedMinimumSize(n);')).toEqual([2]);
    expect(read('  if (!outer.measureText) return null;')).toEqual([2]);
    expect(read('  const w = outer.tentativeRect?.(n)?.w;')).toEqual([2]);
    // The RAW child list is not the sortable one — MenuBar's titles come from it.
    expect(read('  const popups = n.node.children.filter(isPopup);')).toEqual([]);
    expect(read('  return shapeText(text, { fontSizePx, fontMetrics });')).toEqual([]);
    // Prose inside a callback is not a read.
    expect(read('  // `ctx.measureText` is the gate, and stays in the solver.')).toEqual([]);
    // Code AFTER the callback is out of scope.
    expect(
      shareInvariantOffenders('const s = defineShare((n) => n.path);\nconst m = ctx.measureText;')
    ).toEqual([]);
  });

  it('would catch a hand-rolled opener — the check is not vacuous', () => {
    expect(handRolledOpenerLines('  const cached = isTextLayoutResult(meta) ? meta : null;')).toEqual([1]);
    expect(handRolledOpenerLines('  const pos = (meta as SplitLayout).draggerPos;')).toEqual([1]);
    expect(handRolledOpenerLines('  if (typeof meta === "object") return meta;')).toEqual([1]);
    expect(handRolledOpenerLines('  minimumSizeMeta: (n) => resolve(n).meta,')).toEqual([1]);
    // The four legitimate spellings.
    expect(handRolledOpenerLines('  const layout = scrollBarsChannel.open(meta) ?? fallback;')).toEqual([]);
    expect(handRolledOpenerLines('  return { rects: out, meta: scrollBarsChannel.seal(layout) };')).toEqual([]);
    expect(handRolledOpenerLines('export function X({ solveNode, rect, meta }: NativeControlComponentProps) {')).toEqual([]);
    expect(handRolledOpenerLines('  meta,')).toEqual([]);
    expect(handRolledOpenerLines('            meta={undefined}')).toEqual([]);
    // Prose, and the one unrelated `meta` every scan file carries.
    expect(handRolledOpenerLines(' * reads `meta` when the solver attached one')).toEqual([]);
    expect(handRolledOpenerLines("const UI = join(import.meta.dirname, 'ui');")).toEqual([]);
  });
});

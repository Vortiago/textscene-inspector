/**
 * Drift guard: the three promises of `solveHandoff.ts` that neither the type
 * checker nor a per-slice test can see.
 */
// Not asserted: a hit rate, or that a share ran once. `presetTimeMinimumSize` mints nodes
// no painter sees. A miss is a recompute, never a wrong answer.
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isCommentLine,
  isProductionSource,
  offendingLines,
  repoPath,
  reportOffenders,
  walkSources,
  type SourceFile,
} from '../../testing/sourceScan';
import type { Channel } from './solveHandoff';
import { createSolveContext, solveControlTree } from './controlRectSolver';
import { nativeTheme } from './nativeTheme';
import { solveNode, withThemeItems } from './testing/solveNode';
import type { SolveNode } from './solveTree';
import type { TscnNode } from '../../../parser/types';
import { scrollContainerLayoutChannel } from '../../../nodes/2d/ui/scrollcontainer/nativeSolver';
import { splitContainerBoundaryChannel } from '../../../nodes/2d/ui/shared/splitContainerSolver';
import { tabHeaderHeightChannel } from '../../../nodes/2d/ui/tabcontainer/nativeSolver';
import { tabBarLoadedOffset } from '../../../nodes/2d/ui/tabbar/loadedOffset';
// Side-effect import: registers every Control slice's solvers and painters.
import '../index';

const UI_ROOT = join(import.meta.dirname, '../../../nodes/2d/ui');
const WINDOWS_ROOT = join(import.meta.dirname, '../../../nodes/windows');
const SOURCE_ROOT = join(import.meta.dirname, '../../..');

/**
 * The file kinds a solve handoff can be spelled in: the producers (a solver, the layout of a class's
 * internal Controls, a share's module) and the consumer.
 */
const HANDOFF_FILES = ['nativeSolver.ts', 'internalControls.ts', 'tabBarModel.ts', 'Component.tsx'];

/** Read once: the tree cannot change mid-run, and each scan reads all of it. */
const HANDOFF_SOURCES: SourceFile[] = walkSources([UI_ROOT], (name) => HANDOFF_FILES.includes(name));

/** Code only: a match inside prose is not a read, on its own line or trailing one. */
function codeLines(source: string): (string | null)[] {
  return source
    .split('\n')
    .map((line) => (isCommentLine(line) ? null : line.replace(/\/\/.*$/, '').replace(/\/\*.*?\*\//g, '')));
}

// Guard 1: a share's callback reads only the node and the theme. The scan closes
// the ways around `ShareNode`: a cast back to `SolveNode`, and a captured `ctx`.
// The memo is safe only while this holds, since the painter reuses the solver's value.

/**
 * Every `defineShare(` callback's source, paired with the 1-based line it
 * starts on. Read to its own closing paren by depth, so a long callback is
 * scanned whole and the code after it is not.
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
 * a `SolveContext` read. `.node.children`, the raw child list, is the same for
 * the solver and the painter, so it is excluded by name.
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

// Guard 2: no painter hand-rolls an `isFooShape(meta)` opener. A shape guard cannot
// tell this slice's value from any object of the same shape.

/**
 * The spellings of `meta` that are not a read: taking it off the painter's props,
 * handing it to a channel's opener, sealing one in a solver or, by path, in the
 * layout of a class's internal Controls, and the JSX
 * site that passes `undefined` to a painter it renders (`subviewportcontainer`). `import.meta` is stripped first: `\bmeta\b` matches in it.
 */
function stripAllowedMeta(code: string): string {
  return code
    .replace(/\bimport\.meta\b/g, '')
    .replace(/\.open\(\s*meta\s*\)/g, '')
    .replace(/\bmeta:\s*[A-Za-z_$][\w$]*\.seal\(/g, '')
    .replace(/\bmeta:\s*new Map\(\[\[[^,\]]+,\s*[A-Za-z_$][\w$]*\.seal\(/g, '')
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

// Guard 3: every value that reaches `SolvedControl.meta` in a real solve is sealed,
// and the class-B producers attach one unconditionally.

function tscn(
  name: string,
  type: string,
  properties: Record<string, unknown>,
  children: TscnNode[] = []
): TscnNode {
  return { rawProperties: {}, name, type, properties, children };
}

/**
 * A two-child container of `type` at the viewport origin, the shape both class-B
 * producers need: a split reports no boundary below two sortable children, and a
 * scroll container needs content to overflow.
 */
function containerTree(type: string): SolveNode[] {
  const childNodes = ['A', 'B'].map((name) => tscn(name, 'Panel', { customMinimumSize: { x: 400, y: 400 } }));
  const root = tscn('Root', type, {}, childNodes);
  const children = childNodes.map((node, i) =>
    withThemeItems({ ...solveNode(), path: `Root/${['A', 'B'][i]!}`, node })
  );
  return [withThemeItems({ ...solveNode(), path: 'Root', node: root, children })];
}

const VIEWPORT = { x: 0, y: 0, w: 300, h: 300 };

/** Each type whose registered `ContainerLayoutFn` seals a channel value, and the channel its painter opens `meta` through. */
const CHANNEL_OF: Record<string, Channel<unknown>> = {
  ScrollContainer: scrollContainerLayoutChannel,
  HSplitContainer: splitContainerBoundaryChannel,
  VSplitContainer: splitContainerBoundaryChannel,
  SplitContainer: splitContainerBoundaryChannel,
  TabContainer: tabHeaderHeightChannel,
};
const CHANNEL_TYPES = Object.keys(CHANNEL_OF);

/** The channels an `InternalLayoutFn` seals on an internal Control's entry. */
const INTERNAL_CHANNELS: readonly Channel<unknown>[] = [tabBarLoadedOffset];

/** Whether a registered channel opens `meta`: `undefined` from every opener means foreign. */
function opensThroughAChannel(meta: unknown): boolean {
  return [...Object.values(CHANNEL_OF), ...INTERNAL_CHANNELS].some(
    (channel) => channel.open(meta) !== undefined
  );
}

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
    // Button's label shaping is not a share: its wrap width is a third input the
    // `(node, theme)` key cannot express. Its solver and painter still call one
    // function, just not a memoised one. MenuButton sizes through `buttonMinimumSize`
    // and shapes with Button's function, so it declares no share either.
    expect(shares.length).toBeGreaterThanOrEqual(4);
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
        if (entry.meta !== undefined && !opensThroughAChannel(entry.meta)) unsealed.push(`${type} ${path}`);
      }
    }
    expect(unsealed, `a raw value on \`meta\` opens against nothing: ${unsealed.join(', ')}`).toEqual([]);
  });

  it('attaches a channel value unconditionally, so a painter never falls back in production', () => {
    for (const type of CHANNEL_TYPES) {
      const solved = solveControlTree(containerTree(type), VIEWPORT, createSolveContext(nativeTheme(1)));
      expect(CHANNEL_OF[type]?.open(solved.get('Root')?.meta), `${type} sealed nothing`).toBeDefined();
    }
  });

  it('puts nothing on a minimum-size-only node — `MinimumSizeResult` no longer carries a handoff', () => {
    const label = tscn('Root', 'Label', { text: 'hello' });
    const solved = solveControlTree(
      [withThemeItems({ ...solveNode(), path: 'Root', node: label })],
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
    // The raw child list is not the sortable one: MenuBar's titles come from it.
    expect(read('  const popups = n.node.children.filter(isPopup);')).toEqual([]);
    expect(read('  return shapeText(text, { fontSizePx, fontMetrics });')).toEqual([]);
    // Prose inside a callback is not a read.
    expect(read('  // `ctx.measureText` is the gate, and stays in the solver.')).toEqual([]);
    // Code after the callback is out of scope.
    expect(
      shareInvariantOffenders('const s = defineShare((n) => n.path);\nconst m = ctx.measureText;')
    ).toEqual([]);
  });

  it('would catch a hand-rolled opener — the check is not vacuous', () => {
    expect(handRolledOpenerLines('  const cached = isTextLayoutResult(meta) ? meta : null;')).toEqual([1]);
    expect(handRolledOpenerLines('  const pos = (meta as SplitLayout).draggerPos;')).toEqual([1]);
    expect(handRolledOpenerLines('  if (typeof meta === "object") return meta;')).toEqual([1]);
    expect(handRolledOpenerLines('  minimumSizeMeta: (n) => resolve(n).meta,')).toEqual([1]);
    // The legitimate spellings.
    expect(handRolledOpenerLines('  const layout = scrollBarsChannel.open(meta) ?? fallback;')).toEqual([]);
    expect(handRolledOpenerLines('  return { rects: out, meta: scrollBarsChannel.seal(layout) };')).toEqual(
      []
    );
    expect(
      handRolledOpenerLines('export function X({ solveNode, rect, meta }: NativeControlComponentProps) {')
    ).toEqual([]);
    expect(handRolledOpenerLines('    meta: new Map([[bar.path, offsetChannel.seal(offset)]]),')).toEqual([]);
    expect(handRolledOpenerLines('    meta: new Map([[bar.path, offset]]),')).toEqual([1]);
    expect(handRolledOpenerLines('  meta,')).toEqual([]);
    expect(handRolledOpenerLines('            meta={undefined}')).toEqual([]);
    // Prose, and the one unrelated `meta` every scan file carries.
    expect(handRolledOpenerLines(' * reads `meta` when the solver attached one')).toEqual([]);
    expect(handRolledOpenerLines("const UI = join(import.meta.dirname, 'ui');")).toEqual([]);
  });
});

// Guard: a Window class solves its Controls once. Its internal Controls are part of that solve
// (`internalControls.ts`), so a painter that builds its own context solves them a second time.
describe('one solve per Window', () => {
  const windowSources = walkSources([WINDOWS_ROOT], isProductionSource).filter(
    ({ file }) => !file.endsWith(join('window', 'wrapControls.ts'))
  );

  it('calls createSolveContext and solveControlTree only in wrapControls.ts', () => {
    const offenders = reportOffenders(windowSources, (source) =>
      offendingLines(source, /\b(createSolveContext|solveControlTree)\(/)
    );
    expect(offenders).toEqual([]);
  });

  it('keeps no SolveNode.syntheticDraw: a built Control carries its runtime state in its properties', () => {
    const sources = walkSources([SOURCE_ROOT], isProductionSource);
    expect(reportOffenders(sources, (source) => offendingLines(source, /syntheticDraw/))).toEqual([]);
  });
});

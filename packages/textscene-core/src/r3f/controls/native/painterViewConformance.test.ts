/**
 * Drift guard: a native Control painter may not re-apply its own node's
 * `modulate`, and may not reach the two fields that would let it.
 *
 * `ControlCanvasWalker` folds a node's `modulate` into the ambient
 * `Modulate2DContext` it wraps the painter in, so a painter that applies it
 * again SQUARES it — invisible at the default opaque white, wrong at anything
 * else. `painterView` (`solveTree.ts`) hands a painter the node's properties
 * MINUS `modulate`/`selfModulate`, and the walker resolves the own-pixel tint
 * itself (`NativeControlComponentProps.tint`), so a conforming painter cannot
 * name either — and must not resolve a tint of its own to get at them.
 *
 * `painterView` narrows for real — a cached shallow copy with both keys
 * rest-destructured out — so a solver helper handed `props` (`buttonIconColor`,
 * `resolveCheckBoxDrawState`, `labelTextTheme`) can no longer see either. This
 * is still a SOURCE check because the BAG keeps both, and
 * `solveNode.node.properties` is reachable from any file under `nodes/2d/ui`:
 * the scans below are what close that way around.
 *
 * The gate FORBIDS patterns, it does not require `painterView` to be
 * present: eight painters read no properties at all.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isProductionSource,
  offendingLines,
  reportOffenders,
  walkSources,
  type SourceFile,
} from '../../testing/sourceScan';

const UI_ROOT = join(import.meta.dirname, '../../../nodes/2d/ui');

/** Opt-out marker for a line that provably cannot double-apply a Control's tint. */
const EXEMPT_MARKER = 'painter-view-exempt:';

/**
 * Painters that live outside a `nodes/2d/ui` slice — the shared panel chrome
 * two of them delegate their whole body to. Scanned as a painter AND as a
 * launderer, since it is where a `panel` read would land.
 */
const LOOSE_PAINTERS = [join(import.meta.dirname, 'PanelChrome.tsx')];

/**
 * Directories under `nodes/2d/ui` that are not a slice and so have no painter.
 * Named rather than swallowed: a RENAMED painter must fail this file loudly
 * rather than quietly take itself out of scope.
 */
const NO_PAINTER = new Set(['shared']);

/**
 * Every native Control painter: the `Component.tsx` of each `nodes/2d/ui` slice
 * that ships one, plus the loose ones.
 *
 * A slice with no `Component.tsx` is parsed and validated but not drawn — the
 * linter covers every Godot Control type, while a painter exists only where the
 * previewer renders one. `has2DUIContent.driftguard.test.ts` is what holds the
 * painted set to the component registry; this file only asks how the painters
 * that DO exist read their view.
 */
function painterSources(): SourceFile[] {
  const found = readdirSync(UI_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory() && !NO_PAINTER.has(e.name))
    .map((e) => join(UI_ROOT, e.name, 'Component.tsx'))
    .filter((file) => existsSync(file));
  return [...found, ...LOOSE_PAINTERS].map((file) => ({
    file,
    source: readFileSync(file, 'utf8'),
  }));
}

/**
 * Every source file under `nodes/2d/ui`, walked RECURSIVELY (`shared/` holds
 * the container solvers), minus the three places the property legitimately
 * exists by name: `parser.ts` and its strict-parser twin `linterParser.ts`
 * produce it, `types.ts` declares it, and a test may author it.
 */
function uiSources(): SourceFile[] {
  const NOT_A_PAINTER_READ = ['parser.ts', 'linterParser.ts', 'types.ts'];
  const found = walkSources(
    [UI_ROOT],
    (name) => isProductionSource(name) && !NOT_A_PAINTER_READ.includes(name)
  );
  return [...found, ...LOOSE_PAINTERS.map((file) => ({ file, source: readFileSync(file, 'utf8') }))];
}

/**
 * Reaching the raw property bag. Anchored on `.node.properties`, NOT
 * `.properties as`: `subviewportcontainer` legitimately casts a DIFFERENT
 * node's properties (its child SubViewport's), which carries no Control tint
 * at all.
 */
function rawPropertyLines(source: string): number[] {
  return offendingLines(source, /\.node\.properties|\bcontrolProps\b/, EXEMPT_MARKER);
}

/**
 * Resolving a tint at all. A painter is HANDED its own-pixel tint
 * (`NativeControlComponentProps.tint`); every hook that would compute one
 * instead sits above it in the chain, `useControlOwnTint` included — it takes
 * the walker's inherited value, which a painter can only reach by re-reading
 * the provider it renders inside.
 */
function wideTintLines(source: string): number[] {
  return offendingLines(source, /\buseCanvasItemTint\b|\buseControlTint\b|\buseControlOwnTint\b/, EXEMPT_MARKER);
}

/**
 * Naming `modulate` in code at all. Case-sensitive and word-bounded, so
 * `selfModulate`, `self_modulate`, `multiplyModulate`, `canvasModulate`,
 * `Modulate2DContext` and `WHITE_MODULATE` — none of them a node's own
 * hierarchical tint — all pass untouched.
 */
function launderedModulateLines(source: string): number[] {
  return offendingLines(source, /\bmodulate\b/);
}

/** Read once: the tree cannot change mid-run, and each scan reads all of it. */
const PAINTERS = painterSources();
const UI_SOURCES = uiSources();

describe('Control painter view conformance', () => {
  it('reaches no painter through the raw property bag — `painterView` is the only door', () => {
    const offenders = reportOffenders(PAINTERS, rawPropertyLines);
    expect(
      offenders,
      `these painters can see \`modulate\`/\`selfModulate\` — use painterView<T>(solveNode): ${offenders.join(', ')}`
    ).toEqual([]);
  });

  it('resolves no tint inside a painter — the walker hands one down', () => {
    const offenders = reportOffenders(PAINTERS, wideTintLines);
    expect(
      offenders,
      `these painters re-enter the walker's own modulate chain — take \`tint\` from props: ${offenders.join(', ')}`
    ).toEqual([]);
  });

  it('names `modulate` nowhere in 2D-UI code, so no solver helper can launder it back in', () => {
    const offenders = reportOffenders(UI_SOURCES, launderedModulateLines);
    expect(
      offenders,
      `the raw bag keeps both fields — these reads would double-apply: ${offenders.join(', ')}`
    ).toEqual([]);
  });

  it('would catch a painter reading the raw bag — the check is not vacuous', () => {
    expect(rawPropertyLines('  const props = solveNode.node.properties as LabelProperties;')).toEqual([1]);
    expect(rawPropertyLines('  const props = controlProps(solveNode);')).toEqual([1]);
    expect(rawPropertyLines('  const props = painterView<LabelProperties>(solveNode);')).toEqual([]);
    // A DIFFERENT node's properties — `subviewportcontainer`'s child SubViewport.
    expect(rawPropertyLines('  const props = viewport.properties as SubViewportProperties;')).toEqual([]);
    expect(rawPropertyLines(' * `solveNode.node.properties` in a comment is not a read')).toEqual([]);
    expect(rawPropertyLines('// painter-view-exempt: not a Control\nconst p = n.node.properties as X;')).toEqual([]);
  });

  it('would catch a painter resolving a tint — the check is not vacuous', () => {
    expect(wideTintLines('  const tint = useCanvasItemTint({ modulate: WHITE, self_modulate: s });')).toEqual([1]);
    expect(wideTintLines('  const tint = useControlTint(a, b);')).toEqual([1]);
    // The hook the walker still calls: reintroducing it in a painter is the
    // arrangement `tint` replaced, not a variant of it.
    expect(wideTintLines('  const tint = useControlOwnTint(inherited, solveNode);')).toEqual([1]);
    expect(wideTintLines('  const { tint } = props;')).toEqual([]);
    // The MODULE stays importable — `richtextlabel` needs `multiplyModulate`.
    expect(wideTintLines("import { multiplyModulate } from '../../canvasItemModulate';")).toEqual([]);
    expect(wideTintLines(' * `useCanvasItemTint` in a comment is not a call')).toEqual([]);
  });

  it('would catch a laundered `modulate` — the check is not vacuous, and takes no opt-out', () => {
    expect(launderedModulateLines('  return props.modulate ?? WHITE_MODULATE;')).toEqual([1]);
    expect(launderedModulateLines('  const { modulate } = props;')).toEqual([1]);
    expect(launderedModulateLines('  return props.selfModulate;')).toEqual([]);
    expect(launderedModulateLines('  multiplyModulate(a, b);')).toEqual([]);
    expect(launderedModulateLines('  <Modulate2DContext.Provider value={WHITE_MODULATE}>')).toEqual([]);
    expect(launderedModulateLines('  const canvasModulate = canvasModulateColor(n.children);')).toEqual([]);
    expect(launderedModulateLines(' * this node`s own `modulate` in prose is not a read')).toEqual([]);
    expect(launderedModulateLines('  const x = 1; // modulate lives on the walker')).toEqual([]);
    // No escape hatch: an exemption marker does NOT silence this one.
    expect(launderedModulateLines('// painter-view-exempt: nope\nconst m = props.modulate;')).toEqual([2]);
  });

  it('reads every painter and every 2D-UI source, so a new slice cannot escape unnoticed', () => {
    expect(PAINTERS.length).toBeGreaterThanOrEqual(24);
    expect(UI_SOURCES.length).toBeGreaterThanOrEqual(100);
  });
});

/**
 * Drift guard: a native Control painter never re-applies its own node's
 * `modulate`, and never reaches `modulate` or `selfModulate`. The walker already
 * folds `modulate` into the context, so a second application squares it.
 */
// `painterView` (`solveTree.ts`) drops both keys, but the property bag keeps
// them and any file under `nodes/2d/ui` can reach it, so this scans source.
// The gate forbids patterns and does not require `painterView`: a painter may
// read no properties at all.
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
 * Painters outside a `nodes/2d/ui` slice: the shared panel chrome some slices
 * delegate their whole body to. Scanned as a painter and as a launderer,
 * since a `panel` read lands there.
 */
const LOOSE_PAINTERS = [join(import.meta.dirname, 'PanelChrome.tsx')];

/**
 * Directories under `nodes/2d/ui` that are not a slice and so have no painter.
 * Named rather than inferred, so a renamed painter fails here instead of
 * leaving the scope.
 */
const NO_PAINTER = new Set(['shared']);

/**
 * Every native Control painter: the `Component.tsx` of each `nodes/2d/ui` slice
 * that ships one, plus the loose ones. A slice without one is parsed, not drawn.
 * `has2DUIContent.driftguard.test.ts` holds the painted set to the registry.
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
 * Every source file under `nodes/2d/ui`, walked recursively (`shared/` holds
 * the container solvers), minus the files that name the property legitimately:
 * `parser.ts` and `linterParser.ts` produce it, `types.ts` declares it, and a
 * test may author it.
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
 * Reaching the raw property bag. Anchored on `.node.properties`, not
 * `.properties as`: `subviewportcontainer` casts its child SubViewport's
 * properties, which carry no Control tint.
 */
function rawPropertyLines(source: string): number[] {
  return offendingLines(source, /\.node\.properties|\bcontrolProps\b/, EXEMPT_MARKER);
}

/**
 * Resolving a tint at all. A painter is handed its own-pixel tint
 * (`NativeControlComponentProps.tint`). Every hook that computes one sits above
 * it, `useControlOwnTint` included, since only the walker holds its input.
 */
function wideTintLines(source: string): number[] {
  return offendingLines(source, /\buseCanvasItemTint\b|\buseControlTint\b|\buseControlOwnTint\b/, EXEMPT_MARKER);
}

/**
 * Naming `modulate` in code at all. Case-sensitive and word-bounded, so
 * `selfModulate`, `self_modulate`, `multiplyModulate`, `canvasModulate`,
 * `Modulate2DContext` and `WHITE_MODULATE` all pass.
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
    // Another node's properties: `subviewportcontainer`'s child SubViewport.
    expect(rawPropertyLines('  const props = viewport.properties as SubViewportProperties;')).toEqual([]);
    expect(rawPropertyLines(' * `solveNode.node.properties` in a comment is not a read')).toEqual([]);
    expect(rawPropertyLines('// painter-view-exempt: not a Control\nconst p = n.node.properties as X;')).toEqual([]);
  });

  it('would catch a painter resolving a tint — the check is not vacuous', () => {
    expect(wideTintLines('  const tint = useCanvasItemTint({ modulate: WHITE, self_modulate: s });')).toEqual([1]);
    expect(wideTintLines('  const tint = useControlTint(a, b);')).toEqual([1]);
    // The walker calls this hook. A painter never does.
    expect(wideTintLines('  const tint = useControlOwnTint(inherited, solveNode);')).toEqual([1]);
    expect(wideTintLines('  const { tint } = props;')).toEqual([]);
    // The module stays importable: `richtextlabel` needs `multiplyModulate`.
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
    // No escape hatch: an exemption marker does not silence this one.
    expect(launderedModulateLines('// painter-view-exempt: nope\nconst m = props.modulate;')).toEqual([2]);
  });

  it('reads every painter and every 2D-UI source, so a new slice cannot escape unnoticed', () => {
    expect(PAINTERS.length).toBeGreaterThanOrEqual(24);
    expect(UI_SOURCES.length).toBeGreaterThanOrEqual(100);
  });
});

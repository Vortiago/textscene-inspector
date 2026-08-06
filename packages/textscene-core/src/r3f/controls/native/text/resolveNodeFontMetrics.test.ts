/**
 * `resolveNodeFontMetrics` — the join between `themeProcessing.ts`'s
 * `resolveThemeFont` (walking `SolveNode.fontOverrides`/`.themeChain`/
 * `.projectTheme`) and `sceneFontLoader.ts`'s `peekSceneFontMetrics`.
 *
 * `peekSceneFontMetrics` never returns anything but the bundled default under
 * this test environment's `IS_VITEST` short-circuit (`sceneFontLoader.ts`'s
 * own doc — no `FontFace`/canvas under happy-dom), so a resolved
 * `FontMetrics` VALUE cannot be observed here. What CAN be observed: whether
 * `resolveThemeFont` was fed the right `themeKey`/`nativeType`/`typeVariation`
 * at all, via `peekSceneFontMetrics`'s own warn-on-unresolvable side effect
 * (a `SystemFont` always warns, resolved or not — `sceneFontLoader.test.ts`'s
 * own coverage of that branch). A warn firing (or not) for a given lookup
 * therefore proves whether THIS call actually found the font at that
 * type/key, independent of the DOM-gated metrics value itself.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { SolveNode } from '../solveTree';
import { solveNode } from '../testing/solveNode';
import type { ThemeResource } from '../../../../resources/processing/themeProcessing';
import type { FontResource } from '../../../../resources/processing/fontProcessing';
import { resolveNodeFontMetrics } from './resolveNodeFontMetrics';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import * as logger from '../../../../logger';

// `sceneFontLoader.ts`'s own warn-dedupe is keyed by RESOURCE OBJECT IDENTITY
// (a `WeakSet`, module-level, never reset between tests) — a fresh object per
// test, not a shared constant, or an earlier test's warn silently suppresses
// a later one for the "same" SystemFont.
function systemFont(): FontResource {
  return { kind: 'system', fontNames: ['sans-serif'], properties: {} };
}

function emptyTheme(): ThemeResource {
  return { defaultFont: null, defaultFontSize: undefined, fonts: {}, fontSizes: {}, typeVariations: {}, properties: {} };
}

function labelNode(overrides: Partial<SolveNode> = {}): SolveNode {
  return {
    ...solveNode(),
    path: 'Root/MyLabel',
    node: { name: 'MyLabel', type: 'Label', children: [], properties: { name: 'MyLabel' } },
    ...overrides,
  };
}

describe('resolveNodeFontMetrics', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('returns the bundled default with no warning when nothing authors this theme key', () => {
    const metrics = resolveNodeFontMetrics(labelNode(), 'font');
    expect(metrics).toBe(OPEN_SANS_FONT_METRICS);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("(happy) a local theme_override_fonts entry under THIS key is found and passed through — proven by peekSceneFontMetrics's own warn", () => {
    const n = labelNode({ fontOverrides: { font: systemFont() } });
    resolveNodeFontMetrics(n, 'font');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]![0]).toContain('Root/MyLabel');
  });

  it('a local override under a DIFFERENT key is not consulted for this lookup', () => {
    const n = labelNode({ fontOverrides: { normal_font: systemFont() } });
    resolveNodeFontMetrics(n, 'font');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("(happy) an ancestor theme's <nativeType>/fonts/<key> entry is found via THIS node's own node.type", () => {
    const theme: ThemeResource = { ...emptyTheme(), fonts: { Label: { font: systemFont() } } };
    const n = labelNode({ themeChain: [theme] });
    resolveNodeFontMetrics(n, 'font');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("an ancestor theme entry registered under a DIFFERENT native type is not found for this node's own type", () => {
    const theme: ThemeResource = { ...emptyTheme(), fonts: { Button: { font: systemFont() } } };
    const n = labelNode({ themeChain: [theme] });
    resolveNodeFontMetrics(n, 'font');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('(edge) falls back to the project theme when no ancestor theme resolves the key', () => {
    const theme: ThemeResource = { ...emptyTheme(), fonts: { Label: { font: systemFont() } } };
    const n = labelNode({ themeChain: [], projectTheme: theme });
    resolveNodeFontMetrics(n, 'font');
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('(edge) a local override wins over an ancestor theme entry even when the override itself is unresolved (null)', () => {
    const theme: ThemeResource = { ...emptyTheme(), fonts: { Label: { font: systemFont() } } };
    const n = labelNode({ fontOverrides: { font: null }, themeChain: [theme] });
    const metrics = resolveNodeFontMetrics(n, 'font');
    // The override (null, "authored but invalid") wins unconditionally over
    // the ancestor theme's SystemFont — resolveThemeFont's own contract — so
    // this resolves to no font at all, and no SystemFont warn ever fires.
    expect(metrics).toBe(OPEN_SANS_FONT_METRICS);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

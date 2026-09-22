/**
 * `resolveNodeFontMetrics` — the join between the Theme slice's
 * `resolveThemeFontIn` (walking `SolveNode.fontOverrides`/`.themeChain`/
 * `.projectTheme`) and `sceneFontLoader.ts`'s `peekSceneFontMetrics`.
 *
 * `peekSceneFontMetrics` never returns anything but the bundled default under
 * this test environment's `IS_VITEST` short-circuit (`sceneFontLoader.ts`'s
 * own doc — no `FontFace`/canvas under happy-dom), so a resolved
 * `FontMetrics` VALUE cannot be observed here. What CAN be observed: whether
 * `resolveThemeFontIn` was fed the right `themeKey`/`nativeType`/`typeVariation`
 * at all, via `peekSceneFontMetrics`'s own warn-on-unresolvable side effect
 * (a `SystemFont` always warns, resolved or not — `sceneFontLoader.test.ts`'s
 * own coverage of that branch). A warn firing (or not) for a given lookup
 * therefore proves whether THIS call actually found the font at that
 * type/key, independent of the DOM-gated metrics value itself.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { SolveNode } from '../solveTree';
import { solveNode } from '../testing/solveNode';
import type { ThemeResource } from '../../../../resources/styles/theme/types';
import type { FontResource } from '../../../../resources/fonts/font/types';
import { resolveNodeFontMetrics, resolveNodeFontSizePx } from './resolveNodeFontMetrics';
import { OPEN_SANS_FONT_METRICS } from './openSansFontMetrics';
import * as logger from '../../../../logger';
import * as themeLookup from '../../../../resources/styles/theme/lookup';
import * as sceneFontLoader from './sceneFontLoader';

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
    // the ancestor theme's SystemFont — resolveThemeFontIn's own contract — so
    // this resolves to no font at all, and no SystemFont warn ever fires.
    expect(metrics).toBe(OPEN_SANS_FONT_METRICS);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe('resolveNodeFontSizePx — the font-SIZE counterpart join (resolveThemeFontSizeIn, walking the SAME SolveNode fields resolveNodeFontMetrics does)', () => {
  it('returns the built-in default when nothing anywhere defines this size key', () => {
    expect(resolveNodeFontSizePx(labelNode(), 'font_size', undefined, 16)).toBe(16);
  });

  it("(happy) a positive node-local override wins outright, bypassing THIS node's own node.type entirely", () => {
    expect(resolveNodeFontSizePx(labelNode(), 'font_size', 24, 16)).toBe(24);
  });

  it('an override of 0 does NOT win — falls through to the ancestor walk like an absent one (control.cpp:3114-3117)', () => {
    const theme: ThemeResource = { ...emptyTheme(), fontSizes: { Label: { font_size: 30 } } };
    const n = labelNode({ themeChain: [theme] });
    expect(resolveNodeFontSizePx(n, 'font_size', 0, 16)).toBe(30);
  });

  it("(happy) an ancestor theme's <nativeType>/font_sizes/<key> entry is found via THIS node's own node.type", () => {
    const theme: ThemeResource = { ...emptyTheme(), fontSizes: { Label: { font_size: 30 } } };
    const n = labelNode({ themeChain: [theme] });
    expect(resolveNodeFontSizePx(n, 'font_size', undefined, 16)).toBe(30);
  });

  it("an ancestor theme entry registered under a DIFFERENT native type is not found for this node's own type", () => {
    const theme: ThemeResource = { ...emptyTheme(), fontSizes: { Button: { font_size: 30 } } };
    const n = labelNode({ themeChain: [theme] });
    expect(resolveNodeFontSizePx(n, 'font_size', undefined, 16)).toBe(16);
  });

  it("(edge) falls through to the ancestor theme's OWN default_font_size when no specific <Type>/font_sizes/<key> entry matches", () => {
    const theme: ThemeResource = { ...emptyTheme(), defaultFontSize: 22 };
    const n = labelNode({ themeChain: [theme] });
    expect(resolveNodeFontSizePx(n, 'font_size', undefined, 16)).toBe(22);
  });

  it('(edge) falls back to the project theme when no ancestor theme in the chain resolves the key', () => {
    const theme: ThemeResource = { ...emptyTheme(), fontSizes: { Label: { font_size: 20 } } };
    const n = labelNode({ themeChain: [], projectTheme: theme });
    expect(resolveNodeFontSizePx(n, 'font_size', undefined, 16)).toBe(20);
  });
});

describe('the ancestor-Theme walk is cached PER SolveNode OBJECT, not merely per equal inputs — the property both resolveNodeFontMetrics and resolveNodeFontSizePx must share, since buildSolveTree.ts mints a fresh SolveNode per node per generation and relies on that identity as the cache key', () => {
  let scopeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    scopeSpy = vi.spyOn(themeLookup, 'themeResolutionScope');
  });

  afterEach(() => {
    scopeSpy.mockRestore();
  });

  it('resolving font AND font-size for the SAME node object builds the type-dependency chain ONCE, not twice', () => {
    const n = labelNode();
    resolveNodeFontMetrics(n, 'font');
    resolveNodeFontSizePx(n, 'font_size', undefined, 16);
    expect(scopeSpy).toHaveBeenCalledTimes(1);
  });

  it('repeated lookups against the SAME node object — the solve pass then the paint pass calling this join twice each, four calls total — still build the chain ONCE', () => {
    const n = labelNode();
    resolveNodeFontMetrics(n, 'font');
    resolveNodeFontSizePx(n, 'font_size', undefined, 16);
    resolveNodeFontMetrics(n, 'font');
    resolveNodeFontSizePx(n, 'font_size', undefined, 16);
    expect(scopeSpy).toHaveBeenCalledTimes(1);
  });

  it("a DIFFERENT node object with IDENTICAL field values gets its OWN chain build — proves the cache keys on object identity (this generation's node), not on the equal theme/type/variation values, which is what makes a NEW generation (a fresh walk producing new SolveNode objects) see fresh results", () => {
    const a = labelNode();
    const b = labelNode();
    resolveNodeFontMetrics(a, 'font');
    resolveNodeFontMetrics(b, 'font');
    expect(scopeSpy).toHaveBeenCalledTimes(2);
  });
});

describe('async freshness survives the cache — only the ancestor-Theme SCOPE is memoised; the final peekSceneFontMetrics lookup must still run on every call so a just-settled font load is observed on the very next render', () => {
  it('peekSceneFontMetrics is called again on a SECOND resolveNodeFontMetrics call against the SAME node/key, even though the scope is cached', () => {
    const peekSpy = vi.spyOn(sceneFontLoader, 'peekSceneFontMetrics');
    const n = labelNode();
    resolveNodeFontMetrics(n, 'font');
    resolveNodeFontMetrics(n, 'font');
    expect(peekSpy).toHaveBeenCalledTimes(2);
    peekSpy.mockRestore();
  });
});

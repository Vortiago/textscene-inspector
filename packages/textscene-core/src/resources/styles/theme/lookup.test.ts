import { describe, it, expect } from 'vitest';
import {
  buildThemeTypeChain,
  mergeThemedRecord,
  resolveThemeFontIn,
  resolveThemeFontSizeIn,
  themeResolutionScope,
} from './lookup';
import type { ThemeResource } from './types';
import type { FontResource } from '../../fonts/font/types';

const FONT_A: FontResource = { kind: 'file', bytes: new ArrayBuffer(1), mimeType: 'font/ttf', fallbacks: [], properties: {} };
const FONT_B: FontResource = { kind: 'file', bytes: new ArrayBuffer(1), mimeType: 'font/otf', fallbacks: [], properties: {} };

/** An empty `ThemeResource`, overridden per test — keeps every literal short. */
function theme(overrides: Partial<ThemeResource> = {}): ThemeResource {
  return {
    defaultFont: null,
    defaultFontSize: undefined,
    fonts: {},
    fontSizes: {},
    styles: {},
    colors: {},
    constants: {},
    typeVariations: {},
    properties: {},
    resources: { externalResources: [], internalResources: [] },
    ...overrides,
  };
}

describe('buildThemeTypeChain', () => {
  it('is just the native inheritance chain when no type variation is set', () => {
    expect(buildThemeTypeChain('Label', undefined, [], null)).toEqual(['Label', 'Control', 'Node']);
  });

  it('walks the variation base_type chain from the theme that registers it, then appends the native chain', () => {
    const t = theme({ typeVariations: { title_panel: 'Panel' } });
    expect(buildThemeTypeChain('Panel', 'title_panel', [t], null)).toEqual([
      'title_panel',
      'Panel',
      'Control',
      'Node',
    ]);
  });

  it('falls back to the native chain alone when no ancestor/project theme registers the variation', () => {
    expect(buildThemeTypeChain('Label', 'HeaderLabel', [theme()], null)).toEqual(['Label', 'Control', 'Node']);
  });

  it('uses the FIRST theme (nearest ancestor before project) that registers the variation', () => {
    const nearest = theme({ typeVariations: { title_panel: 'Panel' } });
    const project = theme({ typeVariations: { title_panel: 'Control' } });
    expect(buildThemeTypeChain('Panel', 'title_panel', [nearest], project)).toEqual([
      'title_panel',
      'Panel',
      'Control',
      'Node',
    ]);
  });

  it('finds the variation on the project theme when no ancestor registers it', () => {
    const project = theme({ typeVariations: { title_panel: 'Panel' } });
    expect(buildThemeTypeChain('Panel', 'title_panel', [], project)).toEqual([
      'title_panel',
      'Panel',
      'Control',
      'Node',
    ]);
  });
});

describe('resolveThemeFontIn', () => {
  it('a valid node-local override wins over any ancestor theme', () => {
    const ancestor = theme({ fonts: { Label: { font: FONT_B } } });
    expect(resolveThemeFontIn(themeResolutionScope('Label', undefined, [ancestor], null), 'font', FONT_A)).toBe(FONT_A);
  });

  it('an override explicitly authored to nothing (null) STOPS the walk — it does not fall through', () => {
    const ancestor = theme({ fonts: { Label: { font: FONT_B } } });
    expect(resolveThemeFontIn(themeResolutionScope('Label', undefined, [ancestor], null), 'font', null)).toBeNull();
  });

  it('no override (undefined) falls through to the ancestor theme', () => {
    const ancestor = theme({ fonts: { Label: { font: FONT_B } } });
    expect(resolveThemeFontIn(themeResolutionScope('Label', undefined, [ancestor], null), 'font', undefined)).toBe(FONT_B);
  });

  it('the nearest ancestor wins over a farther one', () => {
    const nearest = theme({ fonts: { Label: { font: FONT_A } } });
    const farther = theme({ fonts: { Label: { font: FONT_B } } });
    expect(resolveThemeFontIn(themeResolutionScope('Label', undefined, [nearest, farther], null), 'font', undefined)).toBe(FONT_A);
  });

  it('a gap ancestor (its theme does not define the key) falls through to the next ancestor', () => {
    const gap = theme();
    const farther = theme({ fonts: { Label: { font: FONT_B } } });
    expect(resolveThemeFontIn(themeResolutionScope('Label', undefined, [gap, farther], null), 'font', undefined)).toBe(FONT_B);
  });

  it('falls through every ancestor to the project theme', () => {
    const project = theme({ fonts: { Label: { font: FONT_B } } });
    expect(resolveThemeFontIn(themeResolutionScope('Label', undefined, [theme(), theme()], project), 'font', undefined)).toBe(FONT_B);
  });

  it('resolves to null (the caller renders its own bundled default) when nothing anywhere defines it', () => {
    expect(resolveThemeFontIn(themeResolutionScope('Label', undefined, [theme(), theme()], theme()), 'font', undefined)).toBeNull();
  });

  it("a theme's own default_font SHORT-CIRCUITS the type chain for a NEARER type before a farther type's own explicit entry is ever tried (theme_owner.cpp:236-245's types-inner loop)", () => {
    // `Control/fonts/font` is explicit on this SAME theme, but `Label` (the
    // nearer type in the chain) already satisfies `has_font` via this
    // theme's own `default_font` — so `Control/fonts/font` is shadowed.
    const shadowing = theme({ defaultFont: FONT_A, fonts: { Control: { font: FONT_B } } });
    expect(resolveThemeFontIn(themeResolutionScope('Label', undefined, [shadowing], null), 'font', undefined)).toBe(FONT_A);
  });

  it("a type registered as a variation IN THIS THEME skips ONLY that type's default_font fallback — the walk continues within the SAME theme's turn (has_font_no_default, theme.cpp:1009-1017) and still finds ITS OWN default_font one type later, never reaching a farther ancestor's explicit entry", () => {
    // "title_panel" is a registered variation in `nearest`, so `nearest`
    // contributes nothing AT THAT TYPE — but the very next type in the chain
    // ("Panel", a real class, never itself a variation) is not gated, and
    // `nearest`'s own `default_font` fires there. `farther`'s explicit
    // `title_panel/fonts/font` is never reached at all.
    const nearest = theme({ defaultFont: FONT_A, typeVariations: { title_panel: 'Panel' } });
    const farther = theme({ fonts: { title_panel: { font: FONT_B } } });
    expect(
      resolveThemeFontIn(themeResolutionScope('Panel', 'title_panel', [nearest, farther], null), 'font', undefined)
    ).toBe(FONT_A);
  });
});

describe('resolveThemeFontSizeIn', () => {
  it('a positive node-local override wins over any ancestor theme', () => {
    const ancestor = theme({ fontSizes: { Label: { font_size: 30 } } });
    expect(resolveThemeFontSizeIn(themeResolutionScope('Label', undefined, [ancestor], null), 'font_size', 24, 16)).toBe(24);
  });

  it('an override of 0 does NOT win — falls through like an absent one (Control::get_theme_font_size, control.cpp:3114-3117)', () => {
    const ancestor = theme({ fontSizes: { Label: { font_size: 30 } } });
    expect(resolveThemeFontSizeIn(themeResolutionScope('Label', undefined, [ancestor], null), 'font_size', 0, 16)).toBe(30);
  });

  it('falls through the ancestor chain to the theme default_font_size', () => {
    const ancestor = theme({ defaultFontSize: 22 });
    expect(resolveThemeFontSizeIn(themeResolutionScope('Label', undefined, [ancestor], null), 'font_size', undefined, 16)).toBe(22);
  });

  it('falls back to the built-in default size when nothing anywhere defines it', () => {
    expect(resolveThemeFontSizeIn(themeResolutionScope('Label', undefined, [theme()], theme()), 'font_size', undefined, 16)).toBe(16);
  });

  it('the nearest ancestor wins over a farther one', () => {
    const nearest = theme({ fontSizes: { Label: { font_size: 20 } } });
    const farther = theme({ fontSizes: { Label: { font_size: 30 } } });
    expect(
      resolveThemeFontSizeIn(themeResolutionScope('Label', undefined, [nearest, farther], null), 'font_size', undefined, 16)
    ).toBe(20);
  });
});

describe('mergeThemedRecord', () => {
  it('a local override wins unconditionally, even where a theme also defines the name', () => {
    const ancestor = theme({ colors: { Label: { font_color: { r: 1, g: 0, b: 0, a: 1 } } } });
    const merged = mergeThemedRecord(
      themeResolutionScope('Label', undefined, [ancestor], null),
      { font_color: { r: 0, g: 1, b: 0, a: 1 } },
      (t) => t.colors
    );
    expect(merged.font_color).toEqual({ r: 0, g: 1, b: 0, a: 1 });
  });

  it('a gap name (no override, no theme entry) is simply absent from the result', () => {
    const merged = mergeThemedRecord(themeResolutionScope('Label', undefined, [theme()], null), {}, (t) => t.colors);
    expect(merged.font_color).toBeUndefined();
  });

  it('a nearer owner matching only a BASE type beats a farther owner matching the EXACT type (owners outer, types inner)', () => {
    // `nearest` has nothing under `PanelContainer`, but does under `Control` —
    // a base type in its own chain, tried BEFORE `farther` is ever visited.
    const nearest = theme({ colors: { Control: { font_color: { r: 1, g: 0, b: 0, a: 1 } } } });
    const farther = theme({ colors: { PanelContainer: { font_color: { r: 0, g: 1, b: 0, a: 1 } } } });
    const scope = themeResolutionScope('PanelContainer', undefined, [nearest, farther], null);
    expect(scope.typeChain).toEqual(['PanelContainer', 'Control', 'Node']);
    const merged = mergeThemedRecord(scope, {}, (t) => t.colors);
    expect(merged.font_color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('the type-variation chain is honoured — a variation-registered type wins over the plain native type', () => {
    const t = theme({
      typeVariations: { title_panel: 'Panel' },
      colors: { title_panel: { font_color: { r: 1, g: 0, b: 0, a: 1 } }, Panel: { font_color: { r: 0, g: 1, b: 0, a: 1 } } },
    });
    const merged = mergeThemedRecord(
      themeResolutionScope('Panel', 'title_panel', [t], null),
      {},
      (theme) => theme.colors
    );
    expect(merged.font_color).toEqual({ r: 1, g: 0, b: 0, a: 1 });
  });

  it('falls through every ancestor to the project theme', () => {
    const project = theme({ constants: { Button: { h_separation: 8 } } });
    const merged = mergeThemedRecord(
      themeResolutionScope('Button', undefined, [theme(), theme()], project),
      {},
      (t) => t.constants
    );
    expect(merged.h_separation).toBe(8);
  });
});

/**
 * `resolveTextTheme` — the override key-name mapping a Control authors as
 * `theme_override_font_sizes/<key>` / `theme_override_colors/<key>`, resolved
 * to plain data a painter can read. Font SIZE goes through the SAME
 * ancestor-Theme walk `resolveNodeFontMetrics` already performs for the font
 * itself (`resolveNodeFontSizePx`/`Control::get_theme_font_size`,
 * `scene/gui/control.cpp:3107-3129`); colour does not (no `Theme` colour
 * decode exists in this codebase — the Theme slice's own scope).
 */
import { describe, expect, it } from 'vitest';
import type { SolveNode } from './solveTree';
import { solveNode as emptySolveNode } from './testing/solveNode';
import type { ThemeResource } from '../../../resources/styles/theme/types';
import { resolveTextTheme, type TextThemeKeys } from './textTheme';

const LABEL_KEYS: TextThemeKeys = { sizeKey: 'font_size', colorKey: 'font_color' };
const RICH_TEXT_LABEL_KEYS: TextThemeKeys = { sizeKey: 'normal_font_size', colorKey: 'default_color' };
const DEFAULTS = { fontSizePx: 16, color: { r: 1, g: 1, b: 1, a: 1 } };

function node(overrides: Partial<SolveNode> = {}): SolveNode {
  return {
    ...emptySolveNode(),
    path: 'L',
    node: { name: 'L', type: 'Label', children: [], properties: { name: 'L' } },
    ...overrides,
  };
}

function emptyTheme(): ThemeResource {
  return { defaultFont: null, defaultFontSize: undefined, fonts: {}, fontSizes: {}, typeVariations: {}, properties: {} };
}

describe('resolveTextTheme', () => {
  it('falls back to the supplied defaults when no override or ancestor theme is present', () => {
    const resolved = resolveTextTheme(node(), {}, LABEL_KEYS, DEFAULTS);
    expect(resolved).toEqual({ fontSizePx: 16, color: { r: 1, g: 1, b: 1, a: 1 } });
  });

  it('reads font_size/font_color for Label-shaped keys', () => {
    const resolved = resolveTextTheme(
      node(),
      {
        themeOverrideFontSizes: { font_size: 24 },
        themeOverrideColors: { font_color: { r: 0.2, g: 0.4, b: 0.6, a: 0.8 } },
      },
      LABEL_KEYS,
      DEFAULTS
    );
    expect(resolved).toEqual({ fontSizePx: 24, color: { r: 0.2, g: 0.4, b: 0.6, a: 0.8 } });
  });

  it('reads normal_font_size/default_color for RichTextLabel-shaped keys, ignoring Label-shaped ones', () => {
    const resolved = resolveTextTheme(
      node(),
      {
        themeOverrideFontSizes: { normal_font_size: 20, font_size: 99 },
        themeOverrideColors: { default_color: { r: 0, g: 0, b: 0, a: 1 } },
      },
      RICH_TEXT_LABEL_KEYS,
      DEFAULTS
    );
    expect(resolved).toEqual({ fontSizePx: 20, color: { r: 0, g: 0, b: 0, a: 1 } });
  });

  it('resolves size and colour independently — one overridden, the other defaulted', () => {
    const resolved = resolveTextTheme(node(), { themeOverrideFontSizes: { font_size: 30 } }, LABEL_KEYS, DEFAULTS);
    expect(resolved).toEqual({ fontSizePx: 30, color: { r: 1, g: 1, b: 1, a: 1 } });
  });

  it('a positive node-local size override wins over any ancestor theme', () => {
    const theme: ThemeResource = { ...emptyTheme(), fontSizes: { Label: { font_size: 40 } } };
    const resolved = resolveTextTheme(
      node({ themeChain: [theme] }),
      { themeOverrideFontSizes: { font_size: 24 } },
      LABEL_KEYS,
      DEFAULTS
    );
    expect(resolved.fontSizePx).toBe(24);
  });

  it('a size override of 0 does NOT win — falls through to the ancestor theme like an absent one (control.cpp:3114-3117)', () => {
    const theme: ThemeResource = { ...emptyTheme(), fontSizes: { Label: { font_size: 30 } } };
    const resolved = resolveTextTheme(
      node({ themeChain: [theme] }),
      { themeOverrideFontSizes: { font_size: 0 } },
      LABEL_KEYS,
      DEFAULTS
    );
    expect(resolved.fontSizePx).toBe(30);
  });

  it("(happy) an ancestor theme's <nativeType>/font_sizes/<sizeKey> entry resolves via this node's own node.type, absent an override", () => {
    const theme: ThemeResource = { ...emptyTheme(), fontSizes: { Label: { font_size: 28 } } };
    const resolved = resolveTextTheme(node({ themeChain: [theme] }), {}, LABEL_KEYS, DEFAULTS);
    expect(resolved.fontSizePx).toBe(28);
  });

  it("(edge) falls through to the ancestor theme's OWN default_font_size when no specific <Type>/font_sizes/<sizeKey> entry matches — the gap this slice closes", () => {
    const theme: ThemeResource = { ...emptyTheme(), defaultFontSize: 30 };
    const resolved = resolveTextTheme(node({ themeChain: [theme] }), {}, LABEL_KEYS, DEFAULTS);
    expect(resolved.fontSizePx).toBe(30);
  });

  it('(edge) the ancestor walk never touches colour — an ancestor theme with a matching font_sizes entry still defaults colour independently', () => {
    const theme: ThemeResource = { ...emptyTheme(), fontSizes: { Label: { font_size: 28 } } };
    const resolved = resolveTextTheme(node({ themeChain: [theme] }), {}, LABEL_KEYS, DEFAULTS);
    expect(resolved.color).toEqual(DEFAULTS.color);
  });
});

/**
 * Joins theme resolution (`resolveThemeFontIn`, `resolveThemeFontSizeIn`) to each Control's solver
 * and painter. Both call these functions with the same `themeKey`, so the box a widget is floored
 * to and the glyphs it draws resolve to one font and one size.
 */

// The font `themeKey` is Godot's own key from the `set_font` calls in `default_theme.cpp`: `"font"`
// for Label, Button, CheckBox, OptionButton and LineEdit, `"normal_font"` for RichTextLabel
// (`default_theme.cpp:1194`). The size key appends `_size`, and each `nativeSolver.ts` cites its pair.
import { controlProps, type ShareNode } from '../solveTree';
import {
  resolveThemeFontIn,
  resolveThemeFontSizeIn,
  themeResolutionScope,
  type ThemeResolutionScope,
} from '../../../../resources/styles/theme/lookup';
import { peekSceneFontMetrics } from './sceneFontLoader';
import type { FontMetrics } from './fontMetrics';
import type { FontResource } from '../../../../resources/fonts/font/types';

/**
 * The type-dependency chain and theme search order depend on the node alone, so one build serves
 * both passes and both lookups. Keyed by `SolveNode` identity: `buildForest` mints a new node per
 * walk, so a new generation never hits and an old one is collected with its nodes.
 */
const scopeCache = new WeakMap<ShareNode, ThemeResolutionScope>();

function scopeFor(n: ShareNode): ThemeResolutionScope {
  const cached = scopeCache.get(n);
  if (cached) return cached;
  const scope = themeResolutionScope(n.node.type, controlProps(n).themeTypeVariation, n.themeChain, n.projectTheme);
  scopeCache.set(n, scope);
  return scope;
}

/**
 * Resolves the font of `n` for `themeKey` into a `FontMetrics`: the bundled default while a scene
 * font loads, fails or is unsupported. Never throws. The peek is not cached, because a font load
 * can settle between the solve pass and the paint pass of one generation.
 */
export function resolveNodeFontMetrics(n: ShareNode, themeKey: string): FontMetrics {
  return peekSceneFontMetrics(resolveNodeFont(n, themeKey), n.path);
}

/**
 * The font `themeKey` resolves to on `n`, without the metrics peek. TabContainer pushes its
 * `tab_font` onto its internal TabBar as an override (`scene/gui/tab_container.cpp:338`), so the
 * bar resolves against the type chain of TabContainer.
 */
export function resolveNodeFont(n: ShareNode, themeKey: string): FontResource | null {
  return resolveThemeFontIn(scopeFor(n), themeKey, n.fontOverrides[themeKey]);
}

/**
 * The font size `sizeKey` resolves to on `n` (`scene/gui/control.cpp:3107-3129`). `overridePx` is
 * the widget's `theme_override_font_sizes/<sizeKey>`, read from `props.themeOverrideFontSizes`.
 * `builtInDefaultPx` stands in for `ThemeDB::get_fallback_font_size()`.
 */
export function resolveNodeFontSizePx(
  n: ShareNode,
  sizeKey: string,
  overridePx: number | undefined,
  builtInDefaultPx: number
): number {
  return resolveThemeFontSizeIn(scopeFor(n), sizeKey, overridePx, builtInDefaultPx);
}

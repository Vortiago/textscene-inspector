/**
 * Joins theme resolution (`resolveThemeFontIn`, `resolveThemeFontSizeIn`) to each Control's solver
 * and painter. Both pass the same `themeKey`, so a widget's floored box and its glyphs share one
 * font and size. It is Godot's own `set_font` key: `"font"` for Label, Button, CheckBox,
 * OptionButton and LineEdit, `"normal_font"` for RichTextLabel (`default_theme.cpp:1194`).
 */

import { controlProps, type ShareNode } from '../solveTree';
import {
  findThemeFontIn,
  resolveThemeFontIn,
  resolveThemeFontSizeIn,
  themeResolutionScope,
  type ThemeResolutionScope,
} from '../../../../resources/styles/theme/lookup';
import { peekSceneFontMetrics } from './sceneFontLoader';
import type { FontMetrics } from './fontMetrics';
import type { FontResource } from '../../../../resources/fonts/font/types';
import { perObject } from '../../../../utils/perObject';

/**
 * The type-dependency chain and theme search order depend on the node alone, so one build serves
 * both passes and both lookups. Keyed by `SolveNode` identity: `buildForest` mints a new node per
 * walk, so a new generation never hits and an old one is collected with its nodes.
 */
const scopeFor = perObject((n: ShareNode): ThemeResolutionScope =>
  themeResolutionScope(
    n.node.type,
    controlProps(n).themeTypeVariation,
    n.themeChain,
    n.projectTheme,
    n.projectDefaultFont
  )
);

/**
 * Resolves the font of `n` for `themeKey` into a `FontMetrics`: the bundled default while a scene
 * font loads, fails or is unsupported. Never throws. The peek is not cached, because a font load
 * can settle between the solve pass and the paint pass of one generation.
 */
export function resolveNodeFontMetrics(n: ShareNode, themeKey: string): FontMetrics {
  return peekSceneFontMetrics(resolveNodeFont(n, themeKey), n.path);
}

/**
 * `resolveNodeFontMetrics` for a key whose last rung is a face of its own, not the default font:
 * RichTextLabel's `bold_font` ends at a `FontVariation` over the default font
 * (`default_theme.cpp:1195`). `lastRung` gets the metrics of the default font and answers only
 * where no override, no ancestor theme and no project theme defines `themeKey`.
 */
export function resolveNodeFontMetricsOr(
  n: ShareNode,
  themeKey: string,
  lastRung: (defaultFace: FontMetrics) => FontMetrics
): FontMetrics {
  const scope = scopeFor(n);
  const found = findThemeFontIn(scope, themeKey, n.fontOverrides[themeKey]);
  if (found !== undefined) return peekSceneFontMetrics(found, n.path);
  return lastRung(peekSceneFontMetrics(scope.projectDefaultFont, n.path));
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
 * The font size `sizeKey` resolves to on `n` (`scene/gui/control.cpp:3107-3129`): the font key plus
 * `_size`, as each `nativeSolver.ts` cites. `overridePx` is the widget's
 * `theme_override_font_sizes/<sizeKey>`, read from `props.themeOverrideFontSizes`.
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

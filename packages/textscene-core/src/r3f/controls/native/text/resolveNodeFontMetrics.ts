/**
 * The ONE join point between the theme RESOLUTION half of this feature
 * (`styles/theme/lookup.ts`'s `resolveThemeFontIn`/
 * `resolveThemeFontSizeIn`, walking a `SolveNode`'s `fontOverrides`/
 * `themeChain`/`projectTheme` via a per-node `ThemeResolutionScope`) and each
 * grain's own consumption half: `resolveNodeFontMetrics` feeds the PAINTING
 * side (`./sceneFontLoader.ts`'s `peekSceneFontMetrics`, turning whatever
 * `FontResource` the font walk lands on into a synchronous `FontMetrics`);
 * `resolveNodeFontSizePx` feeds the SOLVE/paint SIZE both widgets need to
 * agree on (`resolveThemeFontSizeIn`'s own doc — `Control::get_theme_font_size`,
 * `scene/gui/control.cpp:3107-3129`).
 *
 * Every text-painting Control's solver (`MinimumSizeFn`) AND painter
 * (`Component.tsx`, for the cases that re-shape locally instead of reading a
 * cached `meta.fontMetrics` — see each widget's own doc) call these SAME two
 * functions with the SAME `themeKey` for a given node, so the box a widget is
 * floored to and the glyphs it draws can never resolve to two different
 * fonts, or two different sizes. A widget's own font `themeKey` is Godot's
 * own theme font key for that type (`SceneStringName(font)` = `"font"` for
 * Label/Button/CheckBox/OptionButton/LineEdit, `scene/theme/
 * default_theme.cpp`'s `set_font` calls for each; RichTextLabel's own
 * base-paragraph key is `"normal_font"`, `default_theme.cpp:1194`); its
 * font-SIZE key is the SAME stem with `_size` appended (`"font_size"` /
 * `"normal_font_size"`, `default_theme.cpp`'s paired `set_font_size` calls —
 * see each widget's own `nativeSolver.ts` for the citation attached to ITS
 * pair).
 *
 * Three functions rather than each widget re-deriving `n.node.type`/
 * `controlProps(n).themeTypeVariation` inline: one seam a test can mock to
 * inject a distinguishable `FontMetrics` without depending on
 * `sceneFontLoader.ts`'s real (DOM-gated, silently-short-circuited-under-
 * vitest — that module's own doc) async pipeline, a second, pure one for
 * the size walk that has no such DOM dependency at all, and
 * `resolveNodeFont` — the first one's font half without the metrics peek,
 * for a caller pushing one node's resolved font onto another
 *
 * Both share `scopeFor` below, which caches the node's `ThemeResolutionScope`
 * (the type-dependency chain + theme search order — the part of the walk that
 * does NOT depend on which item is being looked up) per `SolveNode` object, so
 * a node resolved from both the solve pass and the paint pass, for both its
 * font and its font size, builds that chain once instead of up to four times.
 */
import { controlProps, type SolveNode } from '../solveTree';
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
 * `themeResolutionScope`'s own doc: the type-dependency chain and theme
 * search order are functions of the NODE alone (`node.type`/
 * `themeTypeVariation`/`themeChain`/`projectTheme`), never of which item
 * (font vs. font-size, or which key) is being looked up — so a node that gets
 * looked up from the solve pass AND the paint pass, for BOTH its font and its
 * font size, needs this built only once.
 *
 * Keyed by the `SolveNode` OBJECT itself, not by its field values:
 * `buildSolveTree.ts`'s `buildForest` mints a brand-new `SolveNode` per node
 * on every walk, so object identity already IS "this generation's version of
 * this node" — a `WeakMap` gets the once-per-node-per-generation property for
 * free, with no cache to invalidate (a new generation simply never produces a
 * hit) and no lifetime to manage (an old generation's nodes become
 * unreachable and get collected normally). A hand-built test literal that
 * happens to have identical field values to another still gets its own entry
 * here, which is correct: two SEPARATE call sites holding two SEPARATE
 * `SolveNode` objects must never share a cache slot merely because their
 * contents currently agree.
 */
const scopeCache = new WeakMap<SolveNode, ThemeResolutionScope>();

function scopeFor(n: SolveNode): ThemeResolutionScope {
  const cached = scopeCache.get(n);
  if (cached) return cached;
  const scope = themeResolutionScope(n.node.type, controlProps(n).themeTypeVariation, n.themeChain, n.projectTheme);
  scopeCache.set(n, scope);
  return scope;
}

/**
 * Resolves `n`'s own font for `themeKey` (this widget's local override, else
 * the ancestor theme chain, else the project theme — `resolveThemeFontIn`'s
 * own doc) and turns it into a `FontMetrics` a synchronous solve/paint pass
 * can shape against — the bundled default while a real scene font is still
 * loading, failed, or unsupported (`peekSceneFontMetrics`'s own doc). Never
 * throws.
 *
 * `peekSceneFontMetrics` is called on EVERY invocation, never cached here —
 * unlike `scopeFor` above, its answer can change from one call to the next
 * WITHIN the same generation (a font load settling between the solve pass
 * and the paint pass), and the caller relies on that: see `label/Component.tsx`'s
 * own doc for why the paint-time read has to stay live.
 */
export function resolveNodeFontMetrics(n: SolveNode, themeKey: string): FontMetrics {
  return peekSceneFontMetrics(resolveNodeFont(n, themeKey), n.path);
}

/**
 * The FONT `themeKey` resolves to on `n` — `resolveNodeFontMetrics`'s own
 * first half, without the metrics peek. Exposed for the one caller that must
 * hand a node's resolved font to a DIFFERENT node: TabContainer pushes its own
 * `tab_font` onto its internal TabBar as that bar's own override
 * (`scene/gui/tab_container.cpp:338`), so the bar resolves against
 * TabContainer's type chain the way Godot does, not its own.
 */
export function resolveNodeFont(n: SolveNode, themeKey: string): FontResource | null {
  return resolveThemeFontIn(scopeFor(n), themeKey, n.fontOverrides[themeKey]);
}

/**
 * The font-SIZE counterpart of `resolveNodeFontMetrics` — same cached
 * per-node `scopeFor`, `resolveThemeFontSizeIn`'s ancestor walk instead of
 * `resolveThemeFontIn`'s. `overridePx` is this widget's OWN
 * `theme_override_font_sizes/<sizeKey>` (a plain, already-parsed number — no
 * loader/cache indirection the way a Font reference needs, so there is no
 * `SolveNode` field for it the way `fontOverrides` exists for fonts; the
 * caller reads it straight off `props.themeOverrideFontSizes`).
 * `builtInDefaultPx` is `resolveThemeFontSizeIn`'s own final rung — this
 * previewer's scaled `DEFAULT_FONT_SIZE`, standing in for Godot's
 * `ThemeDB::get_fallback_font_size()`.
 */
export function resolveNodeFontSizePx(
  n: SolveNode,
  sizeKey: string,
  overridePx: number | undefined,
  builtInDefaultPx: number
): number {
  return resolveThemeFontSizeIn(scopeFor(n), sizeKey, overridePx, builtInDefaultPx);
}

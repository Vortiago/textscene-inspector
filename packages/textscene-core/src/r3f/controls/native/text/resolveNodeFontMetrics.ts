/**
 * The ONE join point between the theme RESOLUTION half of this feature
 * (`resources/processing/themeProcessing.ts`'s `resolveThemeFont`/
 * `resolveThemeFontSizePx`, walking a `SolveNode`'s `fontOverrides`/
 * `themeChain`/`projectTheme`) and each grain's own consumption half:
 * `resolveNodeFontMetrics` feeds the PAINTING side (`./sceneFontLoader.ts`'s
 * `peekSceneFontMetrics`, turning whatever `FontResource` the font walk lands
 * on into a synchronous `FontMetrics`); `resolveNodeFontSizePx` feeds the
 * SOLVE/paint SIZE both widgets need to agree on (`resolveThemeFontSizePx`'s
 * own doc — `Control::get_theme_font_size`, `scene/gui/control.cpp:
 * 3113-3131`).
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
 * Two functions rather than each widget re-deriving `n.node.type`/
 * `controlProps(n).themeTypeVariation` inline: one seam a test can mock to
 * inject a distinguishable `FontMetrics` without depending on
 * `sceneFontLoader.ts`'s real (DOM-gated, silently-short-circuited-under-
 * vitest — that module's own doc) async pipeline, and a second, pure one for
 * the size walk that has no such DOM dependency at all.
 */
import { controlProps, type SolveNode } from '../solveTree';
import { resolveThemeFont, resolveThemeFontSizePx } from '../../../../resources/processing/themeProcessing';
import { peekSceneFontMetrics } from './sceneFontLoader';
import type { FontMetrics } from './fontMetrics';

/**
 * Resolves `n`'s own font for `themeKey` (this widget's local override, else
 * the ancestor theme chain, else the project theme — `resolveThemeFont`'s own
 * doc) and turns it into a `FontMetrics` a synchronous solve/paint pass can
 * shape against — the bundled default while a real scene font is still
 * loading, failed, or unsupported (`peekSceneFontMetrics`'s own doc). Never
 * throws.
 */
export function resolveNodeFontMetrics(n: SolveNode, themeKey: string): FontMetrics {
  const nativeType = n.node.type;
  const typeVariation = controlProps(n).themeTypeVariation;
  const fontResource = resolveThemeFont(
    themeKey,
    n.fontOverrides[themeKey],
    nativeType,
    typeVariation,
    n.themeChain,
    n.projectTheme
  );
  return peekSceneFontMetrics(fontResource, n.path);
}

/**
 * The font-SIZE counterpart of `resolveNodeFontMetrics` — same node-context
 * extraction (`n.node.type`/`controlProps(n).themeTypeVariation`/
 * `n.themeChain`/`n.projectTheme`), `resolveThemeFontSizePx`'s ancestor walk
 * instead of `resolveThemeFont`'s. `overridePx` is this widget's OWN
 * `theme_override_font_sizes/<sizeKey>` (a plain, already-parsed number — no
 * loader/cache indirection the way a Font reference needs, so there is no
 * `SolveNode` field for it the way `fontOverrides` exists for fonts; the
 * caller reads it straight off `props.themeOverrideFontSizes`).
 * `builtInDefaultPx` is `resolveThemeFontSizePx`'s own final rung — this
 * previewer's scaled `DEFAULT_FONT_SIZE`, standing in for Godot's
 * `ThemeDB::get_fallback_font_size()`.
 */
export function resolveNodeFontSizePx(
  n: SolveNode,
  sizeKey: string,
  overridePx: number | undefined,
  builtInDefaultPx: number
): number {
  const nativeType = n.node.type;
  const typeVariation = controlProps(n).themeTypeVariation;
  return resolveThemeFontSizePx(sizeKey, overridePx, nativeType, typeVariation, n.themeChain, n.projectTheme, builtInDefaultPx);
}

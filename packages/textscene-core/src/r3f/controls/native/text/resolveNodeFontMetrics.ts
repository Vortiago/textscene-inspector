/**
 * The ONE join point between the theme/font RESOLUTION half of this feature
 * (`resources/processing/themeProcessing.ts`'s `resolveThemeFont`, walking a
 * `SolveNode`'s `fontOverrides`/`themeChain`/`projectTheme`) and the PAINTING
 * half (`./sceneFontLoader.ts`'s `peekSceneFontMetrics`, turning whatever
 * `FontResource` that walk lands on into a synchronous `FontMetrics`).
 *
 * Every text-painting Control's solver (`MinimumSizeFn`) AND painter
 * (`Component.tsx`, for the cases that re-shape locally instead of reading a
 * cached `meta.fontMetrics` — see each widget's own doc) call this SAME
 * function with the SAME `themeKey` for a given node, so the box a widget is
 * floored to and the glyphs it draws can never resolve to two different
 * fonts. A widget's own `themeKey` is Godot's own theme font key for that
 * type (`SceneStringName(font)` = `"font"` for Label/Button/CheckBox/
 * OptionButton/LineEdit, `scene/theme/default_theme.cpp`'s `set_font` calls
 * for each; RichTextLabel's own base-paragraph key is `"normal_font"`,
 * `default_theme.cpp:1194` — see each widget's own `nativeSolver.ts` for the
 * citation attached to ITS key).
 *
 * A single function rather than each widget re-deriving `n.node.type`/
 * `controlProps(n).themeTypeVariation` inline: one seam a test can mock to
 * inject a distinguishable `FontMetrics` without depending on
 * `sceneFontLoader.ts`'s real (DOM-gated, silently-short-circuited-under-
 * vitest — that module's own doc) async pipeline.
 */
import { controlProps, type SolveNode } from '../solveTree';
import { resolveThemeFont } from '../../../../resources/processing/themeProcessing';
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

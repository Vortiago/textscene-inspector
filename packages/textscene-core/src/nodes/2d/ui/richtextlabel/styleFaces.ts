/**
 * The four faces a RichTextLabel draws in: normal, bold, italics and bold italics. Each reads its
 * own theme key (`RichTextLabel::_find_font`, `scene/gui/rich_text_label.cpp:3226-3296`), and
 * where no theme defines it, the key ends at a `FontVariation` over the default font that
 * `scene/theme/default_theme.cpp:1366-1403` builds.
 */
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { withVariation, type FontMetrics } from '../../../../r3f/controls/native/text/fontMetrics';
import {
  resolveNodeFontMetrics,
  resolveNodeFontMetricsOr,
} from '../../../../r3f/controls/native/text/resolveNodeFontMetrics';

/**
 * The plain-paragraph font key, `scene/theme/default_theme.cpp:1194`:
 * `theme->set_font("normal_font", "RichTextLabel", Ref<Font>());`. It has no `FontVariation` of
 * its own, so it ends at the default font.
 */
const NORMAL_FONT_KEY = 'normal_font';

/** `default_theme.cpp:1195-1197`: the key of each styled face. */
const BOLD_FONT_KEY = 'bold_font';
const ITALICS_FONT_KEY = 'italics_font';
const BOLD_ITALICS_FONT_KEY = 'bold_italics_font';

/**
 * `default_theme.cpp:1399`/`:1403`: `Transform2D(1.0, 0.2, 0.0, 1.0, 0.0, 0.0)`. Its second number
 * shears a glyph right by 0.2 px for each px above the baseline.
 */
const ITALIC_SKEW = 0.2;

/** `default_theme.cpp:1394`/`:1398`: `variation_embolden` 1.2. */
const BOLD_EMBOLDEN = 1.2;

export interface RichTextFaces {
  readonly normal: FontMetrics;
  readonly bold: FontMetrics;
  readonly italic: FontMetrics;
  readonly boldItalic: FontMetrics;
}

/**
 * The faces of `n` that `styles` use, the normal face for the rest. A style no run uses is never
 * resolved, so its font never loads. A settled scene font changes the faces, so a painter reads
 * them in its render body. A face can be the bundled one while its font loads.
 */
export function resolveRichTextFaces(
  n: SolveNode,
  styles: readonly { bold: boolean; italic: boolean }[]
): RichTextFaces {
  const normal = resolveNodeFontMetrics(n, NORMAL_FONT_KEY);
  const styled = (
    isBold: boolean,
    isItalic: boolean,
    key: string,
    synthesise: (defaultFace: FontMetrics) => FontMetrics
  ): FontMetrics =>
    styles.some((style) => style.bold === isBold && style.italic === isItalic)
      ? resolveNodeFontMetricsOr(n, key, synthesise)
      : normal;
  return {
    normal,
    bold: styled(true, false, BOLD_FONT_KEY, (base) => withVariation(base, { embolden: BOLD_EMBOLDEN })),
    italic: styled(false, true, ITALICS_FONT_KEY, (base) => withVariation(base, { skew: ITALIC_SKEW })),
    boldItalic: styled(true, true, BOLD_ITALICS_FONT_KEY, (base) =>
      withVariation(base, { embolden: BOLD_EMBOLDEN, skew: ITALIC_SKEW })
    ),
  };
}

/** The face of a run with these `[b]` and `[i]` states (`_find_font`, `rich_text_label.cpp:3239-3296`). */
export function faceOfStyle(faces: RichTextFaces, style: { bold: boolean; italic: boolean }): FontMetrics {
  if (style.bold) return style.italic ? faces.boldItalic : faces.bold;
  return style.italic ? faces.italic : faces.normal;
}

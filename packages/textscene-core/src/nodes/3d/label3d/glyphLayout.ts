/**
 * Label3D's own line-placement + outline-dilation math — a port of
 * `scene/3d/label_3d.cpp Label3D::_shape()` (~562-623) for the parts this
 * component parses (see `types.ts`/`parser.ts` for the parsed set;
 * `vertical_alignment`, `autowrap_mode`, `width`, `render_priority` and
 * `outline_render_priority` are unparsed and out of scope — every Label3D
 * therefore renders as Godot's own DEFAULT for each).
 *
 * This module only turns an ALREADY-SHAPED `TextLayoutResult` (from the
 * shared `shapeText`, reused verbatim — see `LabelGlyphs.tsx`) into per-line
 * pixel placements and the MSDF `distanceBias` that approximates Godot's
 * outline pass. It plays the same role `nodes/2d/ui/label/nativeSolver.ts`
 * plays for the 2D Control Label, for Label3D's own (different) rules:
 * always-centred vertical placement (`vertical_alignment` defaults to
 * `VERTICAL_ALIGNMENT_CENTER`, `label_3d.h`, and is never parsed away from
 * it), no box width, and `HORIZONTAL_ALIGNMENT_FILL` folding into CENTER
 * rather than justifying (`label_3d.cpp:592`'s switch falls `FILL` through
 * to the `CENTER` case; the width-fit block above it,
 * `TS->shaped_text_fit_to_width`, is real Label3D justification this
 * component does not implement since `width` is unparsed).
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * See THIRD-PARTY-NOTICES.md.
 */
import type { TextLayoutResult, TextLineLayout } from '../../../r3f/controls/native/text/textLayout';
import { originCorrectionPx } from '../../../r3f/controls/native/text/textOrigin';
import { OPEN_SANS_ATLAS_INFO } from '../../../r3f/controls/native/text/openSansAtlas';
import { HorizontalAlignment } from './types';

export interface Label3DLinePlacement {
  /** This line's own left-edge x offset (`label_3d.cpp:588-599`), Godot px. */
  x: number;
  /** This line's "box top" Y, Godot px, `TextRun`/`originCorrectionPx` convention (y-down, baseline-anchored). */
  y: number;
  line: TextLineLayout;
}

/**
 * `label_3d.cpp:568-580`: `vbegin` for `VERTICAL_ALIGNMENT_CENTER` — the ONE
 * case reachable here (`vertical_alignment` is unparsed, so every Label3D
 * renders at this default: the origin sits at the vertical centre of the
 * text block). Godot's own `vbegin = (total_h - line_spacing) / 2` is
 * expressed in a Y-UP-from-origin convention (positive = above origin);
 * `TextRun`'s own convention is Y-DOWN, so the sign flips here rather than
 * in the caller.
 */
function verticalOffsetPx(layout: TextLayoutResult, lineSpacingPx: number): number {
  const contentHeightPx = layout.heightPx - lineSpacingPx;
  return -contentHeightPx / 2;
}

/**
 * `label_3d.cpp:588-599`. `FILL` shares `CENTER`'s branch — Label3D has no
 * per-line justification pass for it (that lives in the `width`-driven
 * `shaped_text_fit_to_width` block `_shape()` calls above its per-line
 * loop, which this component never reaches since `width` is unparsed).
 */
function horizontalOffsetPx(lineWidthPx: number, alignment: HorizontalAlignment): number {
  switch (alignment) {
    case HorizontalAlignment.CENTER:
    case HorizontalAlignment.FILL:
      return -lineWidthPx / 2;
    case HorizontalAlignment.RIGHT:
      return -lineWidthPx;
    case HorizontalAlignment.LEFT:
    default:
      return 0;
  }
}

/** Per-line placements for an already-shaped `layout` — `LabelGlyphs.tsx`'s only consumer. */
export function layoutLabel3DLines(
  layout: TextLayoutResult,
  horizontalAlignment: HorizontalAlignment,
  lineSpacingPx: number,
  fontSizePx: number
): Label3DLinePlacement[] {
  const vbeginPx = verticalOffsetPx(layout, lineSpacingPx);
  const originPx = originCorrectionPx(fontSizePx);
  return layout.lines.map((line, lineIndex) => ({
    x: horizontalOffsetPx(line.widthPx, horizontalAlignment),
    y: vbeginPx + originPx + lineIndex * layout.linePitchPx,
    line,
  }));
}

/**
 * Approximates Godot's outline pass — a SEPARATE FreeType-stroked glyph
 * bitmap, keyed by `Vector2i(font_size, outline_size)`
 * (`label_3d.cpp:344-349`; a real geometric dilation, not a shader trick) —
 * as an MSDF `distanceBias` shift of the SAME glyph quad (`TextRun`'s
 * existing synthesized-bold mechanism,
 * `r3f/controls/native/text/msdfMaterial.ts`; `richtextlabel/nativeSolver.ts`'s
 * `BOLD_DISTANCE_BIAS` is the same trick calibrated for a different purpose).
 *
 * Calibrated against real Godot 4.6.3 via `pnpm ref:godot` (not derived from
 * the C++, which never states the actual rendered stroke width): a
 * single-glyph scratch scene (`text="H"`, `outline_size=32`,
 * `outline_modulate=black`, camera `(0,0,3)` looking at the origin,
 * `pixel_size=0.01`) rendered at `font_size=128` AND again at `font_size=64`
 * both measured a one-sided outline band of ≈13.4 screen px around the H's
 * stems (half-max crossings of the background/outline and outline/ink
 * transitions) — confirming the dilation is independent of `font_size`,
 * exactly as `outline_size` being its own absolute font-pixel quantity
 * (not a fraction of `font_size`) predicts. Converting that screen-px
 * measurement to Godot px used the SAME glyph's own known atlas bounding-box
 * width as a ruler (`OPEN_SANS_ATLAS_GLYPHS.H.width` = 28 atlas-bake px,
 * scale `fontSizePx/42`, measured ink-edge-to-ink-edge width ≈130.98 screen
 * px at `font_size=128`) rather than deriving the camera's world-to-screen
 * scale, which `--frame`/`--camera` do not print: 13.4 / (130.98/85.33) ≈
 * 8.66 Godot px of one-sided dilation for `outline_size=32`, i.e. ≈0.27
 * Godot px per unit of `outline_size`. `OUTLINE_DILATION_PX_PER_UNIT` is
 * that constant.
 *
 * `distanceBias` is normalized to the atlas's own `distanceRange` (4
 * atlas-bake px — the SDF's full encoded falloff band), so a target
 * dilation in Godot px converts to atlas-bake px by the SAME
 * `OPEN_SANS_ATLAS_INFO.fontSize / fontSizePx` scale before dividing by
 * `distanceRange`.
 *
 * This trades exactness for reusing the existing MSDF pipeline with zero new
 * atlas bytes: the atlas's own padding around each glyph bounds how far a
 * `distanceBias` shift can dilate before the shape clips flat at the quad's
 * own edge — `MAX_DISTANCE_BIAS` caps the request there (measured the same
 * way, `comparison.md` has the resulting divergence) rather than let a large
 * `outline_size` render a visibly flat-cut silhouette. `msdfMaterial.ts`'s
 * own `outlineDampen` handles the OTHER failure mode (a small on-screen
 * caption, where the shape's own screen-space AA band widens disproportionately) —
 * this cap is purely about the atlas's own per-glyph padding.
 */
const OUTLINE_DILATION_PX_PER_UNIT = 0.27;

/**
 * The largest `distanceBias` the vendored atlas's own per-glyph bitmap can
 * dilate into before the outline stops reading as a glyph-shaped band and
 * starts reading as its QUAD's own bounding rectangle.
 *
 * The atlas's own padding sets a theoretical ceiling around ≈0.5-0.6
 * (sampling the MSDF median channel across the `H` glyph's reported bitmap
 * bounds, `openSansAtlas.ts`'s `OPEN_SANS_ATLAS_PNG_DATA_URL` decoded: the
 * value is already fully saturated — "maximally outside" — one pixel
 * outside the bitmap's own edge, and the halfway/shape-boundary crossing
 * sits only ≈2.5 atlas px, of the atlas's 4px `distanceRange`, further in).
 * In practice a bias that large visibly SQUARES OFF thinner glyphs' outlines
 * (measured on `unit-box-mesh.tscn`'s "BoxMesh Test" caption, a
 * `font_size`-32/`pixel_size`-0.008 label sitting well above
 * `msdfMaterial.ts`'s `outlineDampen` floor — that dampening only helps a
 * SMALLER on-screen caption, not this one). `0.3` is the largest value that
 * rendered every letter's outline as a rounded band rather than a
 * rectangle across the three arbitration scenes in `comparison.md`'s own
 * table; the resulting under-dilation (thinner than Godot's own outline for
 * outline_size ≳ 4) is the accepted trade and is measured there too.
 */
export const MAX_DISTANCE_BIAS = 0.3;

/** `0` when Godot would skip the outline pass entirely (`label_3d.cpp:610`: `outline_modulate.a != 0.0 && outline_size > 0`). */
export function outlineDistanceBias(outlineSizePx: number, fontSizePx: number): number {
  if (outlineSizePx <= 0 || fontSizePx <= 0) return 0;
  const targetDilationGodotPx = outlineSizePx * OUTLINE_DILATION_PX_PER_UNIT;
  const targetDilationAtlasPx = targetDilationGodotPx * (OPEN_SANS_ATLAS_INFO.fontSize / fontSizePx);
  const bias = targetDilationAtlasPx / OPEN_SANS_ATLAS_INFO.distanceRange;
  return Math.min(bias, MAX_DISTANCE_BIAS);
}

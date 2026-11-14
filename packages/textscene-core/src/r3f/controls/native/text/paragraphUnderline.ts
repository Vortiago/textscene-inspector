/**
 * The underline of a shaped paragraph, which Godot copies to each of its lines (`_shape_substr`,
 * `text_server_adv.cpp:5310-5311`).
 */
import { fallbackChainOf, getFontUnderlinePx, type FontMetrics, type UnderlinePx } from './fontMetrics';

/** The faces and sizes of a paragraph, one entry per UTF-16 unit, as `shapeText` resolves them. */
export interface ParagraphFaces {
  readonly chars: ArrayLike<string>;
  readonly sizes: readonly number[];
  /** The face each unit draws in. */
  readonly faces: readonly FontMetrics[];
  /** The face each unit's span asks for. */
  readonly spanFaces: readonly FontMetrics[];
  /** Whether no face of the span's chain has a glyph for the unit at `index`. */
  readonly isUndrawn: (index: number) => boolean;
}

/** The underline of a line with none: a face with no `post`, or a BMFont. A caller that draws a stroke applies its own 1 px floor. */
export const NO_UNDERLINE_PX: UnderlinePx = { positionPx: 0, thicknessPx: 0 };

/**
 * The largest underline of every face `_shape_run` shapes the paragraph in: a span's own face and
 * each fallback up to the face that draws a cluster (`:7174-7175`), or the whole chain where none
 * draws it (`:7189-7190`). An embedded object widens nothing (`:5150-5157`).
 */
export function paragraphUnderline({
  chars,
  sizes,
  faces,
  spanFaces,
  isUndrawn,
}: ParagraphFaces): UnderlinePx {
  let positionPx = 0;
  let thicknessPx = 0;
  const widen = (face: FontMetrics, fontSizePx: number): void => {
    const underline = getFontUnderlinePx(face, fontSizePx);
    positionPx = Math.max(positionPx, underline.positionPx);
    thicknessPx = Math.max(thicknessPx, underline.thicknessPx);
  };
  let lastSpanFace: FontMetrics | undefined;
  let lastDrawnFace: FontMetrics | undefined;
  let lastSize = 0;
  let wasUndrawn = false;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]!;
    const spanFace = spanFaces[i]!;
    const drawnFace = faces[i]!;
    const fontSizePx = sizes[i]!;
    if (ch === '' || spanFace.drawsApart?.(ch)) continue;
    const isUnitUndrawn = isUndrawn(i);
    // Most units shape like the unit before them, in the same faces, which widen nothing more.
    const isRepeat =
      spanFace === lastSpanFace &&
      drawnFace === lastDrawnFace &&
      fontSizePx === lastSize &&
      isUnitUndrawn === wasUndrawn;
    if (isRepeat) continue;
    const isInSpanFace = drawnFace === spanFace && !isUnitUndrawn;
    for (const face of facesShaped(spanFace, drawnFace, isInSpanFace)) widen(face, fontSizePx);
    [lastSpanFace, lastDrawnFace, lastSize, wasUndrawn] = [spanFace, drawnFace, fontSizePx, isUnitUndrawn];
  }
  return positionPx === 0 && thicknessPx === 0 ? NO_UNDERLINE_PX : { positionPx, thicknessPx };
}

/** The faces of the chain of `spanFace` that a unit drawn in `drawnFace` is shaped in, in order. */
function facesShaped(
  spanFace: FontMetrics,
  drawnFace: FontMetrics,
  isInSpanFace: boolean
): readonly FontMetrics[] {
  if (isInSpanFace) return [spanFace];
  const chain = fallbackChainOf(spanFace);
  const drawnAt = chain.indexOf(drawnFace);
  return drawnAt > 0 ? chain.slice(0, drawnAt + 1) : chain;
}

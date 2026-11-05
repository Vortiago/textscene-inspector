/**
 * The MSDF atlas painter's embolden: how far the distance field grows to match a `FontVariation`
 * `variation_embolden`. FreeType emboldens an outline by `embolden * size / 16` px in total
 * (`text_server_adv.cpp:1314-1315`), which the field reaches by moving its threshold outward.
 */
import { OPEN_SANS_ATLAS_INFO } from './openSansAtlas';
import type { TextLayoutResult } from './textLayout';

/**
 * The median below which the fill fades out (`msdfMaterial.ts`'s `inRange`). The field clamps to 0
 * beyond half its range, and a bias reads that flat 0 as a point inside the edge.
 */
export const MSDF_FILL_FADE_MEDIAN = 0.04;

/**
 * The bias per unit of embolden. The field covers `distanceRange` px at the bake size, so one unit
 * of bias moves the edge `distanceRange * size / fontSize` px on screen (`msdfMaterial.ts`'s
 * `screenPxRange`). The edge moves half the growth on each side, `embolden * size / 32` px, which
 * leaves `fontSize / (32 * distanceRange)` per unit and no dependence on the size.
 */
const DISTANCE_BIAS_PER_EMBOLDEN = OPEN_SANS_ATLAS_INFO.fontSize / (32 * OPEN_SANS_ATLAS_INFO.distanceRange);

/**
 * The largest embolden the field grows the edge for: a bias past `0.5 - MSDF_FILL_FADE_MEDIAN`
 * reaches the faded fill, so the glyph stops growing there, near 1.40. A negative embolden keeps
 * the same bound, short of the -1.6 where the atlas thins the stems to nothing.
 */
const MAX_ATLAS_EMBOLDEN = (0.5 - MSDF_FILL_FADE_MEDIAN) / DISTANCE_BIAS_PER_EMBOLDEN;

/** Whether the atlas draws `embolden` as FreeType grows it. Past the limit, the face draws on the canvas painter. */
export function atlasHoldsEmbolden(embolden: number): boolean {
  return Math.abs(embolden) <= MAX_ATLAS_EMBOLDEN;
}

/** The `uDistanceBias` of the material for `layout`, one face: 0 for a face with no embolden. */
export function msdfDistanceBias(layout: TextLayoutResult): number {
  return (layout.fontMetrics.embolden ?? 0) * DISTANCE_BIAS_PER_EMBOLDEN;
}

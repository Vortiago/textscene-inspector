/**
 * The MSDF atlas painter's embolden: how far the distance field grows to match a `FontVariation`
 * `variation_embolden`. FreeType emboldens an outline by `embolden * size / 16` px in total
 * (`text_server_adv.cpp:1313-1314`), which the field reaches by moving its threshold outward.
 */
import { OPEN_SANS_ATLAS_INFO } from './openSansAtlas';
import type { TextLayoutResult } from './textLayout';

/**
 * The bias per unit of embolden. The field covers `distanceRange` px at the bake size, so one unit
 * of bias moves the edge `distanceRange * size / fontSize` px on screen (`msdfMaterial.ts`'s
 * `screenPxRange`). The edge moves half the growth on each side, `embolden * size / 32` px, which
 * leaves `fontSize / (32 * distanceRange)` per unit and no dependence on the size.
 *
 * The field rounds corners and holds limited growth, so an embolden above about 1.4 differs from
 * FreeType's. `comparison.md` of Label records the gap.
 */
const DISTANCE_BIAS_PER_EMBOLDEN = OPEN_SANS_ATLAS_INFO.fontSize / (32 * OPEN_SANS_ATLAS_INFO.distanceRange);

/** The `uDistanceBias` of the material for `layout`, one face: 0 for a face with no embolden. */
export function msdfDistanceBias(layout: TextLayoutResult): number {
  return (layout.fontMetrics.embolden ?? 0) * DISTANCE_BIAS_PER_EMBOLDEN;
}

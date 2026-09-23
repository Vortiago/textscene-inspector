/**
 * How many vertices a `PackedVector2Array` polygon carries, counted, never decoded.
 * The renderer's `parsePackedVector2Array` throws on a component outside the finite
 * grammar, such as `inf`, which Godot loads and counts. A rule asks what Godot
 * loaded, not what the previewer can draw.
 */

import { packedArrayBody, packedArrayForms, splitTopLevel } from '../godot/index.js';

/**
 * The three spellings a packed slot takes, the instances `v.packedVector2Array`
 * matches, so this counts what the validator accepts and leaves a malformed value
 * to linterParser.ts. Built once, not per node, and none carries `g`, so the
 * shared RegExps are stateless.
 */
const POLYGON_FORMS = packedArrayForms('PackedVector2Array');

/**
 * Vertex count for `raw`, mirroring `polygon.size()` (collision_polygon_2d.cpp:239,
 * collision_polygon_3d.cpp:242, csg_shape.cpp:2808-2829). An absent key is zero
 * points: Godot omits a property at its `PackedVector2Array()` default. `null` for
 * an unreadable value, which the format validator reports.
 */
export function polygonPointCount(raw: string | undefined): number | null {
  if (raw === undefined) return 0;
  const matched = packedArrayBody(POLYGON_FORMS, raw);
  if (!matched) return null;
  if (matched.body === '') return 0;
  if (matched.flat) {
    const parts = matched.body.split(',').filter((part) => part.trim().length > 0);
    // `_build_polygon` pairs consecutive components (collision_polygon_2d.cpp:65-71);
    // a trailing odd component is not a whole vertex.
    return Math.floor(parts.length / 2);
  }
  // The bare and typed bodies hold one whole vertex per top-level comma, and a
  // trailing comma yields an empty part Godot's array reader does not count
  // (variant_parser.cpp:1658-1662).
  return splitTopLevel(matched.body).filter((part) => part !== '').length;
}

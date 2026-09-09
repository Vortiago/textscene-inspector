/**
 * How many vertices a `PackedVector2Array` polygon carries.
 *
 * Counting, never decoding. The CSG rule reached for the RENDERER's decoder
 * (`parsePackedVector2Array`) to get a length, and that decoder throws on any
 * component outside the finite grammar — so a polygon carrying `inf`, which
 * Godot loads and counts like any other, made the rule swallow its own
 * `csgpolygon3d-insufficient-points` warning. A renderer decoder answers "can
 * the previewer draw this"; a rule needs "what did Godot load", and those are
 * different questions wherever a value is legal but undrawable.
 *
 * Two rules asked it and only one asked it correctly, so it lives here once.
 */

import { packedArrayBody, packedArrayForms, splitTopLevel } from '../godot/index.js';

/**
 * The three spellings a packed slot takes, the same instances
 * `v.packedVector2Array` matches against — so a value the validator blesses is
 * one this counts, and a value that matches none is malformed, which is
 * linterParser.ts's job to report rather than a rule's.
 *
 * Built once: rebuilding them inside the function would recompile three RegExps
 * on every node either rule visits. None carries `g`, so the shared instances
 * are stateless.
 */
const POLYGON_FORMS = packedArrayForms('PackedVector2Array');

/**
 * Vertex count for `raw`, mirroring `polygon.size()`
 * (collision_polygon_2d.cpp:239, collision_polygon_3d.cpp:242, and
 * csg_shape.cpp:2808-2829 for the CSG side).
 *
 * An ABSENT key is zero points: Godot omits a property at its
 * `PackedVector2Array()` default. `null` for a value the caller cannot read —
 * the format validator owns reporting that, and treating an unreadable value as
 * a valid non-empty polygon would be wrong in the silent direction.
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

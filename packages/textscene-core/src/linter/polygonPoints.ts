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

import { packedArrayLiteral } from '../godot/index.js';

/**
 * Matches the same wrapper `v.packedVector2Array` accepts; a value that doesn't
 * match is malformed, and reporting that is linterParser.ts's job, not a rule's.
 * Compiled once — a literal inside the function would rebuild on every node
 * either rule visits. No `g` flag, so the shared instance is stateless.
 */
const POLYGON_WRAPPER = packedArrayLiteral('PackedVector2Array');

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
  const match = POLYGON_WRAPPER.exec(raw);
  if (!match) return null;
  const body = match[1]!.trim();
  if (body === '') return 0;
  const parts = body.split(',').filter((part) => part.trim().length > 0);
  // `_build_polygon` pairs consecutive components (collision_polygon_2d.cpp:65-71);
  // a trailing odd component is not a whole vertex.
  return Math.floor(parts.length / 2);
}

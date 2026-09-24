/** Polygon2D strict validators. The Node2D surface arrives through the base walk. */

// Registration happens on import, so a test that loads only this slice
// resolves an inherited key only when this line imports the ancestor.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { accepts, propertyError, shape, v } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import type { ParseError } from '../../../linter/types.js';
import { ARRAY_LITERAL_RE, dropTrailingComma, packedArrayLiteral, splitTopLevel } from '../../../godot/index.js';
import { arrayLiteralBody } from '../../../godot/variantParser.js';
import { markIntSlot } from '../../../linter/validators/intSlot.js';
import { badIntElement } from '../../../linter/validators/v/packedArrays.js';

const PACKED_INT32_ELEMENT_RE = packedArrayLiteral('PackedInt32Array');
const BARE_INT_ARRAY_ELEMENT_RE = ARRAY_LITERAL_RE;

/**
 * `polygons` (polygon_2d.cpp:720) is an untyped Array (polygon_2d.h:44), so
 * `array.is_typed()` (variant_parser.cpp:2341) is false and Godot writes a bare
 * `[…]` (:2378-2390). set_polygons (polygon_2d.cpp:435-438) only assigns.
 */
function polygonsValidator(): PropertyValidator {
  const code = 'INVALID_POLYGONS_FORMAT';
  // `shape` first for the `accepts` tag, then `markIntSlot`: the index lists are
  // an INT slot, so this rejects a literal Godot's own tokenizer reads.
  return markIntSlot(shape((key, value, line) => {
    // `Array[PackedInt32Array]([…])` is an Array too, and the setter only
    // assigns (polygon_2d.cpp:720, :435-437), so the typed spelling loads.
    const outer = arrayLiteralBody(value);
    if (outer === null) {
      return propertyError(
        key,
        line,
        `Property 'polygons' must be an Array of PackedInt32Array(…) index lists like [PackedInt32Array(0, 1, 2)], got: "${value}"`,
        code
      );
    }
    const body = outer.trim();
    if (body === '') return null;
    /** The first fractional element seen, held back until every entry is scanned. */
    let truncated: ParseError | null = null;
    for (const entry of dropTrailingComma(splitTopLevel(body))) {
      // `null` is a legal untyped Array element: `set_polygons` stores it
      // (polygon_2d.cpp:435-437), and `_draw` reads an empty `Vector<int>` and
      // skips it at `ic < 3` (:328-330).
      if (entry.trim() === 'null') continue;
      // A bare `[0, 1, 2]` element is equivalent: `_draw` casts each element to
      // `Vector<int>` (polygon_2d.cpp:328), variant.cpp's `can_convert_strict`
      // allows ARRAY, and `_convert_array_from_variant` (variant.cpp:2092-2130)
      // copies each int faithfully.
      const packed = PACKED_INT32_ELEMENT_RE.exec(entry);
      const bare = packed ? null : BARE_INT_ARRAY_ELEMENT_RE.exec(entry);
      const el = packed ?? bare;
      if (!el) {
        return propertyError(
          key,
          line,
          `Property 'polygons' entry "${entry}" must be PackedInt32Array(…) or a bare [i0, i1, …], got: "${entry}"`,
          code
        );
      }
      const inner = el[1]!.trim();
      if (inner === '') continue;
      // `_parse_construct` (variant_parser.cpp:552-596) demands a value after each
      // comma (:562-565, :571), so `PackedInt32Array(…)` refuses a trailing comma
      // that a bare `[…]`, the bracket grammar, allows.
      const indices = bare ? dropTrailingComma(inner.split(',')) : inner.split(',');
      // One pass: unreadable by the tokenizer, or read and then narrowed
      // away (_parse_construct<int32_t>, variant_parser.cpp:1428-1430).
      const bad = badIntElement('polygons', key, line, indices, {
          format: code,
          value: 'INVALID_POLYGONS_VALUE',
      });
      if (bad.error !== null) return bad.error;
      // Remembered, not returned: a later entry may be unreadable, and that
      // error outranks this warning.
      truncated ??= bad.truncated;
    }
    return truncated;
  }, 'Array of PackedInt32Array(i0, i1, …) or bare [i0, i1, …] index lists'));
}

/**
 * `bones`: PROPERTY_USAGE_NO_EDITOR | PROPERTY_USAGE_INTERNAL keeps STORAGE
 * (object.h:132), so it reaches a `.tscn`. `_get_bones` (polygon_2d.cpp:577-584)
 * writes an untyped `[…]` alternating a bone path and its weights, and
 * `_set_bones` (polygon_2d.cpp:588-595) refuses an odd count: enforced.
 */
function bonesValidator(): PropertyValidator {
  const validator = accepts((key, value, line) => {
    // `arrayLiteralBody` also reads the typed `Array[…]([…])` spelling.
    const outer = arrayLiteralBody(value);
    if (outer === null) {
      return propertyError(
        key,
        line,
        `Property 'bones' must be an Array literal like ["Bone/Path", PackedFloat32Array(…), …], got: "${value}"`,
        'INVALID_BONES_FORMAT'
      );
    }
    const body = outer.trim();
    const count = body === '' ? 0 : dropTrailingComma(splitTopLevel(body)).length;
    // The setter checks only the count: `NodePath(p_bones[i])` and the weights
    // cast degrade silently, so, as GridMap's `data` does, element types go
    // unchecked (nodes/3d/gridmap/linterParser.ts).
    if (count % 2 !== 0) {
      return propertyError(
        key,
        line,
        `Property 'bones' must alternate a bone path and a weights array (even element count); got ${count} elements (polygon_2d.cpp:589)`,
        'INVALID_BONES_COUNT'
      );
    }
    return null;
  }, 'Array literal [bone_path, PackedFloat32Array(weights), …]');
  validator.grounding = { kind: 'enforced', cite: 'polygon_2d.cpp:589' };
  return validator;
}

validatorRegistry.registerAll('Polygon2D', {
  color: v.color('color'),
  offset: v.vector2('offset'),
  // polygon_2d.cpp:717 (PACKED_VECTOR2_ARRAY, no hint). get_polygon
  // (polygon_2d.cpp:414-416) returns `Vector<Vector2>`, so `PackedVector2Array(...)`
  // is the only spelling. set_polygon (polygon_2d.cpp:408-412) only assigns.
  polygon: v.packedVector2Array('polygon'),
  // polygon_2d.cpp:720, ARRAY with PROPERTY_HINT_TYPE_STRING "PackedInt32Array".
  polygons: polygonsValidator(),
  texture: v.resourceReference('texture'),
  antialiased: v.boolean('antialiased'),
  invert_enabled: v.boolean('invert_enabled'),
  // polygon_2d.cpp:714 hints "0.1,16384,0.1,suffix:px", closed both ends (no
  // or_greater/or_less); set_invert_border (:516-517) is a bare assignment, so
  // both ends warn rather than erroring (ADR-0032).
  invert_border: v.float('invert_border', {
    min: 0.1,
    max: 16384,
    hinted: 'polygon_2d.cpp:714',
  }),
  // polygon_2d.cpp:722 hints "0,1000", closed both ends.
  // set_internal_vertex_count (polygon_2d.cpp:418-420) assigns unconditionally,
  // so out of range warns (ADR-0032).
  internal_vertex_count: v.int('internal_vertex_count', {
    min: 0,
    max: 1000,
    hinted: 'polygon_2d.cpp:722',
  }),
  bones: bonesValidator(),
  // polygon_2d.cpp:710, NODE_PATH + NODE_PATH_VALID_TYPES "Skeleton2D".
  // set_skeleton (polygon_2d.cpp:597-602) only assigns, so no value is bounded.
  // Resolving the path is a rule's job.
  skeleton: v.nodePath('skeleton'),
  texture_offset: v.vector2('texture_offset'),
  texture_scale: v.vector2('texture_scale'),
  texture_rotation: v.float('texture_rotation'),
  uv: v.packedVector2Array('uv'),
  // polygon_2d.cpp:719 (PACKED_COLOR_ARRAY, no hint). get_vertex_colors
  // (polygon_2d.cpp:458-460) returns `Vector<Color>` directly: same shape as
  // `polygon`. set_vertex_colors (polygon_2d.cpp:453-456) is a bare
  // assignment: format-only.
  vertex_colors: v.packedColorArray('vertex_colors'),
});

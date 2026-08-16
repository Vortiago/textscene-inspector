/**
 * Polygon2D strict validators for linting. Validates the Polygon2D-specific
 * surface (fill color, offset, texture, antialiasing, invert, texture
 * transform, the outline/skinning arrays); the Node2D transform/modulate base
 * props stay lenient like the other 2D slices.
 */

// The base chain. Registration happens on import, so a test that loads only
// this slice resolves an inherited key ONLY if the ancestor is pulled in too;
// without this line just the full barrel ever registers it.
import '../../base/node2d/linterParser.js';
import { validatorRegistry } from '../../../linter/ValidatorRegistry.js';
import { accepts, propertyError, shape, v } from '../../../linter/validators/index.js';
import type { PropertyValidator } from '../../../linter/ValidatorRegistry.js';
import { dropTrailingComma, splitTopLevel } from '../../../godot/index.js';
import { markIntSlot } from '../../../linter/validators/intSlot.js';
import { badIntElement } from '../../../linter/validators/v/packedArrays.js';

const BRACKET_ARRAY_RE = /^\s*\[([\s\S]*)\]\s*$/;
const PACKED_INT32_ELEMENT_RE = /^PackedInt32Array\s*\(([\s\S]*)\)$/;
const BARE_INT_ARRAY_ELEMENT_RE = /^\[([\s\S]*)\]$/;

/**
 * `polygons`: an Array of PackedInt32Array index lists (polygon_2d.cpp:720,
 * ARRAY + PROPERTY_HINT_TYPE_STRING "PackedInt32Array"). The `polygons` member
 * is a plain, untyped `Array` (polygon_2d.h:44 — nothing ever calls
 * `set_typed()` on it), so the `array.is_typed()` guard
 * (variant_parser.cpp:2341) is false and the serialiser skips its typed
 * `Array[…](` prefix entirely, falling to the untyped bracket write at
 * :2378-2390: a bare `[…]`, never `Array[PackedInt32Array](…)`. Every
 * witnessed value
 * (scenes/demos/2d/skeleton/player/player.tscn,
 * scenes/fixtures/unit-2d-geometry-parity.tscn) matches
 * `[PackedInt32Array(0, 1, 2, 3), …]`. set_polygons (polygon_2d.cpp:435-438)
 * is a bare assignment: format-only.
 *
 * Each ELEMENT also loads a second way: `_draw` reads it back as
 * `Vector<int> src_indices = polygons[i];` (polygon_2d.cpp:328), an implicit
 * `Variant -> PackedInt32Array` cast. `Variant::can_convert_strict` lists
 * `ARRAY` as a valid source for `PACKED_INT32_ARRAY` (variant.cpp's
 * `can_convert`/`can_convert_strict` tables both carry the pair), and the
 * actual conversion (`_convert_array_from_variant`, variant.cpp:2092-2130)
 * copies each element through `Variant::operator int()` faithfully — unlike a
 * flat float list miscast to Vector2 pairs, an int element converts to itself,
 * so a bare `[0, 1, 2]` element is not a degenerate spelling but a genuinely
 * equivalent one. Both element forms are accepted here.
 */
function polygonsValidator(): PropertyValidator {
  const code = 'INVALID_POLYGONS_FORMAT';
  // `shape` first for the `accepts` tag, then `markIntSlot`: the index lists are
  // an INT slot, so this rejects a literal Godot's own tokenizer reads.
  return markIntSlot(shape((key, value, line) => {
    const wrapper = BRACKET_ARRAY_RE.exec(value);
    if (!wrapper) {
      return propertyError(
        key,
        line,
        `Property 'polygons' must be an Array of PackedInt32Array(…) index lists like [PackedInt32Array(0, 1, 2)], got: "${value}"`,
        code
      );
    }
    const body = wrapper[1]!.trim();
    if (body === '') return null;
    for (const entry of dropTrailingComma(splitTopLevel(body))) {
      // `PackedInt32Array(…)` is a CONSTRUCTOR call: `_parse_construct`
      // (variant_parser.cpp:552-596) demands a value right after each comma it
      // consumes (:562-565 falls through to :571's unconditional `get_token`,
      // never re-checking for the closing paren), so a trailing comma there is
      // a parse error, unlike the bracket-array literal it sits inside. Bare
      // `[…]` IS that bracket grammar, so only ITS inner list gets the same
      // trailing-comma tolerance as the outer one.
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
      const indices = bare ? dropTrailingComma(inner.split(',')) : inner.split(',');
      // One pass: unreadable by the tokenizer, or read and then narrowed
      // away (_parse_construct<int32_t>, variant_parser.cpp:1428-1430).
      const bad = badIntElement('polygons', key, line, indices, {
          format: code,
          value: 'INVALID_POLYGONS_VALUE',
      });
      if (bad !== null) return bad;
    }
    return null;
  }, 'Array of PackedInt32Array(i0, i1, …) or bare [i0, i1, …] index lists'));
}

/**
 * `bones`: PROPERTY_USAGE_NO_EDITOR | PROPERTY_USAGE_INTERNAL, but that macro
 * is `PROPERTY_USAGE_STORAGE` alone (object.h:132) — no EDITOR bit, STORAGE
 * still set — so it does reach a `.tscn`
 * (scenes/demos/2d/skeleton/player/player.tscn witnesses it). `_get_bones`
 * (polygon_2d.cpp:577-584) builds a fresh untyped `Array`, alternating a
 * bone-path String and a PackedFloat32Array of weights per bone — untyped for
 * the same reason `polygons` is, so a bare `[…]`. `_set_bones`
 * (polygon_2d.cpp:588-595) opens with `ERR_FAIL_COND(p_bones.size() & 1)`,
 * which drops the entire write on an odd element count: enforced. The
 * per-element String/PackedFloat32Array alternation is NOT itself checked by
 * the setter — `NodePath(p_bones[i])` and the Variant->Vector<float> cast on
 * `p_bones[i + 1]` both degrade silently rather than ERR_FAIL — so this format
 * check stops at bracket shape and element count, the same scope GridMap's
 * `data` validator (nodes/3d/gridmap/linterParser.ts) uses for its own
 * count-multiple bound without validating each triple's element type either.
 */
function bonesValidator(): PropertyValidator {
  const validator = accepts((key, value, line) => {
    const wrapper = BRACKET_ARRAY_RE.exec(value);
    if (!wrapper) {
      return propertyError(
        key,
        line,
        `Property 'bones' must be an Array literal like ["Bone/Path", PackedFloat32Array(…), …], got: "${value}"`,
        'INVALID_BONES_FORMAT'
      );
    }
    const body = wrapper[1]!.trim();
    const count = body === '' ? 0 : dropTrailingComma(splitTopLevel(body)).length;
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
  // (polygon_2d.cpp:414-416) returns `Vector<Vector2>` directly — the packed
  // type itself, not a TypedArray getter — so `PackedVector2Array(...)` is the
  // only spelling. set_polygon (polygon_2d.cpp:408-412) is a bare assignment:
  // format-only.
  polygon: v.packedVector2Array('polygon'),
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
  // polygon_2d.cpp:722 hints "0,1000" hard both ends (no or_greater);
  // set_internal_vertex_count (polygon_2d.cpp:418-420) assigns unconditionally,
  // no ERR_FAIL/clamp — a warning, not an error (ADR-0032).
  internal_vertex_count: v.int('internal_vertex_count', {
    min: 0,
    max: 1000,
    hinted: 'polygon_2d.cpp:722',
  }),
  bones: bonesValidator(),
  // polygon_2d.cpp:710, NODE_PATH + NODE_PATH_VALID_TYPES "Skeleton2D".
  // set_skeleton (polygon_2d.cpp:597-602) has an early equality return, then a
  // bare assignment — no value to ground; resolving the path is a rule's job,
  // not this format validator's.
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

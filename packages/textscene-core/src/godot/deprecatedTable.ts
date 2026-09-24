/**
 * The alias table behind `deprecated.ts`, keyed by the declaring type, and the chain walk that
 * finds a row from a descendant. It comes from every `::_set` body in `scene/`, found by either
 * `p_name == "…"` spelling. A missing row leaves a key unvalidated, never a false positive, and
 * no test may read the engine (`godot-source-decoupling`), so this list is the claim.
 */

import { literalText } from './string.js';
import { TSCN_FLOAT_RE } from './number.js';
import { CLASS_BASE_TYPES } from './classBaseTypes.js';
import { MAX_BASE_CHAIN_HOPS } from './nodeBaseTypes.js';
import { indexedKeyRegex } from './indexedKey.js';
import { doubledVector, isTruthy } from './deprecatedTransforms.js';

/**
 * One deprecated `_set` arm that forwards one key to one setter. A bare string is a pure rename.
 * The object form adds the arm's value test (`applies`, absent when every value forwards) and the
 * value the setter receives (`transform`, absent when the literal passes through).
 */
export type AliasRow =
  | string
  | {
      readonly to: string;
      readonly applies?: (raw: string) => boolean;
      readonly transform?: (raw: string) => string;
    };

/** `set_size((Vector3)p_value * 2)`: the Godot-3 half-extents, doubled. */
const HALF_EXTENTS_3D: AliasRow = { to: 'size', transform: doubledVector('Vector3') };
/** `set_size((Size2)p_value * 2)`, the 2D twin. */
const HALF_EXTENTS_2D: AliasRow = { to: 'size', transform: doubledVector('Vector2') };
/** `(expand || ignore_texture_size) && bool(p_value)` → `EXPAND_IGNORE_SIZE`. */
const EXPAND_IGNORE_SIZE: AliasRow = { to: 'expand_mode', applies: isTruthy, transform: () => '1' };
/** `use_in_baked_light && bool(p_value)` → `GI_MODE_STATIC`; `use_dynamic_gi` → `GI_MODE_DYNAMIC`. */
const giMode = (mode: '1' | '2'): AliasRow => ({ to: 'gi_mode', applies: isTruthy, transform: () => mode });

/**
 * `Type.deprecated` to the property the setter writes. A `Map` of `Map`s, not object literals:
 * both keys come from a `.tscn`, and a plain object answers `constructor`, `__proto__` or
 * `toString` from its prototype with a function where a string is promised.
 */
const DEPRECATED_PROPERTY_NAMES = toLookup({
  // set_sprite_frames, both dimensions.
  AnimatedSprite2D: { frames: 'sprite_frames' }, // animated_sprite_2d.cpp:617
  AnimatedSprite3D: { frames: 'sprite_frames' }, // sprite_3d.cpp:1495
  // set_horizontal_alignment / set_vertical_alignment.
  Label: { align: 'horizontal_alignment', valign: 'vertical_alignment' }, // label.cpp:1002-1007
  // `_set` is `p_name == "bbcode_text" && !((String)p_value).is_empty()`, so an
  // empty bbcode_text is refused and must not clear `text`.
  RichTextLabel: {
    bbcode_text: { to: 'text', applies: (raw) => literalText(raw) !== '' }, // rich_text_label.cpp:7563
  },
  // `_set` is `p_name == "mode" && p_value.is_num()`: only an INT or FLOAT
  // variant forwards, so a quoted or boolean mode is dropped, not converted.
  PointLight2D: {
    mode: { to: 'blend_mode', applies: isNumericLiteral }, // light_2d.cpp:456-458
  },
  // The Godot-3 navigation vocabulary, renamed wholesale in 4.0. Every one of
  // these passes `p_value` through untouched.
  NavigationRegion2D: { navpoly: 'navigation_polygon' }, // navigation_region_2d.cpp:361
  NavigationRegion3D: { navmesh: 'navigation_mesh' }, // navigation_region_3d.cpp:312
  NavigationLink2D: {
    start_location: 'start_position', // navigation_link_2d.cpp:84
    end_location: 'end_position', // navigation_link_2d.cpp:88
  },
  NavigationLink3D: {
    start_location: 'start_position', // navigation_link_3d.cpp:223
    end_location: 'end_position', // navigation_link_3d.cpp:227
  },
  NavigationAgent2D: {
    target_location: 'target_position', // navigation_agent_2d.cpp:206
    time_horizon: 'time_horizon_agents', // navigation_agent_2d.cpp:202
  },
  NavigationAgent3D: {
    target_location: 'target_position', // navigation_agent_3d.cpp:217
    time_horizon: 'time_horizon_agents', // navigation_agent_3d.cpp:213
    agent_height_offset: 'path_height_offset', // navigation_agent_3d.cpp:221
  },
  // The Godot-3 half-extents family, keyed by the declaring type: `extents` on
  // any other type is not an alias and stays unknown.
  BoxShape3D: { extents: HALF_EXTENTS_3D }, // box_shape_3d.cpp:81-83
  RectangleShape2D: { extents: HALF_EXTENTS_2D }, // rectangle_shape_2d.cpp:42-44
  Decal: { extents: HALF_EXTENTS_3D }, // decal.cpp:274-276
  ReflectionProbe: { extents: HALF_EXTENTS_3D }, // reflection_probe.cpp:288-290
  FogVolume: { extents: HALF_EXTENTS_3D }, // fog_volume.cpp:60-62
  VoxelGI: { extents: HALF_EXTENTS_3D }, // voxel_gi.cpp:241-243
  GPUParticlesCollisionBox3D: { extents: HALF_EXTENTS_3D }, // gpu_particles_collision_3d.cpp:106-108
  GPUParticlesCollisionSDF3D: { extents: HALF_EXTENTS_3D }, // gpu_particles_collision_3d.cpp:571-573
  GPUParticlesCollisionHeightField3D: { extents: HALF_EXTENTS_3D }, // gpu_particles_collision_3d.cpp:753-755
  GPUParticlesAttractorBox3D: { extents: HALF_EXTENTS_3D }, // gpu_particles_collision_3d.cpp:957-959
  GPUParticlesAttractorVectorField3D: { extents: HALF_EXTENTS_3D }, // gpu_particles_collision_3d.cpp:1009-1011
  // `Bone2D::_set` forwards this bare alias to set_length outside any
  // DISABLE_DEPRECATED guard; the same one-field rule applies.
  Bone2D: { default_length: 'length' }, // skeleton_2d.cpp:48-49
  // set_rendering_quadrant_size, value untouched.
  TileMap: { cell_quadrant_size: 'rendering_quadrant_size' }, // tile_map.cpp:695-697
  TextureRect: { expand: EXPAND_IGNORE_SIZE, ignore_texture_size: EXPAND_IGNORE_SIZE }, // texture_rect.cpp:171-173
  // Declared on the base, so every GeometryInstance3D descendant carries it.
  GeometryInstance3D: { use_in_baked_light: giMode('1'), use_dynamic_gi: giMode('2') }, // visual_instance_3d.cpp:323-330

  // `deprecatedTable.md` lists the deprecated spellings with no row here, and why.
});

/**
 * Deprecated leaves under an indexed key family. `TileSetAtlasSource::_set` splits `x:y/alt/leaf`
 * and forwards the leaf to `TileData::set` (`tile_set.cpp:4812`), whose own `_set` renames
 * `texture_offset` (`:6702-6704`). The index gate is the source's, `is_valid_int`.
 */
const DEPRECATED_INDEXED_LEAVES = new Map<string, readonly { pattern: RegExp; leaf: string; to: string }[]>([
  [
    'TileSetAtlasSource',
    [{ pattern: indexedKeyRegex('^(#):(#)/(#)/texture_offset$', 'is_valid_int'), leaf: 'texture_offset', to: 'texture_origin' }],
  ],
]);

/**
 * Whether a value is the INT or FLOAT variant `Variant::is_num()` accepts: a quoted `"1"` or a
 * `true` does not forward. The tokenizer's grammar, not `is_valid_int`: only `-` precedes the
 * digit test (`variant_parser.cpp:420-424`), so `+5` fails the file's load.
 */
function isNumericLiteral(raw: string): boolean {
  return TSCN_FLOAT_RE.test(raw.trim());
}

/** Nested plain literals to nested Maps, so no lookup can reach a prototype. */
function toLookup(table: Record<string, Record<string, AliasRow>>): Map<string, Map<string, AliasRow>> {
  return new Map(Object.entries(table).map(([type, keys]) => [type, new Map(Object.entries(keys))]));
}

/** The row `key` matches on `type` itself: the flat table first, then the indexed leaves. */
function ownRow(type: string, key: string): AliasRow | undefined {
  const flat = DEPRECATED_PROPERTY_NAMES.get(type)?.get(key);
  if (flat !== undefined) return flat;
  const leaf = DEPRECATED_INDEXED_LEAVES.get(type)?.find((row) => row.pattern.test(key));
  return leaf && { to: key.slice(0, -leaf.leaf.length) + leaf.to };
}

/** The row `key` matches on `nodeType` or any catalogued ancestor, nearest first. */
export function findRow(nodeType: string | undefined, key: string): AliasRow | undefined {
  let current = nodeType;
  for (let hops = 0; current !== undefined && hops < MAX_BASE_CHAIN_HOPS; hops++) {
    const row = ownRow(current, key);
    if (row !== undefined) return row;
    current = Object.hasOwn(CLASS_BASE_TYPES, current) ? CLASS_BASE_TYPES[current] : undefined;
  }
  return undefined;
}

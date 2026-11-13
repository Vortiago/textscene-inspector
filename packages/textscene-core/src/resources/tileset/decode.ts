/**
 * The TileSet slice's decode (ADR-0031): a TileSet's grid and an atlas source's properties to the
 * `TileSetModel`, for the kinds of `kind.ts`. Lenient: silent on absent properties, warn-then-skip
 * on malformed ones, never throws.
 */

import { warn } from '../../logger';
import { indexedKeyRegex } from '../../godot/classdb/indexedKey.js';
import { slotInt } from '../../godot/variant/intSlots.js';
import { boolSlotValue } from '../../godot/variant/variantBool.js';
import { stringToInt } from '../../godot/string/string.js';
import { intOr, vec2iOr } from '../../parser/valueParsers';
import { parseColorOrUndefined } from '../../utils/colorParser';
import { CANVAS_ITEM_MATERIAL } from '../materials/canvasitemmaterial/kind';
import type { Follow, Read } from '../reading';
import { TEXTURE_2D } from '../textures/texture2d/kind';
import { texture2DSizeAtLoad } from '../textures/texture2d/sizeAtLoad';
import { defaultTileData } from './types';
import { TileLayout, TileOffsetAxis, TileShape } from '../../godot/scene/tileSet';
import type { AlternativeTileModel, AtlasSourceModel, AtlasTileModel, TileGrid, TileMaterial } from './types';
import type { Rgba } from '../../godot/math/math.js';
import type { Vector2 } from '../../godot/math/vector.js';
import type { EnumValue } from '../../godot/classdb/enumNames.js';

/** The grid of a TileSet from its properties. */
export function decodeTileGrid(properties: Readonly<Record<string, string>>): TileGrid {
  const shape = intEnumOr(properties.tile_shape, TileShape.TILE_SHAPE_SQUARE, 'tile_shape');
  if (shape < TileShape.TILE_SHAPE_SQUARE || shape > TileShape.TILE_SHAPE_HEXAGON) {
    warn(`[TileSet] unknown tile_shape ${shape}: cells place on a square grid`);
  }

  // `set_tile_layout` and `set_tile_offset_axis` store any int (`tile_set.cpp:368-371`, `:376-379`).
  return {
    shape,
    layout: intEnumOr(properties.tile_layout, TileLayout.TILE_LAYOUT_STACKED, 'tile_layout') as EnumValue<
      typeof TileLayout
    >,
    offsetAxis: intEnumOr(
      properties.tile_offset_axis,
      TileOffsetAxis.TILE_OFFSET_AXIS_HORIZONTAL,
      'tile_offset_axis'
    ) as EnumValue<typeof TileOffsetAxis>,
    tileSize: tileSetVec2i(properties.tile_size, { x: 16, y: 16 }, 'tile_size'),
  };
}

function intEnumOr(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined) return fallback;
  const n = slotInt(value);
  if (n === null) {
    warn(`[TileSet] invalid ${label} "${value}", using the default`);
    return fallback;
  }
  return n;
}

/** A tile's `material` reference to its material, or null for none. */
type TileMaterialResolver = (ref: string) => TileMaterial | null;

/** A material Godot loads that is no CanvasItemMaterial, or that it cannot load: plain canvas blending. */
const PLAIN_MATERIAL: TileMaterial = { properties: null };

/**
 * The material a tile's `material` names. The reading module keeps one answer for each resource, so
 * tiles that name one resource share one object, as Godot's loader hands both one `Ref`
 * (`resource_format_text.cpp:113-114`, `:142-144`). A reference that names nothing loads as null.
 */
function tileMaterialResolver(follow: Follow): TileMaterialResolver {
  return (ref) => materialOf(follow.read(CANVAS_ITEM_MATERIAL, ref), ref);
}

function materialOf(read: Read<TileMaterial>, ref: string): TileMaterial | null {
  if (read.status === 'loaded') return read.value;
  if (read.status === 'none' || read.status === 'pending') return null;
  if (read.reason === 'unknown-id') {
    warn(`[TileSet] material ${ref} names nothing, no material`);
    return null;
  }
  return PLAIN_MATERIAL;
}

/** A `TileSetAtlasSource` from its properties. Its texture and materials resolve in its own file. */
export function decodeAtlasSource(
  properties: Readonly<Record<string, string>>,
  follow: Follow
): AtlasSourceModel {
  const hasRoom = hasRoomAtLoad(properties.texture, follow);
  return {
    texture: properties.texture ? follow.reference(properties.texture) : null,
    margins: tileSetVec2i(properties.margins, { x: 0, y: 0 }, 'margins'),
    separation: tileSetVec2i(properties.separation, { x: 0, y: 0 }, 'separation'),
    textureRegionSize: tileSetVec2i(properties.texture_region_size, { x: 16, y: 16 }, 'texture_region_size'),
    // On unless the file says `false` (`tile_set.h:673`).
    usesTexturePadding: boolSlotValue(properties.use_texture_padding) !== false,
    tiles: hasRoom ? resolveTiles(properties, tileMaterialResolver(follow)) : new Map(),
  };
}

/**
 * Whether the atlas texture reports an area as the TileSet loads. `create_tile` needs room in the
 * atlas grid of the texture's size (`tile_set.cpp:4985`, `:5200-5211`), and a texture saved in its
 * own file is sized from that file, so the source waits for it.
 */
function hasRoomAtLoad(textureRef: string | undefined, follow: Follow): boolean {
  if (!textureRef) return true;
  const texture = follow.read(TEXTURE_2D, textureRef).value;
  const size = texture && texture2DSizeAtLoad(texture);
  return size === null || (size.x > 0 && size.y > 0);
}

/**
 * Per-tile keys: `x:y/size_in_atlas`, `x:y/<altId>` (0 = base) and
 * `x:y/<altId>/prop`. Others are ignored. `TileSetAtlasSource::_set` splits the
 * coordinate on `:` and gates each half on `is_valid_int()` (tile_set.cpp:4754),
 * which skips one leading sign (ustring.cpp:4752).
 */
const TILE_KEY_RE = indexedKeyRegex('^(#):(#)/(.+)$', 'is_valid_int');

/**
 * The alternative id below a tile coordinate, gated on `components[1]`'s
 * `is_valid_int()` (tile_set.cpp:4797). Matched after the fixed leaf names, so
 * `size_in_atlas` and `animation_frame_0/duration` never reach it.
 */
const ALT_KEY_RE = indexedKeyRegex('^(#)(?:/(.+))?$', 'is_valid_int');

/** One property as written: its full key, which a warning names, and its value. */
interface WrittenProperty {
  key: string;
  value: string;
}

/** A tile's keys, gathered before the decode. */
interface WrittenTile {
  sizeInAtlas?: WrittenProperty;
  /** Each alternative's `TileData` keys by leaf name. A bare `x:y/<altId>` key adds no leaf. */
  alternatives: Map<number, Map<string, WrittenProperty>>;
}

function resolveTiles(
  props: Readonly<Record<string, string>>,
  tileMaterial: TileMaterialResolver
): Map<string, AtlasTileModel> {
  const tiles = new Map<string, AtlasTileModel>();
  for (const [coords, written] of writtenTiles(props)) {
    const alternatives = new Map<number, AlternativeTileModel>();
    for (const [altId, data] of written.alternatives) {
      alternatives.set(altId, decodeTileData(data, altId, tileMaterial));
    }
    const sizeInAtlas = written.sizeInAtlas;
    tiles.set(coords, {
      sizeInAtlas: sizeInAtlas
        ? tileSetVec2i(sizeInAtlas.value, { x: 1, y: 1 }, sizeInAtlas.key)
        : { x: 1, y: 1 },
      alternatives,
    });
  }
  return tiles;
}

/** The per-tile keys of an atlas source, by tile, the last spelling of a key winning as in `_set`. */
function writtenTiles(props: Readonly<Record<string, string>>): Map<string, WrittenTile> {
  const tiles = new Map<string, WrittenTile>();
  const tileAt = (x: string, y: string): WrittenTile => {
    // `Vector2i(coords_split[0].to_int(), coords_split[1].to_int())` (tile_set.cpp:4755) takes
    // each half into an `int32_t`.
    const coords = `${stringToInt(x)}:${stringToInt(y)}`;
    let tile = tiles.get(coords);
    if (!tile) {
      // `create_tile` makes the base tile with the tile (tile_set.cpp:4991).
      tile = { alternatives: new Map([[0, new Map()]]) };
      tiles.set(coords, tile);
    }
    return tile;
  };

  for (const [key, value] of Object.entries(props)) {
    const m = TILE_KEY_RE.exec(key);
    if (!m) continue;
    const tile = tileAt(m[1]!, m[2]!);
    const rest = m[3]!;
    if (rest === 'size_in_atlas') {
      tile.sizeInAtlas = { key, value };
      continue;
    }

    const alt = ALT_KEY_RE.exec(rest);
    if (!alt) continue;
    // `int alternative_id = components[1].to_int()` (tile_set.cpp:4798).
    const altId = stringToInt(alt[1]!);
    // -1 is `INVALID_TILE_ALTERNATIVE`, which `_set` refuses (tile_set.cpp:4799).
    // Below that, `create_alternative_tile` re-seats at `next_alternative_id`.
    // Neither names an alternative a cell can address.
    if (altId < 0) continue;
    let data = tile.alternatives.get(altId);
    if (!data) tile.alternatives.set(altId, (data = new Map()));
    if (alt[2] !== undefined) data.set(alt[2], { key, value });
  }
  return tiles;
}

/** One alternative's `TileData` from its written leaves, at `TileData`'s defaults where none is written. */
function decodeTileData(
  data: ReadonlyMap<string, WrittenProperty>,
  altId: number,
  tileMaterial: TileMaterialResolver
): AlternativeTileModel {
  const defaults = defaultTileData();
  const read = <T>(leaf: string, fallback: T, decode: (written: WrittenProperty) => T): T => {
    const written = data.get(leaf);
    return written ? decode(written) : fallback;
  };
  // Only an alternative tile allows a transform (tile_set.cpp:4807): the base tile's setters
  // refuse one (:6192, :6201, :6211).
  const transform = (leaf: string) =>
    altId > 0 && read(leaf, false, ({ value }) => boolSlotValue(value) === true);
  return {
    flipH: transform('flip_h'),
    flipV: transform('flip_v'),
    transpose: transform('transpose'),
    textureOrigin: read('texture_origin', defaults.textureOrigin, ({ key, value }) =>
      tileSetVec2i(value, defaults.textureOrigin, key)
    ),
    modulate: read('modulate', defaults.modulate, ({ key, value }) => tileModulate(value, key)),
    material: read('material', defaults.material, ({ value }) => tileMaterial(value)),
    zIndex: read('z_index', defaults.zIndex, ({ key, value }) =>
      intOr(value, defaults.zIndex, `[TileSet] ${key}`)
    ),
    ySortOrigin: read('y_sort_origin', defaults.ySortOrigin, ({ key, value }) =>
      intOr(value, defaults.ySortOrigin, `[TileSet] ${key}`)
    ),
  };
}

function tileModulate(value: string, key: string): Rgba {
  const color = parseColorOrUndefined(value);
  if (color) return color;
  warn(`[TileSet] ${key}: invalid Color "${value}", using white`);
  return defaultTileData().modulate;
}

function tileSetVec2i(value: string | undefined, fallback: Vector2, key: string): Vector2 {
  return vec2iOr(value, fallback, `[TileSet] ${key}`);
}

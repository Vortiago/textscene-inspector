/**
 * The TileSet slice's decode (ADR-0031): a TileSet's properties to the
 * `TileSetModel`. `tileSetFromScene` and `tileSetFromFile` differ only in which
 * tables resolve a reference, and the decode never forks. Lenient: silent on
 * absent properties, warn-then-skip on malformed ones, never throws.
 */

import { inlineViewportTexture } from '../textures/viewporttexture/localToScene.js';
import { warn } from '../../logger';
import { indexedKeyRegex } from '../../godot/classdb/indexedKey.js';
import { slotInt } from '../../godot/variant/intSlots.js';
import { boolSlotValue } from '../../godot/variant/variantBool.js';
import { stringToInt } from '../../godot/string/string.js';
import type { ParsedResource } from '../../parser/parsedResource';
import { fileResources, findSectionResource } from '../resourceSection';
import { intOr, vec2iOr } from '../../parser/valueParsers';
import { parseColorOrUndefined } from '../../utils/colorParser';
import { canvasItemMaterialOf } from '../materials/canvasitemmaterial/decode';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { findSubResource, parseResourceReference, resolveExtResourcePath } from '../SubResourceResolver';
import { defaultTileData } from './types';
import { TileLayout, TileOffsetAxis, TileShape } from '../../godot/scene/tileSet';
import type {
  AlternativeTileModel,
  AtlasSourceModel,
  AtlasTileModel,
  TileTexture,
  TileMaterial,
  TileSetModel,
} from './types';
import type { Rgba } from '../../godot/math/math.js';
import type { Vector2 } from '../../godot/math/vector.js';
import type { EnumValue } from '../../godot/classdb/enumNames.js';

/** Context-independent view of a TileSet resource and its surroundings. */
interface TileSetSourceData {
  /** The TileSet itself, whose `data` holds its properties as raw value strings. */
  tileSet: TscnInternalResource;
  /** The tables the TileSet's references resolve in. */
  externalResources: readonly TscnExternalResource[];
  internalResources: readonly TscnInternalResource[];
}

/**
 * `TileSet::_set` gates the source id on `components[1].is_valid_int()`
 * (tile_set.cpp:3961), which skips ONE leading sign (ustring.cpp:4752), so
 * `sources/+3` is source 3. The id is `to_int()` stored in an `int` (:3963).
 */
const SOURCE_KEY_RE = indexedKeyRegex('^sources/(#)$', 'is_valid_int');

function resolveTileSetModel(data: TileSetSourceData): TileSetModel {
  const sources = new Map<number, AtlasSourceModel>();
  const tileMaterial = tileMaterialResolver(data);

  // `sources/1`, `sources/01` and `sources/+1` are one source: `_set` drops the id
  // before re-adding (tile_set.cpp:3965-3968), so the last value wins, as `Map.set` does.
  for (const [key, value] of Object.entries(data.tileSet.data)) {
    const sourceMatch = SOURCE_KEY_RE.exec(key);
    if (!sourceMatch) continue;
    const sourceId = stringToInt(sourceMatch[1]!);
    // `add_source` re-seats -1 at the auto-assigned `next_source_id` (tile_set.cpp:481)
    // and refuses anything below (:479). The landing id depends on every other
    // source, so the source is dropped, not misplaced.
    if (sourceId < 0) {
      warn(`[TileSet] source ${key}: Godot re-assigns a negative source id — skipped`);
      continue;
    }

    const ref = parseResourceReference(value);
    const sub = ref?.type === 'SubResource' ? findSubResource(data.internalResources, ref.id) : undefined;
    if (!sub) {
      warn(`[TileSet] source ${key}: unresolvable reference "${value}" — skipped`);
      continue;
    }
    if (sub.type !== 'TileSetAtlasSource') {
      warn(`[TileSet] source ${key}: unsupported source type "${sub.type}" — skipped`);
      continue;
    }

    sources.set(sourceId, resolveAtlasSource(sub, data, tileMaterial));
  }

  const properties = data.tileSet.data;
  const shape = intEnumOr(properties.tile_shape, TileShape.TILE_SHAPE_SQUARE, 'tile_shape');
  if (shape < TileShape.TILE_SHAPE_SQUARE || shape > TileShape.TILE_SHAPE_HEXAGON) {
    warn(`[TileSet] unknown tile_shape ${shape} — cells will place on a square grid`);
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
    sources,
  };
}

function intEnumOr(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined) return fallback;
  const n = slotInt(value);
  if (n === null) {
    warn(`[TileSet] invalid ${label} "${value}" — using default`);
    return fallback;
  }
  return n;
}

/**
 * Adapter: the TileSet `path` addresses in its resource file, the file's `[resource]` or one of its
 * sub-resources, or null for another type.
 */
export function tileSetFromFile(parsed: ParsedResource, path: string): TileSetModel | null {
  const tileSet = findSectionResource(parsed, path);
  if (tileSet?.type !== 'TileSet') return null;
  return resolveTileSetModel({ tileSet, ...fileResources(parsed) });
}

/**
 * Adapter: a TileSet embedded in the scene as a SubResource, or null for an
 * unresolvable ref. `TileSetAtlasSource` stays internal: it arrives only nested.
 */
export function tileSetFromScene(
  tileSetRef: string,
  internalResources: readonly TscnInternalResource[],
  externalResources: readonly TscnExternalResource[]
): TileSetModel | null {
  const ref = parseResourceReference(tileSetRef);
  if (!ref || ref.type !== 'SubResource') return null;
  const tileSet = findSubResource(internalResources, ref.id);
  if (!tileSet || tileSet.type !== 'TileSet') return null;

  return resolveTileSetModel({
    tileSet,
    externalResources,
    internalResources,
  });
}

/** A tile's `material` reference to its material, or null for none. */
type TileMaterialResolver = (ref: string) => TileMaterial | null;

/**
 * One `TileMaterial` per resource the TileSet names, so two tiles share a material exactly when
 * Godot's loader hands both one `Ref` (`resource_format_text.cpp:113-114` for a SubResource, `:142-144`
 * through the resource cache for an ExtResource). A reference that names nothing loads as null.
 */
function tileMaterialResolver(data: TileSetSourceData): TileMaterialResolver {
  const byResource = new Map<string, TileMaterial | null>();
  return (ref) => {
    const parsed = parseResourceReference(ref);
    const key = parsed ? `${parsed.type}:${parsed.id}` : ref;
    if (!byResource.has(key)) byResource.set(key, loadTileMaterial(ref, parsed, data));
    return byResource.get(key)!;
  };
}

/**
 * A SubResource gives its properties, which are null for any material but a CanvasItemMaterial. An
 * external material gives its path, which the draw loads as a node's material is loaded.
 */
function loadTileMaterial(
  ref: string,
  parsed: ReturnType<typeof parseResourceReference>,
  data: TileSetSourceData
): TileMaterial | null {
  if (parsed?.type !== 'SubResource') {
    const path = resolveExtResourcePath(ref, data.externalResources);
    return path ? { path } : null;
  }
  const sub = findSubResource(data.internalResources, parsed.id);
  if (!sub) {
    warn(`[TileSet] material ${ref} names nothing — no material`);
    return null;
  }
  return { properties: canvasItemMaterialOf(sub) };
}

function resolveAtlasSource(
  atlasSource: TscnInternalResource,
  data: TileSetSourceData,
  tileMaterial: TileMaterialResolver
): AtlasSourceModel {
  const props = atlasSource.data;
  return {
    texture: props.texture ? tileTexture(props.texture, atlasSource, data) : null,
    margins: tileSetVec2i(props.margins, { x: 0, y: 0 }, 'margins'),
    separation: tileSetVec2i(props.separation, { x: 0, y: 0 }, 'separation'),
    textureRegionSize: tileSetVec2i(props.texture_region_size, { x: 16, y: 16 }, 'texture_region_size'),
    // On unless the file says `false` (`tile_set.h:673`).
    usesTexturePadding: boolSlotValue(props.use_texture_padding) !== false,
    tiles: isSizelessAtLoad(props.texture, data) ? new Map() : resolveTiles(props, tileMaterial),
  };
}

/**
 * Whether the atlas texture reports size 0 while the scene loads, as a ViewportTexture does
 * (`viewport.cpp:156-160`), so `create_tile` finds room for no tile (`tile_set.cpp:4985`, `:5209`).
 */
function isSizelessAtLoad(ref: string | undefined, data: TileSetSourceData): boolean {
  return inlineViewportTexture(ref, data.internalResources) !== undefined;
}

function tileTexture(ref: string, atlasSource: TscnInternalResource, data: TileSetSourceData): TileTexture {
  return {
    ref,
    externalResources: data.externalResources,
    internalResources: data.internalResources,
    holders: [data.tileSet, atlasSource],
  };
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
  props: Record<string, string>,
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
function writtenTiles(props: Record<string, string>): Map<string, WrittenTile> {
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
  warn(`[TileSet] ${key}: invalid Color "${value}" — using white`);
  return defaultTileData().modulate;
}

function tileSetVec2i(value: string | undefined, fallback: Vector2, key: string): Vector2 {
  return vec2iOr(value, fallback, `[TileSet] ${key}`);
}

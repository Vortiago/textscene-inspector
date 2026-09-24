/**
 * The TileSet slice's decode (ADR-0031): a TileSet's properties to the
 * `TileSetModel`. `tileSetFromScene` and `tileSetFromTres` differ only in which
 * tables resolve a reference, and the decode never forks. Lenient: silent on
 * absent properties, warn-then-skip on malformed ones, never throws.
 */

import { warn } from '../../logger';
import { indexedKeyRegex, slotTupleRegex, ruleInt, storedInt, boolSlotValue} from '../../godot/index.js';
import { compositeTypeName, isConvertedSpelling } from '../../godot/variantConversion.js';
import type { ParsedResource } from '../../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { parseResourceReference, resolveExtResourcePath } from '../SubResourceResolver';
import { TILE_SHAPE_HEXAGON, TILE_SHAPE_SQUARE } from './types';
import type {
  AlternativeTileModel,
  AtlasSourceModel,
  AtlasTileModel,
  TileSetModel,
  Vec2i,
} from './types';

/** Context-independent view of a TileSet resource and its surroundings. */
export interface TileSetSourceData {
  /** The TileSet resource's own properties (raw value strings). */
  properties: Record<string, unknown>;
  findSubResource(id: string): TscnInternalResource | undefined;
  /** `ExtResource("id")` or a raw res:// path to a res:// path, or null. */
  resolveTexturePath(ref: string): string | null;
}

/**
 * `TileSet::_set` gates the source id on `components[1].is_valid_int()`
 * (tile_set.cpp:3961), which skips ONE leading sign (ustring.cpp:4752), so
 * `sources/+3` is source 3. `Number` is the reader the gate has already vetted.
 */
const SOURCE_KEY_RE = indexedKeyRegex('^sources/(#)$', 'is_valid_int');

export function resolveTileSetModel(data: TileSetSourceData): TileSetModel {
  const sources = new Map<number, AtlasSourceModel>();
  const sourceOrder: number[] = [];

  // `sources/1`, `sources/01` and `sources/+1` are one source: `_set` drops the id
  // before re-adding (tile_set.cpp:3965-3968), so the last value wins, as `Map.set`
  // does. The first-seen place is the previewer's batching order (see `types.ts`).
  const seat = (id: number, source: AtlasSourceModel): void => {
    if (!sources.has(id)) sourceOrder.push(id);
    sources.set(id, source);
  };

  for (const [key, value] of Object.entries(data.properties)) {
    const sourceMatch = SOURCE_KEY_RE.exec(key);
    if (!sourceMatch) continue;
    const sourceId = Number(sourceMatch[1]);
    // `add_source` re-seats -1 at the auto-assigned `next_source_id` (tile_set.cpp:481)
    // and refuses anything below (:479). The landing id depends on every other
    // source, so the source is dropped, not misplaced.
    if (sourceId < 0) {
      warn(`[TileSet] source ${key}: Godot re-assigns a negative source id — skipped`);
      continue;
    }

    const ref = typeof value === 'string' ? parseResourceReference(value) : null;
    const sub = ref?.type === 'SubResource' ? data.findSubResource(ref.id) : undefined;
    if (!sub) {
      warn(`[TileSet] source ${key}: unresolvable reference "${String(value)}" — skipped`);
      continue;
    }
    if (sub.type !== 'TileSetAtlasSource') {
      warn(`[TileSet] source ${key}: unsupported source type "${sub.type}" — skipped`);
      continue;
    }

    seat(sourceId, resolveAtlasSource(sub.data, data));
  }

  const shape = intEnumOr(data.properties.tile_shape, 0, 'tile_shape');
  if (shape < TILE_SHAPE_SQUARE || shape > TILE_SHAPE_HEXAGON) {
    warn(
      `[TileSet] unknown tile_shape ${shape} — cells will place on a square grid`
    );
  }

  return {
    shape,
    layout: intEnumOr(data.properties.tile_layout, 0, 'tile_layout') as TileSetModel['layout'],
    offsetAxis: intEnumOr(data.properties.tile_offset_axis, 0, 'tile_offset_axis') as
      | 0
      | 1,
    tileSize: vec2iOr(data.properties.tile_size, { x: 16, y: 16 }, 'tile_size'),
    sources,
    sourceOrder,
  };
}

function intEnumOr(value: unknown, fallback: number, label: string): number {
  if (value === undefined || value === null) return fallback;
  const n = typeof value === 'string' ? ruleInt(value) : null;
  if (n === null) {
    warn(`[TileSet] invalid ${label} "${String(value)}" — using default`);
    return fallback;
  }
  return n;
}

/** Adapter: a TileSet from an external .tres file, or null for another type. */
export function tileSetFromTres(parsed: ParsedResource): TileSetModel | null {
  if (parsed.resourceType !== 'TileSet') return null;
  return resolveTileSetModel({
    properties: parsed.properties,
    findSubResource: (id) => parsed.subResources.find((r) => r.id === id),
    resolveTexturePath: (texRef) => resolveExtResourcePath(texRef, parsed.extResources),
  });
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
  const tileSet = internalResources.find((r) => r.id === ref.id);
  if (!tileSet || tileSet.type !== 'TileSet') return null;

  return resolveTileSetModel({
    properties: tileSet.data,
    findSubResource: (id) => internalResources.find((r) => r.id === id),
    resolveTexturePath: (texRef) => resolveExtResourcePath(texRef, externalResources),
  });
}

function resolveAtlasSource(
  props: Record<string, unknown>,
  data: TileSetSourceData
): AtlasSourceModel {
  const textureRef = typeof props.texture === 'string' ? props.texture : null;
  return {
    texturePath: textureRef ? data.resolveTexturePath(textureRef) : null,
    margins: vec2iOr(props.margins, { x: 0, y: 0 }, 'margins'),
    separation: vec2iOr(props.separation, { x: 0, y: 0 }, 'separation'),
    textureRegionSize: vec2iOr(props.texture_region_size, { x: 16, y: 16 }, 'texture_region_size'),
    tiles: resolveTiles(props),
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

function resolveTiles(props: Record<string, unknown>): Map<string, AtlasTileModel> {
  const tiles = new Map<string, AtlasTileModel>();

  const tileAt = (x: string, y: string): AtlasTileModel => {
    const key = `${Number(x)}:${Number(y)}`;
    let tile = tiles.get(key);
    if (!tile) {
      tile = { sizeInAtlas: { x: 1, y: 1 }, alternatives: new Map() };
      tiles.set(key, tile);
    }
    return tile;
  };
  const alternativeAt = (tile: AtlasTileModel, altId: number): AlternativeTileModel => {
    let alt = tile.alternatives.get(altId);
    if (!alt) {
      alt = { flipH: false, flipV: false, transpose: false, textureOrigin: { x: 0, y: 0 } };
      tile.alternatives.set(altId, alt);
    }
    return alt;
  };

  for (const [key, value] of Object.entries(props)) {
    const m = TILE_KEY_RE.exec(key);
    if (!m) continue;
    const rest = m[3]!;

    if (rest === 'size_in_atlas') {
      tileAt(m[1]!, m[2]!).sizeInAtlas = vec2iOr(value, { x: 1, y: 1 }, key);
      continue;
    }

    const alt = ALT_KEY_RE.exec(rest);
    if (!alt) continue;
    const altId = Number(alt[1]);
    // -1 is `INVALID_TILE_ALTERNATIVE`, which `_set` refuses (tile_set.cpp:4799).
    // Below that, `create_alternative_tile` re-seats at `next_alternative_id`.
    // Neither names an alternative a cell can address.
    if (altId < 0) continue;
    const prop = alt[2];
    const alternative = alternativeAt(tileAt(m[1]!, m[2]!), altId);
    if (prop === 'flip_h') alternative.flipH = typeof value === 'string' && boolSlotValue(value) === true;
    else if (prop === 'flip_v') alternative.flipV = typeof value === 'string' && boolSlotValue(value) === true;
    else if (prop === 'transpose') alternative.transpose = typeof value === 'string' && boolSlotValue(value) === true;
    else if (prop === 'texture_origin')
      alternative.textureOrigin = vec2iOr(value, { x: 0, y: 0 }, key);
  }

  return tiles;
}

const VECTOR2I_RE = slotTupleRegex('Vector2i', 2);

function vec2iOr(value: unknown, fallback: Vec2i, label: string): Vec2i {
  if (value === undefined || value === null) return fallback;
  // A non-string never matches the grammar, so it falls into the warn branch.
  const literal = typeof value === 'string' ? value.trim() : '';
  const m = VECTOR2I_RE.exec(literal);
  if (!m) {
    warn(`[TileSet] invalid ${label} "${String(value)}" — using default`);
    return fallback;
  }
  // A `Vector2(...)` in a Vector2i slot holds doubles, so both components take
  // the `double -> int32` branch whatever the token looks like.
  const converted = isConvertedSpelling('Vector2i', compositeTypeName(literal));
  const x = storedInt(m[1], converted);
  const y = storedInt(m[2], converted);
  if (x === null || y === null) {
    warn(`[TileSet] ${label} "${String(value)}" has a component Godot cannot store — using default`);
    return fallback;
  }
  return { x, y };
}

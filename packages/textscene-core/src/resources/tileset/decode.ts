/**
 * The TileSet slice's decode (ADR-0031): properties of a TileSet resource in,
 * the normalized `TileSetModel` out. Pure and context-independent.
 *
 * ONE decode, two arrival adapters — `tileSetFromScene` (embedded in the scene
 * as a `[sub_resource]`) and `tileSetFromTres` (an external file's
 * **ParsedResource**) — differing only in which tables resolve a reference.
 * The decode may not fork between them.
 *
 * `TileSetAtlasSource` and its alternative tiles stay internal here: nothing in
 * the corpus declares one as an `ext_resource`, so they only ever arrive
 * nested inside a TileSet.
 *
 * Lenient contract: silent on absent properties, warn-then-skip on malformed
 * ones; never throws.
 */

import { warn } from '../../logger';
import { finiteTupleRegex, storedInt } from '../../parser/vectors';
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
  /** `ExtResource("id")` (or raw res:// path) → res:// path, or null. */
  resolveTexturePath(ref: string): string | null;
}

const SOURCE_KEY_RE = /^sources\/(\d+)$/;

export function resolveTileSetModel(data: TileSetSourceData): TileSetModel {
  const sources = new Map<number, AtlasSourceModel>();
  const sourceOrder: number[] = [];

  for (const [key, value] of Object.entries(data.properties)) {
    const sourceMatch = SOURCE_KEY_RE.exec(key);
    if (!sourceMatch) continue;
    const sourceId = parseInt(sourceMatch[1]!, 10);

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

    sources.set(sourceId, resolveAtlasSource(sub.data, data));
    sourceOrder.push(sourceId);
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
  const n = typeof value === 'string' ? parseInt(value.trim(), 10) : NaN;
  if (Number.isNaN(n)) {
    warn(`[TileSet] invalid ${label} "${String(value)}" — using default`);
    return fallback;
  }
  return n;
}

/** Adapter: a TileSet loaded from an external .tres file. Null = not a TileSet. */
export function tileSetFromTres(parsed: ParsedResource): TileSetModel | null {
  if (parsed.resourceType !== 'TileSet') return null;
  return resolveTileSetModel({
    properties: parsed.properties,
    findSubResource: (id) => parsed.subResources.find((r) => r.id === id),
    resolveTexturePath: (texRef) => resolveExtResourcePath(texRef, parsed.extResources),
  });
}

/** Adapter: a TileSet embedded in the scene as a SubResource. Null = ref unresolvable. */
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
 * Per-tile key grammar in a TileSetAtlasSource:
 *   `x:y/size_in_atlas` — per-tile (oversized tiles spanning several cells)
 *   `x:y/<altId>`       — declares an alternative tile (0 = base)
 *   `x:y/<altId>/prop`  — alternative properties (flip_h/flip_v/transpose/texture_origin)
 * Everything else (next_alternative_id, physics/custom-data layers, …) is ignored.
 */
const TILE_KEY_RE = /^(-?\d+):(-?\d+)\/(.+)$/;

function resolveTiles(props: Record<string, unknown>): Map<string, AtlasTileModel> {
  const tiles = new Map<string, AtlasTileModel>();

  const tileAt = (x: string, y: string): AtlasTileModel => {
    const key = `${parseInt(x, 10)}:${parseInt(y, 10)}`;
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

    const alt = /^(\d+)(?:\/(.+))?$/.exec(rest);
    if (!alt) continue;
    const altId = parseInt(alt[1]!, 10);
    const prop = alt[2];
    const alternative = alternativeAt(tileAt(m[1]!, m[2]!), altId);
    if (prop === 'flip_h') alternative.flipH = value === 'true';
    else if (prop === 'flip_v') alternative.flipV = value === 'true';
    else if (prop === 'transpose') alternative.transpose = value === 'true';
    else if (prop === 'texture_origin')
      alternative.textureOrigin = vec2iOr(value, { x: 0, y: 0 }, key);
  }

  return tiles;
}

const VECTOR2I_RE = finiteTupleRegex('Vector2i', 2);

function vec2iOr(value: unknown, fallback: Vec2i, label: string): Vec2i {
  if (value === undefined || value === null) return fallback;
  const m = typeof value === 'string' ? VECTOR2I_RE.exec(value.trim()) : null;
  if (!m) {
    warn(`[TileSet] invalid ${label} "${String(value)}" — using default`);
    return fallback;
  }
  return { x: storedInt(m[1]), y: storedInt(m[2]) };
}

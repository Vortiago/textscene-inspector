/**
 * TileSet resolver — turns a TileSet reference into the normalized
 * TileSetModel. The core is context-independent; thin adapters wire it to the
 * two places a TileSet lives: embedded in the scene (SubResource) or — later —
 * an external `.tres` file. Lenient contract: silent on absent properties,
 * warn-then-skip on malformed ones; never throws.
 */

import { warn } from '../../logger';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import { parseResourceReference, resolveExtResourcePath } from '../SubResourceResolver';
import type { AtlasSourceModel, TileSetModel, Vec2i } from './tileSetModel';

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

  return {
    shape: 0,
    layout: 0,
    offsetAxis: 0,
    tileSize: vec2iOr(data.properties.tile_size, { x: 16, y: 16 }, 'tile_size'),
    sources,
    sourceOrder,
  };
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
    tiles: new Map(),
  };
}

const VECTOR2I_RE = /^Vector2i\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\)$/;

function vec2iOr(value: unknown, fallback: Vec2i, label: string): Vec2i {
  if (value === undefined || value === null) return fallback;
  const m = typeof value === 'string' ? VECTOR2I_RE.exec(value.trim()) : null;
  if (!m) {
    warn(`[TileSet] invalid ${label} "${String(value)}" — using default`);
    return fallback;
  }
  return { x: parseInt(m[1]!, 10), y: parseInt(m[2]!, 10) };
}

/**
 * The normal and specular maps a CanvasTexture gives a textured canvas item. Godot samples them raw
 * with the item's sampler, at the diffuse texture's uv (`canvas.glsl:654,679`), so each takes the
 * same sampler and no window of its own: the item reads them through the diffuse map's uv.
 */

import { useLayoutEffect, useMemo } from 'react';
import type * as THREE from 'three';
import { useTexture2D } from '../resources/useTexture2D';
import type { CanvasTextureAtlas, CanvasTextureSlot, Texture2DResult } from '../resources/useTexture2D';
import { useAtlasTextureCrop } from '../resources/useAtlasTextureCrop';
import { atlasTextureOnSheet } from '../resources/textures/atlastexture/decode';
import type { AtlasTextureReference } from '../resources/textures/atlastexture/resolveAtlasTexture';
import { imageSize } from '../resources/formats/image/imagePixels';
import { canvasTextureSpecular } from '../resources/textures/canvastexture/decode';
import type { TscnInternalResource } from '../parser/types';
import { useRawCanvas2DTexture } from './canvas2DTextureDecode';
import type { CanvasItemTextureSampler } from './canvasItemTextureSampler';
import type { CanvasItemSurface } from './lighting2d/normalMappedLighting';

/**
 * Hands `onSurface` the maps of `slot`, and null while its normal map has not resolved or on unmount.
 * An item mounts it only while its CanvasTexture names a normal map, without which Godot shades none,
 * so an item without one runs none of the texture hooks.
 */
export function CanvasItemSurfaceSource({
  slot,
  sampler,
  onSurface,
}: {
  slot: CanvasTextureSlot;
  sampler: CanvasItemTextureSampler;
  onSurface: (surface: CanvasItemSurface | null) => void;
}) {
  const surface = useCanvasItemSurface(slot, sampler);
  useLayoutEffect(() => {
    onSurface(surface);
    return () => onSurface(null);
  }, [surface, onSurface]);
  return null;
}

function useCanvasItemSurface(
  slot: CanvasTextureSlot,
  sampler: CanvasItemTextureSampler
): CanvasItemSurface | null {
  const { texture, externalResources, internalResources } = slot;
  // Raw in either colour space: the canvas binds a normal and a specular map's own view
  // (`texture_storage.cpp:767,780`).
  const normal = useTexture2D(
    texture.normalTexture ?? undefined,
    externalResources,
    internalResources,
    'plain'
  );
  const specular = useTexture2D(
    texture.specularTexture ?? undefined,
    externalResources,
    internalResources,
    'plain'
  );
  const normalCell = useMapCell(unnested(normal), slot.atlas, internalResources);
  const specularCell = useMapCell(unnested(specular), slot.atlas, internalResources);
  const normalMap = useRawCanvas2DTexture(normalCell, sampler);
  const specularMap = useRawCanvas2DTexture(specularCell, sampler);
  return useMemo(
    () => (normalMap ? { normalMap, specularMap, specular: canvasTextureSpecular(texture) } : null),
    [normalMap, specularMap, texture]
  );
}

/** A map's texture, or null for a CanvasTexture, which each map setter refuses (`canvas_item.cpp:1801,1815`). */
function unnested(map: Texture2DResult): THREE.Texture | null {
  return map.canvasTexture ? null : map.texture;
}

/** `map`, or the cell of it that `atlas` cuts while an AtlasTexture draws a cell of the diffuse. */
function useMapCell(
  map: THREE.Texture | null,
  atlas: CanvasTextureAtlas | undefined,
  internalResources: readonly TscnInternalResource[]
): THREE.Texture | null {
  const mapSize = imageSize(map?.image);
  const mapWidth = mapSize?.width;
  const mapHeight = mapSize?.height;
  const reference = useMemo((): AtlasTextureReference | null => {
    if (!atlas || mapWidth === undefined || mapHeight === undefined) return null;
    const { reference: diffuse, sheetSize } = atlas;
    const texture = atlasTextureOnSheet(diffuse.texture, sheetSize, { width: mapWidth, height: mapHeight });
    return texture === diffuse.texture ? diffuse : { id: diffuse.id, texture };
  }, [atlas, mapWidth, mapHeight]);
  const cell = useAtlasTextureCrop(reference, map, internalResources);
  return atlas ? cell : map;
}

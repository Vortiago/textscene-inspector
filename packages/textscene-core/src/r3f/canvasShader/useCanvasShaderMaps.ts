import { useMemo } from 'react';
import type * as THREE from 'three';
import { DEFAULT_CANVAS_MAPS, type CanvasMaps } from '../../shaders/canvas/canvasTexture';
import { useTexture2D } from '../../resources/useTexture2D';
import type { CanvasItemTexture } from '../canvasItemTexture';
import { unnested } from '../canvasItemSurface';
import { topDownTexture } from '../../resources/textures/topDownTexture';

/** A CanvasTexture's whole maps, which the shader reads at the diffuse uv, or Godot's defaults. */
export function useCanvasShaderMaps(canvasTexture: CanvasItemTexture | undefined): CanvasMaps {
  const slot = canvasTexture?.slot;
  // Raw in either colour space: the batch binds a map's own view (`texture_storage.cpp:767, 780`).
  const normal = topDownOrNull(unnested(useTexture2D(slot?.normalTexture ?? null, 'plain')));
  const specular = topDownOrNull(unnested(useTexture2D(slot?.specularTexture ?? null, 'plain')));
  const texture = slot?.texture;
  return useMemo(() => {
    if (!texture) return DEFAULT_CANVAS_MAPS;
    const { specularColor, specularShininess } = texture;
    return { normal, specular, specularShininess: { ...specularColor, a: specularShininess } };
  }, [texture, normal, specular]);
}

const topDownOrNull = (texture: THREE.Texture | null) => texture && topDownTexture(texture);

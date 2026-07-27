/**
 * The hook side of `canvasItemLightingProps`.
 *
 * It owns ONE set of uniform objects per item for the item's whole life and
 * mutates their `.value` as the light state changes. That is not an
 * optimisation: three captures whatever `onBeforeCompile` assigns at first
 * compile, and R3F never bumps `material.needsUpdate` when the prop changes, so
 * a freshly-built uniform object would never reach the GPU. Replacing the
 * uniforms is exactly the bug that left every item on a stock shader once a
 * light appeared after mount.
 */

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import type { RGBA } from '../canvasItemModulate.js';
import {
  CanvasItemLightMode,
  type CanvasItemMaterialProperties,
} from '../../resources/materials/canvasitemmaterial/types.js';
import { useCanvasLighting2D } from './CanvasLighting2D.js';
import { canvasItemLightingProps, type CanvasItemLightingProps } from './canvasItemLighting.js';

export type { CanvasItemLightingProps };

/** Stand-in while a scene has no lights: contributes exactly nothing. */
function emptyLightBuffer(): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
  texture.colorSpace = THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export function useCanvasItemLighting(
  material: CanvasItemMaterialProperties | null,
  canvasModulate: RGBA
): CanvasItemLightingProps {
  const { buffer, resolution } = useCanvasLighting2D();
  const lightMode = material?.lightMode ?? CanvasItemLightMode.NORMAL;

  const fallback = useMemo(emptyLightBuffer, []);
  const uniforms = useRef({
    uLightBuffer: { value: fallback as THREE.Texture },
    uLightResolution: { value: new THREE.Vector2(1, 1) },
    uCanvasModulate: { value: new THREE.Vector3(1, 1, 1) },
  }).current;

  // Mutating in render keeps the GPU in step without a recompile; these are
  // plain value writes, so re-running them is harmless.
  uniforms.uLightBuffer.value = buffer ?? fallback;
  uniforms.uLightResolution.value.set(resolution.x, resolution.y);
  uniforms.uCanvasModulate.value.set(canvasModulate.r, canvasModulate.g, canvasModulate.b);

  return useMemo(
    () => canvasItemLightingProps({ uniforms, lightMode }),
    [uniforms, lightMode]
  );
}

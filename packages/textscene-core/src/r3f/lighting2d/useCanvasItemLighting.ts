/**
 * The hook side of `canvasItemLightingProps`: reads the accumulation buffer in
 * force and memoises the material props for one item.
 */

import { useMemo } from 'react';
import type { RGBA } from '../canvasItemModulate.js';
import {
  CanvasItemLightMode,
  type CanvasItemMaterialProperties,
} from '../../resources/materials/canvasitemmaterial/types.js';
import { useCanvasLighting2D } from './CanvasLighting2D.js';
import { canvasItemLightingProps, type CanvasItemLightingProps } from './canvasItemLighting.js';

export type { CanvasItemLightingProps };

export function useCanvasItemLighting(
  material: CanvasItemMaterialProperties | null,
  canvasModulate: RGBA
): CanvasItemLightingProps {
  const { buffer, resolution } = useCanvasLighting2D();
  const lightMode = material?.lightMode ?? CanvasItemLightMode.NORMAL;
  const { r, g, b } = canvasModulate;

  return useMemo(
    () =>
      canvasItemLightingProps({
        buffer,
        resolution,
        canvasModulate: { r, g, b },
        lightMode,
      }),
    [buffer, resolution, r, g, b, lightMode]
  );
}

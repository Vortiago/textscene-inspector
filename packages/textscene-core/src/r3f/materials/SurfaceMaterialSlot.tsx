/**
 * One surface's material, textures and all, or the magenta placeholder when a texture
 * never draws. Godot binds a material per surface, so texture resolution lives in a
 * component rendered once per surface, which keeps `useResource` one call per component
 * for any surface count.
 */

import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import type { TscnInternalResource } from '../../parser/types';
import { MISSING_TEXTURE_MATERIAL } from '../../resources/materials/standardmaterial3d/materialBag';
import { materialBagElement, StandardMaterialSlot } from './StandardMaterialSlot';
import { pointDrawOf, withPointDraw } from './godotPoint';
import type { MaterialSource } from './materialSource';
import { useSurfaceMaterial } from './useSurfaceMaterial';

interface SurfaceMaterialSlotProps {
  /** The material this surface renders with; undefined = the renderer's default. */
  source: MaterialSource | undefined;
  /** R3F attach key: `material` for a single surface, `material-N` for many (`surfaceAttach`). */
  attach?: string;
  /** The mesh sub-resource a triplanar material folds into its tiling, if any. */
  triplanarMesh?: TscnInternalResource;
  /** The surface draws `THREE.Points`, so its material also sizes each point. */
  drawsPoints?: boolean;
}

/**
 * One surface's material slot, textures and all, whichever file the material came from.
 * A surface with no usable material draws Godot's default one, which
 * `useSurfaceMaterial` derives from null scalars (ADR-0041). A surface whose texture
 * cannot load, or whose ViewportTexture albedo is cyclic, draws the magenta placeholder.
 */
export function SurfaceMaterialSlot({
  source,
  attach,
  triplanarMesh,
  drawsPoints,
}: SurfaceMaterialSlotProps) {
  const { scalars, bags } = useSurfaceMaterial(source, triplanarMesh);
  const pixelRatio = useThree((state) => state.viewport.dpr);
  const pointDraw = useMemo(
    () => (drawsPoints ? pointDrawOf(scalars, pixelRatio) : undefined),
    [drawsPoints, scalars, pixelRatio]
  );
  if (!bags) return materialBagElement(withPointDraw(MISSING_TEXTURE_MATERIAL, pointDraw), attach, null);
  return <StandardMaterialSlot bags={bags} attach={attach} pointDraw={pointDraw} />;
}

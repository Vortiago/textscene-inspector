/**
 * One surface's material, textures and all, or the magenta placeholder when a texture
 * never draws. Godot binds a material per surface, so texture resolution lives in a
 * component rendered once per surface, which keeps `useResource` one call per component
 * for any surface count.
 */

import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { MISSING_TEXTURE_MATERIAL } from '../../resources/materials/standardmaterial3d/materialBag';
import { drawnBag, materialBagElement, StandardMaterialSlot } from './StandardMaterialSlot';
import { pointDrawOf, type PointPlacement } from './godotPoint';
import { particleDrawOf } from './godotParticles';
import type { MaterialSource } from './materialSource';
import { useSurfaceMaterial } from './useSurfaceMaterial';

interface SurfaceMaterialSlotProps {
  /** The material this surface renders with; undefined = the renderer's default. */
  source: MaterialSource | undefined;
  /** R3F attach key: `material` for a single surface, `material-N` for many (`surfaceAttach`). */
  attach?: string;
  /** The surface draws `THREE.Points`, placed so, and its material also sizes each point. Undefined for triangles. */
  points?: PointPlacement;
  /** The surface draws a particle emitter's instances, which its material colours and billboards. */
  drawsParticles?: boolean;
}

/**
 * One surface's material slot, textures and all, whichever file the material came from.
 * A surface with no usable material draws Godot's default one, which
 * `useSurfaceMaterial` derives from null scalars (ADR-0041). A surface whose texture
 * never draws, a file that cannot load or a ViewportTexture in a pass cycle, draws the
 * magenta placeholder.
 */
export function SurfaceMaterialSlot({ source, attach, points, drawsParticles }: SurfaceMaterialSlotProps) {
  const { scalars, bags } = useSurfaceMaterial(source);
  const pixelRatio = useThree((state) => state.viewport.dpr);
  const pointDraw = useMemo(
    () => (points ? pointDrawOf(scalars, pixelRatio, points) : undefined),
    [points, scalars, pixelRatio]
  );
  const particleDraw = useMemo(
    () => (drawsParticles ? particleDrawOf(scalars) : undefined),
    [drawsParticles, scalars]
  );
  const draws = useMemo(() => ({ pointDraw, particleDraw }), [pointDraw, particleDraw]);
  if (!bags) return materialBagElement(drawnBag(MISSING_TEXTURE_MATERIAL, draws), attach, null);
  return <StandardMaterialSlot bags={bags} attach={attach} draws={draws} />;
}

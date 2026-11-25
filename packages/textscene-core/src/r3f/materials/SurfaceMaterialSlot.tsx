/**
 * One surface's material, textures and all, or the magenta placeholder when a texture
 * never draws. Godot binds a material per surface, so texture resolution lives in a
 * component rendered once per surface, which keeps `useResource` one call per component
 * for any surface count.
 */

import { useEffect, useMemo } from 'react';
import { MISSING_TEXTURE_MATERIAL } from '../../resources/materials/standardmaterial3d/materialBag';
import { drawnBag, materialBagElement, StandardMaterialSlot } from './StandardMaterialSlot';
import { pointDrawOf, type ListedSurface } from './godotPoint';
import { particleDrawOf, type ParticleProgram } from './godotParticles';
import type { ScopedReference } from '../../resources/reading';
import { useShadedSurfaceMaterial } from './useSurfaceMaterial';
import { SpatialShaderSlot } from '../spatialShader/SpatialShaderSlot';
import { warnUndrawnShader, type UndrawnShaderSurface } from './useMaterial';

interface SurfaceMaterialSlotProps {
  /** The material this surface renders with; undefined = the renderer's default. */
  source: ScopedReference | undefined;
  /** R3F attach key: `material` for a single surface, `material-N` for many (`surfaceAttach`). */
  attach?: string;
  /**
   * The surface draws points or line segments, placed so: its material also sizes each point, and
   * declares the instance matrix at instances. Undefined for triangles.
   */
  listed?: ListedSurface;
  /** The surface draws a particle emitter's instances: the patch that colours them and cuts the flipbook frame. */
  particles?: ParticleProgram;
  /** The draw the surface is: `mesh`, which a spatial shader draws on, or the draw it falls back on. */
  drawnOn: ShaderSurface;
}

/** What draws a surface, as a spatial shader's fallback warning names it. */
export type ShaderSurface = 'mesh' | UndrawnShaderSurface;

/** Godot's default surface for no usable material (ADR-0041), magenta for a texture that never draws. */
export function SurfaceMaterialSlot({
  source,
  attach,
  listed,
  particles,
  drawnOn,
}: SurfaceMaterialSlotProps) {
  const { scalars, bags, shader, shaded } = useShadedSurfaceMaterial(source);
  // Primitive and placement are strings: `listed` is a new object each render.
  const primitive = listed?.primitive;
  const placement = listed?.placement;
  const pointDraw = useMemo(
    () => (primitive === 'points' && placement ? pointDrawOf(scalars, placement) : undefined),
    [primitive, placement, scalars]
  );
  const particleDraw = useMemo(
    () => (particles ? { draw: particleDrawOf(scalars), program: particles } : undefined),
    [particles, scalars]
  );
  const draws = useMemo(
    () => ({
      pointDraw,
      linePlacement: primitive === 'lines' ? placement : undefined,
      particles: particleDraw,
    }),
    [pointDraw, primitive, placement, particleDraw]
  );
  const undrawnOn = undrawnSurfaceOf(drawnOn, particles !== undefined);
  useEffect(() => {
    if (shader && undrawnOn) warnUndrawnShader(shader, undrawnOn);
  }, [shader, undrawnOn]);
  const standard = bags ? (
    <StandardMaterialSlot bags={bags} attach={attach} draws={draws} />
  ) : (
    materialBagElement(drawnBag(MISSING_TEXTURE_MATERIAL, draws), attach, null)
  );
  if (!shaded || undrawnOn) return standard;
  return <SpatialShaderSlot source={shaded} attach={attach} fallback={standard} />;
}

/** The surface a spatial shader falls back on, or null for a mesh's own surface, which draws it. */
function undrawnSurfaceOf(drawnOn: ShaderSurface, isParticles: boolean): UndrawnShaderSurface | null {
  if (isParticles) return 'particle draw pass';
  return drawnOn === 'mesh' ? null : drawnOn;
}

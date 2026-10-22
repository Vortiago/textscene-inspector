/**
 * One surface's material as its adapters install it: the scalars a source decodes to, with every
 * texture bound, derived once into the two bags (ADR-0039). A caller loads, decodes and binds
 * nothing itself.
 */

import { useMemo } from 'react';
import {
  standardMaterialBags,
  type StandardMaterialBag,
} from '../../resources/materials/standardmaterial3d/materialBag';
import { parseStandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';
import type { StandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/types';
import type { FadeVariants } from './fadeVariants';
import type { MaterialResource, MaterialSource } from './materialSource';
import { useSurfaceTextures, type TexturedSurface } from './surfaceTextures';
import { readyMaterial, useMaterial } from './useMaterial';

export interface SurfaceMaterial {
  /** The decoded material, or null for Godot's default surface (ADR-0041). */
  scalars: StandardMaterial3DScalars | null;
  /**
   * The source names no material, or its file is still loading or missing: nothing replaces what
   * the surface had. A caller with no other material draws `bags`, which are then Godot's default.
   */
  isAbsent: boolean;
  /** The unfaded and the alpha-pass bag, or null when a texture never draws: the surface takes the missing-texture placeholder. */
  bags: FadeVariants<StandardMaterialBag> | null;
}

/**
 * The material `source` draws on `surface`, whichever file it came from. `surface` matters to a
 * material that tiles per world unit, and to a glTF surface's UVs.
 */
export function useSurfaceMaterial(
  source: MaterialSource | undefined,
  surface?: TexturedSurface
): SurfaceMaterial {
  const loaded = useMaterial(source);
  const material = readyMaterial(loaded);
  const scalars = useDecodedScalars(material);
  const textures = useSurfaceTextures(scalars, material, surface);
  // No bags while unresolved, so a late map leaves the placeholder material as it is.
  const bags = useMemo(() => textures && standardMaterialBags(scalars, textures), [scalars, textures]);
  return { scalars, isAbsent: loaded.status === 'absent', bags };
}

/** The decoded scalars of the material `source` loads to, with no textures: null for Godot's default surface. */
export function useSurfaceScalars(source: MaterialSource | undefined): StandardMaterial3DScalars | null {
  return useDecodedScalars(readyMaterial(useMaterial(source)));
}

function useDecodedScalars(material: MaterialResource | null): StandardMaterial3DScalars | null {
  const resource = material?.resource;
  return useMemo(() => (resource ? parseStandardMaterial3DScalars(resource.data) : null), [resource]);
}

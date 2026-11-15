/**
 * One surface's material as its adapters install it: the scalars a material reference decodes to, with every
 * texture bound, derived once into the two bags (ADR-0039). A caller loads, decodes and binds
 * nothing itself.
 */

import { useMemo } from 'react';
import {
  standardMaterialBags,
  type StandardMaterialBag,
} from '../../resources/materials/standardmaterial3d/materialBag';
import type { StandardMaterial } from '../../resources/materials/material/types';
import { standardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';
import type { StandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/types';
import type { ScopedReference } from '../../resources/reading';
import type { FadeVariants } from './fadeVariants';
import { useSurfaceTextures, type TexturedSurface } from './surfaceTextures';
import { readyMaterial, useMaterial } from './useMaterial';

const NO_TEXTURES: StandardMaterial['textures'] = {};

export interface SurfaceMaterial {
  /** The decoded material, or null for Godot's default surface (ADR-0041). */
  scalars: StandardMaterial3DScalars | null;
  /**
   * The reference names no material, or its file is still loading or missing: nothing replaces what
   * the surface had. A caller with no other material draws `bags`, which are then Godot's default.
   */
  isAbsent: boolean;
  /** The unfaded and the alpha-pass bag, or null when a texture never draws: the surface takes the missing-texture placeholder. */
  bags: FadeVariants<StandardMaterialBag> | null;
  /** The ready material, whose `next_pass` a chain walker follows. Null while the reference names no material to draw. */
  material: StandardMaterial | null;
}

/** The material `reference` draws on `surface`, whichever file it came from: a glTF surface's UVs run top-down. */
export function useSurfaceMaterial(
  reference: ScopedReference | undefined,
  surface?: TexturedSurface
): SurfaceMaterial {
  const loaded = useMaterial(reference);
  const material = readyMaterial(loaded);
  // A decoded material keeps its identity while its text holds, so the scalars do too.
  const scalars = useMemo(() => material && standardMaterial3DScalars(material.data), [material]);
  const textures = useSurfaceTextures(scalars, material?.textures ?? NO_TEXTURES, surface);
  // No bags while unresolved, so a late map leaves the placeholder material as it is.
  const bags = useMemo(() => textures && standardMaterialBags(scalars, textures), [scalars, textures]);
  return { scalars, isAbsent: loaded.status === 'absent', bags, material };
}

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
import type { SurfaceShaderSource } from '../spatialShader/surfaceShader';
import { litSurfaceForm } from '../litSurface/litSurfaceForm';
import { DEFAULT_MATERIAL_SHADER } from '../../godot/rendering/materials/defaultMaterial';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import { standardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/scalars';
import type { StandardMaterial3DScalars } from '../../resources/materials/standardmaterial3d/types';
import type { ScopedReference } from '../../resources/reading';
import type { FadeVariants } from './fadeVariants';
import { useSurfaceTextures, type TexturedSurface } from './surfaceTextures';
import {
  readyMaterial,
  useMaterial,
  useShadedMaterial,
  type LoadedMaterial,
  type UndrawnShaderSurface,
} from './useMaterial';

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
  /** The spatial ShaderMaterial's text, or null for any other material. */
  shader: ShaderText | null;
}

/** A mesh surface's material, and what it draws through a shader. */
export interface ShadedSurfaceMaterial extends SurfaceMaterial {
  /** Null for the classic materials, which draw `bags`. */
  shaded: SurfaceShaderSource | null;
}

/** The material `reference` draws on `surface`, whichever file it came from: a glTF surface's UVs run top-down. */
export function useSurfaceMaterial(
  reference: ScopedReference | undefined,
  drawnOn: UndrawnShaderSurface,
  surface?: TexturedSurface
): SurfaceMaterial {
  return useSurfaceOf(useMaterial(reference, drawnOn), surface);
}

/** Godot's default material: its default shader, with no parameters. */
const GODOT_DEFAULT_SOURCE: SurfaceShaderSource = {
  shader: { code: DEFAULT_MATERIAL_SHADER, file: 'the default 3D material', parameters: {}, textures: {} },
};

/** The material `reference` draws on the surface of a mesh, a spatial shader included. */
export function useShadedSurfaceMaterial(reference: ScopedReference | undefined): ShadedSurfaceMaterial {
  const loaded = useShadedMaterial(reference);
  const surface = useSurfaceOf(loaded);
  const namesNoMaterial = reference === undefined;
  // A texture that never draws keeps the placeholder: the shader would draw its sampler's default.
  const isMissingTexture = loaded.status === 'ready' && surface.bags === null;
  const shaded = useMemo(() => {
    if (namesNoMaterial) return defaultSourceOf();
    return isMissingTexture ? null : shadedSourceOf(loaded);
  }, [loaded, namesNoMaterial, isMissingTexture]);
  return { ...surface, shaded };
}

/** Only the node lit surface draws Godot's default material through its shader. */
const defaultSourceOf = (): SurfaceShaderSource | null =>
  litSurfaceForm() === 'nodes' ? GODOT_DEFAULT_SOURCE : null;

/** What a mesh surface draws through a shader: a ShaderMaterial, or on the node lit surface any material. */
function shadedSourceOf(loaded: LoadedMaterial): SurfaceShaderSource | null {
  if (loaded.status === 'spatial-shader') return { shader: loaded.shader };
  if (litSurfaceForm() !== 'nodes') return null;
  if (loaded.status === 'base-material') return { baseMaterial: loaded.baseMaterial };
  if (loaded.status === 'ready') return { baseMaterial: loaded.material.baseMaterial };
  return loaded.status === 'declined' ? GODOT_DEFAULT_SOURCE : null;
}

function useSurfaceOf(loaded: LoadedMaterial, surface?: TexturedSurface): SurfaceMaterial {
  const material = readyMaterial(loaded);
  // A decoded material keeps its identity while its text holds, so the scalars do too.
  const scalars = useMemo(() => material && standardMaterial3DScalars(material.data), [material]);
  const textures = useSurfaceTextures(scalars, material?.textures ?? NO_TEXTURES, surface);
  // No bags while unresolved, so a late map leaves the placeholder material as it is.
  const bags = useMemo(() => textures && standardMaterialBags(scalars, textures), [scalars, textures]);
  const shader = loaded.status === 'spatial-shader' ? loaded.shader : null;
  return { scalars, isAbsent: loaded.status === 'absent', bags, material, shader };
}

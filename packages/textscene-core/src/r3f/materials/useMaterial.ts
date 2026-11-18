/**
 * The one load step for a material: a reference read with the `MATERIAL` kind, the same from the
 * scene and from a file. A slot renders what this returns and never learns which file the material
 * came from. The host requests the file and reports it when it is missing.
 */

import { useEffect, useMemo } from 'react';
import { warn } from '../../logger';
import { MATERIAL } from '../../resources/materials/material/kind';
import type { Material, StandardMaterial } from '../../resources/materials/material/types';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import { litSurfaceForm } from '../litSurface/litSurfaceForm';
import { useReferencedResource, type Read, type ScopedReference } from '../../resources/reading';

/** What a material reference loads to. */
export type LoadedMaterial =
  /** A StandardMaterial3D to draw. */
  | { status: 'ready'; material: StandardMaterial }
  /** A spatial ShaderMaterial, which the node lit surface draws. */
  | { status: 'spatial-shader'; shader: ShaderText }
  /** A material type this previewer does not build: Godot's default 3D surface (ADR-0041). */
  | { status: 'declined'; type: string }
  /** No reference, a file still loading or a missing one: nothing replaces what the surface had. */
  | { status: 'absent' };

const ABSENT: LoadedMaterial = { status: 'absent' };
const DECLINED_SHADER: LoadedMaterial = { status: 'declined', type: 'ShaderMaterial' };

/** The material to draw, or null for Godot's default surface. */
export function readyMaterial(loaded: LoadedMaterial): StandardMaterial | null {
  return loaded.status === 'ready' ? loaded.material : null;
}

const UNCOMPILED_SHADER =
  "[material] ShaderMaterial is not compiled, and the surface draws Godot's default 3D surface.";

const UNDRAWN_SPATIAL_SHADER =
  "[material] The previewer draws a spatial shader only on the surface of a mesh yet, and draws Godot's default 3D surface for this next pass, glTF override or trail.";

/** What `reference` loads to for a draw that builds no shader: a ShaderMaterial declines with a warning. */
export function useMaterial(reference: ScopedReference | undefined): LoadedMaterial {
  const loaded = useLoadedMaterial(reference);
  const isShader = loaded.status === 'spatial-shader';
  useEffect(() => {
    if (isShader) warn(UNDRAWN_SPATIAL_SHADER);
  }, [isShader]);
  return isShader ? DECLINED_SHADER : loaded;
}

/** What `reference` loads to for a mesh surface, which draws a spatial shader under the node lit surface. */
export function useShadedMaterial(reference: ScopedReference | undefined): LoadedMaterial {
  return useLoadedMaterial(reference);
}

function useLoadedMaterial(reference: ScopedReference | undefined): LoadedMaterial {
  const read = useReferencedResource(reference ?? null, MATERIAL);
  const loaded = useMemo(() => loadedOf(read), [read]);
  useEffect(() => {
    if (loaded.status === 'declined' && loaded.type === 'ShaderMaterial') warn(UNCOMPILED_SHADER);
  }, [loaded]);
  return loaded;
}

function loadedOf(read: Read<Material>): LoadedMaterial {
  if (read.status !== 'loaded') return ABSENT;
  const material = read.value;
  if (material.form === 'standard') return { status: 'ready', material };
  if (material.form !== 'spatial-shader') return { status: 'declined', type: material.type };
  return litSurfaceForm() === 'nodes'
    ? { status: 'spatial-shader', shader: material.shader }
    : DECLINED_SHADER;
}

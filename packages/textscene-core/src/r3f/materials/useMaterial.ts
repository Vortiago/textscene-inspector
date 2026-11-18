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
import { warnOnce } from '../../utils/warnOnce';
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

/** A surface that draws Godot's default 3D surface for a spatial shader, named in its warning. */
export type UndrawnShaderSurface =
  | 'skinned mesh'
  | 'MultiMesh or GridMap'
  | 'particle draw pass'
  | 'particle trail'
  | 'line mesh'
  | 'point mesh'
  | 'next pass'
  | 'glTF surface';

/** Warns once for `shader`, which `surface` draws as Godot's default 3D surface. */
export function warnUndrawnShader(shader: ShaderText, surface: UndrawnShaderSurface): void {
  warnOnce(
    shader,
    'undrawn',
    `[material] The previewer draws a spatial shader only on an unskinned mesh yet, and draws Godot's default 3D surface on this ${surface}.`
  );
}

/** What `reference` loads to on `surface`, which builds no shader: a ShaderMaterial declines and warns. */
export function useMaterial(
  reference: ScopedReference | undefined,
  surface: UndrawnShaderSurface
): LoadedMaterial {
  const loaded = useLoadedMaterial(reference);
  const shader = loaded.status === 'spatial-shader' ? loaded.shader : null;
  useEffect(() => {
    if (shader) warnUndrawnShader(shader, surface);
  }, [shader, surface]);
  return shader ? DECLINED_SHADER : loaded;
}

/** What `reference` loads to for a mesh surface, which draws a spatial shader. */
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
  if (material.form === 'spatial-shader') return { status: 'spatial-shader', shader: material.shader };
  return { status: 'declined', type: material.type };
}

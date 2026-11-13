/**
 * The one load step for a material: a reference read with the `MATERIAL` kind, the same from the
 * scene and from a file. A slot renders what this returns and never learns which file the material
 * came from. The host requests the file and reports it when it is missing.
 */

import { useEffect, useMemo } from 'react';
import { warn } from '../../logger';
import { MATERIAL } from '../../resources/materials/material/kind';
import type { Material, StandardMaterial } from '../../resources/materials/material/types';
import { useReferencedResource, type Read, type ScopedReference } from '../../resources/reading';

/** What a material reference loads to. */
type LoadedMaterial =
  /** A StandardMaterial3D to draw. */
  | { status: 'ready'; material: StandardMaterial }
  /** A material type this previewer does not build: Godot's default 3D surface (ADR-0041). */
  | { status: 'declined'; type: string }
  /** No reference, a file still loading or a missing one: nothing replaces what the surface had. */
  | { status: 'absent' };

const ABSENT: LoadedMaterial = { status: 'absent' };

/** The material to draw, or null for Godot's default surface. */
export function readyMaterial(loaded: LoadedMaterial): StandardMaterial | null {
  return loaded.status === 'ready' ? loaded.material : null;
}

/** What `reference` loads to. A ShaderMaterial is declined with a warning (ADR-0041). */
export function useMaterial(reference: ScopedReference | undefined): LoadedMaterial {
  const read = useReferencedResource(reference ?? null, MATERIAL);
  const loaded = useMemo(() => loadedOf(read), [read]);

  useEffect(() => {
    if (loaded.status === 'declined' && loaded.type === 'ShaderMaterial') {
      warn("[material] ShaderMaterial is not compiled — rendering Godot's default 3D surface.");
    }
  }, [loaded]);

  return loaded;
}

function loadedOf(read: Read<Material>): LoadedMaterial {
  if (read.status !== 'loaded') return ABSENT;
  const material = read.value;
  return material.form === 'standard'
    ? { status: 'ready', material }
    : { status: 'declined', type: material.type };
}

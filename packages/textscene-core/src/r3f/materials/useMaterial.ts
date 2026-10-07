/**
 * The one load step for a material: a scene material as it is, or a `.tres` through the
 * cached `.tres` parse, into the same shape. A slot renders what this returns and never
 * learns which file the material came from.
 */

import { useEffect, useMemo } from 'react';
import { warn } from '../../logger';
import type { ParsedResource } from '../../parser/parsedResource';
import type { TscnInternalResource } from '../../parser/types';
import { resourceSection } from '../../resources/resourceSection';
import { resourceFilePath } from '../../resources/subResourcePath';
import { useResource } from '../../resources/useResource';
import type { MaterialResource, MaterialSource } from './materialSource';

/** What a material source loads to. */
export type LoadedMaterial =
  /** A StandardMaterial3D to draw. */
  | { status: 'ready'; material: MaterialResource }
  /** A material type this previewer does not build: Godot's default 3D surface (ADR-0041). */
  | { status: 'declined'; type: string }
  /** No source, a file still loading or missing: nothing replaces what the surface had. */
  | { status: 'absent' };

const ABSENT: LoadedMaterial = { status: 'absent' };

/** The material to draw, or null for Godot's default surface. */
export function readyMaterial(loaded: LoadedMaterial): MaterialResource | null {
  return loaded.status === 'ready' ? loaded.material : null;
}

/** What `source` loads to. A ShaderMaterial is declined with a warning (ADR-0041). */
export function useMaterial(source: MaterialSource | undefined): LoadedMaterial {
  const path = source?.kind === 'file' ? source.path : '';
  // Called with '' for an inline source, to keep the hook count stable.
  const file = useResource<ParsedResource>(resourceFilePath(path), 'resource').value;

  // Keyed on what the source holds, not the source object: a caller may build a new
  // source each render, and a new material would rebind every texture.
  const inline = source?.kind === 'inline' ? source.material : null;
  const inlineResource = inline?.resource;
  const inlineInternal = inline?.internalResources;
  const inlineExternal = inline?.externalResources;
  const loaded = useMemo((): LoadedMaterial => {
    if (inlineResource && inlineInternal && inlineExternal) {
      return ready({
        resource: inlineResource,
        internalResources: inlineInternal,
        externalResources: inlineExternal,
      });
    }
    if (!path || !file) return ABSENT;
    const resource = materialBody(file, path);
    if (!resource) return ABSENT;
    return ready({ resource, internalResources: file.subResources, externalResources: file.extResources });
  }, [inlineResource, inlineInternal, inlineExternal, file, path]);

  useEffect(() => {
    if (loaded.status === 'declined' && loaded.type === 'ShaderMaterial') {
      warn("[material] ShaderMaterial is not compiled — rendering Godot's default 3D surface.");
    }
  }, [loaded]);

  return loaded;
}

/** Ready for a StandardMaterial3D, declined for any other type. */
function ready(material: MaterialResource): LoadedMaterial {
  const { type } = material.resource;
  return type === 'StandardMaterial3D' ? { status: 'ready', material } : { status: 'declined', type };
}

/** The section `path` addresses in its parsed `.tres`, or undefined for an id the file does not declare. */
function materialBody(file: ParsedResource, path: string): TscnInternalResource | undefined {
  try {
    const { type, properties } = resourceSection(file, path);
    return { id: path, type, data: properties };
  } catch {
    // The lookup's one failure, an undeclared id. No producer mints one past
    // `subResourceTypeGate`, so the file changed under a mounted slot.
    return undefined;
  }
}

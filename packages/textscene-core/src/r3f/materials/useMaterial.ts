/**
 * The one load step for a material: a scene material as it is, or a `.tres` through the
 * cached `.tres` parse, into the same shape. A slot renders what this returns and never
 * learns which file the material came from.
 */

import { useEffect, useMemo } from 'react';
import { warn } from '../../logger';
import type { ParsedResource } from '../../parser/parsedResource';
import type { TscnInternalResource } from '../../parser/types';
import { findSubResource } from '../../resources/SubResourceResolver';
import { parseSubResourcePath } from '../../resources/subResourcePath';
import { useResourceLoad, type ResourceStatus } from '../../resources/useResource';
import { useMissingReport } from '../contexts/MissingResourcesContext';
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
  const address = source?.kind === 'file' ? source.path : '';
  const { filePath, subResourceId } = parseSubResourcePath(address);
  // Called with '' for an inline source, to keep the hook count stable. The `resource` bus
  // parses whole files, so the hook loads the file and reports under the address itself.
  const fileResult = useResourceLoad<ParsedResource>(filePath, 'resource');
  const file = fileResult.value;
  const body = useMemo(
    () => (file ? materialBody(file, filePath, subResourceId) : undefined),
    [file, filePath, subResourceId]
  );
  useMissingReport(address, addressStatus(fileResult.status, body));

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
    if (!file || !body) return ABSENT;
    return ready({
      resource: body,
      internalResources: file.subResources,
      externalResources: file.extResources,
    });
  }, [inlineResource, inlineInternal, inlineExternal, file, body]);

  useEffect(() => {
    if (loaded.status === 'declined' && loaded.type === 'ShaderMaterial') {
      warn("[material] ShaderMaterial is not compiled — rendering Godot's default 3D surface.");
    }
  }, [loaded]);

  return loaded;
}

/** A loaded file without the named `[sub_resource]` fails the address, as Godot's load does. */
function addressStatus(fileStatus: ResourceStatus, body: TscnInternalResource | undefined): ResourceStatus {
  if (fileStatus !== 'loaded') return fileStatus;
  return body ? 'loaded' : 'unavailable';
}

/** Ready for a StandardMaterial3D, declined for any other type. */
function ready(material: MaterialResource): LoadedMaterial {
  const { type } = material.resource;
  return type === 'StandardMaterial3D' ? { status: 'ready', material } : { status: 'declined', type };
}

/** The `[resource]` body, or the named `[sub_resource]`, of a parsed `.tres`. */
function materialBody(
  file: ParsedResource,
  filePath: string,
  subResourceId: string | undefined
): TscnInternalResource | undefined {
  if (subResourceId !== undefined) return findSubResource(file.subResources, subResourceId);
  return { id: filePath, type: file.resourceType, data: file.properties };
}

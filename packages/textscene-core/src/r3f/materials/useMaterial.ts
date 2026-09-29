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
import { useResource } from '../../resources/useResource';
import type { MaterialResource, MaterialSource } from './materialSource';

const NO_FILE: { filePath: string; subResourceId?: string } = { filePath: '' };

/**
 * The material `source` names, or null for Godot's default surface: no source, a file
 * still loading or missing, or a type this previewer does not build. A ShaderMaterial
 * is declined with a warning (ADR-0041).
 */
export function useMaterial(source: MaterialSource | undefined): MaterialResource | null {
  const { filePath, subResourceId } =
    source?.kind === 'file' ? parseSubResourcePath(source.path) : NO_FILE;
  // Called with '' for an inline source, to keep the hook count stable.
  const file = useResource<ParsedResource>(filePath, 'resource').value;

  // Keyed on what the source holds, not the source object: a caller may build a new
  // source each render, and a new material would rebind every texture.
  const inline = source?.kind === 'inline' ? source.material : null;
  const inlineResource = inline?.resource;
  const inlineInternal = inline?.internalResources;
  const inlineExternal = inline?.externalResources;
  const loaded = useMemo((): MaterialResource | null => {
    if (inlineResource && inlineInternal && inlineExternal) {
      return { resource: inlineResource, internalResources: inlineInternal, externalResources: inlineExternal };
    }
    if (!filePath || !file) return null;
    const resource = materialBody(file, filePath, subResourceId);
    if (!resource) return null;
    return { resource, internalResources: file.subResources, externalResources: file.extResources };
  }, [inlineResource, inlineInternal, inlineExternal, file, filePath, subResourceId]);

  const type = loaded?.resource.type;
  useEffect(() => {
    if (type === 'ShaderMaterial') {
      warn("[material] ShaderMaterial is not compiled — rendering Godot's default 3D surface.");
    }
  }, [loaded, type]);

  return type === 'StandardMaterial3D' ? loaded : null;
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

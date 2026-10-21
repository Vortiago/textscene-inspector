/**
 * The reference and tables a texture slot resolves against. A reference that names a resource file
 * means that file's `[resource]` in the file's own tables (`textures/parsedResourceTexture.ts`), so
 * every resolver that reads an inline texture reads a saved one too.
 */

import { useMemo } from 'react';
import type { ParsedResource } from '../parser/parsedResource.js';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types.js';
import { resolveExtResourceFilePath } from './SubResourceResolver.js';
import { parsedResourceTexture } from './textures/parsedResourceTexture.js';
import { useResource } from './useResource.js';

interface TextureSlotResources {
  /** Undefined while a resource file loads or once it proves absent: it names nothing yet. */
  ref: string | undefined;
  externalResources: readonly TscnExternalResource[];
  internalResources: readonly TscnInternalResource[];
  /** `missing` once a named resource file leaves `pending` without loading. */
  status: 'ready' | 'loading' | 'missing';
}

/** The file loads on the `resource` bus, since the image buses decode no resource file. */
export function useParsedResourceSlot(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[]
): TextureSlotResources {
  const path = useMemo(() => resolveExtResourceFilePath(ref, externalResources), [ref, externalResources]);
  const file = useResource<ParsedResource>(path ?? '', 'resource');
  if (!path) return { ref, externalResources, internalResources, status: 'ready' };
  if (!file.value) {
    const status = file.status === 'pending' ? 'loading' : 'missing';
    return { ref: undefined, externalResources, internalResources, status };
  }
  return { ...parsedResourceTexture(file.value), status: 'ready' };
}

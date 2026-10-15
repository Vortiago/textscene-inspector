/**
 * The reference and tables a texture slot resolves against. A reference that names a `.tres`
 * means that file's `[resource]` in the file's own tables (`textures/textResourceTexture.ts`), so
 * every resolver that reads an inline texture reads a saved one too.
 */

import { useMemo } from 'react';
import type { ParsedResource } from '../parser/parsedResource.js';
import type { TscnExternalResource, TscnInternalResource } from '../parser/types.js';
import { resolveExtTextResourcePath } from './SubResourceResolver.js';
import { textResourceTexture } from './textures/textResourceTexture.js';
import { useResource } from './useResource.js';

export interface TextureSlotResources {
  /** Undefined while a `.tres` loads or once it proves absent: it names nothing yet. */
  ref: string | undefined;
  externalResources: readonly TscnExternalResource[];
  internalResources: readonly TscnInternalResource[];
  /** `missing` once a named `.tres` leaves `pending` without loading. */
  status: 'ready' | 'loading' | 'missing';
}

/** The file loads on the `resource` bus, since the image buses decode no text. */
export function useTextResourceSlot(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[]
): TextureSlotResources {
  const path = useMemo(() => resolveExtTextResourcePath(ref, externalResources), [ref, externalResources]);
  const file = useResource<ParsedResource>(path ?? '', 'resource');
  if (!path) return { ref, externalResources, internalResources, status: 'ready' };
  if (!file.value) {
    const status = file.status === 'pending' ? 'loading' : 'missing';
    return { ref: undefined, externalResources, internalResources, status };
  }
  return { ...textResourceTexture(file.value), status: 'ready' };
}

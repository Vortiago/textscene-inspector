/** Builds the `texture` slot of a test atlas source. */

import type { TscnInternalResource } from '../../../parser/types';
import { referenceHeldBy, type ScopedReference } from '../../reading';

/** A source's `texture` slot naming `ref` in a scene with `internalResources` and no external table. */
export function tileTextureAt(
  ref: string,
  internalResources: readonly TscnInternalResource[] = [],
  isHeldLocally = true
): ScopedReference {
  return referenceHeldBy(ref, { externalResources: [], internalResources }, isHeldLocally);
}

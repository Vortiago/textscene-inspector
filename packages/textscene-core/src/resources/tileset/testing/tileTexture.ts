/** Builds the `texture` slot of a test atlas source. */

import type { TscnInternalResource } from '../../../parser/types';
import type { ScopedReference } from '../../reading';
import { referenceIn } from '../../reading/scopedReference.testkit';

/** A source's `texture` slot naming `ref` in a scene with `internalResources` and no external table. */
export function tileTextureAt(
  ref: string,
  internalResources: readonly TscnInternalResource[] = [],
  isHeldLocally = true
): ScopedReference {
  return referenceIn(ref, [], internalResources, isHeldLocally);
}

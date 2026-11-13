/**
 * A reference in tables a test writes inline. Each pair of tables gives one object, and an empty
 * table one shared array, so a reference a hook test builds in render keeps its identity.
 */

import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';
import type { SceneResources } from '../../r3f/SceneResourcesContext';
import { perObject } from '../../utils/perObject';
import { referenceHeldBy, type ScopedReference } from './scopedReference';

const NO_EXTERNAL: readonly TscnExternalResource[] = [];
const NO_INTERNAL: readonly TscnInternalResource[] = [];

/** One tables object for each pair of tables, kept while both are. */
const tablesFor = perObject((externalResources: readonly TscnExternalResource[]) =>
  perObject((internalResources: readonly TscnInternalResource[]): SceneResources => ({
    externalResources,
    internalResources,
  }))
);

export function tablesOf(
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[]
): SceneResources {
  const external = externalResources.length === 0 ? NO_EXTERNAL : externalResources;
  const internal = internalResources.length === 0 ? NO_INTERNAL : internalResources;
  return tablesFor(external)(internal);
}

/** `ref` in the tables, held locally unless `isHeldLocally` says otherwise. */
export function referenceIn(
  ref: string | undefined,
  externalResources: readonly TscnExternalResource[],
  internalResources: readonly TscnInternalResource[],
  isHeldLocally = true
): ScopedReference {
  return referenceHeldBy(ref, tablesOf(externalResources, internalResources), isHeldLocally);
}

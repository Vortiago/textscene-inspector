import { GRADIENT } from './decode';
import { staticSnapshot } from '../../reading/staticSnapshot.testkit';
import { nodeReference } from '../../reading/scopedReference';
import { resolveOnlySubResource } from '../../../testing/subResource';
import type { Gradient } from './types';

/** The Gradient a sub-resource with this property bag decodes to. */
export function gradientOf(data: Record<string, string>): Gradient {
  return resolveOnlySubResource(
    'Gradient',
    data,
    (ref, internalResources) =>
      staticSnapshot({}).read(nodeReference(ref, { internalResources, externalResources: [] }), GRADIENT)
        .value
  )!;
}

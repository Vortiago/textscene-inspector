/** The control points a curve kind decodes from a scene's only `[sub_resource]`, for the curve tests. */

import { staticSnapshot } from '../../reading/staticSnapshot.testkit';
import { nodeReference } from '../../reading/scopedReference';
import type { ResourceKind } from '../../reading/read';
import { subResource } from '../../../testing/subResource';

/** No points for a curve that does not load, as a path draws nothing for it. */
export function decodedCurve<P>(kind: ResourceKind<P[]>, type: string, data: Record<string, string>): P[] {
  const scene = { internalResources: [subResource(type, 'only', data)], externalResources: [] };
  return staticSnapshot({}).read(nodeReference('SubResource("only")', scene), kind).value ?? [];
}

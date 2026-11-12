/** The control points a curve kind decodes from a scene's only `[sub_resource]` of its class, for the curve tests. */

import { decodedResource } from '../../reading/decodedResource.testkit';
import type { ResourceKind } from '../../reading/read';

/** No points for a curve that does not load, as a path draws nothing for it. */
export function decodedCurve<P>(kind: ResourceKind<P[]>, data: Record<string, string>): P[] {
  return decodedResource(kind, data) ?? [];
}

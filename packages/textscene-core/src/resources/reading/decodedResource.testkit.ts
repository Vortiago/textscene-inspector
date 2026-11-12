/** The value a kind decodes from the only `[sub_resource]` of its class in a scene, for the decode tests. */

import type { ResourceKind } from './read';
import { nodeReference } from './scopedReference';
import { staticSnapshot } from './staticSnapshot.testkit';
import { subResource } from '../../testing/subResource';

/** Null when the read does not load, as a reader draws nothing for it. */
export function decodedResource<T>(kind: ResourceKind<T>, data: Record<string, string>): T | null {
  const scene = { internalResources: [subResource(kind.name, 'only', data)], externalResources: [] };
  return staticSnapshot({}).read(nodeReference('SubResource("only")', scene), kind).value;
}

import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { formatNode3DProperties } from '../../base/node3d/propertyFormatter';
import { remoteTransformSection } from '../../base/remoteTransform';

export async function formatRemoteTransform3DProperties(node: InspectedNode): Promise<PropertySection[]> {
  return [await remoteTransformSection(node, 'RemoteTransform3D'), ...(await formatNode3DProperties(node))];
}

import type { InspectedNode, PropertySection } from '../../inspectedNode';
import { formatNode2DProperties } from '../../base/node2d/propertyFormatter';
import { remoteTransformSection } from '../../base/remoteTransform';

export async function formatRemoteTransform2DProperties(node: InspectedNode): Promise<PropertySection[]> {
  return [await remoteTransformSection(node, 'RemoteTransform2D'), ...(await formatNode2DProperties(node))];
}

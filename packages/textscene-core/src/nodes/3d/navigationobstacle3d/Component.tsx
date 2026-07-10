/** NavigationObstacle3D render component — transform group wrapping children. */

import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';

export function NavigationObstacle3D({ node, children }: NodeComponentProps) {
  return <Node3D node={node}>{children}</Node3D>;
}

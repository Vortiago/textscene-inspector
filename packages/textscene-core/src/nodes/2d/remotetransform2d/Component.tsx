/** RemoteTransform2D render component — transform group wrapping children. */

import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';

export function RemoteTransform2D({ node, children }: NodeComponentProps) {
  return <Node2D node={node}>{children}</Node2D>;
}

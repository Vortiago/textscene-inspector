/**
 * Timer renders nothing: the base Node component draws no geometry.
 * `container: true` lets a plain Node type pass through both the 2D and 3D
 * workspaces (NodeComponentRegistry).
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node } from '../../node/Component';

nodeComponentRegistry.register({ typeName: 'Timer', Component: Node, container: true, renderIntent: 'transform-only' });

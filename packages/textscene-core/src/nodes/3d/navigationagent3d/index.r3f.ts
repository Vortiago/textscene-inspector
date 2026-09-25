/**
 * NavigationAgent3D renders nothing visible, so it reuses the base Node component.
 * `container: true`: a helper derived from plain Node passes through both the 2D
 * and 3D workspaces (see NodeComponentRegistry).
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node } from '../../node/Component';

nodeComponentRegistry.register({ typeName: 'NavigationAgent3D', Component: Node, container: true, renderIntent: 'transform-only' });

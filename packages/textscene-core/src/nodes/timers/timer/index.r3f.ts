/**
 * Timer renders nothing visible — reuse the base Node component (zero
 * geometry). `container: true`: a plain-Node-derived type passes through
 * both the 2D and 3D workspaces (see NodeComponentRegistry).
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node } from '../../node/Component';

nodeComponentRegistry.register({ typeName: 'Timer', Component: Node, container: true });

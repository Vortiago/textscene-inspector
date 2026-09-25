/**
 * AudioStreamPlayer renders nothing visible: it reuses the base Node component (zero geometry),
 * so a non-spatial audio node shows no placeholder cube.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node } from '../../node/Component';

nodeComponentRegistry.register({ typeName: 'AudioStreamPlayer', Component: Node, container: true, renderIntent: 'transform-only' });

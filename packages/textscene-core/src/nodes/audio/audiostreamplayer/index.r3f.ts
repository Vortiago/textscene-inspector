/**
 * AudioStreamPlayer renders nothing visible — reuse the base Node component
 * (zero geometry) so a non-spatial audio node doesn't show a placeholder cube.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node } from '../../node/Component';

nodeComponentRegistry.register({ typeName: 'AudioStreamPlayer', Component: Node, container: true });

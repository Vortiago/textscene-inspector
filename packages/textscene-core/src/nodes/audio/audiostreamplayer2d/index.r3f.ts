/**
 * AudioStreamPlayer2D renders no geometry — reuse the Node2D transform-group
 * Component (ADR-0008): an invisible group that positions children via the
 * 2D transform, instead of a placeholder cube.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';

nodeComponentRegistry.register({ typeName: 'AudioStreamPlayer2D', Component: Node2D });

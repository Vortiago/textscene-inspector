/**
 * AudioStreamPlayer2D renders no geometry: it reuses the Node2D transform-group Component
 * (ADR-0008), an invisible group that positions children through the 2D transform.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../base/node2d/Component';

nodeComponentRegistry.register({ typeName: 'AudioStreamPlayer2D', Component: Node2D, canvasItem: true, renderIntent: 'transform-only' });

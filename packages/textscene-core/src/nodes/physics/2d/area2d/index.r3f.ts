/**
 * Area2D renders as a transform-only Node2D group, so it reuses the Node2D
 * component (ADR-0005/ADR-0008). `canvasItem: true` keeps it Node2D-world
 * content: never drawn in the 3D viewport, always in the 2D world canvas.
 */

import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { Node2D } from '../../../base/node2d/Component';

nodeComponentRegistry.register({ typeName: 'Area2D', Component: Node2D, canvasItem: true, renderIntent: 'transform-only' });

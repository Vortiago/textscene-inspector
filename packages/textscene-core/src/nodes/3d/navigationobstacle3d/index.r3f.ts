/**
 * NavigationObstacle3D defines an avoidance region but draws nothing, so it
 * renders as a transform-only Node3D group (ADR-0008). Neither `canvasItem` nor
 * `container`: like Area3D, it is drawn only in the 3D viewport.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';

nodeComponentRegistry.register({ typeName: 'NavigationObstacle3D', Component: Node3D, renderIntent: 'transform-only' });

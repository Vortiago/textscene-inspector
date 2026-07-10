/**
 * NavigationObstacle3D renders as a transform-only Node3D group (ADR-0008) —
 * it defines an avoidance region but draws nothing itself. Registered as
 * neither `canvasItem` nor `container`: a pure 3D-only type, like Area3D —
 * only drawn in the 3D viewport.
 */

import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { Node3D } from '../../base/node3d/Component';

nodeComponentRegistry.register({ typeName: 'NavigationObstacle3D', Component: Node3D });

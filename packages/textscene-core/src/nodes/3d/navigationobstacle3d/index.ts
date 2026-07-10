/**
 * NavigationObstacle3D registration — parser + property formatter.
 *
 * Non-visual: it carves/reports an avoidance region but draws nothing of its
 * own, so the render component (index.r3f.ts) reuses the Node3D
 * transform-only group (ADR-0008).
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNavigationObstacle3D } from './parser';
import { formatNavigationObstacle3DProperties } from './propertyFormatter';

const navigationObstacle3DRegistration: NodeTypeRegistration = {
  typeName: 'NavigationObstacle3D',
  parser: parseNavigationObstacle3D,
  propertyFormatter: formatNavigationObstacle3DProperties,
};

nodeRegistry.register(navigationObstacle3DRegistration);

export { navigationObstacle3DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';

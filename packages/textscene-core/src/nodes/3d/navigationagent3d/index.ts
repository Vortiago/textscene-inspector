/**
 * NavigationAgent3D registration: parser + property formatter.
 *
 * NavigationAgent3D extends Node (non-spatial helper): it has no visual
 * representation, so the render component (index.r3f.ts) reuses the base
 * Node component so it renders nothing visible.
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../core/NodeRegistry';
import { parseNavigationAgent3D } from './parser';
import { formatNavigationAgent3DProperties } from './propertyFormatter';

const navigationAgent3DRegistration: NodeTypeRegistration = {
  typeName: 'NavigationAgent3D',
  parser: parseNavigationAgent3D,
  propertyFormatter: formatNavigationAgent3DProperties,
};

nodeRegistry.register(navigationAgent3DRegistration);

export { navigationAgent3DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';

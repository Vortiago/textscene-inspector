/**
 * Area2D registration: the parser and property formatter. Unlike StaticBody2D, RigidBody2D and
 * CharacterBody2D, which reuse `parseNode2D`, Area2D has its own parser so the Inspector shows
 * monitoring, monitorable, collision_layer and collision_mask. It still renders as a
 * transform-only Node2D group, like Area3D (ADR-0005/ADR-0008).
 */

import { nodeRegistry, type NodeTypeRegistration } from '../../../../core/NodeRegistry';
import { parseArea2D } from './parser';
import { formatArea2DProperties } from './propertyFormatter';

const area2DRegistration: NodeTypeRegistration = {
  typeName: 'Area2D',
  parser: parseArea2D,
  propertyFormatter: formatArea2DProperties,
};

nodeRegistry.register(area2DRegistration);

export { area2DRegistration };
export * from './parser';
export * from './propertyFormatter';
export * from './types';

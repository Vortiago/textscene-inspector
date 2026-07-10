/**
 * Area2D registration — parser + property formatter.
 *
 * Unlike the shared `physics/2d` loop (StaticBody2D/RigidBody2D/CharacterBody2D,
 * which reuse `parseNode2D` verbatim), Area2D carries its own parser so the
 * lenient renderer path also captures monitoring/monitorable/collision_layer/
 * collision_mask for the Inspector — the render component itself stays a
 * transform-only Node2D group (mirrors Area3D, ADR-0005/ADR-0008).
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

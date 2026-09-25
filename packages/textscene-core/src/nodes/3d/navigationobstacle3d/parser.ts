/**
 * NavigationObstacle3D parser: the Node3D base parse plus the radius, height and
 * avoidance properties.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode3D } from '../../base/node3d/parser';
import { parseOptionalBool, parseOptionalFloat, parseOptionalInt } from '../../../parser/valueParsers';
import type { NavigationObstacle3DProperties } from './types';

export function parseNavigationObstacle3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): NavigationObstacle3DProperties {
  const baseProperties = parseNode3D(heading, properties);
  const result: NavigationObstacle3DProperties = { ...baseProperties };

  const radius = parseOptionalFloat(properties.radius);
  if (radius !== undefined) result.radius = radius;

  const height = parseOptionalFloat(properties.height);
  if (height !== undefined) result.height = height;

  const avoidanceEnabled = parseOptionalBool(properties.avoidance_enabled);
  if (avoidanceEnabled !== undefined) result.avoidance_enabled = avoidanceEnabled;

  const avoidanceLayers = parseOptionalInt(properties.avoidance_layers, 'uint32');
  if (avoidanceLayers !== undefined) result.avoidance_layers = avoidanceLayers;

  const affectNavigationMesh = parseOptionalBool(properties.affect_navigation_mesh);
  if (affectNavigationMesh !== undefined) result.affect_navigation_mesh = affectNavigationMesh;

  const carveNavigationMesh = parseOptionalBool(properties.carve_navigation_mesh);
  if (carveNavigationMesh !== undefined) result.carve_navigation_mesh = carveNavigationMesh;

  const use3dAvoidance = parseOptionalBool(properties.use_3d_avoidance);
  if (use3dAvoidance !== undefined) result.use_3d_avoidance = use3dAvoidance;

  return result;
}

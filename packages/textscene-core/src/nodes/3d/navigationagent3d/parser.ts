/**
 * NavigationAgent3D parser — extends the Node base parse with the
 * avoidance/path property surface.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode } from '../../node/parser';
import { parseOptionalBool, parseOptionalFloat, parseOptionalInt } from '../../../parser/valueParsers';
import { parseVector3 } from '../../../parser/vectors';
import { warn } from '../../../logger';
import type { NavigationAgent3DProperties } from './types';

export function parseNavigationAgent3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): NavigationAgent3DProperties {
  const baseProperties = parseNode(heading, properties);
  const result: NavigationAgent3DProperties = { ...baseProperties };

  const radius = parseOptionalFloat(properties.radius);
  if (radius !== undefined) result.radius = radius;

  const height = parseOptionalFloat(properties.height);
  if (height !== undefined) result.height = height;

  const avoidanceEnabled = parseOptionalBool(properties.avoidance_enabled);
  if (avoidanceEnabled !== undefined) result.avoidance_enabled = avoidanceEnabled;

  const avoidanceLayers = parseOptionalInt(properties.avoidance_layers);
  if (avoidanceLayers !== undefined) result.avoidance_layers = avoidanceLayers;

  const avoidanceMask = parseOptionalInt(properties.avoidance_mask);
  if (avoidanceMask !== undefined) result.avoidance_mask = avoidanceMask;

  const maxNeighbors = parseOptionalInt(properties.max_neighbors);
  if (maxNeighbors !== undefined) result.max_neighbors = maxNeighbors;

  const maxSpeed = parseOptionalFloat(properties.max_speed);
  if (maxSpeed !== undefined) result.max_speed = maxSpeed;

  const navigationLayers = parseOptionalInt(properties.navigation_layers);
  if (navigationLayers !== undefined) result.navigation_layers = navigationLayers;

  const targetDesiredDistance = parseOptionalFloat(properties.target_desired_distance);
  if (targetDesiredDistance !== undefined) result.target_desired_distance = targetDesiredDistance;

  const pathDesiredDistance = parseOptionalFloat(properties.path_desired_distance);
  if (pathDesiredDistance !== undefined) result.path_desired_distance = pathDesiredDistance;

  if (properties.target_position) {
    try {
      result.target_position = parseVector3(properties.target_position);
    } catch (error) {
      warn(`[NavigationAgent3D] Failed to parse target_position: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return result;
}

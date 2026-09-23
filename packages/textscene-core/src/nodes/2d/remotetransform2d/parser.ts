/** Parses a RemoteTransform2D: the Node2D surface plus `remote_path` and the update flags. */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { parseOptionalBool } from '../../../parser/valueParsers';
import type { RemoteTransform2DProperties } from './types';

export function parseRemoteTransform2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): RemoteTransform2DProperties {
  const baseProperties = parseNode2D(heading, properties);
  const result: RemoteTransform2DProperties = { ...baseProperties };

  if (properties.remote_path) {
    result.remote_path = properties.remote_path;
  }

  const updatePosition = parseOptionalBool(properties.update_position);
  if (updatePosition !== undefined) result.update_position = updatePosition;

  const updateRotation = parseOptionalBool(properties.update_rotation);
  if (updateRotation !== undefined) result.update_rotation = updateRotation;

  const updateScale = parseOptionalBool(properties.update_scale);
  if (updateScale !== undefined) result.update_scale = updateScale;

  const useGlobalCoordinates = parseOptionalBool(properties.use_global_coordinates);
  if (useGlobalCoordinates !== undefined) result.use_global_coordinates = useGlobalCoordinates;

  return result;
}

/**
 * WorldEnvironment parser - parses WorldEnvironment TSCN properties
 */

import type { ParsedHeading } from '../../../parser/utils.js';
import type { WorldEnvironmentProperties } from './types.js';
import { parseNode3D } from '../../base/node3d/parser.js';

/**
 * Parse WorldEnvironment properties
 *
 * WorldEnvironment nodes configure global rendering environment via
 * an Environment SubResource reference.
 */
export function parseWorldEnvironment(
  heading: ParsedHeading,
  properties: Record<string, string>
): WorldEnvironmentProperties {
  const baseProps = parseNode3D(heading, properties);

  return {
    ...baseProps,
    environment: properties.environment ?? '',
    camera_attributes: properties.camera_attributes,
  };
}

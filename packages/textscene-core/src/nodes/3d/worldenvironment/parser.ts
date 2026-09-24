/**
 * WorldEnvironment parser - parses WorldEnvironment TSCN properties.
 *
 * A plain Node: a Node3D below it finds no Node3D parent
 * (node_3d.cpp:150, `data.parent = Object::cast_to<Node3D>(get_parent())`),
 * so the chain is `parseNode`, which carries no `visible` or placement fields.
 */

import type { ParsedHeading } from '../../../parser/utils.js';
import type { WorldEnvironmentProperties } from './types.js';
import { parseNode } from '../../node/parser.js';

export function parseWorldEnvironment(
  heading: ParsedHeading,
  properties: Record<string, string>
): WorldEnvironmentProperties {
  const baseProps = parseNode(heading, properties);

  return {
    ...baseProps,
    environment: properties.environment ?? '',
    camera_attributes: properties.camera_attributes,
  };
}

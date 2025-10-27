/**
 * Node3D parser - parses Node3D nodes from TSCN.
 */

import type { ParsedHeading } from '../../parser/utils';
import type { Node3DProperties, Transform3D } from './types';
import { parseTransform3D, identityTransform3D } from '../../utils/transform';
import { warn } from '../../logger';

export function parseNode3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Node3DProperties {
  const name = heading.attributes.name || '';
  const parent = heading.attributes.parent;
  const instance = heading.attributes.instance;

  let transform: Transform3D | undefined;
  if (properties.transform) {
    try {
      transform = parseTransform3D(properties.transform);
    } catch (error) {
      warn(
        `Failed to parse transform for node "${name}": ${error instanceof Error ? error.message : String(error)}`
      );
      transform = identityTransform3D();
    }
  }

  return {
    name,
    parent,
    transform,
    instance,
  };
}

export function isNode3D(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'Node3D';
}

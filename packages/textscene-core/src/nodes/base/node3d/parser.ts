/**
 * Node3D parser - parses Node3D nodes from TSCN.
 */

import type { ParsedHeading } from '../../../parser/utils';
import type { Node3DProperties } from './types';
import { parseOptionalTransform } from '../../../utils/transform';

export function parseNode3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Node3DProperties {
  const name = heading.attributes.name || '';
  const parent = heading.attributes.parent;
  const instance = heading.attributes.instance;
  const index = heading.attributes.index ? Number(heading.attributes.index) : undefined;
  const transform = parseOptionalTransform(properties.transform, name);
  const visible = properties.visible === undefined ? undefined : properties.visible !== 'false';

  return {
    name,
    parent,
    transform,
    instance,
    index,
    visible,
  };
}

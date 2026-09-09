/**
 * Node3D parser - parses Node3D nodes from TSCN.
 */

import type { ParsedHeading } from '../../../parser/utils';
import type { Node3DProperties } from './types';
import { parseOptionalTransform } from '../../../utils/transform';
import { parseHeadingIndex } from '../../../parser/valueParsers';
import { boolSlotValue } from '../../../godot/index.js';

export function parseNode3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Node3DProperties {
  const name = heading.attributes.name || '';
  const parent = heading.attributes.parent;
  const instance = heading.attributes.instance;
  const index = parseHeadingIndex(heading.attributes.index);
  const transform = parseOptionalTransform(properties.transform, name);
  const visible = properties.visible === undefined ? undefined : boolSlotValue(properties.visible) !== false;

  return {
    name,
    parent,
    transform,
    instance,
    index,
    visible,
  };
}

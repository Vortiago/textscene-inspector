/**
 * Node3D parser - parses Node3D nodes from TSCN.
 */

import type { ParsedHeading } from '../../../parser/utils';
import type { Node3DProperties } from './types';
import { parseOptionalTransform } from '../../../utils/transform';
import { parseHeadingIndex } from '../../../parser/valueParsers';
import { boolSlotValue } from '../../../godot/index.js';
import { nodePathLiteral } from '../../../godot/variantParser.js';

export function parseNode3D(heading: ParsedHeading, properties: Record<string, string>): Node3DProperties {
  const name = heading.attributes.name || '';
  const parent = heading.attributes.parent;
  const instance = heading.attributes.instance;
  const index = parseHeadingIndex(heading.attributes.index);
  const transform = parseOptionalTransform(properties.transform, name);
  const visible = properties.visible === undefined ? undefined : boolSlotValue(properties.visible) !== false;
  const top_level =
    properties.top_level === undefined ? undefined : boolSlotValue(properties.top_level) === true;
  const visibility_parent = visibilityParentText(properties.visibility_parent);

  return {
    name,
    parent,
    transform,
    instance,
    index,
    visible,
    top_level,
    visibility_parent,
  };
}

/** An empty path is no path of its own: the node takes its Node3D parent's (`node_3d.cpp:1307-1318`). */
function visibilityParentText(raw: string | undefined): string | undefined {
  const text = raw === undefined ? '' : (nodePathLiteral(raw) ?? '');
  return text === '' ? undefined : text;
}

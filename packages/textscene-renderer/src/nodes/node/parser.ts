/**
 * Base Node parser - minimal parsing for hierarchy tracking.
 */

import type { ParsedHeading } from '../../parser/utils';
import type { NodeProperties } from './types';
import { parseOptionalTransform } from '../../utils/transform';

export function parseNode(
  heading: ParsedHeading,
  properties: Record<string, string>
): NodeProperties {
  const name = heading.attributes.name || '';
  const parent = heading.attributes.parent;
  const instance = heading.attributes.instance;
  const transform = parseOptionalTransform(properties.transform, name);

  return {
    name,
    parent,
    instance,
    transform,
  };
}

export function isNode(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'Node';
}

/**
 * CanvasLayer parser. CanvasLayer is NOT a Control (it has no anchors/offsets),
 * so it does not delegate to parseControl — only the heading's hierarchy
 * attributes, visibility, and layer.
 *
 * The hierarchy attributes are what rebuild the tree: a node parsed without its
 * `parent` is not attached to one, and since a scene has exactly one root it is
 * dropped along with everything under it. That is how every HUD written the way
 * Godot writes one — a CanvasLayer under the scene root — rendered as nothing.
 */

import { type ParsedHeading } from '../../../../parser/utils';
import { parseOptionalInt, parseHeadingIndex } from '../../../../parser/valueParsers';
import type { CanvasLayerProperties } from './types';

export function parseCanvasLayer(
  heading: ParsedHeading,
  properties: Record<string, string>
): CanvasLayerProperties {
  const result: CanvasLayerProperties = { name: heading.attributes.name || '' };
  if (heading.attributes.parent !== undefined) result.parent = heading.attributes.parent;
  if (heading.attributes.instance !== undefined) result.instance = heading.attributes.instance;
  const index = parseHeadingIndex(heading.attributes.index);
  if (index !== undefined) result.index = index;
  if (properties.visible !== undefined) result.visible = properties.visible !== 'false';
  const layer = parseOptionalInt(properties.layer);
  if (layer !== undefined) result.layer = layer;
  return result;
}

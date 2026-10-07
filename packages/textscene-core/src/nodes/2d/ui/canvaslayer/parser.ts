/**
 * CanvasLayer parser. CanvasLayer is not a Control, so it parses only the heading's
 * hierarchy attributes, visibility, layer and its canvas transform. Without its `parent` a node
 * attaches to nothing, and a scene has one root, so the layer and its subtree would be dropped.
 */

import { type ParsedHeading } from '../../../../parser/utils';
import { floatOr, parseOptionalInt, parseHeadingIndex, vec2Or } from '../../../../parser/valueParsers';
import { decomposeTransform2D } from '../../../base/node2d/parser';
import type { CanvasLayerProperties } from './types';
import { boolSlotValue } from '../../../../godot/index.js';
import { transform2DFromParts, type Transform2DColumns } from '../../../../godot/transform2d.js';

/**
 * The layer's canvas transform, shared with every CanvasLayer subclass. `_bind_methods` registers
 * `transform` after offset, rotation and scale (`canvas_layer.cpp:343-346`), so Godot writes it
 * last and `set_transform` stores the whole matrix, skew included.
 */
export function parseCanvasLayerTransform(
  properties: Record<string, string>,
  name: string
): Transform2DColumns {
  const parts = properties.transform ? decomposeTransform2D(properties.transform, name) : null;
  if (parts) return transform2DFromParts(parts.rotation, parts.scale, parts.skew, parts.position);
  const context = name || 'CanvasLayer';
  return transform2DFromParts(
    floatOr(properties.rotation, 0, context),
    vec2Or(properties.scale, { x: 1, y: 1 }, context),
    0,
    vec2Or(properties.offset, { x: 0, y: 0 }, context)
  );
}

export function parseCanvasLayer(
  heading: ParsedHeading,
  properties: Record<string, string>
): CanvasLayerProperties {
  const name = heading.attributes.name || '';
  const result: CanvasLayerProperties = {
    name,
    canvasTransform: parseCanvasLayerTransform(properties, name),
  };
  if (heading.attributes.parent !== undefined) result.parent = heading.attributes.parent;
  if (heading.attributes.instance !== undefined) result.instance = heading.attributes.instance;
  const index = parseHeadingIndex(heading.attributes.index);
  if (index !== undefined) result.index = index;
  if (properties.visible !== undefined) result.visible = boolSlotValue(properties.visible) !== false;
  const layer = parseOptionalInt(properties.layer);
  if (layer !== undefined) result.layer = layer;
  return result;
}

/**
 * VisualInstance3D parser: the Node3D transform plus the render layers, which every
 * VisualInstance3D parser starts from. An unreadable value keeps Godot's default.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseOptionalInt } from '../../../parser/valueParsers';
import { GODOT_DEFAULT_VISUAL_LAYERS } from '../../../godot/scene/visualLayers';
import { parseNode3D } from '../../base/node3d/parser';
import type { VisualInstance3DProperties } from './types';

export function parseVisualInstance3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): VisualInstance3DProperties {
  return { ...parseNode3D(heading, properties), layers: parseVisualLayers(properties) };
}

/** `layers`, for a parser that does not start from the Node3D fields, such as a light's. */
export function parseVisualLayers(properties: Record<string, string>): number {
  return parseOptionalInt(properties.layers, 'uint32') ?? GODOT_DEFAULT_VISUAL_LAYERS;
}

/**
 * Camera2D parser — Node2D transform + the framing surface (zoom, offset,
 * anchor_mode, enabled). Defaults follow Godot: zoom (1,1), anchor_mode
 * DRAG_CENTER (1), enabled true.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { intOr, vec2Or } from '../../../parser/valueParsers';
import { Camera2DAnchorMode, type Camera2DProperties } from './types';

export function isCamera2D(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'Camera2D';
}

export function parseCamera2D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Camera2DProperties {
  const base = parseNode2D(heading, properties);
  return {
    ...base,
    zoom: vec2Or(properties.zoom, { x: 1, y: 1 }, 'Camera2D'),
    offset: vec2Or(properties.offset, { x: 0, y: 0 }, 'Camera2D'),
    anchor_mode: intOr(properties.anchor_mode, Camera2DAnchorMode.DRAG_CENTER),
    enabled: properties.enabled === undefined ? true : properties.enabled !== 'false',
  };
}

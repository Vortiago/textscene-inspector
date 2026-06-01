/**
 * Camera2D parser — Node2D transform + the framing surface (zoom, offset,
 * anchor_mode, enabled). Defaults follow Godot: zoom (1,1), anchor_mode
 * DRAG_CENTER (1), enabled true.
 */

import type { ParsedHeading } from '../../../parser/utils';
import { parseNode2D } from '../../base/node2d/parser';
import { parseVector2 } from '../../../parser/vectors';
import { warn } from '../../../logger';
import { Camera2DAnchorMode, type Camera2DProperties } from './types';
import type { Vector2 } from '../../base/node2d/types';

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
    zoom: vec2Or(properties.zoom, { x: 1, y: 1 }),
    offset: vec2Or(properties.offset, { x: 0, y: 0 }),
    anchor_mode: intOr(properties.anchor_mode, Camera2DAnchorMode.DRAG_CENTER),
    enabled: properties.enabled === undefined ? true : properties.enabled !== 'false',
  };
}

function intOr(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function vec2Or(value: string | undefined, fallback: Vector2): Vector2 {
  if (!value) return fallback;
  try {
    return parseVector2(value);
  } catch {
    warn(`Camera2D: invalid Vector2 "${value}"`);
    return fallback;
  }
}

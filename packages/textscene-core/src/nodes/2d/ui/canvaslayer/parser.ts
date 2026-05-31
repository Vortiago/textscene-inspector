/**
 * CanvasLayer parser. CanvasLayer is NOT a Control (it has no anchors/offsets),
 * so it does not delegate to parseControl — only name, visibility, and layer.
 */

import { type ParsedHeading, intOr } from '../../../../parser/utils';
import type { CanvasLayerProperties } from './types';

export function parseCanvasLayer(
  heading: ParsedHeading,
  properties: Record<string, string>
): CanvasLayerProperties {
  const result: CanvasLayerProperties = { name: heading.attributes.name || '' };
  if (properties.visible !== undefined) result.visible = properties.visible !== 'false';
  const layer = intOr(properties.layer);
  if (layer !== undefined) result.layer = layer;
  return result;
}

export function isCanvasLayer(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'CanvasLayer';
}

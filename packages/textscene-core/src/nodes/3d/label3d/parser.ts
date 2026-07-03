/**
 * Label3D parser - parses Label3D TSCN properties
 */

import type { ParsedHeading } from '../../../parser/utils';
import type { Label3DProperties } from './types';
import { BillboardMode } from './types';
import { parseNode3D } from '../../base/node3d/parser';
import { parseColor } from '../../../utils/colorParser';
import { floatOr } from '../../../parser/valueParsers';

export function parseLabel3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Label3DProperties {
  const baseProps = parseNode3D(heading, properties);

  return {
    ...baseProps,
    text: parseText(properties.text),
    pixel_size: floatOr(properties.pixel_size, 0.005, 'pixel_size'),
    billboard: parseBillboardMode(properties.billboard),
    modulate: parseColor(properties.modulate),
    outline_size: floatOr(properties.outline_size, 12, 'outline_size'),
    outline_modulate: properties.outline_modulate ? parseColor(properties.outline_modulate) : { r: 0, g: 0, b: 0, a: 1 },
    double_sided: properties.double_sided !== 'false', // Godot default true
  };
}

function parseText(value: string | undefined): string {
  if (!value) return '';

  // Remove surrounding quotes
  return value.replace(/^"(.*)"$/, '$1');
}

function parseBillboardMode(value: string | undefined): BillboardMode {
  if (value === undefined) return BillboardMode.BILLBOARD_DISABLED;  // Godot default
  const num = parseInt(value, 10);

  if (num === 0) return BillboardMode.BILLBOARD_DISABLED;
  if (num === 2) return BillboardMode.BILLBOARD_FIXED_Y;

  return BillboardMode.BILLBOARD_ENABLED;  // default to enabled (1)
}

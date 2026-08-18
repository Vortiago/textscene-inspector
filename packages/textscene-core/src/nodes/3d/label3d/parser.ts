/**
 * Label3D parser - parses Label3D TSCN properties
 */

import { type ParsedHeading, unquoteString } from '../../../parser/utils';
import type { Label3DProperties } from './types';
import { AlphaCutMode, BillboardMode, HorizontalAlignment, TextureFilter } from './types';
import { parseNode3D } from '../../base/node3d/parser';
import { parseColor, colorOr } from '../../../utils/colorParser';
import { boolOr, floatOr, intOr } from '../../../parser/valueParsers';

export function parseLabel3D(
  heading: ParsedHeading,
  properties: Record<string, string>
): Label3DProperties {
  const baseProps = parseNode3D(heading, properties);

  return {
    ...baseProps,
    text: properties.text === undefined ? '' : unquoteString(properties.text),
    pixel_size: floatOr(properties.pixel_size, 0.005, 'pixel_size'),
    billboard: parseBillboardMode(properties.billboard),
    modulate: parseColor(properties.modulate),
    outline_size: floatOr(properties.outline_size, 12, 'outline_size'),
    outline_modulate: colorOr(properties.outline_modulate, { r: 0, g: 0, b: 0, a: 1 }),
    double_sided: properties.double_sided !== 'false', // Godot default true
    font_size: floatOr(properties.font_size, 32, 'font_size'),
    line_spacing: floatOr(properties.line_spacing, 0, 'line_spacing'),
    horizontal_alignment: parseHorizontalAlignment(properties.horizontal_alignment),
    no_depth_test: properties.no_depth_test === 'true',
    render_priority: intOr(properties.render_priority, 0, 'render_priority'),
    outline_render_priority: intOr(properties.outline_render_priority, -1, 'outline_render_priority'),
    alpha_cut: parseAlphaCutMode(properties.alpha_cut),
    alpha_scissor_threshold: floatOr(properties.alpha_scissor_threshold, 0.5, 'alpha_scissor_threshold'),
    fixed_size: boolOr(properties.fixed_size, false, 'Label3D fixed_size'),
    texture_filter: parseTextureFilter(properties.texture_filter),
  };
}

function parseAlphaCutMode(value: string | undefined): AlphaCutMode {
  const num = intOr(value, AlphaCutMode.DISABLED, 'alpha_cut');
  return num >= AlphaCutMode.DISABLED && num <= AlphaCutMode.HASH ? (num as AlphaCutMode) : AlphaCutMode.DISABLED;
}

function parseTextureFilter(value: string | undefined): TextureFilter {
  const num = intOr(value, TextureFilter.LINEAR_WITH_MIPMAPS, 'texture_filter');
  return num >= TextureFilter.NEAREST && num <= TextureFilter.LINEAR_WITH_MIPMAPS_ANISOTROPIC
    ? (num as TextureFilter)
    : TextureFilter.LINEAR_WITH_MIPMAPS;
}

function parseHorizontalAlignment(value: string | undefined): HorizontalAlignment {
  const num = intOr(value, HorizontalAlignment.CENTER, 'horizontal_alignment');
  return num >= HorizontalAlignment.LEFT && num <= HorizontalAlignment.FILL
    ? (num as HorizontalAlignment)
    : HorizontalAlignment.CENTER;
}

function parseBillboardMode(value: string | undefined): BillboardMode {
  if (value === undefined) return BillboardMode.BILLBOARD_DISABLED;  // Godot default
  const num = parseInt(value, 10);

  if (num === 0) return BillboardMode.BILLBOARD_DISABLED;
  if (num === 2) return BillboardMode.BILLBOARD_FIXED_Y;

  return BillboardMode.BILLBOARD_ENABLED;  // default to enabled (1)
}

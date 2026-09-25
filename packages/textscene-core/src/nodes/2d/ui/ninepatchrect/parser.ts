/** Parses a NinePatchRect: Control plus texture ref, patch margins, region and axis stretch. */

import { type ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalInt, parseOptionalRect2 } from '../../../../parser/valueParsers';
import type { NinePatchRectProperties } from './types';
import { parseControl } from '../control/parser';

export function parseNinePatchRect(
  heading: ParsedHeading,
  properties: Record<string, string>
): NinePatchRectProperties {
  const result: NinePatchRectProperties = { ...parseControl(heading, properties) };
  // `texture` stays a raw resource ref, not unquoted: the component resolves it in the scene's own scope.
  if (properties.texture !== undefined) result.texture = properties.texture;
  result.axisStretchHorizontal = parseOptionalInt(properties.axis_stretch_horizontal);
  result.axisStretchVertical = parseOptionalInt(properties.axis_stretch_vertical);
  result.drawCenter = parseOptionalBool(properties.draw_center);
  result.patchMarginLeft = parseOptionalInt(properties.patch_margin_left);
  result.patchMarginTop = parseOptionalInt(properties.patch_margin_top);
  result.patchMarginRight = parseOptionalInt(properties.patch_margin_right);
  result.patchMarginBottom = parseOptionalInt(properties.patch_margin_bottom);
  const region = parseOptionalRect2(properties.region_rect, 'NinePatchRect region_rect');
  if (region) result.regionRect = region;
  return result;
}

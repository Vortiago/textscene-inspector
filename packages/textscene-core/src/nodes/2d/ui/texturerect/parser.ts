/** Parses a TextureRect: Control, the texture ref and the expand and stretch modes. */

import { type ParsedHeading } from '../../../../parser/utils';
import { parseOptionalBool, parseOptionalInt } from '../../../../parser/valueParsers';
import type { TextureRectProperties } from './types';
import { parseControl } from '../control/parser';

export function parseTextureRect(
  heading: ParsedHeading,
  properties: Record<string, string>
): TextureRectProperties {
  const result: TextureRectProperties = { ...parseControl(heading, properties) };
  // `texture` stays a raw resource ref, not unquoted: the component resolves
  // it in the scene's external-resource table.
  if (properties.texture !== undefined) result.texture = properties.texture;
  result.expandMode = parseOptionalInt(properties.expand_mode);
  result.stretchMode = parseOptionalInt(properties.stretch_mode);
  result.flipH = parseOptionalBool(properties.flip_h);
  result.flipV = parseOptionalBool(properties.flip_v);
  return result;
}

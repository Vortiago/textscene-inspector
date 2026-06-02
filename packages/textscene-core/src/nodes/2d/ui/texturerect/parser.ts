/** TextureRect parser — Control + texture ref + expand/stretch modes. */

import { type ParsedHeading } from '../../../../parser/utils';
import { parseOptionalInt } from '../../../../parser/valueParsers';
import type { TextureRectProperties } from './types';
import { parseControl } from '../control/parser';

export function parseTextureRect(
  heading: ParsedHeading,
  properties: Record<string, string>
): TextureRectProperties {
  const result: TextureRectProperties = { ...parseControl(heading, properties) };
  // `texture` stays a raw resource ref — the component resolves it via the
  // scene's external-resource table (do not unquote).
  if (properties.texture !== undefined) result.texture = properties.texture;
  result.expandMode = parseOptionalInt(properties.expand_mode);
  result.stretchMode = parseOptionalInt(properties.stretch_mode);
  return result;
}

export function isTextureRect(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'TextureRect';
}

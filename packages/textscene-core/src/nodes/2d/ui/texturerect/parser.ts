/** TextureRect parser — Control + texture ref + expand/stretch modes. */

import type { ParsedHeading } from '../../../../parser/utils';
import type { TextureRectProperties } from './types';
import { parseControl } from '../control/parser';

function intOr(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? undefined : n;
}

export function parseTextureRect(
  heading: ParsedHeading,
  properties: Record<string, string>
): TextureRectProperties {
  const result: TextureRectProperties = { ...parseControl(heading, properties) };
  // `texture` stays a raw resource ref — the component resolves it via the
  // scene's external-resource table (do not unquote).
  if (properties.texture !== undefined) result.texture = properties.texture;
  result.expandMode = intOr(properties.expand_mode);
  result.stretchMode = intOr(properties.stretch_mode);
  return result;
}

export function isTextureRect(heading: ParsedHeading): boolean {
  return heading.type === 'node' && heading.attributes.type === 'TextureRect';
}

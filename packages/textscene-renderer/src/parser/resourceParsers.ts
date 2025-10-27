/**
 * Parsing for external and internal TSCN resources.
 */

import type { TscnExternalResource, TscnInternalResource } from './types';
import type { ParsedHeading } from './utils';

export function parseExternalResource(heading: ParsedHeading | null): TscnExternalResource | null {
  if (!heading) return null;

  const _id = heading.attributes.id;
  const path = heading.attributes.path;
  const type = heading.attributes.type;

  return {
    id: 0,
    path: path || '',
    type: type || '',
  };
}

export function parseInternalResource(
  heading: ParsedHeading | null,
  properties: Record<string, string>
): TscnInternalResource | null {
  if (!heading) return null;

  const id = heading.attributes.id;
  const type = heading.attributes.type;

  return {
    id: 0,
    type: type || '',
    data: { ...properties, id },
  };
}

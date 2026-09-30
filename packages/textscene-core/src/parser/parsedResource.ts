/**
 * Parses a whole `.tres`: a `.tscn` without `[node]` sections, with a `[gd_resource]`
 * header and one `[resource]` body. Rides TscnParserCore. A ParseObserver captures the
 * header type, which the core keeps only on a `[resource]` body. Values stay raw strings
 * for consumers such as the TileSet resolver to decode.
 */

import { TscnParserCore, type ParseObserver } from './TscnParserCore.js';
import type { TscnExternalResource, TscnInternalResource } from './types.js';

export interface ParsedResource {
  /** The [gd_resource type="…"] header type. */
  resourceType: string;
  /** The [resource] section's properties, raw value strings. */
  properties: Record<string, string>;
  extResources: TscnExternalResource[];
  subResources: TscnInternalResource[];
}

/** Throws when the content has no [gd_resource] header (not a .tres file). */
export function parseTresFile(content: string): ParsedResource {
  let resourceType: string | null = null;

  const observer: ParseObserver = {
    onSectionStart(heading) {
      if (heading.type === 'gd_resource') resourceType = heading.attributes.type ?? null;
    },
  };

  const scene = new TscnParserCore().parse(content, () => null, observer);

  if (!resourceType) {
    throw new Error('Invalid .tres file: missing [gd_resource] header type');
  }

  return {
    resourceType,
    properties: scene.mainResource?.data ?? {},
    extResources: scene.externalResources,
    subResources: scene.internalResources,
  };
}

/**
 * Parses a whole `.tres`: a `.tscn` without `[node]` sections, with a `[gd_resource]`
 * header and one `[resource]` body. Rides TscnParserCore. A ParseObserver captures the
 * header type and `[resource]` properties the core drops. Values stay raw strings for
 * consumers such as the TileSet resolver to decode.
 */

import { TscnParserCore, type ParseObserver } from './TscnParserCore.js';
import { resolveDeprecatedProperty } from '../godot/deprecated.js';
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
  let inResourceSection = false;
  const properties: Record<string, string> = {};

  const observer: ParseObserver = {
    onSectionStart(heading) {
      if (heading.type === 'gd_resource') {
        resourceType = heading.attributes.type ?? null;
        inResourceSection = false;
      } else {
        inResourceSection = heading.type === 'resource';
      }
    },
    onProperty(_section, ownerType, key, value) {
      // The observer hands over the line as written; the bag holds what the
      // setter writes, as the scanner's own bags do.
      if (!inResourceSection) return;
      const resolved = resolveDeprecatedProperty(ownerType, key, value);
      properties[resolved.key] = resolved.value;
    },
  };

  const scene = new TscnParserCore().parse(content, () => null, observer);

  if (!resourceType) {
    throw new Error('Invalid .tres file: missing [gd_resource] header type');
  }

  return {
    resourceType,
    properties,
    extResources: scene.externalResources,
    subResources: scene.internalResources,
  };
}

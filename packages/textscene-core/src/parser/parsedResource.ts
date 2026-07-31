/**
 * Full-file `.tres` (Godot resource file) parsing — a .tres is a .tscn without
 * [node] sections: a [gd_resource] header, [ext_resource]/[sub_resource]
 * sections, and one [resource] body. Rides the shared TscnParserCore scanning
 * loop: ext/sub resources come back from the core; a ParseObserver captures
 * what the core drops for non-scene files (the header type and the [resource]
 * properties). Values stay raw strings — typed decoding belongs to consumers
 * (e.g. the TileSet resolver, the material path).
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
    onProperty(_section, _ownerType, key, value) {
      if (inResourceSection) properties[key] = value;
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

/**
 * A texture saved as its own resource file, read as a sub-resource of the file's own tables, so every
 * resolver that reads an inline texture reads a saved one too. The file's ids are its own, so its
 * refs resolve against its tables, never the scene's.
 */

import type { ParsedResource } from '../../parser/parsedResource';
import type { TscnExternalResource, TscnInternalResource } from '../../parser/types';

interface ParsedResourceTexture {
  /** A `SubResource` ref to the file's `[resource]`. */
  ref: string;
  /** The file's sub-resources, with its `[resource]` among them. */
  internalResources: readonly TscnInternalResource[];
  externalResources: readonly TscnExternalResource[];
}

/** The id the file's `[resource]` takes in its table. Godot writes `Type_xxxxx` ids, never brackets. */
const MAIN_RESOURCE_ID = '[resource]';

/**
 * Written by `parsedResourceTexture`, once per parsed file. The procedural caches key their plans on
 * the table's identity, so a file read twice must give the same table.
 */
const textures = new WeakMap<ParsedResource, ParsedResourceTexture>();

export function parsedResourceTexture(parsed: ParsedResource): ParsedResourceTexture {
  let texture = textures.get(parsed);
  if (!texture) {
    const main: TscnInternalResource = {
      id: MAIN_RESOURCE_ID,
      type: parsed.resourceType,
      data: parsed.properties,
    };
    texture = {
      ref: `SubResource("${MAIN_RESOURCE_ID}")`,
      internalResources: [...parsed.subResources, main],
      externalResources: parsed.extResources,
    };
    textures.set(parsed, texture);
  }
  return texture;
}

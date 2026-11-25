/**
 * Parses a whole resource file into its property bag. A `.tres` is a `.tscn` without `[node]`
 * sections, with a `[gd_resource]` header and one `[resource]` body. Rides TscnParserCore. Values
 * stay raw strings for consumers such as the TileSet resolver to decode.
 */

import { stringLiteral } from '../godot/string/string.js';
import { TscnParserCore } from './TscnParserCore.js';
import type { FileValue, TscnExternalResource, TscnInternalResource } from './types.js';
import { UnparsedTextError } from './unparsedTextError';

export interface ParsedResource {
  /** The [gd_resource type="…"] header type. */
  resourceType: string;
  /** The [resource] section's properties, raw value strings. */
  properties: Record<string, string>;
  readonly extResources: readonly TscnExternalResource[];
  readonly subResources: readonly TscnInternalResource[];
  /** Each value the text loader parses, in file order. Absent in a file that has no text sections. */
  readonly fileValues?: readonly FileValue[];
}

/** Throws when the content has no [gd_resource] header (not a .tres file). */
export function parseTresFile(content: string): ParsedResource {
  const { scene } = new TscnParserCore().parse(content, () => null);
  const { resourceType } = scene;

  if (!resourceType) {
    throw new UnparsedTextError('Invalid .tres file: missing [gd_resource] header type');
  }

  return {
    resourceType,
    properties: scene.mainResource?.data ?? {},
    extResources: scene.externalResources,
    subResources: scene.internalResources,
    ...(scene.fileValues ? { fileValues: scene.fileValues } : {}),
  };
}

/** A `.gdshader` file as the Shader resource Godot loads from it, its text the code. */
export function parseShaderFile(content: string): ParsedResource {
  return {
    resourceType: 'Shader',
    properties: { code: stringLiteral(content) },
    extResources: [],
    subResources: [],
  };
}

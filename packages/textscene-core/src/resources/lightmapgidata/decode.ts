/**
 * `decodeLightmapGIData`: a LightmapGIData's property bag as the renderer reads it, from a
 * ParsedResource that a `.lmbake` or a `.tres` gives alike (ADR-0031). Each property's setter is
 * in `scene/3d/lightmap_gi.cpp`.
 */

import type { ParsedResource } from '../../parser/parsedResource';
import { parseOptionalRect2 } from '../../parser/valueParsers';
import { splitTopLevel } from '../../godot/string/string';
import { parseGodotInt } from '../../godot/variant/intReader';
import { parseGodotFloat } from '../../godot/variant/number';
import { resourceRef } from '../../godot/variant/resourceRef';
import { boolSlotValue } from '../../godot/variant/variantBool';
import { arrayLiteralBody, dictNumberField, nodePathLiteral } from '../../godot/variant/variantParser';
import { findExtResource } from '../SubResourceResolver';
import type { LightmapGIData, LightmapUser } from './types';

/** `_set_user_data` reads each user as four elements (`lightmap_gi.cpp:83-89`). */
const USER_FIELDS = 4;

/** `baked_exposure`'s default (`lightmap_gi.h:70`), which a bake without probe data keeps. */
const DEFAULT_BAKED_EXPOSURE = 1;

const BAKED_EXPOSURE_FIELD = dictNumberField('baked_exposure');

export function decodeLightmapGIData(resource: ParsedResource): LightmapGIData {
  const { properties } = resource;
  return {
    lightmapTextures: lightmapTexturePaths(properties.lightmap_textures, resource),
    // Off unless set (`lightmap_gi.h:63`).
    usesSphericalHarmonics: boolSlotValue(properties.uses_spherical_harmonics) ?? false,
    users: lightmapUsers(properties.user_data),
    bakedExposure: bakedExposure(properties.probe_data),
  };
}

/** The path of each external TextureLayered the array names, in order. */
function lightmapTexturePaths(raw: string | undefined, { extResources }: ParsedResource): string[] {
  const body = raw === undefined ? null : arrayLiteralBody(raw);
  if (body === null) return [];
  return splitTopLevel(body).flatMap((element) => {
    const ref = resourceRef(element);
    const external = ref?.kind === 'ExtResource' ? findExtResource(extResources, ref.id) : undefined;
    return external ? [external.path] : [];
  });
}

/**
 * Each group of four elements as a user. An array that is not whole groups keeps none, as
 * `_set_user_data` returns before it clears (`lightmap_gi.cpp:84`), and so does a group whose
 * element does not convert.
 */
function lightmapUsers(raw: string | undefined): LightmapUser[] {
  const body = raw === undefined ? null : arrayLiteralBody(raw);
  if (body === null) return [];
  const elements = splitTopLevel(body);
  if (elements.length % USER_FIELDS !== 0) return [];
  const users: LightmapUser[] = [];
  for (let i = 0; i < elements.length; i += USER_FIELDS) {
    const user = lightmapUser(elements.slice(i, i + USER_FIELDS));
    if (!user) return [];
    users.push(user);
  }
  return users;
}

function lightmapUser([pathText, rectText, sliceText, subInstanceText]: string[]): LightmapUser | null {
  const path = nodePathLiteral(pathText!);
  const uvScale = parseOptionalRect2(rectText, 'LightmapGIData user_data');
  const sliceIndex = parseGodotInt(sliceText!);
  const subInstance = parseGodotInt(subInstanceText!);
  if (path === null || !uvScale || sliceIndex === null || subInstance === null) return null;
  return { path, uvScale, sliceIndex, subInstance };
}

/** `probe_data["baked_exposure"]` (`lightmap_gi.cpp:282,288`), or the default without one. */
function bakedExposure(raw: string | undefined): number {
  const field = raw === undefined ? null : BAKED_EXPOSURE_FIELD.exec(raw);
  return (field && parseGodotFloat(field[1]!)) ?? DEFAULT_BAKED_EXPOSURE;
}

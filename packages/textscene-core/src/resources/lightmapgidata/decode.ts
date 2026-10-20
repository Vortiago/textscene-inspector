/**
 * `decodeLightmapGIData`: a LightmapGIData's property bag as the renderer reads it, from a
 * `.lmbake`, a `.tres` or a scene's sub-resource alike (ADR-0031). Each property's setter is
 * in `scene/3d/lightmap_gi.cpp`.
 */

import type { TscnExternalResource } from '../../parser/types';
import { parseOptionalAabb, parseOptionalRect2 } from '../../parser/valueParsers';
import { EMPTY_AABB, type Aabb } from '../../godot/math/aabb';
import { splitTopLevel } from '../../godot/string/string';
import { parseGodotInt } from '../../godot/variant/intReader';
import { resourceRef } from '../../godot/variant/resourceRef';
import { boolSlotValue } from '../../godot/variant/variantBool';
import { arrayLiteralBody, dictCallField, nodePathLiteral } from '../../godot/variant/variantParser';
import { LIGHTMAP_USER_FIELDS } from '../../godot/scene/lightmapGi';
import { missingProbeDataField } from './probeData';
import { findExtResource } from '../SubResourceResolver';
import type { LightmapGIData, LightmapUser } from './types';

/** `externalResources` are the pools the data's own `ExtResource` references resolve against. */
export function decodeLightmapGIData(
  properties: Record<string, string>,
  externalResources: readonly TscnExternalResource[]
): LightmapGIData {
  // Both off unless set (`lightmap_gi.h:63,66`).
  const usesSphericalHarmonics = boolSlotValue(properties.uses_spherical_harmonics) ?? false;
  const usesPackedDirectional = boolSlotValue(properties._uses_packed_directional) ?? false;
  // A LightmapGI refuses directional data in the unpacked format older bakes wrote (`:1509-1513`).
  const isAssignable = !usesSphericalHarmonics || usesPackedDirectional;
  return {
    lightmapTextures: lightmapTexturePaths(properties.lightmap_textures, externalResources),
    usesSphericalHarmonics,
    users: isAssignable ? lightmapUsers(properties.user_data) : [],
    bounds: captureBounds(properties.probe_data),
  };
}

const readBounds = dictCallField('bounds', 'AABB');
const readPoints = dictCallField('points', 'PackedVector3Array');

/**
 * The bounds `probe_data` gives the capture. `set_capture_data` keeps them only with probe points
 * (`:223-234`), and the data starts with none (`lightmap_gi.h:69`).
 */
function captureBounds(probeData: string | undefined): Aabb {
  if (probeData === undefined) return EMPTY_AABB;
  if (missingProbeDataField(probeData) !== null) return EMPTY_AABB;
  if (!readPoints(probeData)?.trim()) return EMPTY_AABB;
  const bounds = readBounds(probeData);
  return (bounds !== null && parseOptionalAabb(`AABB(${bounds})`, 'LightmapGIData probe_data')) || EMPTY_AABB;
}

/** The path of each external TextureLayered the array names, in order. */
function lightmapTexturePaths(
  raw: string | undefined,
  externalResources: readonly TscnExternalResource[]
): string[] {
  const body = raw === undefined ? null : arrayLiteralBody(raw);
  if (body === null) return [];
  return splitTopLevel(body).flatMap((element) => {
    const ref = resourceRef(element);
    const external = ref?.kind === 'ExtResource' ? findExtResource(externalResources, ref.id) : undefined;
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
  if (elements.length % LIGHTMAP_USER_FIELDS !== 0) return [];
  const users: LightmapUser[] = [];
  for (let i = 0; i < elements.length; i += LIGHTMAP_USER_FIELDS) {
    const user = lightmapUser(elements.slice(i, i + LIGHTMAP_USER_FIELDS));
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

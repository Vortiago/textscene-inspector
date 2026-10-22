/**
 * ReflectionProbe parser: the Node3D parse plus every property the probe draws with, as Godot's
 * setters leave them (`scene/3d/reflection_probe.cpp`).
 */

import {
  loadedOriginOffset,
  REFLECTION_PROBE_DEFAULTS,
  REFLECTION_PROBE_MAX_DISTANCE,
} from '../../../godot/scene/reflectionProbe';
import {
  ReflectionProbeAmbientMode,
  ReflectionProbeUpdateMode,
} from '../../../godot/rendering/environment/reflectionProbe';
import type { Vector3 } from '../../../godot/math/vector';
import { clamp } from '../../../godot/math/math';
import type { ParsedHeading } from '../../../parser/utils';
import { boolOr, enumOr, floatOr, intOr, vec3Or } from '../../../parser/valueParsers';
import { colorOr } from '../../../utils/colorParser';
import { parseNode3D } from '../../base/node3d/parser';
import type { ReflectionProbeProperties } from './types';
import type { EnumValue } from '../../../godot/classdb/enumNames.js';

const AMBIENT_MODES: readonly number[] = [
  ReflectionProbeAmbientMode.DISABLED,
  ReflectionProbeAmbientMode.ENVIRONMENT,
  ReflectionProbeAmbientMode.COLOR,
];

export function parseReflectionProbe(
  heading: ParsedHeading,
  properties: Record<string, string>
): ReflectionProbeProperties {
  const { size, originOffset } = parseBox(properties);
  return {
    ...parseNode3D(heading, properties),
    updateMode: enumOr(
      properties.update_mode,
      ReflectionProbeUpdateMode.ONCE,
      [ReflectionProbeUpdateMode.ONCE, ReflectionProbeUpdateMode.ALWAYS],
      'ReflectionProbe update_mode'
    ),
    intensity: floatOr(
      properties.intensity,
      REFLECTION_PROBE_DEFAULTS.intensity,
      'ReflectionProbe intensity'
    ),
    blendDistance: floatOr(
      properties.blend_distance,
      REFLECTION_PROBE_DEFAULTS.blendDistance,
      'ReflectionProbe blend_distance'
    ),
    maxDistance: parseMaxDistance(properties.max_distance),
    size,
    originOffset,
    boxProjection: boolOr(properties.box_projection, false, 'ReflectionProbe box_projection'),
    interior: boolOr(properties.interior, false, 'ReflectionProbe interior'),
    enableShadows: boolOr(properties.enable_shadows, false, 'ReflectionProbe enable_shadows'),
    cullMask: layerMask(properties.cull_mask, 'ReflectionProbe cull_mask'),
    reflectionMask: layerMask(properties.reflection_mask, 'ReflectionProbe reflection_mask'),
    ambientMode: parseAmbientMode(properties.ambient_mode),
    ambientColor: colorOr(properties.ambient_color, { r: 0, g: 0, b: 0, a: 1 }),
    ambientColorEnergy: floatOr(
      properties.ambient_color_energy,
      REFLECTION_PROBE_DEFAULTS.ambientColorEnergy,
      'ReflectionProbe ambient_color_energy'
    ),
  };
}

/** The size, and the origin offset its setters clamp against each size line in turn. */
function parseBox(properties: Record<string, string>): { size: Vector3; originOffset: Vector3 } {
  const size = vec3Or(properties.size, REFLECTION_PROBE_DEFAULTS.size, 'ReflectionProbe size');
  const originOffset = vec3Or(
    properties.origin_offset,
    REFLECTION_PROBE_DEFAULTS.originOffset,
    'ReflectionProbe origin_offset'
  );
  const lineValues = { size, origin_offset: originOffset };
  const lines = Object.keys(properties)
    .filter((key): key is keyof typeof lineValues => Object.hasOwn(lineValues, key))
    .map((key) => [key, lineValues[key]] as const);
  return { size, originOffset: loadedOriginOffset(lines) };
}

/** `set_max_distance` clamps to `[0, 262144]` (`reflection_probe.cpp:81`). */
function parseMaxDistance(value: string | undefined): number {
  const distance = floatOr(value, REFLECTION_PROBE_DEFAULTS.maxDistance, 'ReflectionProbe max_distance');
  return clamp(distance, 0, REFLECTION_PROBE_MAX_DISTANCE);
}

/** The setters take a `uint32_t` (`reflection_probe.h:117-120`). */
function layerMask(value: string | undefined, context: string): number {
  return intOr(value, REFLECTION_PROBE_DEFAULTS.layerMask, context, 'uint32');
}

/**
 * `set_ambient_mode` stores any int, and the scene shader's switch has a case only for the three
 * modes (`scene_forward_lights_inc.glsl:977-1001`), so another value adds no ambient.
 */
function parseAmbientMode(value: string | undefined): EnumValue<typeof ReflectionProbeAmbientMode> {
  const mode = intOr(value, REFLECTION_PROBE_DEFAULTS.ambientMode, 'ReflectionProbe ambient_mode');
  return AMBIENT_MODES.includes(mode)
    ? (mode as EnumValue<typeof ReflectionProbeAmbientMode>)
    : ReflectionProbeAmbientMode.DISABLED;
}

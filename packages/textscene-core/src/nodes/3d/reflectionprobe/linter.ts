/**
 * ReflectionProbe semantic rules: `ambient_color` or `ambient_color_energy` set while
 * `ambient_mode` is not AMBIENT_COLOR (2), an info that the value has no effect, and an
 * `origin_offset` that `size` clamps. Format validation lives in linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { ruleInt } from '../../../linter/validators/commonValidators.js';
import { matchVector3 } from '../../../linter/validators/vectorValidators.js';
import { sign } from '../../../godot/math.js';
import { formatReal, storedReal } from '../../../godot/real.js';

/** reflection_probe.h:44-48 enum AmbientMode; AMBIENT_COLOR is the last value. */
const AMBIENT_COLOR = 2;
/** reflection_probe.h:60, `AmbientMode ambient_mode = AMBIENT_ENVIRONMENT;` (1): the default for an absent key. */
const AMBIENT_MODE_DEFAULT = 1;

// `_validate_property` (reflection_probe.cpp:203-212) only sets PROPERTY_USAGE_NO_EDITOR,
// which equals PROPERTY_USAGE_STORAGE (object.h:132), so the keys still serialise. The
// class doc's prose is no basis (ADR-0032).
const AMBIENT_ONLY_KEYS = ['ambient_color', 'ambient_color_energy'] as const;

function checkAmbientMode(node: RuleContext['node'], props: Record<string, string>): Diagnostic[] {
  // light_storage.cpp:1817 copies `ambient_color` unconditionally, but its only read
  // (scene_forward_lights_inc.glsl:998) runs in `case REFLECTION_AMBIENT_COLOR:` of the
  // switch at scene_forward_lights_inc.glsl:977, in the `renderer_rd` backend of Forward+
  // and Mobile.
  const modeRaw = props.ambient_mode;
  const mode = ruleInt(modeRaw, AMBIENT_MODE_DEFAULT);
  if (mode === AMBIENT_COLOR) return [];

  const diagnostics: Diagnostic[] = [];
  for (const key of AMBIENT_ONLY_KEYS) {
    if (props[key] === undefined) continue;
    diagnostics.push({
      severity: 'info',
      message: `ReflectionProbe '${node.name}' sets '${key}' but 'ambient_mode' is not AMBIENT_COLOR (2), so '${key}' has no effect. It still saves and reloads fine; the editor just hides it from the inspector while another ambient mode is selected.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'reflectionprobe-ambient-color-no-effect',
    });
  }
  return diagnostics;
}

type Vector3Components = [x: number, y: number, z: number];

/** reflection_probe.h:55, `Vector3 size = Vector3(20, 20, 20);`. */
const DEFAULT_SIZE: Vector3Components = [20, 20, 20];
/** The margin both setters keep between `origin_offset` and the probe's face. */
const FACE_MARGIN = 0.01;

const formatVector3 = (v: Vector3Components): string => `Vector3(${v.map(formatReal).join(', ')})`;
const sameReal = (a: number, b: number): boolean => a === b || (Number.isNaN(a) && Number.isNaN(b));

/**
 * The `origin_offset` Godot holds after it applies the file's `size` and `origin_offset`
 * lines in order, or `null` when either is malformed. Both setters clamp each axis to
 * `half_size - 0.01` against the size in effect then (reflection_probe.cpp:99-131), so an
 * offset listed first meets the default size. Only `set_size` floors `half_size` at 0.01.
 */
function loadedOriginOffset(rawProps: Record<string, string>): Vector3Components | null {
  let size = DEFAULT_SIZE;
  let offset: Vector3Components = [0, 0, 0];

  const clampOffset = (floorHalfSize: boolean): void => {
    offset = offset.map((component, i) => {
      let halfSize = storedReal(size[i]! / 2);
      if (floorHalfSize && halfSize < FACE_MARGIN) halfSize = storedReal(FACE_MARGIN);
      const limit = halfSize - FACE_MARGIN;
      return limit < Math.abs(component) ? storedReal(sign(component) * limit) : component;
    }) as Vector3Components;
  };

  for (const [key, raw] of Object.entries(rawProps)) {
    if (key !== 'size' && key !== 'origin_offset') continue;
    const written = matchVector3(raw);
    if (!written) return null;
    const stored = [written.x, written.y, written.z].map(storedReal) as Vector3Components;
    if (key === 'size') size = stored;
    else offset = stored;
    clampOffset(key === 'size');
  }
  return offset;
}

function checkOriginOffset(node: RuleContext['node'], rawProps: Record<string, string>): Diagnostic[] {  if (rawProps.origin_offset === undefined) return [];
  const written = matchVector3(rawProps.origin_offset);
  const loaded = loadedOriginOffset(rawProps);
  if (!written || !loaded) return [];
  const stored = [written.x, written.y, written.z].map(storedReal) as Vector3Components;
  if (stored.every((component, i) => sameReal(component, loaded[i]!))) return [];
  return [
    {
      severity: 'warning',
      message: `ReflectionProbe 'origin_offset' ${formatVector3(stored)} loads as ${formatVector3(loaded)}: Godot clamps each axis to within half the 'size' less 0.01, against the size in effect when the file lists the offset.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'reflectionprobe-origin-offset-clamped',
    },
  ];
}

function checkReflectionProbe(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];
  const rawProps = node.properties as Record<string, string>;
  return [...checkAmbientMode(node, rawProps), ...checkOriginOffset(node, rawProps)];
}

const reflectionProbeValidationRule: LintRule = {
  meta: {
    name: 'valid-reflectionprobe-properties',
    description:
      "Flags ambient_color/ambient_color_energy authored while ambient_mode isn't AMBIENT_COLOR (legal and still serialised, but inert), and an origin_offset outside the probe's size, which Godot clamps at load",
    category: 'validation',
    applicableNodeTypes: ['ReflectionProbe'],
    emits: [
      {
        ruleName: 'reflectionprobe-ambient-color-no-effect',
        severity: 'info',
        grounding: {
          kind: 'engine-inert',
          at: 'scene_forward_lights_inc.glsl:998',
          unused: 'the ambient colour is read only while the mode is AMBIENT_COLOR',
        },
      },
      {
        ruleName: 'reflectionprobe-origin-offset-clamped',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'reflection_probe.cpp:99-131' },
      },
    ],
  },
  check: checkReflectionProbe,
};

ruleRegistry.register(reflectionProbeValidationRule);

export { reflectionProbeValidationRule };

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
import type { Vector3 } from '../../../parser/vectors.js';

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

/** reflection_probe.h:55, `Vector3 size = Vector3(20, 20, 20);`. */
const DEFAULT_SIZE: Vector3 = { x: 20, y: 20, z: 20 };
/** The margin both setters keep between `origin_offset` and the probe's face. */
const FACE_MARGIN = 0.01;
const AXES = ['x', 'y', 'z'] as const;

const formatVector3 = (v: Vector3): string => `Vector3(${AXES.map((axis) => formatReal(v[axis])).join(', ')})`;
const sameReal = (a: number, b: number): boolean => a === b || (Number.isNaN(a) && Number.isNaN(b));
const storedVector3 = (v: Vector3): Vector3 => ({ x: storedReal(v.x), y: storedReal(v.y), z: storedReal(v.z) });

/**
 * One setter's clamp of each `origin_offset` axis to `half_size - 0.01` against `size`
 * (reflection_probe.cpp:102-110, :126-131). Only `set_size` floors `half_size` at 0.01.
 */
function clampOffset(offset: Vector3, size: Vector3, floorHalfSize: boolean): Vector3 {
  const clampAxis = (axis: (typeof AXES)[number]): number => {
    let halfSize = storedReal(size[axis] / 2);
    if (floorHalfSize && halfSize < FACE_MARGIN) halfSize = storedReal(FACE_MARGIN);
    const limit = halfSize - FACE_MARGIN;
    const component = offset[axis];
    return limit < Math.abs(component) ? storedReal(sign(component) * limit) : component;
  };
  return { x: clampAxis('x'), y: clampAxis('y'), z: clampAxis('z') };
}

/**
 * The file's `origin_offset` and the one Godot holds after it applies the `size` and
 * `origin_offset` lines in order, or `null` when the offset is absent or either line is
 * malformed. An offset listed before `size` meets the default size first.
 */
function replayOriginOffset(rawProps: Record<string, string>): { written: Vector3; loaded: Vector3 } | null {
  let size = DEFAULT_SIZE;
  let written: Vector3 | null = null;
  let offset: Vector3 = { x: 0, y: 0, z: 0 };

  for (const [key, raw] of Object.entries(rawProps)) {
    if (key !== 'size' && key !== 'origin_offset') continue;
    const value = matchVector3(raw);
    if (!value) return null;
    const stored = storedVector3(value);
    if (key === 'size') {
      size = stored;
    } else {
      written = stored;
      offset = stored;
    }
    offset = clampOffset(offset, size, key === 'size');
  }
  return written ? { written, loaded: offset } : null;
}

function checkOriginOffset(node: RuleContext['node'], rawProps: Record<string, string>): Diagnostic[] {
  const replayed = replayOriginOffset(rawProps);
  if (!replayed) return [];
  const { written, loaded } = replayed;
  if (AXES.every((axis) => sameReal(written[axis], loaded[axis]))) return [];
  return [
    {
      severity: 'warning',
      message: `ReflectionProbe 'origin_offset' ${formatVector3(written)} loads as ${formatVector3(loaded)}: Godot clamps each axis to within half the 'size' less 0.01, against the size in effect when the file lists the offset.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'reflectionprobe-origin-offset-clamped',
    },
  ];
}

function checkReflectionProbe(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const rawProps = node.properties;
  if (!isValidProperties(rawProps)) return [];
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

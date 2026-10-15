/**
 * ReflectionProbe semantic rules: `ambient_color` or `ambient_color_energy` set while
 * `ambient_mode` is not AMBIENT_COLOR (2), an info that the value has no effect, and an
 * `origin_offset` that `size` clamps. Format validation lives in linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { ruleInt } from '../../../linter/validators/commonValidators.js';
import { matchVector3 } from '../../../linter/validators/vectorValidators.js';
import {
  loadedOriginOffset,
  REFLECTION_PROBE_DEFAULTS,
  ReflectionProbeAmbientMode,
} from '../../../godot/reflectionProbe.js';
import { formatReal, storedVector3 } from '../../../godot/real.js';
import type { Vector3 } from '../../../parser/vectors.js';
import { armDiagnostic, armEmits, groundedArm, reportArm, type RuleArms } from '../../../linter/ruleArms.js';

const arms = {
  ambientColorNoEffect: groundedArm('reflectionprobe-ambient-color-no-effect', {
    kind: 'engine-inert',
    at: 'scene_forward_lights_inc.glsl:998',
    unused: 'the ambient colour is read only while the mode is AMBIENT_COLOR',
  }),
  originOffsetClamped: {
    severity: 'warning',
    ruleName: 'reflectionprobe-origin-offset-clamped',
    grounding: { kind: 'engine', at: 'reflection_probe.cpp:99-131' },
  },
} as const satisfies RuleArms<string>;

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
  const mode = ruleInt(modeRaw, REFLECTION_PROBE_DEFAULTS.ambientMode);
  if (mode === ReflectionProbeAmbientMode.COLOR) return [];

  const diagnostics: Diagnostic[] = [];
  for (const key of AMBIENT_ONLY_KEYS) {
    if (props[key] === undefined) continue;
    reportArm(
      diagnostics,
      arms.ambientColorNoEffect,
      node,
      `ReflectionProbe '${node.name}' sets '${key}' but 'ambient_mode' is not AMBIENT_COLOR (2), so '${key}' has no effect. It still saves and reloads fine; the editor just hides it from the inspector while another ambient mode is selected.`
    );
  }
  return diagnostics;
}

const AXES = ['x', 'y', 'z'] as const;

const formatVector3 = (v: Vector3): string =>
  `Vector3(${AXES.map((axis) => formatReal(v[axis])).join(', ')})`;
const sameReal = (a: number, b: number): boolean => a === b || (Number.isNaN(a) && Number.isNaN(b));

/**
 * The file's `origin_offset` and the one Godot holds after it applies the `size` and
 * `origin_offset` lines in order, or `null` when the offset is absent or either line is malformed.
 */
function replayOriginOffset(rawProps: Record<string, string>): { written: Vector3; loaded: Vector3 } | null {
  const lines: ['size' | 'origin_offset', Vector3][] = [];
  for (const [key, raw] of Object.entries(rawProps)) {
    if (key !== 'size' && key !== 'origin_offset') continue;
    const value = matchVector3(raw);
    if (!value) return null;
    lines.push([key, value]);
  }
  const written = lines.find(([key]) => key === 'origin_offset')?.[1];
  if (!written) return null;
  return {
    written: storedVector3(written),
    loaded: loadedOriginOffset(lines),
  };
}

function checkOriginOffset(node: RuleContext['node'], rawProps: Record<string, string>): Diagnostic[] {
  const replayed = replayOriginOffset(rawProps);
  if (!replayed) return [];
  const { written, loaded } = replayed;
  if (AXES.every((axis) => sameReal(written[axis], loaded[axis]))) return [];
  return [
    armDiagnostic(
      arms.originOffsetClamped,
      node,
      `ReflectionProbe 'origin_offset' ${formatVector3(written)} loads as ${formatVector3(loaded)}: Godot clamps each axis to within half the 'size' less 0.01, against the size in effect when the file lists the offset.`
    ),
  ];
}

function checkReflectionProbe(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const rawProps = node.rawProperties;
  return [...checkAmbientMode(node, rawProps), ...checkOriginOffset(node, rawProps)];
}

const reflectionProbeValidationRule: LintRule = {
  meta: {
    name: 'valid-reflectionprobe-properties',
    description:
      "Flags ambient_color/ambient_color_energy authored while ambient_mode isn't AMBIENT_COLOR (legal and still serialised, but inert), and an origin_offset outside the probe's size, which Godot clamps at load",
    category: 'validation',
    applicableNodeTypes: ['ReflectionProbe'],
    emits: armEmits(arms),
  },
  check: checkReflectionProbe,
};

ruleRegistry.register(reflectionProbeValidationRule);

export { reflectionProbeValidationRule };

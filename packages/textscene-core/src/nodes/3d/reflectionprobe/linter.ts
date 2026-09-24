/**
 * ReflectionProbe semantic rule: `ambient_color` or `ambient_color_energy` set
 * while `ambient_mode` is not AMBIENT_COLOR (2). Both keys are legal and reload,
 * so the rule is an info that the value has no effect. Format validation lives
 * in linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { ruleInt } from '../../../linter/validators/commonValidators.js';

/** reflection_probe.h:44-48 enum AmbientMode; AMBIENT_COLOR is the last value. */
const AMBIENT_COLOR = 2;
/** reflection_probe.h:60, `AmbientMode ambient_mode = AMBIENT_ENVIRONMENT;` (1): the default for an absent key. */
const AMBIENT_MODE_DEFAULT = 1;

// `_validate_property` (reflection_probe.cpp:203-212) only sets PROPERTY_USAGE_NO_EDITOR,
// which equals PROPERTY_USAGE_STORAGE (object.h:132), so the keys still serialise. The
// class doc's prose is no basis (ADR-0032).
const AMBIENT_ONLY_KEYS = ['ambient_color', 'ambient_color_energy'] as const;

function checkAmbientMode(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];
  const props = node.properties;

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

const reflectionProbeAmbientModeRule: LintRule = {
  meta: {
    name: 'valid-reflectionprobe-ambient-mode',
    description:
      "Flags ambient_color/ambient_color_energy authored while ambient_mode isn't AMBIENT_COLOR — legal and still serialised, but inert",
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
    ],
  },
  check: checkAmbientMode,
};

ruleRegistry.register(reflectionProbeAmbientModeRule);

export { reflectionProbeAmbientModeRule };

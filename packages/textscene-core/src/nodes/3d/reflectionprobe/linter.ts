/**
 * Semantic rule for ReflectionProbe — `ambient_color`/`ambient_color_energy`
 * authored while `ambient_mode` is not AMBIENT_COLOR (2).
 *
 * Advisory (WARNING, never error): both keys are perfectly legal here.
 * `ReflectionProbe::_validate_property` (reflection_probe.cpp:203-212) only
 * hides them from the EDITOR inspector when `ambient_mode != AMBIENT_COLOR`,
 * by setting `PROPERTY_USAGE_NO_EDITOR` — and `PROPERTY_USAGE_NO_EDITOR ==
 * PROPERTY_USAGE_STORAGE` (object.h:132), so the STORAGE bit that controls
 * serialisation is untouched. A scene saved from the editor after the author
 * switched `ambient_mode` away from AMBIENT_COLOR keeps whatever
 * `ambient_color`/`ambient_color_energy` it last held, and Godot reloads that
 * file without complaint — this is not a defect Godot itself would refuse.
 *
 * What IS true, per the class doc ("Only effective if ambient_mode is
 * AMBIENT_COLOR"), is that the value has no effect while ambient_mode names a
 * different mode: same shape as CharacterBody's `floor_*` properties under
 * `motion_mode = FLOATING` (characterBodyLinterRule.ts) — legal, serialisable,
 * inert. The message says "set but has no effect", not "invalid" or
 * "dropped", because neither of those is what happens.
 *
 * Format validation lives in linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';

/** reflection_probe.h:44-48 enum AmbientMode; AMBIENT_COLOR is the last value. */
const AMBIENT_COLOR = 2;
/** reflection_probe.h:60 — `AmbientMode ambient_mode = AMBIENT_ENVIRONMENT;` (1), the default when the key is absent. */
const AMBIENT_MODE_DEFAULT = 1;

const AMBIENT_ONLY_KEYS = ['ambient_color', 'ambient_color_energy'] as const;

function checkAmbientMode(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];
  const props = node.properties;

  const modeRaw = props.ambient_mode;
  const mode = modeRaw !== undefined ? parseInt(modeRaw, 10) : AMBIENT_MODE_DEFAULT;
  if (mode === AMBIENT_COLOR) return [];

  const diagnostics: Diagnostic[] = [];
  for (const key of AMBIENT_ONLY_KEYS) {
    if (props[key] === undefined) continue;
    diagnostics.push({
      severity: 'warning',
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
        severity: 'warning',
        grounding: {
          kind: 'engine-inert',
          at: 'reflection_probe.cpp:208',
          unused: 'the ambient colour is read only while the mode is AMBIENT_COLOR',
        },
      },
    ],
  },
  check: checkAmbientMode,
};

ruleRegistry.register(reflectionProbeAmbientModeRule);

export { reflectionProbeAmbientModeRule };

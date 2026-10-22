/**
 * The warning for a ParticleProcessMaterial `_min` above its `_max`: the paired setters pull one bound
 * onto the other in file order (`particle_process_material.cpp:1295-1300, 1369-1375`). The rule checks
 * the section itself, so a material in a `.tres`, or one no node holds, warns too.
 */

import { armEmits, type RuleArms } from '../../../linter/ruleArms.js';
import { resourceRuleRegistry, type ResourceRule } from '../../../linter/ResourceRuleRegistry.js';
import { paramMinAboveMaxArm, paramMinAboveMaxFindings } from '../../../linter/particleParamRanges.js';
import { PARTICLE_PROCESS_MATERIAL_PARAMS } from '../../../godot/scene/particles3d.js';

const arms = {
  paramMinAboveMax: paramMinAboveMaxArm('particleprocessmaterial', 'particle_process_material.cpp:1295-1375'),
} as const satisfies RuleArms<string>;

const paramMinAboveMaxRule: ResourceRule = {
  meta: {
    name: 'valid-particleprocessmaterial',
    description:
      'Flags a ParticleProcessMaterial *_min above its *_max, where one of the two loads as the other',
    resourceType: 'ParticleProcessMaterial',
    emits: armEmits(arms),
  },
  check(data) {
    return paramMinAboveMaxFindings(data, PARTICLE_PROCESS_MATERIAL_PARAMS).map((finding) => ({
      arm: arms.paramMinAboveMax,
      ...finding,
    }));
  },
};

resourceRuleRegistry.register(paramMinAboveMaxRule);

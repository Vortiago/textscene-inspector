/**
 * The warning Godot prints when it loads a Real-Time sky whose radiance size is not 256: the
 * renderer's setters bake the sky at 256 regardless (`sky.cpp:590-592`, `:616-617`). The rule checks
 * the `Sky` section itself, so a sky in a `.tres`, or one no node holds, warns too.
 */

import { armEmits, type RuleArms } from '../../linter/ruleArms.js';
import { resourceRuleRegistry, type ResourceRule } from '../../linter/ResourceRuleRegistry.js';
import { REAL_TIME_RADIANCE_SIZE } from '../../godot/rendering/environment/skyReflection.js';
import { decodeSkyProcessing } from './decode.js';

const arms = {
  realTimeSize: {
    severity: 'warning',
    ruleName: 'real-time-sky-radiance-size',
    grounding: { kind: 'engine', at: 'sky.cpp:592' },
  },
} as const satisfies RuleArms<string>;

const realTimeSkySizeRule: ResourceRule = {
  meta: {
    name: 'valid-sky',
    description: 'Reports a Real-Time sky at a radiance size Godot replaces with 256',
    resourceType: 'Sky',
    emits: armEmits(arms),
  },
  check(data) {
    const { processMode, radianceSize } = decodeSkyProcessing(data);
    if (processMode !== 'real-time' || radianceSize === REAL_TIME_RADIANCE_SIZE) return [];
    return [
      {
        arm: arms.realTimeSize,
        property: 'process_mode',
        message:
          `Sky is Real-Time with a radiance size of ${radianceSize}. Godot bakes a Real-Time sky at ` +
          `${REAL_TIME_RADIANCE_SIZE} and prints a warning when it loads.`,
      },
    ];
  },
};

resourceRuleRegistry.register(realTimeSkySizeRule);

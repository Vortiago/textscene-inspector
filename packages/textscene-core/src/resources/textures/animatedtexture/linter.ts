import { visitIndexedKeys } from '../../../godot/classdb/indexedKey.js';
import { ANIMATED_TEXTURE_FRAMES as frames } from '../../../godot/scene/animatedTexture.js';
import { resourceRef } from '../../../godot/variant/resourceRef.js';
import { resourceRuleRegistry, type ResourceRule } from '../../../linter/ResourceRuleRegistry.js';
import { armEmits, type RuleArms } from '../../../linter/ruleArms.js';

const arms = {
  selfTexture: {
    severity: 'error',
    ruleName: 'animated-texture-self-reference',
    grounding: { kind: 'engine', at: 'animated_texture.cpp:133' },
  },
} as const satisfies RuleArms<string>;

const selfTexture: ResourceRule = {
  meta: {
    name: 'valid-animated-texture',
    description: 'Reports a frame that uses its own AnimatedTexture',
    resourceType: frames.owner,
    emits: armEmits(arms),
  },
  check(data, id) {
    const findings: ReturnType<ResourceRule['check']> = [];
    if (id === undefined) return findings;
    visitIndexedKeys(data, frames.prefix, frames.indexParse, (key, _text, index, leaf, value) => {
      if (leaf !== 'texture' || index >= frames.indexLimit.value) return;
      const ref = resourceRef(value);
      if (ref?.kind === 'SubResource' && ref.id === id) {
        findings.push({
          arm: arms.selfTexture,
          property: key,
          message: `${key} cannot use its own AnimatedTexture.`,
        });
      }
    });
    return findings;
  },
};

resourceRuleRegistry.register(selfTexture);

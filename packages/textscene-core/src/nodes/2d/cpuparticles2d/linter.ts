/**
 * Semantic rules for CPUParticles2D: a `*_min` above its `*_max`, which the setters resolve by
 * moving one of the two, and a bound the previewer cannot draw because it is non-finite.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { armDiagnostic, armEmits, groundedArm, type RuleArms } from '../../../linter/ruleArms.js';
import { CPU_PARTICLES_PARAMS } from '../../../godot/scene/cpuParticles.js';
import { paramMinAboveMaxArm, paramMinAboveMaxDiagnostics } from '../../../linter/paramMinAboveMax.js';
import { drawableParamBounds, type NonFiniteBound } from '../../shared/cpuparticles/drawableParamBounds.js';
import { formatReal } from '../../../godot/math/real.js';

const arms = {
  nonFiniteParamBound: groundedArm('cpuparticles2d-non-finite-param-bound', {
    kind: 'no-engine-counterpart',
    scope: 'previewer-limitation',
    because: 'the previewer cannot draw a particle whose range has an infinite or NaN bound',
  }),
  paramMinAboveMax: paramMinAboveMaxArm('cpuparticles2d', 'cpu_particles_2d.cpp:352-376'),
} as const satisfies RuleArms<string>;

function checkNonFiniteBounds(node: RuleContext['node'], nonFinite: readonly NonFiniteBound[]): Diagnostic[] {
  return nonFinite.map(({ key, stored }) =>
    armDiagnostic(
      arms.nonFiniteParamBound,
      node,
      `CPUParticles2D '${key}' is ${formatReal(stored)}. The previewer cannot draw a non-finite range, so it uses the default for '${key}'.`
    )
  );
}

function checkCPUParticles2D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const props = node.rawProperties;
  const { drawable, nonFinite } = drawableParamBounds(props);
  return [
    ...checkNonFiniteBounds(node, nonFinite),
    ...paramMinAboveMaxDiagnostics(node, drawable, CPU_PARTICLES_PARAMS, arms.paramMinAboveMax),
  ];
}

const cpuParticles2DValidationRule: LintRule = {
  meta: {
    name: 'valid-cpuparticles2d-properties',
    description:
      'Flags a CPUParticles2D *_min above its *_max, where one of the two loads as the other, and a bound the previewer cannot draw because it is non-finite',
    category: 'validation',
    applicableNodeTypes: ['CPUParticles2D'],
    emits: armEmits(arms),
  },
  check: checkCPUParticles2D,
};

ruleRegistry.register(cpuParticles2DValidationRule);

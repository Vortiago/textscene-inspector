/**
 * Semantic rules for CPUParticles2D: an emission shape whose result the frozen pose
 * cannot reproduce, and a `*_min` above its `*_max`, which the setters resolve by
 * moving one of the two. The emission shape is info: it is legal Godot, and the
 * emitter still draws particles, only not where the property puts them.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { armDiagnostic, armEmits, groundedArm, reportArm, type RuleArms } from '../../../linter/ruleArms.js';
import { CPU_PARTICLES_PARAMS } from '../../../godot/scene/cpuParticles.js';
import { paramMinAboveMaxArm, paramMinAboveMaxDiagnostics } from '../../../linter/paramMinAboveMax.js';
import { drawableParamBounds, type NonFiniteBound } from './drawableParamBounds.js';
import { formatReal } from '../../../godot/math/real.js';
import { ruleInt } from '../../../godot/variant/intSlots.js';
import { CPU_PARTICLES_2D_EMISSION_SHAPE_NAMES } from '../../../godot/scene/particles2d.js';

const arms = {
  nondeterministicEmissionShape: groundedArm('cpuparticles2d-nondeterministic-emission-shape', {
    kind: 'no-engine-counterpart',
    scope: 'previewer-limitation',
    because: 'the emitter samples an unserialised global RNG, so no static pose can place it',
  }),
  nonFiniteParamBound: groundedArm('cpuparticles2d-non-finite-param-bound', {
    kind: 'no-engine-counterpart',
    scope: 'previewer-limitation',
    because: 'the previewer cannot draw a particle whose range has an infinite or NaN bound',
  }),
  paramMinAboveMax: paramMinAboveMaxArm('cpuparticles2d', 'cpu_particles_2d.cpp:352-376'),
} as const satisfies RuleArms<string>;

/**
 * The EMISSION_SHAPE_* ordinals (enum at `cpu_particles_2d.h:71-80`) placed by
 * Godot's unsaved process-wide RNG: `Math::rand()` for POINTS/DIRECTED_POINTS
 * (`cpu_particles_2d.cpp:936`) and `Math::randf()` for RING (`:953`, `:956`). Two
 * runs of Godot itself differ, so no static pose can match.
 */
const GLOBAL_RNG_SHAPES = new Map<number, string>(
  [4, 5, 6].map((shape) => [shape, CPU_PARTICLES_2D_EMISSION_SHAPE_NAMES[shape]!])
);

function checkPreviewLimits(node: RuleContext['node'], props: Record<string, string>): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Keyed by the stored int, so `4.0` and `4e0`, FLOAT tokens the write truncates
  // to 4, read as the engine reads them. A Map reaches no prototype key.
  const shape = ruleInt(props.emission_shape);
  const shapeName = shape === null ? undefined : GLOBAL_RNG_SHAPES.get(shape);
  if (shapeName) {
    reportArm(
      diagnostics,
      arms.nondeterministicEmissionShape,
      node,
      `CPUParticles2D 'emission_shape = ${shapeName}' draws its positions from Godot's global RNG, which is never saved with the scene, so no static preview can place them. The previewer emits from the node origin instead.`
    );
  }

  return diagnostics;
}

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
    ...checkPreviewLimits(node, props),
    ...checkNonFiniteBounds(node, nonFinite),
    ...paramMinAboveMaxDiagnostics(node, drawable, CPU_PARTICLES_PARAMS, arms.paramMinAboveMax),
  ];
}

const cpuParticles2DValidationRule: LintRule = {
  meta: {
    name: 'valid-cpuparticles2d-properties',
    description:
      'Flags CPUParticles2D settings the previewer’s frozen pose cannot reproduce (global-RNG emission shapes), and a *_min above its *_max, where one of the two loads as the other, and a bound the previewer cannot draw because it is non-finite',
    category: 'validation',
    applicableNodeTypes: ['CPUParticles2D'],
    emits: armEmits(arms),
  },
  check: checkCPUParticles2D,
};

ruleRegistry.register(cpuParticles2DValidationRule);

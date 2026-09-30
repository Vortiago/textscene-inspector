/**
 * Semantic rules for CPUParticles2D: the two settings whose result the frozen pose
 * cannot reproduce, and a `*_min` above its `*_max`, which the setters resolve by
 * moving one of the two. The preview two are info: each is legal Godot, and the
 * emitter still draws particles, only not where the property puts them.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { armEmits, reportArm, type RuleArms } from '../../../linter/ruleArms.js';
import { paramMinAboveMaxArms, paramMinAboveMaxDiagnostics } from '../../../linter/particleParamRanges.js';
import { ruleInt, boolSlotValue} from '../../../godot/index.js';

const arms = {
  nondeterministicEmissionShape: {
    severity: 'info',
    ruleName: 'cpuparticles2d-nondeterministic-emission-shape',
    grounding: {
      kind: 'no-engine-counterpart',
      scope: 'previewer-limitation',
      because: 'the emitter samples an unserialised global RNG, so no static pose can place it',
    },
  },
  fractDeltaIgnored: {
    severity: 'info',
    ruleName: 'cpuparticles2d-fract-delta-ignored',
    grounding: {
      kind: 'no-engine-counterpart',
      scope: 'previewer-limitation',
      because: 'the frozen pose steps at a fixed rate, so a partial first step is unreachable',
    },
  },
  ...paramMinAboveMaxArms('cpuparticles2d', 'cpu_particles_2d.cpp:352-376'),
} as const satisfies RuleArms<'nondeterministicEmissionShape' | 'fractDeltaIgnored' | 'paramMinAboveMax'>;

/**
 * The EMISSION_SHAPE_* ordinals (enum at `cpu_particles_2d.cpp:1586`) placed by
 * Godot's unsaved process-wide RNG: `Math::rand()` for POINTS/DIRECTED_POINTS
 * (`cpu_particles_2d.cpp:936`) and `Math::randf()` for RING (`:953`, `:956`). Two
 * runs of Godot itself differ, so no static pose can match.
 */
const GLOBAL_RNG_SHAPES = new Map<number, string>([
  [4, 'POINTS'],
  [5, 'DIRECTED_POINTS'],
  [6, 'RING'],
]);

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

  // Godot's default is true, so only an explicit setting is reported: a report on
  // every emitter that omits the property would say nothing.
  if (boolSlotValue(props.fract_delta) === true) {
    reportArm(
      diagnostics,
      arms.fractDeltaIgnored,
      node,
      `CPUParticles2D 'fract_delta' gives a restarting particle a partial first step. The previewer's frozen pose steps at a fixed rate and ignores it, so particles land up to one frame behind Godot's.`
    );
  }

  return diagnostics;
}

function checkCPUParticles2D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  const props = node.properties;
  if (!isValidProperties(props)) return [];
  return [...checkPreviewLimits(node, props), ...paramMinAboveMaxDiagnostics(node, props, arms)];
}

const cpuParticles2DValidationRule: LintRule = {
  meta: {
    name: 'valid-cpuparticles2d-properties',
    description:
      'Flags CPUParticles2D settings the previewer’s frozen pose cannot reproduce (global-RNG emission shapes, fract_delta), and a *_min above its *_max, where one of the two loads as the other',
    category: 'validation',
    applicableNodeTypes: ['CPUParticles2D'],
    emits: armEmits(arms),
  },
  check: checkCPUParticles2D,
};

ruleRegistry.register(cpuParticles2DValidationRule);

export { cpuParticles2DValidationRule };

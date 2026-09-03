/**
 * Semantic rules for CPUParticles2D — the two settings whose result the
 * previewer's frozen pose cannot reproduce.
 *
 * Both are advisory (WARNING, never error): each is legal Godot that renders
 * fine in the engine. The warning exists because the divergence is otherwise
 * invisible — the emitter still draws particles, just not in the places the
 * property asks for.
 *
 * Format validation lives in linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';
import { ruleInt, boolSlotValue} from '../../../godot/index.js';

/**
 * The EMISSION_SHAPE_* ordinals whose positions come from Godot's process-wide
 * RNG rather than the per-particle one (`cpu_particles_2d.cpp:936`
 * `Math::rand()` for POINTS/DIRECTED_POINTS, `:953` and `:956` `Math::randf()`
 * for RING; the enum is at `:1586`, PROPERTY_HINT_ENUM
 * "Point,Sphere,Sphere Surface,Rectangle,Points,Directed Points,Ring"). That
 * RNG is never serialised, so the layout differs between two runs of Godot
 * itself — there is no pose a static previewer could match.
 *
 * Keyed by the stored INT, not by the file's text: the slot is Variant::INT, so
 * `4.0` and `4e0` are FLOAT tokens the write truncates to 4 and `+4` is the
 * same 4, and all three name a shape the preview cannot place.
 */
const GLOBAL_RNG_SHAPES = new Map<number, string>([
  [4, 'POINTS'],
  [5, 'DIRECTED_POINTS'],
  [6, 'RING'],
]);

function checkCPUParticles2D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];

  const props = node.properties as Record<string, string>;
  const diagnostics: Diagnostic[] = [];

  // A Map keyed by the stored int, so a value the engine converts is read the
  // way the engine reads it and no prototype key can be reached from the file.
  const shape = ruleInt(props.emission_shape);
  const shapeName = shape === null ? undefined : GLOBAL_RNG_SHAPES.get(shape);
  if (shapeName) {
    diagnostics.push({
      severity: 'info',
      message: `CPUParticles2D 'emission_shape = ${shapeName}' draws its positions from Godot's global RNG, which is never saved with the scene, so no static preview can place them. The previewer emits from the node origin instead.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'cpuparticles2d-nondeterministic-emission-shape',
    });
  }

  // Godot's default is TRUE, so only an explicit setting is worth reporting —
  // warning on every emitter that omits the property would say nothing.
  if (boolSlotValue(props.fract_delta) === true) {
    diagnostics.push({
      severity: 'info',
      message: `CPUParticles2D 'fract_delta' gives a restarting particle a partial first step. The previewer's frozen pose steps at a fixed rate and ignores it, so particles land up to one frame behind Godot's.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'cpuparticles2d-fract-delta-ignored',
    });
  }

  return diagnostics;
}

const cpuParticles2DPreviewRule: LintRule = {
  meta: {
    name: 'valid-cpuparticles2d-preview',
    description:
      'Flags CPUParticles2D settings the previewer’s frozen pose cannot reproduce: global-RNG emission shapes and fractional delta',
    category: 'validation',
    applicableNodeTypes: ['CPUParticles2D'],
    emits: [
      {
        ruleName: 'cpuparticles2d-nondeterministic-emission-shape',
        severity: 'info',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'previewer-limitation',
          because: 'the emitter samples an unserialised global RNG, so no static pose can place it',
        },
      },
      {
        ruleName: 'cpuparticles2d-fract-delta-ignored',
        severity: 'info',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'previewer-limitation',
          because: 'the frozen pose steps at a fixed rate, so a partial first step is unreachable',
        },
      },
    ],
  },
  check: checkCPUParticles2D,
};

ruleRegistry.register(cpuParticles2DPreviewRule);

export { cpuParticles2DPreviewRule };

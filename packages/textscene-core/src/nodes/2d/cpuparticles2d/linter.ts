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

/**
 * `emission_shape` values that sample Godot's process-wide RNG rather than the
 * per-particle one (`cpu_particles_2d.cpp:936` `Math::rand()` for
 * POINTS/DIRECTED_POINTS, `:953` and `:956` `Math::randf()` for RING). That RNG
 * is never serialised, so the emitter's
 * layout differs between two runs of Godot itself — there is no pose a static
 * previewer could match.
 */
const GLOBAL_RNG_SHAPES: Record<string, string> = {
  '4': 'POINTS',
  '5': 'DIRECTED_POINTS',
  '6': 'RING',
};

function checkCPUParticles2D(context: RuleContext): Diagnostic[] {
  const { node } = context;
  if (!isValidProperties(node.properties)) return [];

  const props = node.properties as Record<string, string>;
  const diagnostics: Diagnostic[] = [];

  const shape = props.emission_shape?.trim();
  const shapeName = shape === undefined ? undefined : GLOBAL_RNG_SHAPES[shape];
  if (shapeName) {
    diagnostics.push({
      severity: 'warning',
      message: `CPUParticles2D 'emission_shape = ${shapeName}' draws its positions from Godot's global RNG, which is never saved with the scene, so no static preview can place them. The previewer emits from the node origin instead.`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'cpuparticles2d-nondeterministic-emission-shape',
    });
  }

  // Godot's default is TRUE, so only an explicit setting is worth reporting —
  // warning on every emitter that omits the property would say nothing.
  if (props.fract_delta === 'true') {
    diagnostics.push({
      severity: 'warning',
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
        severity: 'warning',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'previewer-limitation',
          because: 'the emitter samples an unserialised global RNG, so no static pose can place it',
        },
      },
      {
        ruleName: 'cpuparticles2d-fract-delta-ignored',
        severity: 'warning',
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

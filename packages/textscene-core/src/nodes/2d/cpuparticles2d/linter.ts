/**
 * Semantic rules for CPUParticles2D — the one setting whose result the
 * previewer's frozen pose cannot reproduce.
 *
 * Advisory (WARNING, never error): it is legal Godot that renders fine in the
 * engine. The warning exists because the divergence is otherwise invisible —
 * the emitter still draws particles, just not in the places the property
 * asks for.
 *
 * Format validation lives in linterParser.ts.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../linter/types.js';
import { ruleRegistry } from '../../../linter/RuleRegistry.js';
import { isValidProperties } from '../../../linter/linterUtils.js';

/**
 * `emission_shape` values that sample Godot's process-wide RNG rather than the
 * per-particle one (`cpu_particles_2d.cpp:975` for POINTS/DIRECTED_POINTS,
 * `:992` and `:995` for RING). That RNG is never serialised, so the emitter's
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
  if (node.type !== 'CPUParticles2D') return [];
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

  return diagnostics;
}

const cpuParticles2DPreviewRule: LintRule = {
  meta: {
    name: 'valid-cpuparticles2d-preview',
    description:
      'Flags CPUParticles2D settings the previewer’s frozen pose cannot reproduce: global-RNG emission shapes',
    category: 'validation',
    applicableNodeTypes: ['CPUParticles2D'],
    emits: [{ ruleName: 'cpuparticles2d-nondeterministic-emission-shape', severity: 'warning' }],
  },
  check: checkCPUParticles2D,
};

ruleRegistry.register(cpuParticles2DPreviewRule);

export { cpuParticles2DPreviewRule };

/**
 * Semantic linter rules for GPUParticles3D
 *
 * Note: Format validation (amount > 0, explosiveness range, etc.) is handled
 * by linterParser.ts during strict parsing. This file focuses on semantic validation
 * that requires full scene context (e.g., resource references exist).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { heldResource } from '../../../../linter/resourceChecker.js';
import { extractNodePath } from '../../../../linter/linterUtils.js';
import { resolveNodePath } from '../../../../linter/nodePathResolve.js';

/** One key per draw pass; `MAX_DRAW_PASSES = 4` (gpu_particles_3d.h:56). */
const DRAW_PASS_KEYS = ['draw_pass_1', 'draw_pass_2', 'draw_pass_3', 'draw_pass_4'] as const;

/**
 * Validate GPUParticles3D semantic rules (resource references, trail config, etc.)
 */
function checkGPUParticles3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;


  // Access raw properties from the node (Record<string, string>)
  const rawProps = node.properties as unknown as Record<string, string>;

  // WARNING: a material-less emitter is valid (the material can be assigned
  // at runtime) but renders no particles until one is set.
  if (heldResource(rawProps.process_material) === undefined) {
    diagnostics.push({
      severity: 'warning',
      message: `GPUParticles3D has no 'process_material' set. Particles will not render until one is assigned`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'gpuparticles3d-missing-process-material',
    });
  }

  // gpu_particles_3d.cpp:342-363: `meshes_found` scans every draw_pass_N mesh
  // in `draw_passes` (size defaults to 1, gpu_particles_3d.cpp:898) and warns
  // if none is set. A `draw_pass_N` key can only be present in a `.tscn` for
  // an index the author's own `draw_passes` count made visible
  // (`_validate_property`, gpu_particles_3d.cpp:462-466), so any present
  // `draw_pass_N` key is in scope regardless of what `draw_passes` says here —
  // this stays a simple "no key at all has a mesh" scan rather than also
  // re-deriving that bound. `meshes_found` tests `is_valid()`, so the `null` an
  // empty pass serialises to is not a mesh (`draw_passes = 2` with one mesh
  // writes it, and Godot reloads it without complaint).
  if (DRAW_PASS_KEYS.every((key) => heldResource(rawProps[key]) === undefined)) {
    diagnostics.push({
      severity: 'warning',
      message:
        'GPUParticles3D has no mesh assigned to any draw pass. Nothing is visible until at least one draw_pass_N mesh is set.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'gpuparticles3d-no-draw-pass-mesh',
    });
  }

  // sub_emitter names a GPUParticles3D node; empty/non-NodePath means "no
  // sub-emitter". All three arms below are the engine-inert tier:
  // `_attach_sub_emitter` walks the path with `get_node_or_null` and skips the
  // attach when the node is missing (`if (n)`, gpu_particles_3d.cpp:484), the
  // cast fails (:485) or the target is this node (:486) — nothing is refused
  // or altered, so each is a warning. `resolveNodePath` declines —
  // `unknowable`, its only decline — whenever the walk touches content another
  // file declares, so no arm fires on a target this file cannot classify.
  if (rawProps.sub_emitter) {
    const subEmitterPath = extractNodePath(rawProps.sub_emitter);
    if (subEmitterPath) {
      const target = resolveNodePath(scene, node, subEmitterPath);

      if (target.status === 'missing') {
        diagnostics.push({
          severity: 'info',
          message: `Sub-emitter node not found: NodePath("${subEmitterPath}"). Godot keeps the path and emits no sub-particles.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'valid-gpuparticles3d-sub-emitter',
        });
      } else if (target.status === 'found' && target.node === node) {
        // The OTHER half of `if (sen && sen != this)`
        // (gpu_particles_3d.cpp:485-486): a path back to this very node passes
        // the cast and is then dropped by the identity test, so the emitter
        // never becomes its own sub-emitter. Checked before the type arm
        // because a self path always passes it.
        diagnostics.push({
          severity: 'info',
          message: `Sub-emitter property points back at '${node.name}' itself. Godot keeps the path and emits no sub-particles.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'gpuparticles3d-sub-emitter-self',
        });
      } else if (target.status === 'found' && target.node.type !== 'GPUParticles3D') {
        // The path RESOLVES here; `_attach_sub_emitter` casts the node it
        // walked to and skips the attach when the cast fails
        // (gpu_particles_3d.cpp:485). The property's
        // PROPERTY_HINT_NODE_PATH_VALID_TYPES only constrains the inspector's
        // node picker and grounds nothing.
        diagnostics.push({
          severity: 'info',
          message: `Sub-emitter property points to a ${target.node.type} node, but must point to a GPUParticles3D node. Godot keeps the path and emits no sub-particles.`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'gpuparticles3d-sub-emitter-wrong-type',
        });
      }
    }
  }

  return diagnostics;
}

/**
 * GPUParticles3D semantic validation rule
 */
const gpuParticles3DValidationRule: LintRule = {
  meta: {
    name: 'valid-gpuparticles3d-resources',
    description: 'Validates GPUParticles3D process material and draw-pass mesh presence, and sub-emitter paths',
    category: 'validation',
    applicableNodeTypes: ['GPUParticles3D'],
    emits: [
      { ruleName: 'gpuparticles3d-missing-process-material', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      { ruleName: 'gpuparticles3d-no-draw-pass-mesh', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      {
        ruleName: 'valid-gpuparticles3d-sub-emitter',
        severity: 'info',
        grounding: {
          kind: 'engine-inert',
          at: 'gpu_particles_3d.cpp:484',
          unused: 'get_node_or_null finds nothing and the attach is skipped, so no sub-emitter is set',
        },
      },
      {
        ruleName: 'gpuparticles3d-sub-emitter-self',
        severity: 'info',
        grounding: {
          kind: 'engine-inert',
          at: 'gpu_particles_3d.cpp:486',
          unused: 'the `sen != this` arm skips the attach, so no sub-emitter is set',
        },
      },
      {
        ruleName: 'gpuparticles3d-sub-emitter-wrong-type',
        severity: 'info',
        grounding: {
          kind: 'engine-inert',
          at: 'gpu_particles_3d.cpp:485',
          unused: 'the cast to GPUParticles3D fails, so no sub-emitter is set',
        },
      },
    ],
  },
  check: checkGPUParticles3D,
};

// Self-register the rule
ruleRegistry.register(gpuParticles3DValidationRule);

// Export for testing
export { gpuParticles3DValidationRule };

/**
 * Semantic linter rules for GPUParticles3D: the checks that need the whole
 * scene, such as whether a resource or a sub-emitter exists. linterParser.ts
 * owns format and range validation.
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { heldResource } from '../../../../linter/resourceChecker.js';
import { extractNodePath } from '../../../../linter/linterUtils.js';
import { resolveNodePath } from '../../../../linter/nodePathResolve.js';
import { armEmits, groundedArm, reportArm, type RuleArms } from '../../../../linter/ruleArms.js';

const arms = {
  missingProcessMaterial: groundedArm('gpuparticles3d-missing-process-material', {
    kind: 'configuration-warning',
  }),
  noDrawPassMesh: groundedArm('gpuparticles3d-no-draw-pass-mesh', { kind: 'configuration-warning' }),
  subEmitterNotFound: groundedArm('valid-gpuparticles3d-sub-emitter', {
    kind: 'engine-inert',
    at: 'gpu_particles_3d.cpp:484',
    unused: 'get_node_or_null finds nothing and the attach is skipped, so no sub-emitter is set',
  }),
  subEmitterSelf: groundedArm('gpuparticles3d-sub-emitter-self', {
    kind: 'engine-inert',
    at: 'gpu_particles_3d.cpp:486',
    unused: 'the `sen != this` arm skips the attach, so no sub-emitter is set',
  }),
  subEmitterWrongType: groundedArm('gpuparticles3d-sub-emitter-wrong-type', {
    kind: 'engine-inert',
    at: 'gpu_particles_3d.cpp:485',
    unused: 'the cast to GPUParticles3D fails, so no sub-emitter is set',
  }),
} as const satisfies RuleArms<string>;

/** One key per draw pass; `MAX_DRAW_PASSES = 4` (gpu_particles_3d.h:56). */
const DRAW_PASS_KEYS = ['draw_pass_1', 'draw_pass_2', 'draw_pass_3', 'draw_pass_4'] as const;

function checkGPUParticles3D(context: RuleContext): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const { node, scene } = context;

  const rawProps = node.rawProperties;

  // A material-less emitter is valid, since a script can assign one, but renders no
  // particles until then.
  if (heldResource(rawProps.process_material) === undefined) {
    reportArm(
      diagnostics,
      arms.missingProcessMaterial,
      node,
      `GPUParticles3D has no 'process_material' set. Particles will not render until one is assigned`
    );
  }

  // gpu_particles_3d.cpp:342-363 warns when no draw pass in `draw_passes` (default 1,
  // gpu_particles_3d.cpp:898) has a mesh. A `draw_pass_N` key is only written for an
  // index `draw_passes` exposes (gpu_particles_3d.cpp:462-466), so every present key is
  // in scope. `meshes_found` tests `is_valid()`, so a `null` pass is no mesh.
  if (DRAW_PASS_KEYS.every((key) => heldResource(rawProps[key]) === undefined)) {
    reportArm(
      diagnostics,
      arms.noDrawPassMesh,
      node,
      'GPUParticles3D has no mesh assigned to any draw pass. Nothing is visible until at least one draw_pass_N mesh is set.'
    );
  }

  // `_attach_sub_emitter` skips the attach when the node is missing (gpu_particles_3d.cpp:484),
  // the cast fails (:485) or the target is this node (:486), so each arm is engine-inert.
  // `resolveNodePath` returns `unknowable` when the walk reaches content another file
  // declares, so no arm fires on a target this file cannot classify.
  if (rawProps.sub_emitter) {
    const subEmitterPath = extractNodePath(rawProps.sub_emitter);
    if (subEmitterPath) {
      const target = resolveNodePath(scene, node, subEmitterPath);

      if (target.status === 'missing') {
        reportArm(
          diagnostics,
          arms.subEmitterNotFound,
          node,
          `Sub-emitter node not found: NodePath("${subEmitterPath}"). Godot keeps the path and emits no sub-particles.`
        );
      } else if (target.status === 'found' && target.node === node) {
        // A path back to this node passes the cast and fails `sen != this`
        // (gpu_particles_3d.cpp:485-486). Checked before the type arm, which a self path
        // always passes.
        reportArm(
          diagnostics,
          arms.subEmitterSelf,
          node,
          `Sub-emitter property points back at '${node.name}' itself. Godot keeps the path and emits no sub-particles.`
        );
      } else if (target.status === 'found' && target.node.type !== 'GPUParticles3D') {
        // `_attach_sub_emitter` skips the attach when the cast fails
        // (gpu_particles_3d.cpp:485). PROPERTY_HINT_NODE_PATH_VALID_TYPES only
        // constrains the inspector's node picker and grounds nothing.
        reportArm(
          diagnostics,
          arms.subEmitterWrongType,
          node,
          `Sub-emitter property points to a ${target.node.type} node, but must point to a GPUParticles3D node. Godot keeps the path and emits no sub-particles.`
        );
      }
    }
  }

  return diagnostics;
}

const gpuParticles3DValidationRule: LintRule = {
  meta: {
    name: 'valid-gpuparticles3d-resources',
    description:
      'Validates GPUParticles3D process material and draw-pass mesh presence, and sub-emitter paths',
    category: 'validation',
    applicableNodeTypes: ['GPUParticles3D'],
    emits: armEmits(arms),
  },
  check: checkGPUParticles3D,
};

ruleRegistry.register(gpuParticles3DValidationRule);

export { gpuParticles3DValidationRule };

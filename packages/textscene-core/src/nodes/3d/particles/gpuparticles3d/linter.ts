/**
 * Semantic linter rules for GPUParticles3D
 *
 * Note: Format validation (amount > 0, explosiveness range, etc.) is handled
 * by linterParser.ts during strict parsing. This file focuses on semantic validation
 * that requires full scene context (e.g., resource references exist, trail configuration).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { checkResourceExists } from '../../../../linter/resourceChecker.js';
import { extractNodePath, resolveNodePathTarget } from '../../../../linter/linterUtils.js';

/** Top of the `amount` hint, gpu_particles_3d.cpp:821 — "1,1000000,1,exp". */
const MAX_HINTED_PARTICLE_AMOUNT = 1000000;

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
  if (!rawProps.process_material) {
    diagnostics.push({
      severity: 'warning',
      message: `GPUParticles3D has no 'process_material' set. Particles will not render until one is assigned`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'gpuparticles3d-missing-process-material',
    });
  } else {
    // Check if process_material resource exists
    const resourceExists = checkResourceExists(scene, rawProps.process_material);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Process material resource not found: ${rawProps.process_material}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-gpuparticles3d-process-material',
      });
    }
  }

  // Check if draw_pass_1 resource exists (if specified)
  if (rawProps.draw_pass_1) {
    const resourceExists = checkResourceExists(scene, rawProps.draw_pass_1);
    if (!resourceExists) {
      diagnostics.push({
        severity: 'error',
        message: `Draw pass mesh resource not found: ${rawProps.draw_pass_1}`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-gpuparticles3d-resources',
      });
    }
  }

  // gpu_particles_3d.cpp:342-363: `meshes_found` scans every draw_pass_N mesh
  // in `draw_passes` (size defaults to 1, gpu_particles_3d.cpp:898) and warns
  // if none is set. A `draw_pass_N` key can only be present in a `.tscn` for
  // an index the author's own `draw_passes` count made visible
  // (`_validate_property`, gpu_particles_3d.cpp:462-466), so any present
  // `draw_pass_N` key is in scope regardless of what `draw_passes` says here —
  // this stays a simple "no key at all has a mesh" scan rather than also
  // re-deriving that bound.
  const hasDrawPassMesh = Object.keys(rawProps).some(
    (key) => /^draw_pass_\d+$/.test(key) && rawProps[key]
  );
  if (!hasDrawPassMesh) {
    diagnostics.push({
      severity: 'warning',
      message:
        'GPUParticles3D has no mesh assigned to any draw pass. Nothing is visible until at least one draw_pass_N mesh is set.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'gpuparticles3d-no-draw-pass-mesh',
    });
  }

  // Validate trail configuration
  if (rawProps.trail_lifetime) {
    const trailLifetime = parseFloat(rawProps.trail_lifetime);
    const trailEnabled = rawProps.trail_enabled === 'true';

    if (!isNaN(trailLifetime) && trailLifetime > 0 && !trailEnabled) {
      diagnostics.push({
        severity: 'error',
        message: `Trail lifetime is set to ${trailLifetime}, but 'trail_enabled' is false. Set 'trail_enabled=true' to enable particle trails`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'valid-gpuparticles3d-trail-config',
      });
    }
  }

  // sub_emitter must reference an existing GPUParticles3D node; empty/non-NodePath
  // means "no sub-emitter". resolveNodePathTarget suppresses escapes/ambiguous
  // paths (see its JSDoc).
  if (rawProps.sub_emitter) {
    const subEmitterPath = extractNodePath(rawProps.sub_emitter);
    if (subEmitterPath) {
      const target = resolveNodePathTarget(scene.nodes, node, subEmitterPath);

      if (target.status === 'missing') {
        diagnostics.push({
          severity: 'error',
          message: `Sub-emitter node not found: NodePath("${subEmitterPath}")`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'valid-gpuparticles3d-sub-emitter',
        });
      } else if (target.status === 'found' && target.node.type !== 'GPUParticles3D') {
        diagnostics.push({
          severity: 'error',
          message: `Sub-emitter property points to a ${target.node.type} node, but must point to a GPUParticles3D node`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'valid-gpuparticles3d-sub-emitter',
        });
      }
    }
  }

  // Warning: amount above the ceiling the inspector offers. gpu_particles_3d.cpp:821
  // hints "1,1000000,1,exp" — no `or_greater`, so 1,000,000 is a real top end —
  // but set_amount (:76) only refuses values below 1, so exceeding it is advisory.
  if (rawProps.amount) {
    const amount = parseInt(rawProps.amount, 10);
    if (!isNaN(amount) && amount > MAX_HINTED_PARTICLE_AMOUNT) {
      diagnostics.push({
        severity: 'warning',
        message: `Particle amount is ${amount}. The editor range for 'amount' stops at ${MAX_HINTED_PARTICLE_AMOUNT}; counts this high are a severe performance risk`,
        nodeName: node.name,
        nodeType: node.type,
        ruleName: 'gpuparticles3d-performance',
      });
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
    description: 'Validates GPUParticles3D resource references, trail configuration, sub-emitter paths, and performance considerations',
    category: 'validation',
    applicableNodeTypes: ['GPUParticles3D'],
    emits: [
      { ruleName: 'gpuparticles3d-missing-process-material', severity: 'warning' },
      { ruleName: 'valid-gpuparticles3d-process-material', severity: 'error' },
      { ruleName: 'valid-gpuparticles3d-resources', severity: 'error' },
      { ruleName: 'gpuparticles3d-no-draw-pass-mesh', severity: 'warning' },
      { ruleName: 'valid-gpuparticles3d-trail-config', severity: 'error' },
      { ruleName: 'valid-gpuparticles3d-sub-emitter', severity: 'error' },
      { ruleName: 'gpuparticles3d-performance', severity: 'warning' },
    ],
  },
  check: checkGPUParticles3D,
};

// Self-register the rule
ruleRegistry.register(gpuParticles3DValidationRule);

// Export for testing
export { gpuParticles3DValidationRule };

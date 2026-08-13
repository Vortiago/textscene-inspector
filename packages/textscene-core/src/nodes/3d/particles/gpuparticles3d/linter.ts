/**
 * Semantic linter rules for GPUParticles3D
 *
 * Note: Format validation (amount > 0, explosiveness range, etc.) is handled
 * by linterParser.ts during strict parsing. This file focuses on semantic validation
 * that requires full scene context (e.g., resource references exist).
 */

import type { LintRule, Diagnostic, RuleContext } from '../../../../linter/types.js';
import { ruleRegistry } from '../../../../linter/RuleRegistry.js';
import { checkResourceExists, heldResource } from '../../../../linter/resourceChecker.js';
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
  const processMaterial = heldResource(rawProps.process_material);
  if (processMaterial === undefined) {
    diagnostics.push({
      severity: 'warning',
      message: `GPUParticles3D has no 'process_material' set. Particles will not render until one is assigned`,
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'gpuparticles3d-missing-process-material',
    });
  } else {
    // Check if process_material resource exists
    const resourceExists = checkResourceExists(scene, processMaterial);
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

  // Every draw pass, not just the first. `_validate_property`
  // (gpu_particles_3d.cpp:462-467) clears PROPERTY_USAGE_NONE for every index
  // under `draw_passes`, so draw_pass_2..4 are ordinary serialised keys the
  // moment an author raises the count — and a dangling id in one fails the load
  // exactly like draw_pass_1. Naming the four keys rather than scraping them
  // gives index order for free and ignores a `draw_pass_9` Godot never writes.
  //
  // `null` is the serialised form of an EMPTY pass, which `draw_passes = 2` with
  // one mesh writes and Godot reloads without complaint
  // (`scenes/demos/3d/particles/test.tscn`), so it is skipped rather than read
  // as a reference that failed to resolve.
  const drawPasses: [key: string, ref: string][] = [];
  for (const key of DRAW_PASS_KEYS) {
    const mesh = heldResource(rawProps[key]);
    if (mesh !== undefined) drawPasses.push([key, mesh]);
  }
  for (const [key, raw] of drawPasses) {
    if (!checkResourceExists(scene, raw)) {
      diagnostics.push({
        severity: 'error',
        message: `Draw pass mesh resource not found for '${key}': ${raw}`,
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
  // re-deriving that bound. `meshes_found` tests `is_valid()`, so the `null` an
  // empty pass serialises to is not a mesh — the same exclusion the loop above
  // makes, which is why both read the one list.
  if (drawPasses.length === 0) {
    diagnostics.push({
      severity: 'warning',
      message:
        'GPUParticles3D has no mesh assigned to any draw pass. Nothing is visible until at least one draw_pass_N mesh is set.',
      nodeName: node.name,
      nodeType: node.type,
      ruleName: 'gpuparticles3d-no-draw-pass-mesh',
    });
  }

  // sub_emitter must reference an existing GPUParticles3D node; empty/non-NodePath
  // means "no sub-emitter". `resolveNodePath` declines — `unknowable`, its only
  // decline — whenever the walk touches content another file declares, so
  // neither arm below fires on a target this file cannot classify.
  if (rawProps.sub_emitter) {
    const subEmitterPath = extractNodePath(rawProps.sub_emitter);
    if (subEmitterPath) {
      const target = resolveNodePath(scene, node, subEmitterPath);

      if (target.status === 'missing') {
        diagnostics.push({
          severity: 'error',
          message: `Sub-emitter node not found: NodePath("${subEmitterPath}")`,
          nodeName: node.name,
          nodeType: node.type,
          ruleName: 'valid-gpuparticles3d-sub-emitter',
        });
      } else if (target.status === 'found' && target.node.type !== 'GPUParticles3D') {
        // A separate rule name from the dangling case above, because the two
        // are different ADR-0032 tiers. The path RESOLVES here; what says it
        // must resolve to a GPUParticles3D is only the property's
        // PROPERTY_HINT_NODE_PATH_VALID_TYPES, which constrains the inspector's
        // node picker. Godot stores the path either way and simply emits
        // nothing, so this is a hint violation - a warning.
        diagnostics.push({
          severity: 'warning',
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
    description: 'Validates GPUParticles3D resource references, draw-pass meshes, and sub-emitter paths',
    category: 'validation',
    applicableNodeTypes: ['GPUParticles3D'],
    emits: [
      { ruleName: 'gpuparticles3d-missing-process-material', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      {
        ruleName: 'valid-gpuparticles3d-process-material',
        severity: 'error',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'dangling-reference',
          because: 'the process_material reference names a resource id this file never declares',
        },
      },
      {
        ruleName: 'valid-gpuparticles3d-resources',
        severity: 'error',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'dangling-reference',
          because: 'the draw pass mesh reference names a resource id this file never declares',
        },
      },
      { ruleName: 'gpuparticles3d-no-draw-pass-mesh', severity: 'warning', grounding: { kind: 'configuration-warning' } },
      {
        ruleName: 'valid-gpuparticles3d-sub-emitter',
        severity: 'error',
        grounding: {
          kind: 'no-engine-counterpart',
          scope: 'dangling-reference',
          because: 'the sub_emitter NodePath names a node this scene never declares',
        },
      },
      {
        ruleName: 'gpuparticles3d-sub-emitter-wrong-type',
        severity: 'warning',
        grounding: { kind: 'engine', at: 'gpu_particles_3d.cpp:823' },
      },
    ],
  },
  check: checkGPUParticles3D,
};

// Self-register the rule
ruleRegistry.register(gpuParticles3DValidationRule);

// Export for testing
export { gpuParticles3DValidationRule };

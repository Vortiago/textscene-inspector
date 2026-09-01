/**
 * Tests for GPUParticles3D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  expectNoErrors,
  runPropertyValidation,
} from '../../../../linter/testing/testkit';
import './linterParser';
import './linter';

/** Sub-resource heading the kit can't model; appended so accept cases have a valid process_material. */
const PROCESS_MATERIAL = '[sub_resource type="ParticleProcessMaterial" id="process_1"]';
/** A mesh sub-resource so accept cases also carry a draw_pass_1, quieting gpuparticles3d-no-draw-pass-mesh. */
const DRAW_PASS_MESH = '[sub_resource type="QuadMesh" id="mesh_1"]';
const RESOURCES = `${PROCESS_MATERIAL}\n\n${DRAW_PASS_MESH}`;
const withMaterial = {
  process_material: 'SubResource("process_1")',
  draw_pass_1: 'SubResource("mesh_1")',
};

/** Raw fixture with the required process_material; used where extra resources/sections are needed. */
const createTestScene = (properties: string): string => {
  return `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="TestParticles" type="GPUParticles3D"]
process_material = SubResource("process_1")
${properties}
`;
};

describe('GPUParticles3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid GPUParticles3D properties', () => {
      expectClean(
        scene(
          node(
            'GPUParticles3D',
            {
              emitting: true,
              amount: 1000,
              lifetime: 2.0,
              process_material: 'SubResource("process_1")',
              speed_scale: 1.0,
              explosiveness: 0.5,
              randomness: 0.3,
              draw_pass_1: 'SubResource("mesh_1")',
            },
            { name: 'ValidParticles' }
          ),
          RESOURCES
        )
      );
    });

    runPropertyValidation(
      { nodeType: 'GPUParticles3D', acceptChild: RESOURCES, baseProps: withMaterial },
      [
      {
        prop: 'emitting',
        valid: [true, false],
        invalid: [{ value: 1, severity: 'warning', contains: ['converts'] }],
      },
      {
        // gpu_particles_3d.cpp:76, ERR_FAIL_COND_MSG(p_amount < 1): only the floor
        // is enforced. The hint's ceiling at :821 ("1,1000000,1,exp") warns.
        prop: 'amount',
        valid: [1, 100, 1000, 10000, 50000, 150000, 1000000],
        invalid: [
          { value: 0, contains: ['between 1 and 1000000'], severity: 'error' },
          { value: -100, contains: ['between 1 and 1000000'], severity: 'error' },
          { value: 1000001, contains: ['between 1 and 1000000'], severity: 'warning' },
          { value: '"many"', contains: ['number'] },
        ],
      },
      {
        // set_lifetime (gpu_particles_3d.cpp:82) refuses `<= 0`; the hint
        // (:825) floors at 0.01, so (0, 0.01) loads and only warns.
        prop: 'lifetime',
        valid: [0.01, 0.1, 1.0, 2.5, 5.0, 10.0],
        invalid: [
          { value: '0.0', contains: ['greater than 0'] },
          { value: '-2.0', contains: ['greater than 0'] },
          { value: '0.005', contains: ['lifetime', '0.01'], severity: 'warning' },
          { value: '"forever"', contains: ['number'] },
        ],
      },
      {
        prop: 'one_shot',
        valid: [true, false],
        invalid: [{ value: 1, severity: 'warning', contains: ['converts'] }],
      },
      {
        prop: 'preprocess',
        valid: [0.0, 0.5, 1.0, 5.0],
        invalid: [{ value: '-1.0', contains: ['non-negative'] }],
      },
      {
        // gpu_particles_3d.cpp:829 hints "0,64,0.01" (0 is legal, pauses
        // particle time); set_speed_scale:174-177 is a bare assignment.
        prop: 'speed_scale',
        valid: [0.0, 0.1, 0.5, 1.0, 2.0, 5.0, 64],
        invalid: [{ value: '-1.0', contains: ['between 0 and 64'] }],
      },
      {
        prop: 'explosiveness',
        valid: [0.0, 0.25, 0.5, 0.75, 1.0],
        invalid: [
          { value: '-0.1', contains: ['between 0 and 1'] },
          { value: 1.5, contains: ['between 0 and 1'] },
        ],
      },
      {
        prop: 'randomness',
        valid: [0.0, 0.3, 0.5, 0.8, 1.0],
        invalid: [
          { value: '-0.1', contains: ['between 0 and 1'] },
          { value: 1.1, contains: ['between 0 and 1'] },
        ],
      },
      {
        // gpu_particles_3d.cpp:834 hints "0,1000,1,suffix:FPS" (closed
        // ceiling 1000, not 120); set_fixed_fps:309-312 is a bare assignment.
        prop: 'fixed_fps',
        valid: [0, 30, 60, 90, 120, 150, 1000],
        invalid: [{ value: -1, contains: ['between 0 and 1000'] }],
      },
      {
        prop: 'fract_delta',
        valid: [true, false],
        invalid: [{ value: 1, severity: 'warning', contains: ['converts'] }],
      },
      {
        prop: 'visibility_aabb',
        // set_visibility_aabb (gpu_particles_3d.cpp:139-143) assigns straight
        // through to particles_set_custom_aabb, so a negative or zero extent is
        // a value Godot keeps. Only the 6-number shape is checkable.
        valid: [
          'AABB(0, 0, 0, 10, 10, 10)',
          'AABB(-5, -5, -5, 10, 10, 10)',
          'AABB(0, 0, 0, -10, 10, 10)',
          'AABB(0, 0, 0, 10, 0, 10)',
        ],
        invalid: [{ value: 'AABB(0, 0, 0)', contains: ['6 numbers'] }],
      },
      {
        prop: 'local_coords',
        valid: [true, false],
        invalid: [{ value: 1, severity: 'warning', contains: ['converts'] }],
      },
      {
        // gpu_particles_3d.cpp:843 hints 4 labels (Index/Lifetime/Reverse
        // Lifetime/View Depth); set_draw_order:236-239 is a bare assignment.
        prop: 'draw_order',
        valid: [0, 1, 2, 3],
        invalid: [
          { value: 5, contains: ['0-3'] },
          { value: -1, contains: ['0-3'] },
        ],
      },
      {
        prop: 'trail_enabled',
        valid: [true, false],
        invalid: [{ value: 1, severity: 'warning', contains: ['converts'] }],
      },
      {
        // gpu_particles_3d.cpp:247-250, ERR_FAIL_COND(p_seconds < 0.01 -
        // CMP_EPSILON): the refusal is one epsilon under the hint's floor
        // (:847), so the band between the two loads and only warns.
        prop: 'trail_lifetime',
        valid: [0.01, 0.1, 0.5, 1.0, 2.0],
        with: { trail_enabled: true },
        invalid: [
          { value: '0.0', contains: ['0.00999'], severity: 'error' },
          { value: '-1.0', contains: ['0.00999'], severity: 'error' },
          { value: '0.009995', contains: ['trail_lifetime'], severity: 'warning' },
        ],
      },
      {
        // gpu_particles_3d.cpp:839 hints "0,128,0.01,or_greater" (0 is
        // legal, means no collision radius); set_collision_base_size:179-182
        // is a bare assignment with no check at all.
        prop: 'collision_base_size',
        valid: [0.0, 0.1, 0.5, 1.0, 2.0],
        invalid: [{ value: '-1.0', contains: ['non-negative'] }],
      },
      {
        prop: 'interp_to_end',
        valid: [0.0, 0.25, 0.5, 0.75, 1.0],
        invalid: [
          { value: '-0.1', contains: ['between 0 and 1'] },
          { value: 1.1, contains: ['between 0 and 1'] },
        ],
      },
      ]
    );

    describe('process_material validation', () => {
      it('should accept valid resource reference format', () => {
        expectClean(`[gd_scene format=3]

${RESOURCES}

[node name="ValidMaterial" type="GPUParticles3D"]
process_material = SubResource("process_1")
draw_pass_1 = SubResource("mesh_1")
`);
      });

      it('should accept ExtResource format', () => {
        expectClean(`[gd_scene format=3]

[ext_resource type="ParticleProcessMaterial" id="ext_process" path="res://materials/particle.tres"]
${DRAW_PASS_MESH}

[node name="ExtMaterial" type="GPUParticles3D"]
process_material = ExtResource("ext_process")
draw_pass_1 = SubResource("mesh_1")
`);
      });

      it('should reject invalid resource reference format', () => {
        // Will have 2 errors: format error + missing valid process_material
        expectDiagnostic(createTestScene('process_material = "invalid_format"'), {
          prop: 'resource reference',
        });
      });
    });

    describe('draw_pass_1 validation', () => {
      it('should accept valid mesh resource reference', () => {
        expectClean(`[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]
[sub_resource type="QuadMesh" id="mesh_1"]

[node name="ValidDrawPass" type="GPUParticles3D"]
process_material = SubResource("process_1")
draw_pass_1 = SubResource("mesh_1")
`);
      });

      it('should reject invalid reference format', () => {
        expectDiagnostic(createTestScene('draw_pass_1 = invalid'), {
          prop: 'draw_pass_1',
          contains: ['SubResource'],
        });
      });

      it('should accept the literal null (an empty pass) as a format', () => {
        // Godot writes `null` for a draw_pass_N index its own
        // `_validate_property` makes newly visible with no mesh assigned
        // (scenes/demos/3d/particles/test.tscn ships `draw_pass_2 = null`).
        // `gpuparticles3d-no-draw-pass-mesh` still warns separately (no mesh
        // set anywhere) — that is the semantic rule, not the format check.
        expectNoDiagnostic(createTestScene('draw_pass_1 = null'), {
          ruleName: 'strict-parser',
        });
      });
    });

    describe('sub_emitter validation', () => {
      it('should accept valid NodePath format', () => {
        // Will have 1 semantic error (node not found) but NO format error
        expectNoDiagnostic(createTestScene('sub_emitter = NodePath("SubEmitter")'), {
          ruleName: 'strict-parser',
        });
      });

      it('should accept empty NodePath', () => {
        expectClean(`[gd_scene format=3]

${RESOURCES}

[node name="TestParticles" type="GPUParticles3D"]
process_material = SubResource("process_1")
draw_pass_1 = SubResource("mesh_1")
sub_emitter = NodePath("")
`);
      });

      it('should reject invalid NodePath format', () => {
        expectDiagnostic(createTestScene('sub_emitter = "invalid"'), {
          prop: 'sub_emitter',
          contains: ['NodePath'],
        });
      });
    });
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should warn when process_material is missing (valid, assignable at runtime)', () => {
      expectDiagnostic(
        `[gd_scene format=3]

[node name="NoProcessMaterial" type="GPUParticles3D"]
amount = 1000
lifetime = 2.0
`,
        {
          ruleName: 'gpuparticles3d-missing-process-material',
          severity: 'warning',
          contains: ['process_material'],
        }
      );
    });

    it('should error when process_material resource does not exist', () => {
      expectDiagnostic(
        `[gd_scene format=3]

[node name="MissingMaterialResource" type="GPUParticles3D"]
process_material = SubResource("nonexistent")
`,
        { prop: 'Process material resource not found' }
      );
    });

    it('should pass when process_material resource exists', () => {
      expectClean(`[gd_scene format=3]

${RESOURCES}

[node name="ValidParticles" type="GPUParticles3D"]
process_material = SubResource("process_1")
draw_pass_1 = SubResource("mesh_1")
`);
    });

    it('should error when draw_pass_1 resource does not exist', () => {
      expectDiagnostic(
        `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="MissingDrawPass" type="GPUParticles3D"]
process_material = SubResource("process_1")
draw_pass_1 = SubResource("nonexistent_mesh")
`,
        { prop: 'Draw pass mesh resource not found' }
      );
    });

    // draw_pass_2..4 are ordinary serialised keys once `draw_passes` is raised
    // (gpu_particles_3d.cpp:462-467, MAX_DRAW_PASSES = 4 in the header), and a
    // dangling id in one fails the load exactly like draw_pass_1's.
    it('reports a dangling mesh in a draw pass past the first', () => {
      const diagnostics = lint(`[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]
[sub_resource type="BoxMesh" id="mesh_1"]

[node name="Particles" type="GPUParticles3D"]
process_material = SubResource("process_1")
draw_passes = 3
draw_pass_1 = SubResource("mesh_1")
draw_pass_3 = SubResource("nonexistent_mesh")
`);
      const errors = diagnostics.filter((d) => d.ruleName === 'valid-gpuparticles3d-resources');
      expect(errors).toHaveLength(1);
      expect(errors[0]!.message).toContain('draw_pass_3');
    });

    it('should pass when draw_pass_1 resource exists', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]
[sub_resource type="QuadMesh" id="mesh_1"]

[node name="ValidDrawPass" type="GPUParticles3D"]
process_material = SubResource("process_1")
draw_pass_1 = SubResource("mesh_1")
`);
    });
  });

  describe('Semantic Validation (Draw Passes)', () => {
    // gpu_particles_3d.cpp:342-363
    it('warns when no draw_pass_N key carries a mesh', () => {
      expectDiagnostic(
        `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="NoDrawPass" type="GPUParticles3D"]
process_material = SubResource("process_1")
`,
        { ruleName: 'gpuparticles3d-no-draw-pass-mesh', severity: 'warning' }
      );
    });

    it('does not warn when draw_pass_1 carries a mesh', () => {
      expectNoDiagnostic(
        `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]
[sub_resource type="QuadMesh" id="mesh_1"]

[node name="HasDrawPass" type="GPUParticles3D"]
process_material = SubResource("process_1")
draw_pass_1 = SubResource("mesh_1")
`,
        { ruleName: 'gpuparticles3d-no-draw-pass-mesh' }
      );
    });

    it('does not warn when a later draw_pass_N (not draw_pass_1) carries a mesh', () => {
      expectNoDiagnostic(
        `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]
[sub_resource type="QuadMesh" id="mesh_1"]

[node name="HasLaterDrawPass" type="GPUParticles3D"]
process_material = SubResource("process_1")
draw_passes = 2
draw_pass_2 = SubResource("mesh_1")
`,
        { ruleName: 'gpuparticles3d-no-draw-pass-mesh' }
      );
    });
  });

  describe('Semantic Validation (Trail Configuration)', () => {
    // trail_lifetime defaults to 0.3 with trail_enabled false and
    // _validate_property never hides the key, so Godot itself writes this pair.
    it('should pass when trail_lifetime is set and trail_enabled is false', () => {
      expectClean(`[gd_scene format=3]

${RESOURCES}

[node name="DisabledTrail" type="GPUParticles3D"]
process_material = SubResource("process_1")
draw_pass_1 = SubResource("mesh_1")
trail_enabled = false
trail_lifetime = 1.0
`);
    });

    it('should pass when trail_lifetime is set and trail_enabled is true', () => {
      expectClean(`[gd_scene format=3]

${RESOURCES}

[node name="ValidTrail" type="GPUParticles3D"]
process_material = SubResource("process_1")
draw_pass_1 = SubResource("mesh_1")
trail_enabled = true
trail_lifetime = 1.0
`);
    });

    it('should pass when trail_enabled is false and trail_lifetime is not set', () => {
      expectClean(`[gd_scene format=3]

${RESOURCES}

[node name="NoTrail" type="GPUParticles3D"]
process_material = SubResource("process_1")
draw_pass_1 = SubResource("mesh_1")
trail_enabled = false
`);
    });
  });

  describe('Semantic Validation (Sub-Emitter)', () => {
    it('should error when sub_emitter node does not exist', () => {
      expectDiagnostic(
        `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="MissingSubEmitter" type="GPUParticles3D"]
process_material = SubResource("process_1")
sub_emitter = NodePath("NonexistentEmitter")
`,
        { prop: 'Sub-emitter node not found' }
      );
    });

    it('should error when sub_emitter points to wrong node type', () => {
      expectDiagnostic(
        `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="Root" type="Node3D"]

[node name="WrongType" type="MeshInstance3D" parent="."]

[node name="Particles" type="GPUParticles3D" parent="."]
process_material = SubResource("process_1")
sub_emitter = NodePath("../WrongType")
`,
        { prop: 'must point to a GPUParticles3D node' }
      );
    });

    it('should pass when sub_emitter references valid GPUParticles3D node', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]
[sub_resource type="ParticleProcessMaterial" id="process_2"]
${DRAW_PASS_MESH}

[node name="Root" type="Node3D"]

[node name="SubEmitter" type="GPUParticles3D" parent="."]
process_material = SubResource("process_2")
draw_pass_1 = SubResource("mesh_1")

[node name="MainParticles" type="GPUParticles3D" parent="."]
process_material = SubResource("process_1")
draw_pass_1 = SubResource("mesh_1")
sub_emitter = NodePath("../SubEmitter")
`);
    });

    // `_attach_sub_emitter` casts the node it walked to and then drops it when
    // it IS this node: `if (sen && sen != this)` (gpu_particles_3d.cpp:485-486).
    // The path resolves and is stored, so nothing is refused — the emitter just
    // never becomes its own sub-emitter.
    it.each(['NodePath(".")', 'NodePath("../Particles")'])(
      'warns when sub_emitter %s points back at the node itself',
      (path) => {
        expectDiagnostic(
          `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="World" type="Node3D"]

[node name="Particles" type="GPUParticles3D" parent="."]
process_material = SubResource("process_1")
sub_emitter = ${path}
`,
          {
            ruleName: 'gpuparticles3d-sub-emitter-self',
            severity: 'warning',
            contains: ['points back at', 'Particles'],
          }
        );
      }
    );

    it('should pass when sub_emitter is empty NodePath', () => {
      expectClean(`[gd_scene format=3]

${RESOURCES}

[node name="NoSubEmitter" type="GPUParticles3D"]
process_material = SubResource("process_1")
draw_pass_1 = SubResource("mesh_1")
sub_emitter = NodePath("")
`);
    });

    // A `..` segment is not itself unknowable: the walk climbs to World and then
    // asks World for a child named "Other" (node.cpp:1941). There is none and no
    // instance to hide one, so Godot's own `get_node_or_null` returns null too.
    // The instance case is the test below, where the decline is real.
    it('errors on a relative path whose next segment names no child', () => {
      expectDiagnostic(
        `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="World" type="Node3D"]

[node name="Particles" type="GPUParticles3D" parent="."]
process_material = SubResource("process_1")
sub_emitter = NodePath("../Other/Emitter")
`,
        { ruleName: 'valid-gpuparticles3d-sub-emitter', severity: 'error' }
      );
    });

    it('should not error when the GPUParticles3D sits under an instanced sub-scene', () => {
      expectNoDiagnostic(
        `[gd_scene format=3]

[ext_resource type="PackedScene" path="res://rig.tscn" id="1_rig"]
[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="World" type="Node3D"]

[node name="Rig" parent="." instance=ExtResource("1_rig")]

[node name="Particles" type="GPUParticles3D" parent="Rig"]
process_material = SubResource("process_1")
sub_emitter = NodePath("Emitter")
`,
        { ruleName: 'valid-gpuparticles3d-sub-emitter' }
      );
    });
  });

  describe('Amount and lifetime', () => {
    // The `amount` ceiling is the validator's hinted bound (linterParser.ts), not
    // a rule: a rule beside it double-reported the same value.
    it.each([75000, 1000000])('says nothing about amount %s', (amount) => {
      expectClean(`[gd_scene format=3]

${RESOURCES}

[node name="InBandCount" type="GPUParticles3D"]
process_material = SubResource("process_1")
draw_pass_1 = SubResource("mesh_1")
amount = ${amount}
`);
    });

    // lifetime / speed_scale carry no combined advisory: gpu_particles_3d.cpp
    // states no bound on their ratio, and neither setter looks at the other.
    it('says nothing about a long effective lifetime', () => {
      expectClean(`[gd_scene format=3]

${RESOURCES}

[node name="LongLifetime" type="GPUParticles3D"]
process_material = SubResource("process_1")
draw_pass_1 = SubResource("mesh_1")
lifetime = 100.0
speed_scale = 0.5
`);
    });

    it('should not warn for reasonable particle count', () => {
      const diagnostics = lint(`[gd_scene format=3]

${RESOURCES}

[node name="ReasonableParticles" type="GPUParticles3D"]
process_material = SubResource("process_1")
draw_pass_1 = SubResource("mesh_1")
amount = 10000
`);
      const perfWarning = diagnostics.find(d => d.severity === 'warning');
      expect(perfWarning).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const diagnostics = lint(`[gd_scene format=3]

[node name="MultipleErrors" type="GPUParticles3D"]
amount = 0
lifetime = -1.0
speed_scale = 0.0
explosiveness = 2.0
`);
      expect(diagnostics.length).toBeGreaterThan(3);
    });

    it('should handle all properties together', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]
[sub_resource type="QuadMesh" id="mesh_1"]

[node name="Root" type="Node3D"]

[node name="SubEmitter" type="GPUParticles3D" parent="."]
process_material = SubResource("process_1")
draw_pass_1 = SubResource("mesh_1")

[node name="ComplexParticles" type="GPUParticles3D" parent="."]
emitting = true
amount = 5000
lifetime = 3.0
one_shot = false
preprocess = 1.0
speed_scale = 1.5
explosiveness = 0.8
randomness = 0.4
fixed_fps = 60
fract_delta = true
process_material = SubResource("process_1")
draw_pass_1 = SubResource("mesh_1")
visibility_aabb = AABB(-10, -10, -10, 20, 20, 20)
local_coords = false
draw_order = 1
trail_enabled = true
trail_lifetime = 0.5
collision_base_size = 1.0
sub_emitter = NodePath("../SubEmitter")
interp_to_end = 0.3
`);
    });

    it('should handle node with no properties', () => {
      // Should error because process_material is missing
      expectDiagnostic(
        `[gd_scene format=3]

[node name="EmptyParticles" type="GPUParticles3D"]
`,
        { prop: 'process_material' }
      );
    });
  });
});

describe('GPUParticles3D Linter — the tokenizer float grammar', () => {
  it('accepts a trailing-dot visibility_aabb component', () => {
    // Isolate the strict-parser format check (a bare node also trips the
    // unrelated process_material semantic requirement).
    expectNoErrors(
      scene(node('GPUParticles3D', { visibility_aabb: 'AABB(0.5, 0, 0, 10., 10, 10)' })),
      { ruleName: 'strict-parser' }
    );
  });
});

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
const withMaterial = { process_material: 'SubResource("process_1")' };

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
            },
            { name: 'ValidParticles' }
          ),
          PROCESS_MATERIAL
        )
      );
    });

    runPropertyValidation(
      { nodeType: 'GPUParticles3D', acceptChild: PROCESS_MATERIAL, baseProps: withMaterial },
      [
      {
        prop: 'emitting',
        valid: [true, false],
        invalid: [{ value: 1, contains: ['boolean'] }],
      },
      {
        // gpu_particles_3d.cpp:76, ERR_FAIL_COND_MSG(p_amount < 1): only the floor
        // is enforced. The hint's ceiling at :821 ("1,1000000,1,exp") warns.
        prop: 'amount',
        valid: [1, 100, 1000, 10000, 50000, 150000, 1000000],
        invalid: [
          { value: 0, contains: ['greater than 0'] },
          { value: -100, contains: ['greater than 0'] },
          { value: '"many"', contains: ['integer'] },
        ],
      },
      {
        prop: 'lifetime',
        valid: [0.1, 1.0, 2.5, 5.0, 10.0],
        invalid: [
          { value: '0.0', contains: ['greater than 0'] },
          { value: '-2.0', contains: ['greater than 0'] },
          { value: '"forever"', contains: ['number'] },
        ],
      },
      {
        prop: 'one_shot',
        valid: [true, false],
        invalid: [{ value: 1, contains: ['boolean'] }],
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
        invalid: [{ value: 1, contains: ['boolean'] }],
      },
      {
        prop: 'visibility_aabb',
        valid: ['AABB(0, 0, 0, 10, 10, 10)', 'AABB(-5, -5, -5, 10, 10, 10)'],
        invalid: [
          { value: 'AABB(0, 0, 0)', contains: ['6 numbers'] },
          { value: 'AABB(0, 0, 0, -10, 10, 10)', contains: ['positive'] },
          { value: 'AABB(0, 0, 0, 10, 0, 10)', contains: ['positive'] },
        ],
      },
      {
        prop: 'local_coords',
        valid: [true, false],
        invalid: [{ value: 1, contains: ['boolean'] }],
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
        invalid: [{ value: 1, contains: ['boolean'] }],
      },
      {
        // gpu_particles_3d.cpp:247-250, ERR_FAIL_COND(p_seconds < 0.01 -
        // CMP_EPSILON): the enforced floor is 0.01, not the previous ~0.
        prop: 'trail_lifetime',
        valid: [0.01, 0.1, 0.5, 1.0, 2.0],
        with: { trail_enabled: true },
        invalid: [
          { value: '0.0', contains: ['>= 0.01'] },
          { value: '-1.0', contains: ['>= 0.01'] },
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

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="ValidMaterial" type="GPUParticles3D"]
process_material = SubResource("process_1")
`);
      });

      it('should accept ExtResource format', () => {
        expectClean(`[gd_scene format=3]

[ext_resource type="ParticleProcessMaterial" id="ext_process" path="res://materials/particle.tres"]

[node name="ExtMaterial" type="GPUParticles3D"]
process_material = ExtResource("ext_process")
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
          contains: ['resource reference'],
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
        expectClean(createTestScene('sub_emitter = NodePath("")'));
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

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="ValidParticles" type="GPUParticles3D"]
process_material = SubResource("process_1")
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

  describe('Semantic Validation (Trail Configuration)', () => {
    it('should error when trail_lifetime is set but trail_enabled is false', () => {
      expectDiagnostic(
        `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="MisconfiguredTrail" type="GPUParticles3D"]
process_material = SubResource("process_1")
trail_enabled = false
trail_lifetime = 1.0
`,
        { prop: 'trail_enabled', severity: 'error', contains: ['trail_enabled=true'] }
      );
    });

    it('should pass when trail_lifetime is set and trail_enabled is true', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="ValidTrail" type="GPUParticles3D"]
process_material = SubResource("process_1")
trail_enabled = true
trail_lifetime = 1.0
`);
    });

    it('should pass when trail_enabled is false and trail_lifetime is not set', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="NoTrail" type="GPUParticles3D"]
process_material = SubResource("process_1")
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
sub_emitter = NodePath("WrongType")
`,
        { prop: 'must point to a GPUParticles3D node' }
      );
    });

    it('should pass when sub_emitter references valid GPUParticles3D node', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]
[sub_resource type="ParticleProcessMaterial" id="process_2"]

[node name="Root" type="Node3D"]

[node name="SubEmitter" type="GPUParticles3D" parent="."]
process_material = SubResource("process_2")

[node name="MainParticles" type="GPUParticles3D" parent="."]
process_material = SubResource("process_1")
sub_emitter = NodePath("SubEmitter")
`);
    });

    it('should pass when sub_emitter is empty NodePath', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="NoSubEmitter" type="GPUParticles3D"]
process_material = SubResource("process_1")
sub_emitter = NodePath("")
`);
    });

    it('should not error on a relative (..) sub_emitter path that escapes the authored scope', () => {
      // A "../" segment can resolve into an instanced sibling sub-scene the
      // static linter never sees, so a not-found assertion would be a false
      // positive (same static-scope heuristic as the skeleton/anim_player rules).
      expectNoDiagnostic(
        `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="World" type="Node3D"]

[node name="Particles" type="GPUParticles3D" parent="."]
process_material = SubResource("process_1")
sub_emitter = NodePath("../Other/Emitter")
`,
        { ruleName: 'valid-gpuparticles3d-sub-emitter' }
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

  describe('Performance Warnings', () => {
    // gpu_particles_3d.cpp:821 — amount PROPERTY_HINT_RANGE "1,1000000,1,exp": no
    // `or_greater`, so 1,000,000 is a real ceiling, but set_amount (:76) refuses
    // only values below 1, which makes exceeding it a warning.
    it('should warn for a particle count above the hint', () => {
      expectDiagnostic(
        `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="HighParticleCount" type="GPUParticles3D"]
process_material = SubResource("process_1")
amount = 1500000
`,
        { prop: 'performance', severity: 'warning', contains: ['1500000', '1000000'] }
      );
    });

    it.each([75000, 1000000])('says nothing about amount %s', (amount) => {
      expectClean(`[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="InBandCount" type="GPUParticles3D"]
process_material = SubResource("process_1")
amount = ${amount}
`);
    });

    // lifetime / speed_scale carry no combined advisory: gpu_particles_3d.cpp
    // states no bound on their ratio, and neither setter looks at the other.
    it('says nothing about a long effective lifetime', () => {
      expectClean(`[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="LongLifetime" type="GPUParticles3D"]
process_material = SubResource("process_1")
lifetime = 100.0
speed_scale = 0.5
`);
    });

    it('should not warn for reasonable particle count', () => {
      const diagnostics = lint(`[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="ReasonableParticles" type="GPUParticles3D"]
process_material = SubResource("process_1")
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
sub_emitter = NodePath("SubEmitter")
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

describe('GPUParticles3D Linter — lenient float grammar (#190 #7 follow-up)', () => {
  it('accepts visibility_aabb with leading-dot / trailing-dot floats', () => {
    // Isolate the strict-parser format check (a bare node also trips the
    // unrelated process_material semantic requirement).
    expectNoErrors(
      scene(node('GPUParticles3D', { visibility_aabb: 'AABB(.5, 0, 0, 10., 10, 10)' })),
      { ruleName: 'strict-parser' }
    );
  });
});

/**
 * Tests for GPUParticles3D linter (strict parser + semantic rules)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Linter } from '../../../../linter/Linter';
import './linterParser';
import './linter';

describe('GPUParticles3D Linter', () => {
  let linter: Linter;

  beforeEach(() => {
    linter = new Linter();
  });

  // Helper to create test content with required process_material
  const createTestScene = (properties: string): string => {
    return `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="TestParticles" type="GPUParticles3D"]
process_material = SubResource("process_1")
${properties}
`;
  };

  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid GPUParticles3D properties', () => {
      const content = `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="ValidParticles" type="GPUParticles3D"]
emitting = true
amount = 1000
lifetime = 2.0
process_material = SubResource("process_1")
speed_scale = 1.0
explosiveness = 0.5
randomness = 0.3
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    describe('emitting validation', () => {
      it('should accept true value', () => {
        const content = createTestScene('emitting = true');
        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept false value', () => {
        const content = createTestScene('emitting = false');
        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid boolean format', () => {
        const content = createTestScene('emitting = 1');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('emitting');
        expect(diagnostics[0].message).toContain('boolean');
      });
    });

    describe('amount validation', () => {
      it('should reject zero amount', () => {
        const content = createTestScene('amount = 0');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('amount');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject negative amount', () => {
        const content = createTestScene('amount = -100');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('amount');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should accept valid amount values', () => {
        const validValues = [1, 100, 1000, 10000, 50000];

        for (const value of validValues) {
          const content = createTestScene(`amount = ${value}`);
          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should error on excessive amount (performance)', () => {
        const content = createTestScene('amount = 150000');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        const amountError = diagnostics.find(d => d.message.includes('amount'));
        expect(amountError).toBeDefined();
        expect(amountError?.message).toContain('exceeds recommended maximum');
      });

      it('should reject non-numeric amount', () => {
        const content = createTestScene('amount = "many"');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('amount');
        expect(diagnostics[0].message).toContain('integer');
      });
    });

    describe('lifetime validation', () => {
      it('should reject zero lifetime', () => {
        const content = createTestScene('lifetime = 0.0');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('lifetime');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject negative lifetime', () => {
        const content = createTestScene('lifetime = -2.0');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('lifetime');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should accept valid lifetime values', () => {
        const validValues = [0.1, 1.0, 2.5, 5.0, 10.0];

        for (const value of validValues) {
          const content = createTestScene(`lifetime = ${value}`);
          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject non-numeric lifetime', () => {
        const content = createTestScene('lifetime = "forever"');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('lifetime');
        expect(diagnostics[0].message).toContain('number');
      });
    });

    describe('one_shot validation', () => {
      it('should accept true and false values', () => {
        const validValues = ['true', 'false'];

        for (const value of validValues) {
          const content = createTestScene(`one_shot = ${value}`);
          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid boolean format', () => {
        const content = createTestScene('one_shot = 1');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('one_shot');
        expect(diagnostics[0].message).toContain('boolean');
      });
    });

    describe('preprocess validation', () => {
      it('should accept non-negative preprocess values', () => {
        const validValues = [0.0, 0.5, 1.0, 5.0];

        for (const value of validValues) {
          const content = createTestScene(`preprocess = ${value}`);
          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject negative preprocess', () => {
        const content = createTestScene('preprocess = -1.0');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('preprocess');
        expect(diagnostics[0].message).toContain('non-negative');
      });
    });

    describe('speed_scale validation', () => {
      it('should reject zero speed_scale', () => {
        const content = createTestScene('speed_scale = 0.0');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('speed_scale');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject negative speed_scale', () => {
        const content = createTestScene('speed_scale = -1.0');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('speed_scale');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should accept valid speed_scale values', () => {
        const validValues = [0.1, 0.5, 1.0, 2.0, 5.0];

        for (const value of validValues) {
          const content = createTestScene(`speed_scale = ${value}`);
          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });
    });

    describe('explosiveness validation', () => {
      it('should accept values in range 0-1', () => {
        const validValues = [0.0, 0.25, 0.5, 0.75, 1.0];

        for (const value of validValues) {
          const content = createTestScene(`explosiveness = ${value}`);
          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject values below 0', () => {
        const content = createTestScene('explosiveness = -0.1');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('explosiveness');
        expect(diagnostics[0].message).toContain('between 0 and 1');
      });

      it('should reject values above 1', () => {
        const content = createTestScene('explosiveness = 1.5');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('explosiveness');
        expect(diagnostics[0].message).toContain('between 0 and 1');
      });
    });

    describe('randomness validation', () => {
      it('should accept values in range 0-1', () => {
        const validValues = [0.0, 0.3, 0.5, 0.8, 1.0];

        for (const value of validValues) {
          const content = createTestScene(`randomness = ${value}`);
          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject values outside range', () => {
        const invalidValues = [-0.1, 1.1];

        for (const value of invalidValues) {
          const content = createTestScene(`randomness = ${value}`);
          const diagnostics = linter.lint(content);
          expect(diagnostics.length).toBeGreaterThan(0);
          expect(diagnostics[0].message).toContain('randomness');
          expect(diagnostics[0].message).toContain('between 0 and 1');
        }
      });
    });

    describe('fixed_fps validation', () => {
      it('should accept values in range 0-120', () => {
        const validValues = [0, 30, 60, 90, 120];

        for (const value of validValues) {
          const content = createTestScene(`fixed_fps = ${value}`);
          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject negative values', () => {
        const content = createTestScene('fixed_fps = -1');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('fixed_fps');
        expect(diagnostics[0].message).toContain('between 0 and 120');
      });

      it('should reject values above 120', () => {
        const content = createTestScene('fixed_fps = 150');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('fixed_fps');
        expect(diagnostics[0].message).toContain('between 0 and 120');
      });
    });

    describe('fract_delta validation', () => {
      it('should accept true and false values', () => {
        const validValues = ['true', 'false'];

        for (const value of validValues) {
          const content = createTestScene(`fract_delta = ${value}`);
          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid boolean format', () => {
        const content = createTestScene('fract_delta = 1');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('fract_delta');
        expect(diagnostics[0].message).toContain('boolean');
      });
    });

    describe('process_material validation', () => {
      it('should accept valid resource reference format', () => {
        const content = `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="ValidMaterial" type="GPUParticles3D"]
process_material = SubResource("process_1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept ExtResource format', () => {
        const content = `[gd_scene format=3]

[ext_resource type="ParticleProcessMaterial" id="ext_process" path="res://materials/particle.tres"]

[node name="ExtMaterial" type="GPUParticles3D"]
process_material = ExtResource("ext_process")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid resource reference format', () => {
        const content = createTestScene('process_material = "invalid_format"');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        // Will have 2 errors: format error + missing valid process_material
        const formatError = diagnostics.find(d => d.message.includes('resource reference'));
        expect(formatError).toBeDefined();
      });
    });

    describe('draw_pass_1 validation', () => {
      it('should accept valid mesh resource reference', () => {
        const content = `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]
[sub_resource type="QuadMesh" id="mesh_1"]

[node name="ValidDrawPass" type="GPUParticles3D"]
process_material = SubResource("process_1")
draw_pass_1 = SubResource("mesh_1")
`;

        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid reference format', () => {
        const content = createTestScene('draw_pass_1 = invalid');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('draw_pass_1');
        expect(diagnostics[0].message).toContain('resource reference');
      });
    });

    describe('visibility_aabb validation', () => {
      it('should accept valid AABB format', () => {
        const content = createTestScene('visibility_aabb = AABB(0, 0, 0, 10, 10, 10)');
        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should accept negative positions with positive sizes', () => {
        const content = createTestScene('visibility_aabb = AABB(-5, -5, -5, 10, 10, 10)');
        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid AABB format', () => {
        const content = createTestScene('visibility_aabb = AABB(0, 0, 0)');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('visibility_aabb');
        expect(diagnostics[0].message).toContain('6 numbers');
      });

      it('should reject negative size components', () => {
        const content = createTestScene('visibility_aabb = AABB(0, 0, 0, -10, 10, 10)');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('visibility_aabb');
        expect(diagnostics[0].message).toContain('positive');
      });

      it('should reject zero size components', () => {
        const content = createTestScene('visibility_aabb = AABB(0, 0, 0, 10, 0, 10)');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('visibility_aabb');
        expect(diagnostics[0].message).toContain('positive');
      });
    });

    describe('local_coords validation', () => {
      it('should accept true and false values', () => {
        const validValues = ['true', 'false'];

        for (const value of validValues) {
          const content = createTestScene(`local_coords = ${value}`);
          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid boolean format', () => {
        const content = createTestScene('local_coords = 1');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('local_coords');
        expect(diagnostics[0].message).toContain('boolean');
      });
    });

    describe('draw_order validation', () => {
      it('should accept valid draw_order values', () => {
        const validValues = [0, 1, 2]; // INDEX, LIFETIME, VIEW_DEPTH

        for (const value of validValues) {
          const content = createTestScene(`draw_order = ${value}`);
          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid draw_order value', () => {
        const content = createTestScene('draw_order = 5');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('draw_order');
        expect(diagnostics[0].message).toContain('0-2');
      });

      it('should reject negative draw_order', () => {
        const content = createTestScene('draw_order = -1');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('draw_order');
        expect(diagnostics[0].message).toContain('0-2');
      });
    });

    describe('trail_enabled validation', () => {
      it('should accept true and false values', () => {
        const validValues = ['true', 'false'];

        for (const value of validValues) {
          const content = createTestScene(`trail_enabled = ${value}`);
          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject invalid boolean format', () => {
        const content = createTestScene('trail_enabled = 1');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('trail_enabled');
        expect(diagnostics[0].message).toContain('boolean');
      });
    });

    describe('trail_lifetime validation', () => {
      it('should accept positive trail_lifetime values', () => {
        const validValues = [0.1, 0.5, 1.0, 2.0];

        for (const value of validValues) {
          // Must enable trails for trail_lifetime to be valid
          const content = createTestScene(`trail_enabled = true\ntrail_lifetime = ${value}`);
          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject zero trail_lifetime', () => {
        const content = createTestScene('trail_lifetime = 0.0');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('trail_lifetime');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject negative trail_lifetime', () => {
        const content = createTestScene('trail_lifetime = -1.0');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('trail_lifetime');
        expect(diagnostics[0].message).toContain('greater than 0');
      });
    });

    describe('collision_base_size validation', () => {
      it('should accept positive collision_base_size values', () => {
        const validValues = [0.1, 0.5, 1.0, 2.0];

        for (const value of validValues) {
          const content = createTestScene(`collision_base_size = ${value}`);
          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject zero collision_base_size', () => {
        const content = createTestScene('collision_base_size = 0.0');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('collision_base_size');
        expect(diagnostics[0].message).toContain('greater than 0');
      });

      it('should reject negative collision_base_size', () => {
        const content = createTestScene('collision_base_size = -1.0');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('collision_base_size');
        expect(diagnostics[0].message).toContain('greater than 0');
      });
    });

    describe('sub_emitter validation', () => {
      it('should accept valid NodePath format', () => {
        const content = createTestScene('sub_emitter = NodePath("SubEmitter")');
        const diagnostics = linter.lint(content);
        // Will have 1 error: sub_emitter node not found (semantic error)
        // But NO format error
        const formatError = diagnostics.find(d => d.ruleName === 'strict-parser');
        expect(formatError).toBeUndefined();
      });

      it('should accept empty NodePath', () => {
        const content = createTestScene('sub_emitter = NodePath("")');
        const diagnostics = linter.lint(content);
        expect(diagnostics).toHaveLength(0);
      });

      it('should reject invalid NodePath format', () => {
        const content = createTestScene('sub_emitter = "invalid"');
        const diagnostics = linter.lint(content);
        expect(diagnostics.length).toBeGreaterThan(0);
        expect(diagnostics[0].message).toContain('sub_emitter');
        expect(diagnostics[0].message).toContain('NodePath');
      });
    });

    describe('interp_to_end validation', () => {
      it('should accept values in range 0-1', () => {
        const validValues = [0.0, 0.25, 0.5, 0.75, 1.0];

        for (const value of validValues) {
          const content = createTestScene(`interp_to_end = ${value}`);
          const diagnostics = linter.lint(content);
          expect(diagnostics).toHaveLength(0);
        }
      });

      it('should reject values outside range', () => {
        const invalidValues = [-0.1, 1.1];

        for (const value of invalidValues) {
          const content = createTestScene(`interp_to_end = ${value}`);
          const diagnostics = linter.lint(content);
          expect(diagnostics.length).toBeGreaterThan(0);
          expect(diagnostics[0].message).toContain('interp_to_end');
          expect(diagnostics[0].message).toContain('between 0 and 1');
        }
      });
    });
  });

  describe('Semantic Validation (Resource References)', () => {
    it('should error when process_material is missing', () => {
      const content = `[gd_scene format=3]

[node name="NoProcessMaterial" type="GPUParticles3D"]
amount = 1000
lifetime = 2.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const materialError = diagnostics.find(d => d.message.includes('process_material'));
      expect(materialError).toBeDefined();
      expect(materialError?.severity).toBe('error');
      expect(materialError?.message).toContain('requires');
    });

    it('should error when process_material resource does not exist', () => {
      const content = `[gd_scene format=3]

[node name="MissingMaterialResource" type="GPUParticles3D"]
process_material = SubResource("nonexistent")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const resourceError = diagnostics.find(d => d.message.includes('Process material resource not found'));
      expect(resourceError).toBeDefined();
    });

    it('should pass when process_material resource exists', () => {
      const content = `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="ValidParticles" type="GPUParticles3D"]
process_material = SubResource("process_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should error when draw_pass_1 resource does not exist', () => {
      const content = `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="MissingDrawPass" type="GPUParticles3D"]
process_material = SubResource("process_1")
draw_pass_1 = SubResource("nonexistent_mesh")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const drawPassError = diagnostics.find(d => d.message.includes('Draw pass mesh resource not found'));
      expect(drawPassError).toBeDefined();
    });

    it('should pass when draw_pass_1 resource exists', () => {
      const content = `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]
[sub_resource type="QuadMesh" id="mesh_1"]

[node name="ValidDrawPass" type="GPUParticles3D"]
process_material = SubResource("process_1")
draw_pass_1 = SubResource("mesh_1")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Trail Configuration)', () => {
    it('should error when trail_lifetime is set but trail_enabled is false', () => {
      const content = `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="MisconfiguredTrail" type="GPUParticles3D"]
process_material = SubResource("process_1")
trail_enabled = false
trail_lifetime = 1.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const trailError = diagnostics.find(d => d.message.includes('trail_enabled'));
      expect(trailError).toBeDefined();
      expect(trailError?.severity).toBe('error');
      expect(trailError?.message).toContain('trail_enabled=true');
    });

    it('should pass when trail_lifetime is set and trail_enabled is true', () => {
      const content = `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="ValidTrail" type="GPUParticles3D"]
process_material = SubResource("process_1")
trail_enabled = true
trail_lifetime = 1.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass when trail_enabled is false and trail_lifetime is not set', () => {
      const content = `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="NoTrail" type="GPUParticles3D"]
process_material = SubResource("process_1")
trail_enabled = false
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Semantic Validation (Sub-Emitter)', () => {
    it('should error when sub_emitter node does not exist', () => {
      const content = `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="MissingSubEmitter" type="GPUParticles3D"]
process_material = SubResource("process_1")
sub_emitter = NodePath("NonexistentEmitter")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const subEmitterError = diagnostics.find(d => d.message.includes('Sub-emitter node not found'));
      expect(subEmitterError).toBeDefined();
    });

    it('should error when sub_emitter points to wrong node type', () => {
      const content = `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="Root" type="Node3D"]

[node name="WrongType" type="MeshInstance3D" parent="."]

[node name="Particles" type="GPUParticles3D" parent="."]
process_material = SubResource("process_1")
sub_emitter = NodePath("WrongType")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const typeError = diagnostics.find(d => d.message.includes('must point to a GPUParticles3D node'));
      expect(typeError).toBeDefined();
    });

    it('should pass when sub_emitter references valid GPUParticles3D node', () => {
      const content = `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]
[sub_resource type="ParticleProcessMaterial" id="process_2"]

[node name="Root" type="Node3D"]

[node name="SubEmitter" type="GPUParticles3D" parent="."]
process_material = SubResource("process_2")

[node name="MainParticles" type="GPUParticles3D" parent="."]
process_material = SubResource("process_1")
sub_emitter = NodePath("SubEmitter")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should pass when sub_emitter is empty NodePath', () => {
      const content = `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="NoSubEmitter" type="GPUParticles3D"]
process_material = SubResource("process_1")
sub_emitter = NodePath("")
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });
  });

  describe('Performance Warnings', () => {
    it('should warn for high particle count (50000-100000)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="HighParticleCount" type="GPUParticles3D"]
process_material = SubResource("process_1")
amount = 75000
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const perfWarning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('performance'));
      expect(perfWarning).toBeDefined();
      expect(perfWarning?.message).toContain('75000');
    });

    it('should warn for very long effective lifetime', () => {
      const content = `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="LongLifetime" type="GPUParticles3D"]
process_material = SubResource("process_1")
lifetime = 100.0
speed_scale = 0.5
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      const lifetimeWarning = diagnostics.find(d => d.severity === 'warning' && d.message.includes('Effective particle lifetime'));
      expect(lifetimeWarning).toBeDefined();
      expect(lifetimeWarning?.message).toContain('200');
    });

    it('should not warn for reasonable particle count', () => {
      const content = `[gd_scene format=3]

[sub_resource type="ParticleProcessMaterial" id="process_1"]

[node name="ReasonableParticles" type="GPUParticles3D"]
process_material = SubResource("process_1")
amount = 10000
`;

      const diagnostics = linter.lint(content);
      const perfWarning = diagnostics.find(d => d.severity === 'warning');
      expect(perfWarning).toBeUndefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const content = `[gd_scene format=3]

[node name="MultipleErrors" type="GPUParticles3D"]
amount = 0
lifetime = -1.0
speed_scale = 0.0
explosiveness = 2.0
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics.length).toBeGreaterThan(3);
    });

    it('should handle all properties together', () => {
      const content = `[gd_scene format=3]

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
`;

      const diagnostics = linter.lint(content);
      expect(diagnostics).toHaveLength(0);
    });

    it('should handle node with no properties', () => {
      const content = `[gd_scene format=3]

[node name="EmptyParticles" type="GPUParticles3D"]
`;

      const diagnostics = linter.lint(content);
      // Should error because process_material is missing
      expect(diagnostics.length).toBeGreaterThan(0);
      const materialError = diagnostics.find(d => d.message.includes('process_material'));
      expect(materialError).toBeDefined();
    });
  });
});

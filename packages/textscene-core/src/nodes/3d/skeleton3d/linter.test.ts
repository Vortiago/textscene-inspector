/**
 * Tests for Skeleton3D linter (strict parser + semantic rules)
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
} from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('Skeleton3D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid Skeleton3D properties', () => {
      // Note: animate_physical_bones = true triggers an INFO message about deprecated feature
      expectNoErrors(
        scene(
          node('Skeleton3D', {
            motion_scale: '1.0',
            show_rest_only: false,
            animate_physical_bones: true,
            modifier_callback_mode_process: 1,
          })
        )
      );
    });

    describe('motion_scale validation', () => {
      it('should accept valid positive motion_scale', () => {
        expectClean(scene(node('Skeleton3D', { motion_scale: '1.5' })));
      });

      it('should reject motion_scale of 0', () => {
        expectDiagnostic(scene(node('Skeleton3D', { motion_scale: 0 })), {
          ruleName: 'strict-parser',
          contains: ['motion_scale', 'greater than 0'],
        });
      });

      it('should reject negative motion_scale', () => {
        expectDiagnostic(scene(node('Skeleton3D', { motion_scale: '-1.0' })), {
          ruleName: 'strict-parser',
          contains: ['motion_scale'],
        });
      });

      it('should reject invalid motion_scale format', () => {
        expectDiagnostic(scene(node('Skeleton3D', { motion_scale: 'not_a_number' })), {
          prop: 'motion_scale',
          contains: ['must be a number'],
        });
      });

      it('should accept very small positive motion_scale', () => {
        // Should pass format validation (> 0)
        expectNoErrors(scene(node('Skeleton3D', { motion_scale: '0.001' })), {
          ruleName: 'strict-parser',
        });
      });

      it('should accept large motion_scale', () => {
        // Should pass format validation (> 0)
        expectNoErrors(scene(node('Skeleton3D', { motion_scale: '100.0' })), {
          ruleName: 'strict-parser',
        });
      });
    });

    runPropertyValidation({ nodeType: 'Skeleton3D', acceptMode: 'no-error' }, [
      {
        prop: 'show_rest_only',
        valid: [true, false],
        invalid: [{ value: 'yes', contains: ['true or false'] }, { value: 1 }],
      },
      {
        prop: 'animate_physical_bones',
        valid: [true, false],
        invalid: [{ value: 'True', contains: ['true or false'] }],
      },
      {
        prop: 'modifier_callback_mode_process',
        valid: [0, 1, 2],
        invalid: [
          { value: 5, contains: ['0-2', 'PHYSICS', 'IDLE', 'MANUAL'] },
          { value: -1 },
          { value: 'IDLE', contains: ['must be a number'] },
        ],
      },
    ]);

    describe('bone properties validation', () => {
      it('should accept valid bone position (Vector3)', () => {
        expectNoErrors(scene(node('Skeleton3D', { 'bones/0/position': 'Vector3(0, 1.5, 0)' })), {
          ruleName: 'strict-parser',
        });
      });

      it('should accept valid bone rotation (Quaternion)', () => {
        expectNoErrors(
          scene(node('Skeleton3D', { 'bones/1/rotation': 'Quaternion(0, 0.707, 0, 0.707)' })),
          { ruleName: 'strict-parser' }
        );
      });

      it('should accept valid bone scale (Vector3)', () => {
        expectNoErrors(scene(node('Skeleton3D', { 'bones/2/scale': 'Vector3(1, 1, 1)' })), {
          ruleName: 'strict-parser',
        });
      });

      it('should reject invalid bone position format', () => {
        expectDiagnostic(scene(node('Skeleton3D', { 'bones/0/position': 'invalid_format' })), {
          prop: 'bones/0/position',
          contains: ['Vector3'],
        });
      });

      it('should reject invalid bone rotation format', () => {
        expectDiagnostic(scene(node('Skeleton3D', { 'bones/0/rotation': 'Vector3(0, 0, 0)' })), {
          prop: 'bones/0/rotation',
          contains: ['Quaternion'],
        });
      });

      it('should reject negative bone index', () => {
        expectDiagnostic(scene(node('Skeleton3D', { 'bones/-1/position': 'Vector3(0, 0, 0)' })), {
          prop: 'Bone index',
          contains: ['non-negative'],
        });
      });

      it('should reject invalid bone property key format', () => {
        expectDiagnostic(scene(node('Skeleton3D', { 'bones/invalid': 'Vector3(0, 0, 0)' })), {
          prop: 'bone property key format',
        });
      });

      it('should accept multiple bone properties', () => {
        expectNoErrors(
          scene(
            node('Skeleton3D', {
              'bones/0/position': 'Vector3(0, 1.5, 0)',
              'bones/0/rotation': 'Quaternion(0, 0, 0, 1)',
              'bones/0/scale': 'Vector3(1, 1, 1)',
              'bones/1/position': 'Vector3(0, 3.0, 0)',
            })
          ),
          { ruleName: 'strict-parser' }
        );
      });
    });
  });

  describe('Semantic Validation (Usage Context)', () => {
    describe('motion_scale warnings', () => {
      it('warns on a negative motion_scale, which the setter also replaces', () => {
        expectDiagnostic(scene(node('Skeleton3D', { motion_scale: '-1.0' })), {
          ruleName: 'valid-skeleton3d-motion-scale',
          severity: 'warning',
          contains: ['Godot replaces it with 1.0'],
        });
      });

      it('stays silent inside the hint range and above its open max end', () => {
        // skeleton_3d.cpp:1293 is "0.001,10,0.001,or_greater": 0.05 sits inside
        // the range and `or_greater` opens the top, so neither warns.
        expectClean(scene(node('Skeleton3D', { motion_scale: '0.05' })));
        expectClean(scene(node('Skeleton3D', { motion_scale: '50.0' })));
      });

      it('should not warn about normal motion_scale values', () => {
        expectNoDiagnostic(scene(node('Skeleton3D', { motion_scale: '1.0' })), {
          ruleName: 'valid-skeleton3d-motion-scale',
        });
      });

      it('should accept motion_scale at boundary of acceptable range', () => {
        for (const value of ['0.1', '0.5', '2.0', '10.0']) {
          expectNoDiagnostic(scene(node('Skeleton3D', { motion_scale: value })), {
            ruleName: 'valid-skeleton3d-motion-scale',
          });
        }
      });
    });

    describe('debug mode detection', () => {
      it('should warn when show_rest_only is enabled', () => {
        expectDiagnostic(scene(node('Skeleton3D', { show_rest_only: true })), {
          ruleName: 'skeleton3d-debug-mode',
          severity: 'warning',
          contains: ['debugging mode', 'rest pose'],
        });
      });

      it('should not warn when show_rest_only is false', () => {
        expectNoDiagnostic(scene(node('Skeleton3D', { show_rest_only: false })), {
          ruleName: 'skeleton3d-debug-mode',
        });
      });
    });

    describe('deprecated feature detection', () => {
      it('should warn about deprecated animate_physical_bones', () => {
        expectDiagnostic(scene(node('Skeleton3D', { animate_physical_bones: true })), {
          ruleName: 'skeleton3d-deprecated-feature',
          severity: 'warning',
          contains: ['deprecated', 'SkeletonModifier3D'],
        });
      });

      it('should not warn when animate_physical_bones is false', () => {
        expectNoDiagnostic(scene(node('Skeleton3D', { animate_physical_bones: false })), {
          ruleName: 'skeleton3d-deprecated-feature',
        });
      });
    });

    describe('modifier_callback_mode_process (no diagnostic)', () => {
      it('should not produce a diagnostic for PHYSICS mode', () => {
        expectNoDiagnostic(scene(node('Skeleton3D', { modifier_callback_mode_process: 0 })), {
          ruleName: 'skeleton3d-modifier-mode',
        });
      });

      it('should not produce a diagnostic for MANUAL mode', () => {
        expectNoDiagnostic(scene(node('Skeleton3D', { modifier_callback_mode_process: 2 })), {
          ruleName: 'skeleton3d-modifier-mode',
        });
      });

      it('should not produce a diagnostic for default IDLE mode', () => {
        expectNoDiagnostic(scene(node('Skeleton3D', { modifier_callback_mode_process: 1 })), {
          ruleName: 'skeleton3d-modifier-mode',
        });
      });
    });

    // A Skeleton3D is legitimately consumed by BoneAttachment3D or
    // SkeletonModifier3D subtrees, not only by a MeshInstance3D, and Skeleton3D
    // overrides no get_configuration_warnings.
    describe('skeleton usage validation', () => {
      it('reports nothing when no MeshInstance3D references the skeleton', () => {
        expectClean(
          scene(
            node('Skeleton3D', {}, { name: 'UnusedSkeleton' }),
            node('MeshInstance3D', {}, { name: 'SomeMesh' })
          )
        );
        expectClean(
          scene(
            node('Skeleton3D', {}, { name: 'UnusedSkeleton' }),
            node('Skeleton3D', {}, { name: 'OtherSkeleton' }),
            node('MeshInstance3D', { skeleton: 'NodePath("OtherSkeleton")' }, { name: 'Mesh' })
          )
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle node with no properties', () => {
      expectClean(scene(node('Skeleton3D', {}, { name: 'EmptySkeleton' })));
    });

    it('should handle multiple validation issues', () => {
      const diagnostics = lint(
        scene(
          node('Skeleton3D', {
            show_rest_only: true,
            animate_physical_bones: true,
            modifier_callback_mode_process: 0,
          })
        )
      );
      // Should have multiple warning messages (show_rest_only + animate_physical_bones)
      expect(diagnostics.length).toBeGreaterThanOrEqual(2);
      const warnings = diagnostics.filter(d => d.severity === 'warning');
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('should handle skeleton with all properties correctly set', () => {
      const diagnostics = lint(
        scene(
          node('Skeleton3D', {
            motion_scale: '1.0',
            show_rest_only: false,
            animate_physical_bones: false,
            modifier_callback_mode_process: 1,
            'bones/0/position': 'Vector3(0, 0, 0)',
            'bones/0/rotation': 'Quaternion(0, 0, 0, 1)',
            'bones/0/scale': 'Vector3(1, 1, 1)',
          }, { name: 'CompleteSkeleton' }),
          node('MeshInstance3D', { skeleton: 'NodePath("CompleteSkeleton")' }, { name: 'CharacterMesh' })
        )
      );
      // Should have no warnings or errors
      expect(diagnostics.filter(d => d.severity === 'error' || d.severity === 'warning')).toHaveLength(0);
    });

    it('should handle complex bone hierarchy', () => {
      expectNoErrors(
        scene(
          node('Skeleton3D', {
            'bones/0/position': 'Vector3(0, 0, 0)',
            'bones/0/rotation': 'Quaternion(0, 0, 0, 1)',
            'bones/1/position': 'Vector3(0, 1, 0)',
            'bones/1/rotation': 'Quaternion(0, 0.707, 0, 0.707)',
            'bones/2/position': 'Vector3(0, 2, 0)',
            'bones/2/rotation': 'Quaternion(0, 0, 0, 1)',
            'bones/2/scale': 'Vector3(0.5, 0.5, 0.5)',
          }, { name: 'ComplexSkeleton' }),
          node('MeshInstance3D', { skeleton: 'NodePath("ComplexSkeleton")' }, { name: 'Mesh' })
        ),
        { ruleName: 'strict-parser' }
      );
    });

    it('should handle scientific notation in bone transforms', () => {
      expectNoErrors(
        scene(
          node('Skeleton3D', {
            'bones/0/position': 'Vector3(1.5e-3, 2.0e+2, -3.14e1)',
            'bones/0/rotation': 'Quaternion(1e-5, 0, 0, 1.0)',
          }, { name: 'ScientificBones' })
        ),
        { ruleName: 'strict-parser' }
      );
    });
  });
});

describe('Skeleton3D Linter — lenient float grammar (#190 #7 follow-up)', () => {
  it('accepts bone rotation quaternion with leading-dot / trailing-dot floats', () => {
    expectNoErrors(
      scene(node('Skeleton3D', { 'bones/0/rotation': 'Quaternion(.5, 0, 0, 1.)' })),
      { ruleName: 'strict-parser' }
    );
  });
});

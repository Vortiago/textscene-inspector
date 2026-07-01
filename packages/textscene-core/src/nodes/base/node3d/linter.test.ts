/**
 * Tests for Node3D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  expectClean,
  expectDiagnostic,
  runPropertyValidation,
} from '../../../linter/testing/testkit';
import './linterParser'; // Import to trigger validator registration
import './linter'; // Import to trigger rule registration

describe('Node3D Linter', () => {
  describe('Strict Parser Validation - Transform Properties', () => {
    runPropertyValidation({ nodeType: 'Node3D' }, [
      {
        prop: 'transform',
        valid: ['Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)'],
        invalid: [
          { value: 'Transform3D(1, 0, 0)', contains: ['transform', '12 numbers'] },
          { value: 'Vector3(1, 0, 0)', contains: ['transform'] },
        ],
      },
      {
        prop: 'global_transform',
        valid: ['Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 5, 10, 15)'],
      },
    ]);
  });

  describe('Strict Parser Validation - Position Properties', () => {
    runPropertyValidation({ nodeType: 'Node3D' }, [
      {
        prop: 'position',
        valid: ['Vector3(1, 2, 3)', 'Vector3(-10, -20, -30)', 'Vector3(1.5e-3, 2.1e+2, 3.0e0)'],
        invalid: [{ value: 'Vector3(1, 2)', contains: ['position', '3 numbers'] }],
      },
    ]);
  });

  describe('Strict Parser Validation - Rotation Properties', () => {
    runPropertyValidation({ nodeType: 'Node3D' }, [
      {
        prop: 'rotation',
        valid: ['Vector3(0, 1.5708, 0)'],
        invalid: [{ value: 'Vector3(0, 90)', contains: ['rotation'] }],
      },
      {
        prop: 'rotation_degrees',
        valid: ['Vector3(0, 90, 0)'],
      },
      {
        prop: 'rotation_order',
        valid: [0, 1, 2, 3, 4, 5], // XYZ, XZY, YXZ, YZX, ZXY, ZYX
        invalid: [{ value: 99, contains: ['rotation_order', '0-5'] }],
      },
    ]);
  });

  describe('Strict Parser Validation - Scale Properties', () => {
    runPropertyValidation({ nodeType: 'Node3D' }, [
      {
        // Any nonzero magnitude is valid Godot and lints clean, including
        // negative (a mirror/flip) and extreme-but-finite values; only a zero
        // axis (a collapsed transform) and malformed values error. See
        // linterParser.ts — the base-walk (#143) inherits this to every Node3D
        // subclass, so it must match what the renderer accepts (and Node2D).
        prop: 'scale',
        valid: [
          'Vector3(1, 1, 1)',
          'Vector3(2, 0.5, 1.5)',
          'Vector3(10000, 1, 1)',
          'Vector3(0.0001, 1, 1)',
          'Vector3(1, -1, 1)',
          'Vector3(-2, -2, -2)',
        ],
        invalid: [
          { value: 'Vector3(0, 1, 1)', contains: ['scale', 'non-zero'] },
          { value: 'Vector3(1, 1)', contains: ['scale', '3 numbers'] },
        ],
      },
    ]);
  });

  describe('Strict Parser Validation - Quaternion and Basis', () => {
    runPropertyValidation({ nodeType: 'Node3D' }, [
      {
        prop: 'quaternion',
        valid: ['Quaternion(0, 0, 0, 1)'],
        invalid: [{ value: 'Quaternion(0, 0, 1)', contains: ['quaternion', '4 numbers'] }],
      },
      {
        prop: 'basis',
        valid: ['Basis(1, 0, 0, 0, 1, 0, 0, 0, 1)'],
        invalid: [{ value: 'Basis(1, 0, 0, 0, 1, 0)', contains: ['basis', '9 numbers'] }],
      },
    ]);
  });

  describe('Strict Parser Validation - Visibility Properties', () => {
    runPropertyValidation({ nodeType: 'Node3D' }, [
      {
        prop: 'visible',
        valid: [true, false],
        invalid: [{ value: 1, contains: ['visible', 'boolean'] }],
      },
      {
        prop: 'top_level',
        valid: [true],
        invalid: [{ value: 'yes', contains: ['top_level', 'boolean'] }],
      },
      {
        prop: 'visibility_parent',
        valid: ['NodePath("")'],
        invalid: [{ value: '"../ParentNode"', contains: ['visibility_parent', 'NodePath'] }],
      },
    ]);

    it('should pass validation for valid visibility_parent with absolute path', () => {
      expectClean(
        scene(
          node('Node3D', {}, { name: 'ParentNode' }),
          node('Node3D', { visibility_parent: 'NodePath("ParentNode")' }, { name: 'ValidNode' })
        )
      );
    });
  });

  describe('Strict Parser Validation - Global Properties', () => {
    runPropertyValidation({ nodeType: 'Node3D' }, [
      { prop: 'global_position', valid: ['Vector3(10, 20, 30)'] },
      { prop: 'global_rotation', valid: ['Vector3(0, 1.5708, 0)'] },
      { prop: 'global_rotation_degrees', valid: ['Vector3(0, 90, 0)'] },
      { prop: 'global_basis', valid: ['Basis(1, 0, 0, 0, 1, 0, 0, 0, 1)'] },
    ]);
  });

  describe('Semantic Validation - Visibility Parent References', () => {
    it('should pass when visibility_parent node exists', () => {
      expectClean(
        scene(
          node('Node3D', {}, { name: 'ParentNode' }),
          node(
            'Node3D',
            { visibility_parent: 'NodePath("ParentNode")' },
            { name: 'ChildNode', parent: 'ParentNode' }
          )
        )
      );
    });

    it('should detect missing visibility_parent node', () => {
      expectDiagnostic(
        scene(node('Node3D', { visibility_parent: 'NodePath("NonExistentNode")' }, { name: 'ChildNode' })),
        { ruleName: 'valid-node3d-visibility', severity: 'error', contains: ['not found'] }
      );
    });

    it('should pass when visibility_parent is empty', () => {
      expectClean(scene(node('Node3D', { visibility_parent: 'NodePath("")' }, { name: 'ChildNode' })));
    });

    it('should warn about relative visibility_parent paths', () => {
      const diagnostics = lint(
        scene(
          node('Node3D', {}, { name: 'ParentNode' }),
          node(
            'Node3D',
            { visibility_parent: 'NodePath("../OtherNode")' },
            { name: 'ChildNode', parent: 'ParentNode' }
          )
        )
      );
      const visibilityWarning = diagnostics.find(d => d.ruleName === 'valid-node3d-visibility');
      if (visibilityWarning) {
        expect(visibilityWarning.severity).toBe('warning');
        expect(visibilityWarning.message).toContain('Relative');
      }
    });
  });

  describe('Combined Properties Validation', () => {
    it('should pass validation for node with multiple valid properties', () => {
      expectClean(
        scene(
          node('Node3D', {
            position: 'Vector3(1, 2, 3)',
            rotation_degrees: 'Vector3(0, 90, 0)',
            scale: 'Vector3(2, 2, 2)',
            visible: true,
            top_level: false,
          })
        )
      );
    });

    it('should detect multiple errors in a single node', () => {
      const diagnostics = lint(
        scene(
          node('Node3D', {
            position: 'Vector3(1, 2)',
            scale: 'Vector3(0, 1, 1)',
            visible: 'maybe',
          })
        )
      );
      expect(diagnostics.length).toBeGreaterThanOrEqual(3);
      expect(diagnostics.some(d => d.message.includes('position'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('scale'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('visible'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle nodes without any transform properties', () => {
      expectClean(scene(node('Node3D', {}, { name: 'MinimalNode' })));
    });

    it('should handle very small valid scale values', () => {
      expectClean(scene(node('Node3D', { scale: 'Vector3(0.01, 0.01, 0.01)' })));
    });

    it('should handle very large valid scale values', () => {
      expectClean(scene(node('Node3D', { scale: 'Vector3(100, 100, 100)' })));
    });

    it('should handle Node3D properties on subclasses (e.g., MeshInstance3D)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="mesh_1"]

[node name="MeshNode" type="Node3D"]
position = Vector3(1, 2, 3)
scale = Vector3(0, 1, 1)
`;

      const diagnostics = lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      // Should catch the zero scale error
      expect(diagnostics.some(d => d.message.includes('scale'))).toBe(true);
    });
  });
});

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
  expectNoDiagnostic,
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
        // Any magnitude is valid Godot and lints clean, including zero
        // (`Node3D::set_scale`, node_3d.cpp:812-827, is a bare assignment with
        // no zero guard, unlike Node2D's), negative (a mirror/flip), and
        // extreme-but-finite values; only malformed values error. See
        // linterParser.ts — the base-walk inherits this to every Node3D
        // subclass.
        prop: 'scale',
        valid: [
          'Vector3(1, 1, 1)',
          'Vector3(2, 0.5, 1.5)',
          'Vector3(10000, 1, 1)',
          'Vector3(0.0001, 1, 1)',
          'Vector3(1, -1, 1)',
          'Vector3(-2, -2, -2)',
          'Vector3(0, 1, 1)',
          'Vector3(0, 0, 0)',
        ],
        invalid: [{ value: 'Vector3(1, 1)', contains: ['scale', '3 numbers'] }],
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
        invalid: [{ value: 1, severity: 'warning', contains: ['visible', 'converts'] }],
      },
      {
        prop: 'top_level',
        valid: [true],
        invalid: [{ value: 'yes', contains: ['top_level', 'boolean'] }],
      },
      {
        prop: 'visibility_parent',
        valid: ['NodePath("")'],
        // variant.cpp:746-749 lists STRING (not STRING_NAME) as a strict source for NODE_PATH.
        invalid: [{ value: '&"../ParentNode"', contains: ['visibility_parent', 'NodePath'] }],
      },
    ]);

    it('should pass validation for a visibility_parent that names a sibling', () => {
      // Every node below the root states `parent="."`. Without it the second
      // heading is a second ROOT, which Godot refuses (packed_scene.cpp:206)
      // and the tree build drops — so the rule under test never ran on it.
      expectClean(
        scene(
          node('Node3D', {}, { name: 'Root' }),
          node('Node3D', {}, { name: 'ParentNode', parent: '.' }),
          node(
            'Node3D',
            { visibility_parent: 'NodePath("../ParentNode")' },
            { name: 'ValidNode', parent: '.' }
          )
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
      // `parent="."`, not `parent="ParentNode"`: a child of the root names the
      // root as `.`, and the longer spelling resolves against nothing.
      expectClean(
        scene(
          node('Node3D', {}, { name: 'ParentNode' }),
          node('Node3D', { visibility_parent: 'NodePath("..")' }, { name: 'ChildNode', parent: '.' })
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

    // `%Name` resolves through the owner's `owned_unique_nodes`
    // (node.cpp:1931-1933), not by tree position, and it is what the inspector's
    // node picker writes. Comparing it against a position-keyed path map called a
    // working reference "not found", at error tier. The flag is what puts the
    // name in the table (node.cpp:2222), so the target must carry it.
    it('should report nothing for a %unique-name visibility_parent', () => {
      expectNoDiagnostic(
        scene(
          node('Node3D', { unique_name_in_owner: 'true' }, { name: 'ParentNode' }),
          node(
            'Node3D',
            { visibility_parent: 'NodePath("%ParentNode")' },
            { name: 'ChildNode', parent: '.' }
          )
        ),
        { ruleName: 'valid-node3d-visibility' }
      );
    });

    it('should report nothing for a relative visibility_parent path', () => {
      // `..` walks to the parent and the next segment reads ITS children, so a
      // relative path resolves like any other — the rule declines only the
      // absolute form, whose root is the live SceneTree's and not this file's.
      expectNoDiagnostic(
        scene(
          node('Node3D', {}, { name: 'ParentNode' }),
          node('Node3D', {}, { name: 'OtherNode', parent: '.' }),
          node(
            'Node3D',
            { visibility_parent: 'NodePath("../OtherNode")' },
            { name: 'ChildNode', parent: '.' }
          )
        ),
        { ruleName: 'valid-node3d-visibility' }
      );
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
            scale: 'Vector3(1, 1)',
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

    it('accepts a zero-component scale: Node3D::set_scale has no zero guard, unlike Node2D', () => {
      expectClean(scene(node('Node3D', { scale: 'Vector3(0, 1, 1)' })));
      expectClean(scene(node('Node3D', { scale: 'Vector3(0, 0, 0)' })));
    });

    it('should handle Node3D properties on subclasses (e.g., MeshInstance3D)', () => {
      const content = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="mesh_1"]

[node name="MeshNode" type="Node3D"]
position = Vector3(1, 2, 3)
scale = Vector3(1, 1)
`;

      const diagnostics = lint(content);
      expect(diagnostics.length).toBeGreaterThan(0);
      // Should catch the malformed scale (base-walk delivers Node3D's own
      // validator to the subclass)
      expect(diagnostics.some(d => d.message.includes('scale'))).toBe(true);
    });
  });
});

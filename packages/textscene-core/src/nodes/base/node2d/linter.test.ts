/**
 * Tests for Node2D linter (strict parser validators). Node2D registers no
 * semantic rule — it is a base class; semantic validation lives in the
 * subclasses (see index.linter.ts).
 */

import { describe, it, expect } from 'vitest';
import { node, scene, lint, expectClean, expectDiagnostic } from '../../../linter/testing/testkit';
import './linterParser'; // Import to trigger validator registration

describe('Node2D Linter', () => {
  describe('Strict Parser Validation - Position Properties', () => {
    it('should pass validation for valid position', () => {
      expectClean(scene(node('Node2D', { position: 'Vector2(100, 50)' })));
    });

    it('should pass validation for negative position values', () => {
      expectClean(scene(node('Node2D', { position: 'Vector2(-100, -50)' })));
    });

    it('should pass validation for scientific notation in position', () => {
      expectClean(scene(node('Node2D', { position: 'Vector2(1.5e2, 2.1e-1)' })));
    });

    it('should detect invalid position format - too few values', () => {
      expectDiagnostic(scene(node('Node2D', { position: 'Vector2(100)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['position', '2 numbers'],
      });
    });

    it('should detect invalid position format - too many values', () => {
      expectDiagnostic(scene(node('Node2D', { position: 'Vector2(100, 50, 25)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['position'],
      });
    });

    it('should detect invalid position format - wrong type', () => {
      expectDiagnostic(scene(node('Node2D', { position: 'Vector3(100, 50, 0)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['position'],
      });
    });

    it('should pass validation for valid global_position', () => {
      expectClean(scene(node('Node2D', { global_position: 'Vector2(100, 50)' })));
    });
  });

  describe('Strict Parser Validation - Rotation Properties', () => {
    it('should pass validation for valid rotation', () => {
      expectClean(scene(node('Node2D', { rotation: 1.5708 })));
    });

    it('should pass validation for negative rotation', () => {
      expectClean(scene(node('Node2D', { rotation: -1.5708 })));
    });

    it('should pass validation for zero rotation', () => {
      expectClean(scene(node('Node2D', { rotation: 0 })));
    });

    it('should detect invalid rotation format', () => {
      expectDiagnostic(scene(node('Node2D', { rotation: '"ninety degrees"' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['rotation', 'number'],
      });
    });

    it('should pass validation for valid rotation_degrees', () => {
      expectClean(scene(node('Node2D', { rotation_degrees: 90 })));
    });

    it('should pass validation for rotation_degrees with decimal', () => {
      expectClean(scene(node('Node2D', { rotation_degrees: 45.5 })));
    });

    it('should detect invalid rotation_degrees format', () => {
      expectDiagnostic(scene(node('Node2D', { rotation_degrees: 'Vector2(90, 0)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['rotation_degrees'],
      });
    });

    it('should pass validation for valid global_rotation', () => {
      expectClean(scene(node('Node2D', { global_rotation: 3.14159 })));
    });

    it('should pass validation for valid global_rotation_degrees', () => {
      expectClean(scene(node('Node2D', { global_rotation_degrees: 180 })));
    });
  });

  describe('Strict Parser Validation - Scale Properties', () => {
    it('should pass validation for valid scale', () => {
      expectClean(scene(node('Node2D', { scale: 'Vector2(1, 1)' })));
    });

    it('should pass validation for non-uniform scale', () => {
      expectClean(scene(node('Node2D', { scale: 'Vector2(2, 0.5)' })));
    });

    it('should pass validation for negative scale', () => {
      expectClean(scene(node('Node2D', { scale: 'Vector2(-1, 1)' })));
    });

    it('should detect zero scale value on x-axis', () => {
      expectDiagnostic(scene(node('Node2D', { scale: 'Vector2(0, 1)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['scale', 'non-zero', 'rendering issues'],
      });
    });

    it('should detect zero scale value on y-axis', () => {
      expectDiagnostic(scene(node('Node2D', { scale: 'Vector2(1, 0)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['scale', 'non-zero'],
      });
    });

    it('should detect zero scale on both axes', () => {
      expectDiagnostic(scene(node('Node2D', { scale: 'Vector2(0, 0)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['scale', 'non-zero'],
      });
    });

    // Extreme-but-nonzero scales are valid Godot (the renderer draws them; real
    // scenes use near-zero "hide" scales), so they must lint clean — erroring
    // would re-introduce parser/linter divergence now that every Node2D subclass
    // inherits this validator via the base-walk.
    it('tolerates a very large (but finite) scale', () => {
      expectClean(scene(node('Node2D', { scale: 'Vector2(10000, 1)' })));
    });

    it('tolerates a near-zero (but nonzero) scale', () => {
      expectClean(scene(node('Node2D', { scale: 'Vector2(0.00001, 0.00001)' })));
    });

    it('flags a component closer to zero than CMP_EPSILON, which Godot silently rewrites', () => {
      // node_2d.cpp:194-198's is_zero_approx uses CMP_EPSILON (1e-5), not exact
      // zero; a value strictly smaller gets substituted just like exact 0 does.
      expectDiagnostic(scene(node('Node2D', { scale: 'Vector2(0.000001, 1)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['scale', 'non-zero'],
      });
    });

    it('should detect invalid scale format', () => {
      expectDiagnostic(scene(node('Node2D', { scale: 'Vector2(1)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['scale', '2 numbers'],
      });
    });

    it('should pass validation for valid global_scale', () => {
      expectClean(scene(node('Node2D', { global_scale: 'Vector2(2, 2)' })));
    });
  });

  describe('Strict Parser Validation - Skew Properties', () => {
    it('should pass validation for valid skew', () => {
      expectClean(scene(node('Node2D', { skew: 0.5 })));
    });

    it('should pass validation for zero skew', () => {
      expectClean(scene(node('Node2D', { skew: 0 })));
    });

    it('should pass validation for negative skew', () => {
      expectClean(scene(node('Node2D', { skew: -0.25 })));
    });

    it('should detect invalid skew format', () => {
      expectDiagnostic(scene(node('Node2D', { skew: '"slanted"' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['skew', 'number'],
      });
    });

    it('should pass validation for valid global_skew', () => {
      expectClean(scene(node('Node2D', { global_skew: 0.3 })));
    });
  });

  describe('Strict Parser Validation - Transform Properties', () => {
    it('should pass validation for valid transform', () => {
      expectClean(scene(node('Node2D', { transform: 'Transform2D(1, 0, 0, 1, 0, 0)' })));
    });

    it('should pass validation for transform with translation', () => {
      expectClean(scene(node('Node2D', { transform: 'Transform2D(1, 0, 0, 1, 100, 50)' })));
    });

    it('should pass validation for rotated transform', () => {
      expectClean(scene(node('Node2D', { transform: 'Transform2D(0.707, 0.707, -0.707, 0.707, 0, 0)' })));
    });

    it('should detect invalid transform format - too few values', () => {
      expectDiagnostic(scene(node('Node2D', { transform: 'Transform2D(1, 0, 0, 1)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['transform', '6 numbers'],
      });
    });

    it('should detect invalid transform format - wrong type', () => {
      expectDiagnostic(
        scene(node('Node2D', { transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0)' })),
        {
          ruleName: 'strict-parser',
          severity: 'error',
          contains: ['transform'],
        }
      );
    });

    it('should pass validation for valid global_transform', () => {
      expectClean(scene(node('Node2D', { global_transform: 'Transform2D(1, 0, 0, 1, 200, 100)' })));
    });
  });

  describe('Strict Parser Validation - Z-Index Properties', () => {
    it('should pass validation for valid z_index', () => {
      expectClean(scene(node('Node2D', { z_index: 10 })));
    });

    it('should pass validation for negative z_index', () => {
      expectClean(scene(node('Node2D', { z_index: -5 })));
    });

    it('should pass validation for zero z_index', () => {
      expectClean(scene(node('Node2D', { z_index: 0 })));
    });

    it('should detect invalid z_index format - float', () => {
      expectDiagnostic(scene(node('Node2D', { z_index: 10.5 })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['z_index', 'integer'],
      });
    });

    it('should detect invalid z_index format - string', () => {
      expectDiagnostic(scene(node('Node2D', { z_index: '"ten"' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['z_index'],
      });
    });

    it('should pass validation for valid z_as_relative', () => {
      expectClean(scene(node('Node2D', { z_as_relative: true })));
    });

    it('should pass validation for z_as_relative = false', () => {
      expectClean(scene(node('Node2D', { z_as_relative: false })));
    });

    it('should detect invalid z_as_relative format', () => {
      expectDiagnostic(scene(node('Node2D', { z_as_relative: 1 })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['z_as_relative', 'boolean'],
      });
    });
  });

  describe('Strict Parser Validation - Y-Sort Properties', () => {
    it('should pass validation for valid y_sort_enabled', () => {
      expectClean(scene(node('Node2D', { y_sort_enabled: true })));
    });

    it('should pass validation for y_sort_enabled = false', () => {
      expectClean(scene(node('Node2D', { y_sort_enabled: false })));
    });

    it('should detect invalid y_sort_enabled format', () => {
      expectDiagnostic(scene(node('Node2D', { y_sort_enabled: 'yes' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['y_sort_enabled', 'boolean'],
      });
    });
  });

  describe('Combined Properties Validation', () => {
    it('should pass validation for node with multiple valid properties', () => {
      expectClean(
        scene(
          node('Node2D', {
            position: 'Vector2(100, 50)',
            rotation_degrees: 45,
            scale: 'Vector2(2, 2)',
            skew: 0.1,
            z_index: 5,
            z_as_relative: true,
            y_sort_enabled: false,
          })
        )
      );
    });

    it('should detect multiple errors in a single node', () => {
      const diagnostics = lint(
        scene(
          node('Node2D', {
            position: 'Vector2(100)',
            scale: 'Vector2(0, 1)',
            z_index: 5.5,
            y_sort_enabled: 'maybe',
          })
        )
      );
      expect(diagnostics.length).toBeGreaterThanOrEqual(4);
      expect(diagnostics.some(d => d.message.includes('position'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('scale'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('z_index'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('y_sort_enabled'))).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle nodes without any transform properties', () => {
      expectClean(scene(node('Node2D')));
    });

    it('should handle very small valid scale values', () => {
      expectClean(scene(node('Node2D', { scale: 'Vector2(0.01, 0.01)' })));
    });

    it('should handle very large valid scale values', () => {
      expectClean(scene(node('Node2D', { scale: 'Vector2(100, 100)' })));
    });

    it('should handle extreme rotation values', () => {
      expectClean(scene(node('Node2D', { rotation: 6.28318, rotation_degrees: 720 })));
    });

    it('should handle scientific notation in transform', () => {
      expectClean(scene(node('Node2D', { transform: 'Transform2D(1e0, 0e0, 0e0, 1e0, 1e2, 5e1)' })));
    });

    it('should handle Node2D properties on subclasses (e.g., Sprite2D)', () => {
      // Should catch the zero scale error
      expectDiagnostic(scene(node('Node2D', { position: 'Vector2(50, 50)', scale: 'Vector2(0, 1)' })), {
        prop: 'scale',
      });
    });

    it('accepts z_index across the whole range Godot allows', () => {
      // scene/main/canvas_item.cpp:668-669 — set_z_index ERR_FAIL_CONDs on both
      // sides of CANVAS_ITEM_Z_MIN/MAX (±4096, rendering_server.h:103-104), so
      // these are hard bounds and not an editor convenience.
      expectClean(scene(node('Node2D', { z_index: 4096 })));
      expectClean(scene(node('Node2D', { z_index: -4096 })));
    });

    it('rejects a z_index Godot itself refuses', () => {
      // Previously `v.strictInt` with no bounds, so 999999 passed — a value the
      // engine will not load. The CanvasItem tier carries the real range.
      expectDiagnostic(scene(node('Node2D', { z_index: 999999 })), {
        prop: 'z_index',
        severity: 'error',
      });
      expectDiagnostic(scene(node('Node2D', { z_index: -999999 })), {
        prop: 'z_index',
        severity: 'error',
      });
    });
  });

  describe('Scale magnitude tolerance', () => {
    // Any nonzero magnitude is valid Godot and lints clean — only a zero axis
    // (a collapsed transform) errors. There is no extreme-magnitude threshold,
    // and negative components are valid mirrors/flips (matching Node3D).
    it('tolerates tiny, huge, and negative (mirror) nonzero scales', () => {
      for (const s of [
        'Vector2(0.001, 0.001)',
        'Vector2(1000, 1000)',
        'Vector2(0.0009, 1)',
        'Vector2(1001, 1)',
        'Vector2(-1, 1)',
        'Vector2(-2, -2)',
      ]) {
        expectClean(scene(node('Node2D', { scale: s })));
      }
    });
  });
});

describe('Node2D Linter: light_mask, inherited by every CanvasItem', () => {
  // canvas_item.cpp:1477, PROPERTY_HINT_LAYERS_2D_RENDER — not a
  // PROPERTY_HINT_RANGE. set_light_mask (canvas_item.cpp:589-596) assigns
  // unconditionally, no ERR_FAIL, no clamp. ADR-0032 removed the 0..2^32-1
  // `layerBitmask` bound this used to carry (ungrounded verdict "none");
  // only the integer format is checked now.
  it('accepts the whole 32-bit range, including 0 and the sign bit', () => {
    for (const mask of ['0', '1', '512', '2147483648', '4294967295']) {
      expectClean(scene(node('Node2D', { light_mask: mask })));
    }
  });

  it('warns on a negative mask, which the 32-checkbox widget cannot express', () => {
    // canvas_item.cpp:1477 hints PROPERTY_HINT_LAYERS_2D_RENDER; set_light_mask
    // (:589-596) assigns unconditionally, so this is the UI's bound, not the
    // engine's, and it warns rather than erroring.
    expectDiagnostic(scene(node('Node2D', { light_mask: '-1' })), { severity: 'warning' });
  });

  it('warns on a mask past 32 bits, for the same reason', () => {
    expectDiagnostic(scene(node('Node2D', { light_mask: '4294967296' })), { severity: 'warning' });
  });

  it('still requires an integer format', () => {
    expectDiagnostic(scene(node('Node2D', { light_mask: 'not-a-number' })), {
      ruleName: 'strict-parser',
      severity: 'error',
      contains: ['light_mask'],
    });
  });

  it('reaches a Node2D SUBCLASS through the base walk', () => {
    // The point of registering it here: every 2D slice inherits the validator
    // rather than each one re-declaring it.
    expectDiagnostic(scene(node('Sprite2D', { light_mask: '-1' })), { severity: 'warning' });
  });
});

describe('Node2D Linter — lenient float grammar (#190 #7 follow-up)', () => {
  it('accepts scale with leading-dot / trailing-dot / explicit-plus floats', () => {
    expectClean(scene(node('Node2D', { scale: 'Vector2(.5, 2.)' })));
    expectClean(scene(node('Node2D', { scale: 'Vector2(+1, 1)' })));
  });
});

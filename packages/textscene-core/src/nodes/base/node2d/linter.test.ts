/**
 * Tests for the Node2D linter (strict parser validators). Node2D is a base class
 * and registers no semantic rule. Semantic validation lives in the subclasses
 * (see index.linter.ts).
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

    // Extreme but nonzero scales are valid Godot: the renderer draws them and
    // scenes use near-zero "hide" scales, so they lint clean.
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

    // node_2d.cpp:194-198's guard is `is_zero_approx`, that is `abs(v) <
    // CMP_EPSILON`, which is false for an infinite component and false for a
    // `nan` one, so Godot assigns both unaltered.
    it('tolerates a non-finite scale component, which Godot stores as written', () => {
      expectClean(scene(node('Node2D', { scale: 'Vector2(inf, inf_neg)' })));
      expectClean(scene(node('Node2D', { scale: 'Vector2(nan, 1)' })));
    });

    it('names the non-finite component as a number when the OTHER one is zero', () => {
      const diagnostic = expectDiagnostic(scene(node('Node2D', { scale: 'Vector2(inf, 0)' })), {
        ruleName: 'strict-parser',
        severity: 'error',
        contains: ['scale', 'non-zero'],
      });
      expect(diagnostic.message).toContain('Vector2(Infinity, 0)');
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

    it('accepts the converted ends of the ±89.9 degree hint', () => {
      // node_2d.cpp:503, PROPERTY_HINT_RANGE "-89.9,89.9,0.1,radians_as_degrees":
      // the inspector shows degrees, the .tscn stores radians, so the extents
      // are ±1.56905 rad. Bounding on ±89.9 RADIANS would reject nothing a
      // scene can contain.
      expectClean(scene(node('Node2D', { skew: 1.569 })));
      expectClean(scene(node('Node2D', { skew: -1.569 })));
    });

    it('warns, not errors, past the skew hint', () => {
      // set_skew (node_2d.cpp:178-185) is a bare assignment with no clamp,
      // unlike set_scale below it, so the hint governs the inspector alone.
      expectDiagnostic(scene(node('Node2D', { skew: 1.6 })), {
        ruleName: 'strict-parser',
        severity: 'warning',
        contains: ['skew', '89.9 degrees'],
      });
      expectDiagnostic(scene(node('Node2D', { skew: -1.6 })), {
        ruleName: 'strict-parser',
        severity: 'warning',
        contains: ['skew', '89.9 degrees'],
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

    it('warns that a float z_index is truncated', () => {
      expectDiagnostic(scene(node('Node2D', { z_index: 10.5 })), {
        ruleName: 'strict-parser',
        severity: 'warning',
        contains: ['z_index', 'integer slot', 'stores 10'],
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
        severity: 'warning',
        contains: ['z_as_relative', 'converts'],
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
      // scene/main/canvas_item.cpp:668-669: set_z_index ERR_FAIL_CONDs on both
      // sides of CANVAS_ITEM_Z_MIN/MAX (±4096, rendering_server.h:103-104), so
      // these are hard bounds and not an editor convenience.
      expectClean(scene(node('Node2D', { z_index: 4096 })));
      expectClean(scene(node('Node2D', { z_index: -4096 })));
    });

    it('rejects a z_index Godot itself refuses', () => {
      // The CanvasItem tier carries the real range; an unbounded `v.strictInt`
      // here would pass 999999, a value the engine will not load.
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
    // Any nonzero magnitude is valid Godot and lints clean. Only a zero axis
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
  // canvas_item.cpp:1477, PROPERTY_HINT_LAYERS_2D_RENDER, not a
  // PROPERTY_HINT_RANGE. set_light_mask (canvas_item.cpp:589-596) assigns
  // unconditionally, no ERR_FAIL, no clamp, so ADR-0032's verdict is "none":
  // no 0..2^32-1 `layerBitmask` bound, only the integer format.
  it('accepts the whole 32-bit range, including 0 and the sign bit', () => {
    for (const mask of ['0', '1', '512', '2147483648', '4294967295']) {
      expectClean(scene(node('Node2D', { light_mask: mask })));
    }
  });

  it('accepts a negative mask, which is how Godot spells all layers on', () => {
    // canvas_item.cpp:1477 hints PROPERTY_HINT_LAYERS_2D_RENDER; set_light_mask
    // (:589-596) assigns unconditionally, and measured on 4.6.3 `light_mask =
    // -1` stores -1, a pattern the 32 checkboxes render exactly.
    expectClean(scene(node('Node2D', { light_mask: '-1' })));
  });

  it('errors on a mask past 32 bits, where the engine drops the extra', () => {
    // Measured: `light_mask = 4294967296` stores 0, so the file misstates it.
    expectDiagnostic(scene(node('Node2D', { light_mask: '4294967296' })), { severity: 'error' });
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
    expectDiagnostic(scene(node('Sprite2D', { light_mask: '4294967296' })), { severity: 'error' });
  });
});

describe('Node2D Linter — the tokenizer float grammar', () => {
  it('accepts a trailing-dot scale component', () => {
    expectClean(scene(node('Node2D', { scale: 'Vector2(0.5, 2.)' })));
  });

  it('refuses a leading-plus or leading-dot component, which Godot cannot read', () => {
    // Measured on 4.6.3: both spellings fail the load outright, so a clean
    // lint here would say nothing about a file that does not open.
    expectDiagnostic(scene(node('Node2D', { scale: 'Vector2(+1, 1)' })), { severity: 'error' });
    expectDiagnostic(scene(node('Node2D', { scale: 'Vector2(.5, 2)' })), { severity: 'error' });
  });
});

/**
 * Tests for Camera2D linter (strict parser + semantic rules)
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

describe('Camera2D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid Camera2D properties', () => {
      expectClean(
        scene(
          node('Camera2D', {
            anchor_mode: 1,
            enabled: true,
            zoom: 'Vector2(1, 1)',
            offset: 'Vector2(0, 0)',
            process_callback: 1,
            limit_left: -1000,
            limit_top: -1000,
            limit_right: 1000,
            limit_bottom: 1000,
            position_smoothing_enabled: true,
            position_smoothing_speed: 5.0,
          })
        )
      );
    });

    runPropertyValidation({ nodeType: 'Camera2D' }, [
      {
        prop: 'anchor_mode',
        valid: [0, 1],
        invalid: [
          { value: 5, contains: ['anchor_mode', '0-1'] },
          { value: 'center', contains: ['anchor_mode', 'must be a number'] },
        ],
      },
      {
        prop: 'enabled',
        valid: [true, false],
        invalid: [{ value: 'yes', contains: ['enabled', 'boolean'] }],
      },
      {
        prop: 'ignore_rotation',
        valid: [true, false],
        invalid: [{ value: 1, severity: 'warning', contains: ['ignore_rotation', 'converts'] }],
      },
      {
        prop: 'offset',
        valid: ['Vector2(10.5, -20.3)', 'Vector2(1.5e2, -3.2e1)'],
        invalid: [
          { value: '(10, 20)', contains: ['offset', 'Vector2'] },
          { value: 'Vector2(10, 20, 30)', contains: ['offset'] },
        ],
      },
      {
        // camera_2d.cpp:103-105: set_zoom only rejects a (near-)zero component
        // ("Zoom level must be different from 0 (can be negative)."), so a
        // negative zoom is legal — it flips the view.
        prop: 'zoom',
        valid: ['Vector2(2, 2)', 'Vector2(0.5, 0.5)', 'Vector2(1, -1)', 'Vector2(-2, -2)'],
        invalid: [
          { value: 'Vector2(0, 1)', contains: ['zoom', 'non-zero'] },
          { value: 'Vector2(1, 0.000001)', contains: ['zoom', 'non-zero'] },
          { value: '(2, 2)', contains: ['zoom', 'Vector2'] },
        ],
      },
      {
        prop: 'process_callback',
        valid: [0, 1],
        invalid: [{ value: 5, contains: ['process_callback', '0-1'] }],
      },
      {
        prop: 'limit_smoothed',
        valid: [true, false],
        invalid: [{ value: 1, severity: 'warning', contains: ['limit_smoothed', 'converts'] }],
      },
      {
        prop: 'limit_left',
        valid: [-1000],
        invalid: [{ value: 'invalid', contains: ['limit_left', 'must be a number'] }],
      },
      {
        // A fractional limit LOADS — the INT conversion truncates it — but the
        // stored value is not the written one, so it draws the truncation
        // warning and is not a clean example.
        prop: 'limit_top',
        valid: [-500, 10],
      },
      {
        prop: 'limit_right',
        valid: [1000],
        invalid: [{ value: 'abc', contains: ['limit_right', 'must be a number'] }],
      },
      {
        prop: 'limit_bottom',
        valid: [500],
        invalid: [{ value: 'xyz', contains: ['limit_bottom', 'must be a number'] }],
      },
      {
        prop: 'position_smoothing_enabled',
        valid: [true],
        with: { position_smoothing_speed: 5.0 },
      },
      {
        // camera_2d.cpp:703: set_position_smoothing_speed does
        // `position_smoothing_speed = MAX(0, p_speed)` — 0 is a legal value
        // (it disables smoothing), only negative is out of range.
        prop: 'position_smoothing_speed',
        valid: [10, 0],
        invalid: [
          { value: '-5.0', contains: ['position_smoothing_speed', 'non-negative'] },
          { value: 'fast', contains: ['position_smoothing_speed', 'must be a number'] },
        ],
      },
      {
        prop: 'rotation_smoothing_enabled',
        valid: [true],
        with: { rotation_smoothing_speed: 5.0 },
      },
      {
        // camera_2d.cpp:715: set_rotation_smoothing_speed does the same
        // `MAX(0, p_speed)` clamp — 0 is legal, only negative is out of range.
        prop: 'rotation_smoothing_speed',
        valid: [10, 0],
        invalid: [{ value: '-5.0', contains: ['rotation_smoothing_speed', 'non-negative'] }],
      },
      {
        prop: 'drag_horizontal_enabled',
        valid: [true],
        with: { drag_vertical_enabled: false },
      },
      {
        prop: 'drag_horizontal_offset',
        valid: [-1, -0.5, 0, 0.5, 1],
        invalid: [{ value: 1.5, contains: ['drag_horizontal_offset', 'between -1 and 1'] }],
      },
      {
        prop: 'drag_vertical_offset',
        valid: [-1, -0.5, 0, 0.5, 1],
        invalid: [{ value: '-2.0', contains: ['drag_vertical_offset', 'between -1 and 1'] }],
      },
      {
        prop: 'drag_left_margin',
        valid: [0, 0.2, 0.5, 0.8, 1],
        invalid: [{ value: 1.5, contains: ['drag_left_margin', 'between 0 and 1'] }],
      },
      {
        prop: 'drag_top_margin',
        valid: [0, 0.2, 0.5, 0.8, 1],
        invalid: [{ value: -0.1, contains: ['drag_top_margin', 'between 0 and 1'] }],
      },
      {
        prop: 'drag_right_margin',
        valid: [0, 0.2, 0.5, 0.8, 1],
        invalid: [{ value: '2.0', contains: ['drag_right_margin', 'between 0 and 1'] }],
      },
      {
        prop: 'drag_bottom_margin',
        valid: [0, 0.2, 0.5, 0.8, 1],
        invalid: [{ value: -0.5, contains: ['drag_bottom_margin', 'between 0 and 1'] }],
      },
      {
        prop: 'editor_draw_screen',
        valid: [true],
        invalid: [{ value: 1, severity: 'warning', contains: ['editor_draw_screen', 'converts'] }],
      },
      {
        prop: 'editor_draw_limits',
        valid: [false],
        invalid: [{ value: 'yes', contains: ['editor_draw_limits', 'boolean'] }],
      },
      {
        prop: 'editor_draw_drag_margin',
        valid: [true],
        invalid: [{ value: 0, severity: 'warning', contains: ['editor_draw_drag_margin', 'converts'] }],
      },
    ]);

    describe('ADR-0032 tiering', () => {
      it('zoom near-zero is an enforced error (camera_2d.cpp:103-105)', () => {
        expectDiagnostic(scene(node('Camera2D', { zoom: 'Vector2(0, 1)' })), {
          prop: 'zoom',
          severity: 'error',
        });
      });

      it('anchor_mode out of range is a hinted warning (camera_2d.cpp:961)', () => {
        expectDiagnostic(scene(node('Camera2D', { anchor_mode: 5 })), {
          prop: 'anchor_mode',
          severity: 'warning',
        });
      });

      it('process_callback out of range is a hinted warning (camera_2d.cpp:966)', () => {
        expectDiagnostic(scene(node('Camera2D', { process_callback: 5 })), {
          prop: 'process_callback',
          severity: 'warning',
        });
      });

      it('drag_horizontal_offset out of range is a hinted warning (camera_2d.cpp:987)', () => {
        expectDiagnostic(scene(node('Camera2D', { drag_horizontal_offset: 1.5 })), {
          prop: 'drag_horizontal_offset',
          severity: 'warning',
        });
      });

      it('drag_left_margin out of range is a hinted warning (camera_2d.cpp:989)', () => {
        expectDiagnostic(scene(node('Camera2D', { drag_left_margin: 1.5 })), {
          prop: 'drag_left_margin',
          severity: 'warning',
        });
      });

      it('position_smoothing_speed negative is an enforced error (camera_2d.cpp:703)', () => {
        expectDiagnostic(scene(node('Camera2D', { position_smoothing_speed: -5 })), {
          prop: 'position_smoothing_speed',
          severity: 'error',
        });
      });
    });
  });

  describe('Semantic Validation', () => {
    describe('multiple enabled cameras', () => {
      // TSCN allows only one parentless root node; sibling cameras must hang
      // off the root via parent="." for buildSceneTree to keep them.

      it('reports when multiple Camera2D nodes are enabled', () => {
        expectDiagnostic(
          scene(
            node('Node2D', {}, { name: 'Root' }),
            node('Camera2D', { enabled: true }, { name: 'Camera1', parent: '.' }),
            node('Camera2D', { enabled: true }, { name: 'Camera2', parent: '.' })
          ),
          {
            ruleName: 'camera2d-multiple-enabled',
            severity: 'info',
            nodeType: 'Camera2D',
            contains: ['Multiple enabled Camera2D'],
          }
        );
      });

      // The current-camera slot belongs to the Viewport (viewport.h:764) and the
      // group name carries its id (camera_2d.cpp:349), so each of these becomes
      // current in its own sub-viewport and neither displaces the other.
      it('should not warn across a SubViewport boundary, which has its own camera slot', () => {
        expectNoDiagnostic(
          scene(
            node('Node2D', {}, { name: 'Root' }),
            node('Camera2D', { enabled: true }, { name: 'MainCamera', parent: '.' }),
            node('SubViewport', {}, { name: 'Inset', parent: '.' }),
            node('Camera2D', { enabled: true }, { name: 'InsetCamera', parent: 'Inset' })
          ),
          { ruleName: 'camera2d-multiple-enabled' }
        );
      });

      // A camera's scope is `get_viewport()`, the nearest Viewport ancestor
      // (camera_2d.cpp:342, node.cpp:345-347), and Window is a Viewport
      // (window.h:43), so a window's cameras have their own current-camera slot.
      it('should not warn across a Window boundary, a Viewport like any other', () => {
        expectNoDiagnostic(
          scene(
            node('Node2D', {}, { name: 'Root' }),
            node('Camera2D', { enabled: true }, { name: 'MainCamera', parent: '.' }),
            node('Window', {}, { name: 'Overlay', parent: '.' }),
            node('Camera2D', { enabled: true }, { name: 'OverlayCamera', parent: 'Overlay' })
          ),
          { ruleName: 'camera2d-multiple-enabled' }
        );
      });

      // ConfirmationDialog -> AcceptDialog -> Window -> Viewport: the scope comes
      // off the base chain, so a subclass three hops down scopes without being
      // named. Its own cameras still contend, which is what tells this apart from
      // a type the walk declined to classify.
      it('should not warn across a ConfirmationDialog, three hops below Viewport', () => {
        expectNoDiagnostic(
          scene(
            node('Node2D', {}, { name: 'Root' }),
            node('Camera2D', { enabled: true }, { name: 'MainCamera', parent: '.' }),
            node('ConfirmationDialog', {}, { name: 'Dialog', parent: '.' }),
            node('Camera2D', { enabled: true }, { name: 'DialogCamera', parent: 'Dialog' })
          ),
          { ruleName: 'camera2d-multiple-enabled' }
        );
      });

      it('reports for two cameras inside the SAME ConfirmationDialog', () => {
        expectDiagnostic(
          scene(
            node('Node2D', {}, { name: 'Root' }),
            node('ConfirmationDialog', {}, { name: 'Dialog', parent: '.' }),
            node('Camera2D', { enabled: true }, { name: 'CameraA', parent: 'Dialog' }),
            node('Camera2D', { enabled: true }, { name: 'CameraB', parent: 'Dialog' })
          ),
          { ruleName: 'camera2d-multiple-enabled', severity: 'info' }
        );
      });

      it('reports for two cameras inside the SAME SubViewport', () => {
        expectDiagnostic(
          scene(
            node('Node2D', {}, { name: 'Root' }),
            node('SubViewport', {}, { name: 'Inset', parent: '.' }),
            node('Camera2D', { enabled: true }, { name: 'CameraA', parent: 'Inset' }),
            node('Camera2D', { enabled: true }, { name: 'CameraB', parent: 'Inset' })
          ),
          { ruleName: 'camera2d-multiple-enabled', severity: 'info' }
        );
      });

      it('should not warn when only one camera is enabled', () => {
        expectNoDiagnostic(
          scene(
            node('Node2D', {}, { name: 'Root' }),
            node('Camera2D', { enabled: true }, { name: 'Camera1', parent: '.' }),
            node('Camera2D', { enabled: false }, { name: 'Camera2', parent: '.' })
          ),
          { ruleName: 'camera2d-multiple-enabled' }
        );
      });

      it('should treat cameras without enabled property as enabled by default', () => {
        expectDiagnostic(
          scene(
            node('Node2D', {}, { name: 'Root' }),
            node('Camera2D', {}, { name: 'Camera1', parent: '.' }),
            node('Camera2D', {}, { name: 'Camera2', parent: '.' })
          ),
          { ruleName: 'camera2d-multiple-enabled', severity: 'info', nodeType: 'Camera2D' }
        );
      });
    });

    describe('limit consistency', () => {
      it('reports when limit_right < limit_left', () => {
        expectDiagnostic(scene(node('Camera2D', { limit_left: 1000, limit_right: 500 })), {
          ruleName: 'camera2d-invalid-horizontal-limits',
          severity: 'info',
          nodeType: 'Camera2D',
          contains: ['limit_right', 'limit_left'],
        });
      });

      it('reports when limit_bottom < limit_top', () => {
        expectDiagnostic(scene(node('Camera2D', { limit_top: 500, limit_bottom: 200 })), {
          ruleName: 'camera2d-invalid-vertical-limits',
          severity: 'info',
          nodeType: 'Camera2D',
          contains: ['limit_bottom', 'limit_top'],
        });
      });

      it('should not warn when limits are consistent', () => {
        expectClean(
          scene(node('Camera2D', { limit_left: -1000, limit_right: 1000, limit_top: -500, limit_bottom: 500 }))
        );
      });
    });

    describe('position smoothing diagnostics', () => {
      it('reports when position_smoothing_speed is zero, the value Godot keeps', () => {
        // MAX(0, 0) is 0, so nothing is refused or altered; what the zero does
        // is make the interpolation factor zero (camera_2d.cpp:199-200).
        expectDiagnostic(scene(node('Camera2D', { position_smoothing_enabled: true, position_smoothing_speed: 0 })), {
          ruleName: 'camera2d-smoothing-speed-zero',
          severity: 'info',
          contains: ['position_smoothing_speed'],
        });
      });

      // A negative speed is the VALIDATOR's job, not this rule's: `MAX(0, p_speed)`
      // refuses it and `v.nonNegativeFloat(…, { enforced: 'camera_2d.cpp:703' })`
      // already reports that at the same tier from the same line. A rule beside it
      // reported the one value twice, and read it with `parseFloat`, which returns
      // NaN for the `-inf` Godot writes and reloads.
      it.each([-4, '-inf', 'inf_neg'])(
        'errors exactly once on position_smoothing_speed %s, from the validator',
        (speed) => {
          const diagnostics = lint(
            scene(node('Camera2D', { position_smoothing_enabled: true, position_smoothing_speed: speed }))
          );
          const errors = diagnostics.filter((d) => d.severity === 'error');
          expect(errors).toHaveLength(1);
          expect(errors[0]?.ruleName).toBe('strict-parser');
          expect(errors[0]?.message).toContain('position_smoothing_speed');
        }
      );

      it('should not warn when position_smoothing_enabled with valid speed', () => {
        expectClean(scene(node('Camera2D', { position_smoothing_enabled: true, position_smoothing_speed: 5.0 })));
      });
    });

    describe('rotation smoothing diagnostics', () => {
      it('reports when rotation_smoothing_speed is zero, the value Godot keeps', () => {
        // Mirror of the position case: MAX(0, 0) stores 0, and the zero step
        // pins lerp_angle where it started (camera_2d.cpp:216-217).
        expectDiagnostic(scene(node('Camera2D', { rotation_smoothing_enabled: true, rotation_smoothing_speed: 0 })), {
          ruleName: 'camera2d-rotation-smoothing-speed-zero',
          severity: 'info',
          contains: ['rotation_smoothing_speed'],
        });
      });

      it.each([-2.5, '-inf', 'inf_neg'])(
        'errors exactly once on rotation_smoothing_speed %s, from the validator',
        (speed) => {
          const diagnostics = lint(
            scene(node('Camera2D', { rotation_smoothing_enabled: true, rotation_smoothing_speed: speed }))
          );
          const errors = diagnostics.filter((d) => d.severity === 'error');
          expect(errors).toHaveLength(1);
          expect(errors[0]?.ruleName).toBe('strict-parser');
          expect(errors[0]?.message).toContain('rotation_smoothing_speed');
        }
      );

      it('should not warn when rotation_smoothing_enabled with valid speed', () => {
        expectClean(scene(node('Camera2D', { rotation_smoothing_enabled: true, rotation_smoothing_speed: 5.0 })));
      });
    });

  });

  describe('Edge Cases', () => {
    it('should handle Camera2D with no properties (defaults)', () => {
      // No required-property errors since defaults are assumed.
      expectNoErrors(scene(node('Camera2D')));
    });

    it('should handle all properties together', () => {
      expectClean(
        scene(
          node('Camera2D', {
            anchor_mode: 1,
            enabled: true,
            ignore_rotation: false,
            offset: 'Vector2(10, 20)',
            zoom: 'Vector2(2, 2)',
            process_callback: 1,
            limit_left: -1000,
            limit_top: -1000,
            limit_right: 1000,
            limit_bottom: 1000,
            limit_smoothed: true,
            position_smoothing_enabled: true,
            position_smoothing_speed: 5.0,
            rotation_smoothing_enabled: false,
            drag_horizontal_enabled: true,
            drag_vertical_enabled: true,
            drag_horizontal_offset: 0.5,
            drag_vertical_offset: -0.5,
            drag_left_margin: 0.2,
            drag_top_margin: 0.2,
            drag_right_margin: 0.2,
            drag_bottom_margin: 0.2,
            editor_draw_screen: true,
            editor_draw_limits: true,
            editor_draw_drag_margin: true,
          })
        )
      );
    });

    it('should handle multiple validation errors', () => {
      const diagnostics = lint(
        scene(
          node('Camera2D', {
            anchor_mode: 5,
            zoom: 'Vector2(0, -1)',
            process_callback: 10,
            drag_horizontal_offset: '2.0',
            drag_vertical_offset: '-2.0',
            position_smoothing_speed: '-5.0',
          })
        )
      );
      expect(diagnostics.length).toBeGreaterThan(4);
      // Errors for: anchor_mode, zoom, process_callback, both offsets, speed.
    });

    it('should handle scientific notation in numeric values', () => {
      expectClean(
        scene(
          node('Camera2D', {
            offset: 'Vector2(1e2, -5e1)',
            zoom: 'Vector2(2e0, 2e0)',
            position_smoothing_speed: '5e0',
            limit_left: '-1e3',
          })
        )
      );
    });

    it('should handle boundary values for drag properties', () => {
      expectNoErrors(
        scene(
          node('Camera2D', {
            drag_horizontal_enabled: true,
            drag_vertical_enabled: true,
            drag_horizontal_offset: -1,
            drag_vertical_offset: 1,
            drag_left_margin: 0,
            drag_top_margin: 1,
            drag_right_margin: 0.5,
            drag_bottom_margin: 0.5,
          })
        )
      );
    });

    it('should validate nested Camera2D nodes', () => {
      // Cameras two levels deep: Root -> Holder -> Camera1/Camera2.
      // Parent paths are root-relative ("." = root, "Holder" = root/Holder).
      const diagnostics = lint(
        scene(
          node('Node2D', {}, { name: 'Root' }),
          node('Node2D', {}, { name: 'Holder', parent: '.' }),
          node('Camera2D', { enabled: true }, { name: 'Camera1', parent: 'Holder' }),
          node('Camera2D', { enabled: true }, { name: 'Camera2', parent: 'Holder' })
        )
      );
      const reports = diagnostics.filter(d => d.severity === 'info' && d.message.includes('Multiple enabled'));
      expect(reports.length).toBeGreaterThan(0);
    });

    it('should not warn about multiple cameras when only one is enabled', () => {
      const diagnostics = lint(
        scene(
          node('Node2D', {}, { name: 'Root' }),
          node(
            'Camera2D',
            { enabled: true, position_smoothing_enabled: true, position_smoothing_speed: 5.0 },
            { name: 'ActiveCamera', parent: '.' }
          ),
          node('Camera2D', { enabled: false }, { name: 'DisabledCamera', parent: '.' })
        )
      );
      const cameraWarnings = diagnostics.filter(d => d.message.includes('Multiple enabled'));
      expect(cameraWarnings).toHaveLength(0);
    });
  });
});

describe('Camera2D Linter — the tokenizer float grammar', () => {
  it('accepts a trailing-dot zoom component', () => {
    expectClean(scene(node('Camera2D', { zoom: 'Vector2(0.5, 2.)' })));
  });

  // camera_2d.cpp:102-105 fails only on `is_zero_approx`, i.e. `abs(v) <
  // CMP_EPSILON`, which no non-finite component satisfies, so Godot assigns them.
  it('accepts a non-finite zoom component, which Godot stores as written', () => {
    expectClean(scene(node('Camera2D', { zoom: 'Vector2(inf, inf_neg)' })));
    expectClean(scene(node('Camera2D', { zoom: 'Vector2(nan, 1)' })));
  });

  it('names the non-finite component as a number when the OTHER one is zero', () => {
    const diagnostic = expectDiagnostic(scene(node('Camera2D', { zoom: 'Vector2(inf, 0)' })), {
      prop: 'zoom',
      contains: ['zoom', 'non-zero'],
    });
    expect(diagnostic.message).toContain('Vector2(Infinity, 0)');
  });
});

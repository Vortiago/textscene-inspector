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
        invalid: [{ value: 1, contains: ['ignore_rotation', 'boolean'] }],
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
        prop: 'zoom',
        valid: ['Vector2(2, 2)', 'Vector2(0.5, 0.5)'],
        invalid: [
          { value: 'Vector2(0, 1)', contains: ['zoom', 'greater than 0'] },
          { value: 'Vector2(1, -1)', contains: ['zoom', 'greater than 0'] },
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
        invalid: [{ value: 1, contains: ['limit_smoothed', 'boolean'] }],
      },
    ]);

    describe('limit properties validation', () => {
      it('should accept valid limit values', () => {
        expectClean(
          scene(node('Camera2D', { limit_left: -1000, limit_top: -500, limit_right: 1000, limit_bottom: 500 }))
        );
      });

      it('should reject invalid limit_left format', () => {
        expectDiagnostic(scene(node('Camera2D', { limit_left: 'invalid' })), {
          prop: 'limit_left',
          contains: ['limit_left', 'integer'],
        });
      });

      it('should reject invalid limit_top format', () => {
        // parseInt parses "10.5" as 10, so this passes format validation.
        expectClean(scene(node('Camera2D', { limit_top: 10.5 })));
      });

      it('should reject invalid limit_right format', () => {
        expectDiagnostic(scene(node('Camera2D', { limit_right: 'abc' })), {
          prop: 'limit_right',
          contains: ['limit_right', 'integer'],
        });
      });

      it('should reject invalid limit_bottom format', () => {
        expectDiagnostic(scene(node('Camera2D', { limit_bottom: 'xyz' })), {
          prop: 'limit_bottom',
          contains: ['limit_bottom', 'integer'],
        });
      });
    });

    describe('position_smoothing validation', () => {
      it('should accept valid position_smoothing_enabled', () => {
        expectClean(scene(node('Camera2D', { position_smoothing_enabled: true, position_smoothing_speed: 5.0 })));
      });

      it('should accept valid position_smoothing_speed', () => {
        expectClean(scene(node('Camera2D', { position_smoothing_speed: 10.5 })));
      });

      it('should reject zero position_smoothing_speed', () => {
        expectDiagnostic(scene(node('Camera2D', { position_smoothing_speed: 0 })), {
          prop: 'position_smoothing_speed',
          contains: ['position_smoothing_speed', 'greater than 0'],
        });
      });

      it('should reject negative position_smoothing_speed', () => {
        expectDiagnostic(scene(node('Camera2D', { position_smoothing_speed: '-5.0' })), {
          prop: 'position_smoothing_speed',
          contains: ['position_smoothing_speed', 'greater than 0'],
        });
      });

      it('should reject invalid position_smoothing_speed format', () => {
        expectDiagnostic(scene(node('Camera2D', { position_smoothing_speed: 'fast' })), {
          prop: 'position_smoothing_speed',
          contains: ['position_smoothing_speed', 'must be a number'],
        });
      });
    });

    describe('rotation_smoothing validation', () => {
      it('should accept valid rotation_smoothing_enabled', () => {
        expectClean(scene(node('Camera2D', { rotation_smoothing_enabled: true, rotation_smoothing_speed: 5.0 })));
      });

      it('should accept valid rotation_smoothing_speed', () => {
        expectClean(scene(node('Camera2D', { rotation_smoothing_speed: 10.5 })));
      });

      it('should reject zero rotation_smoothing_speed', () => {
        expectDiagnostic(scene(node('Camera2D', { rotation_smoothing_speed: 0 })), {
          prop: 'rotation_smoothing_speed',
          contains: ['rotation_smoothing_speed', 'greater than 0'],
        });
      });

      it('should reject negative rotation_smoothing_speed', () => {
        expectDiagnostic(scene(node('Camera2D', { rotation_smoothing_speed: '-5.0' })), {
          prop: 'rotation_smoothing_speed',
          contains: ['rotation_smoothing_speed', 'greater than 0'],
        });
      });
    });

    describe('drag properties validation', () => {
      it('should accept valid drag enabled values', () => {
        expectClean(scene(node('Camera2D', { drag_horizontal_enabled: true, drag_vertical_enabled: false })));
      });

      it('should accept valid drag offsets in range -1 to 1', () => {
        for (const offset of [-1, -0.5, 0, 0.5, 1]) {
          expectNoErrors(
            scene(node('Camera2D', { drag_horizontal_offset: offset, drag_vertical_offset: offset })),
            { prop: 'offset' }
          );
        }
      });

      it('should reject drag_horizontal_offset out of range', () => {
        expectDiagnostic(scene(node('Camera2D', { drag_horizontal_offset: 1.5 })), {
          prop: 'drag_horizontal_offset',
          contains: ['drag_horizontal_offset', 'between -1 and 1'],
        });
      });

      it('should reject drag_vertical_offset out of range', () => {
        expectDiagnostic(scene(node('Camera2D', { drag_vertical_offset: '-2.0' })), {
          prop: 'drag_vertical_offset',
          contains: ['drag_vertical_offset', 'between -1 and 1'],
        });
      });

      it('should accept valid drag margins in range 0 to 1', () => {
        for (const margin of [0, 0.2, 0.5, 0.8, 1]) {
          expectNoErrors(
            scene(
              node('Camera2D', {
                drag_left_margin: margin,
                drag_top_margin: margin,
                drag_right_margin: margin,
                drag_bottom_margin: margin,
              })
            ),
            { prop: 'margin' }
          );
        }
      });

      it('should reject drag_left_margin out of range', () => {
        expectDiagnostic(scene(node('Camera2D', { drag_left_margin: 1.5 })), {
          prop: 'drag_left_margin',
          contains: ['drag_left_margin', 'between 0 and 1'],
        });
      });

      it('should reject drag_top_margin out of range', () => {
        expectDiagnostic(scene(node('Camera2D', { drag_top_margin: -0.1 })), {
          prop: 'drag_top_margin',
          contains: ['drag_top_margin', 'between 0 and 1'],
        });
      });

      it('should reject drag_right_margin out of range', () => {
        expectDiagnostic(scene(node('Camera2D', { drag_right_margin: '2.0' })), {
          prop: 'drag_right_margin',
          contains: ['drag_right_margin', 'between 0 and 1'],
        });
      });

      it('should reject drag_bottom_margin out of range', () => {
        expectDiagnostic(scene(node('Camera2D', { drag_bottom_margin: -0.5 })), {
          prop: 'drag_bottom_margin',
          contains: ['drag_bottom_margin', 'between 0 and 1'],
        });
      });
    });

    describe('editor properties validation', () => {
      it('should accept valid editor_draw properties', () => {
        expectClean(
          scene(node('Camera2D', { editor_draw_screen: true, editor_draw_limits: false, editor_draw_drag_margin: true }))
        );
      });

      it('should reject invalid editor_draw_screen value', () => {
        expectDiagnostic(scene(node('Camera2D', { editor_draw_screen: 1 })), {
          prop: 'editor_draw_screen',
          contains: ['editor_draw_screen', 'boolean'],
        });
      });

      it('should reject invalid editor_draw_limits value', () => {
        expectDiagnostic(scene(node('Camera2D', { editor_draw_limits: 'yes' })), {
          prop: 'editor_draw_limits',
          contains: ['editor_draw_limits', 'boolean'],
        });
      });

      it('should reject invalid editor_draw_drag_margin value', () => {
        expectDiagnostic(scene(node('Camera2D', { editor_draw_drag_margin: 0 })), {
          prop: 'editor_draw_drag_margin',
          contains: ['editor_draw_drag_margin', 'boolean'],
        });
      });
    });
  });

  describe('Semantic Validation', () => {
    describe('multiple enabled cameras', () => {
      // TSCN allows only one parentless root node; sibling cameras must hang
      // off the root via parent="." for buildSceneTree to keep them.

      it('should warn when multiple Camera2D nodes are enabled', () => {
        expectDiagnostic(
          scene(
            node('Node2D', {}, { name: 'Root' }),
            node('Camera2D', { enabled: true }, { name: 'Camera1', parent: '.' }),
            node('Camera2D', { enabled: true }, { name: 'Camera2', parent: '.' })
          ),
          {
            ruleName: 'camera2d-multiple-enabled',
            severity: 'warning',
            nodeType: 'Camera2D',
            contains: ['Multiple enabled Camera2D'],
          }
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
          { ruleName: 'camera2d-multiple-enabled', severity: 'warning', nodeType: 'Camera2D' }
        );
      });
    });

    describe('limit consistency', () => {
      it('should warn when limit_right < limit_left', () => {
        expectDiagnostic(scene(node('Camera2D', { limit_left: 1000, limit_right: 500 })), {
          ruleName: 'camera2d-invalid-horizontal-limits',
          severity: 'warning',
          nodeType: 'Camera2D',
          contains: ['limit_right', 'limit_left'],
        });
      });

      it('should warn when limit_bottom < limit_top', () => {
        expectDiagnostic(scene(node('Camera2D', { limit_top: 500, limit_bottom: 200 })), {
          ruleName: 'camera2d-invalid-vertical-limits',
          severity: 'warning',
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

    describe('position smoothing warnings', () => {
      it('should warn when position_smoothing_enabled without speed', () => {
        expectDiagnostic(scene(node('Camera2D', { position_smoothing_enabled: true })), {
          ruleName: 'camera2d-smoothing-speed-missing',
          severity: 'warning',
          nodeType: 'Camera2D',
          contains: ['position_smoothing_speed', 'not set'],
        });
      });

      it('should error when position_smoothing_speed is zero (format error)', () => {
        // Caught by format validation (linterParser) as an error.
        expectDiagnostic(scene(node('Camera2D', { position_smoothing_enabled: true, position_smoothing_speed: 0 })), {
          prop: 'position_smoothing_speed',
          severity: 'error',
        });
      });

      it('should not warn when position_smoothing_enabled with valid speed', () => {
        expectClean(scene(node('Camera2D', { position_smoothing_enabled: true, position_smoothing_speed: 5.0 })));
      });
    });

    describe('rotation smoothing warnings', () => {
      it('should warn when rotation_smoothing_enabled without speed', () => {
        expectDiagnostic(scene(node('Camera2D', { rotation_smoothing_enabled: true })), {
          ruleName: 'camera2d-rotation-smoothing-speed-missing',
          severity: 'warning',
          nodeType: 'Camera2D',
          contains: ['rotation_smoothing_speed', 'not set'],
        });
      });

      it('should error when rotation_smoothing_speed is zero (format error)', () => {
        // Caught by format validation (linterParser) as an error.
        expectDiagnostic(scene(node('Camera2D', { rotation_smoothing_enabled: true, rotation_smoothing_speed: 0 })), {
          prop: 'rotation_smoothing_speed',
          severity: 'error',
        });
      });

      it('should not warn when rotation_smoothing_enabled with valid speed', () => {
        expectClean(scene(node('Camera2D', { rotation_smoothing_enabled: true, rotation_smoothing_speed: 5.0 })));
      });
    });

    describe('drag margin warnings', () => {
      it('should warn when horizontal margins set but drag not enabled', () => {
        expectDiagnostic(scene(node('Camera2D', { drag_left_margin: 0.2, drag_right_margin: 0.2 })), {
          ruleName: 'camera2d-horizontal-margins-without-drag',
          severity: 'warning',
          nodeType: 'Camera2D',
          contains: ['drag_horizontal_enabled'],
        });
      });

      it('should warn when vertical margins set but drag not enabled', () => {
        expectDiagnostic(scene(node('Camera2D', { drag_top_margin: 0.2, drag_bottom_margin: 0.2 })), {
          ruleName: 'camera2d-vertical-margins-without-drag',
          severity: 'warning',
          nodeType: 'Camera2D',
          contains: ['drag_vertical_enabled'],
        });
      });

      it('should not warn when margins set and drag enabled', () => {
        expectClean(
          scene(
            node('Camera2D', {
              drag_horizontal_enabled: true,
              drag_left_margin: 0.2,
              drag_right_margin: 0.2,
              drag_vertical_enabled: true,
              drag_top_margin: 0.2,
              drag_bottom_margin: 0.2,
            })
          )
        );
      });
    });

    describe('drag offset warnings', () => {
      it('should warn when horizontal offset set but drag not enabled', () => {
        expectDiagnostic(scene(node('Camera2D', { drag_horizontal_offset: 0.5 })), {
          ruleName: 'camera2d-horizontal-offset-without-drag',
          severity: 'warning',
          nodeType: 'Camera2D',
          contains: ['drag_horizontal_enabled'],
        });
      });

      it('should warn when vertical offset set but drag not enabled', () => {
        expectDiagnostic(scene(node('Camera2D', { drag_vertical_offset: -0.5 })), {
          ruleName: 'camera2d-vertical-offset-without-drag',
          severity: 'warning',
          nodeType: 'Camera2D',
          contains: ['drag_vertical_enabled'],
        });
      });

      it('should not warn when offsets set and drag enabled', () => {
        expectClean(
          scene(
            node('Camera2D', {
              drag_horizontal_enabled: true,
              drag_horizontal_offset: 0.5,
              drag_vertical_enabled: true,
              drag_vertical_offset: -0.5,
            })
          )
        );
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
      const warnings = diagnostics.filter(d => d.severity === 'warning' && d.message.includes('Multiple enabled'));
      expect(warnings.length).toBeGreaterThan(0);
    });

    it('should handle complex scene with smoothing warnings', () => {
      const diagnostics = lint(
        scene(
          node('Node2D', {}, { name: 'Root' }),
          node(
            'Camera2D',
            { enabled: true, position_smoothing_enabled: true, position_smoothing_speed: 5.0 },
            { name: 'ActiveCamera', parent: '.' }
          ),
          node(
            'Camera2D',
            { enabled: false, position_smoothing_enabled: true },
            { name: 'BrokenCamera', parent: '.' }
          )
        )
      );
      // Should warn about BrokenCamera's missing smoothing speed.
      const smoothingWarnings = diagnostics.filter(
        d => d.message.includes('smoothing_speed') && d.message.includes('not set')
      );
      expect(smoothingWarnings.length).toBeGreaterThan(0);
      // Only one camera is enabled, so no multiple-camera warning.
      const cameraWarnings = diagnostics.filter(d => d.message.includes('Multiple enabled'));
      expect(cameraWarnings).toHaveLength(0);
    });
  });
});

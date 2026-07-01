/**
 * Tests for AnimationPlayer linter (strict parser + semantic rules)
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
  expectSeverity,
  runPropertyValidation,
} from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('AnimationPlayer Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid AnimationPlayer properties', () => {
      expectClean(
        scene(
          node('AnimationPlayer', {
            speed_scale: 1.0,
            playback_default_blend_time: 0.0,
            playback_process_mode: 1,
            playback_active: true,
            method_call_mode: 0,
            root_node: 'NodePath("..")',
            'anims/test': 'SubResource("Animation_1")',
          })
        )
      );
    });

    it('should pass validation for AnimationPlayer with animations', () => {
      expectClean(
        scene(
          node('AnimationPlayer', {
            autoplay: '"idle"',
            speed_scale: 1.0,
            'anims/idle': 'SubResource("Animation_1")',
            'anims/walk': 'SubResource("Animation_2")',
          })
        )
      );
    });

    runPropertyValidation(
      { nodeType: 'AnimationPlayer', acceptMode: 'no-error' },
      [
        {
          prop: 'speed_scale',
          valid: [0.001, 0.5, 1.0, 2.0, 10.0, 100.0, -1.0],
          invalid: [
            { value: 0, contains: ['speed_scale', 'cannot be 0'] },
            { value: 0.00001, contains: ['speed_scale', 'too small'] },
            { value: 10000, contains: ['speed_scale', 'too large'] },
            { value: 'fast', contains: ['speed_scale', 'must be a number'] },
          ],
        },
        {
          prop: 'playback_default_blend_time',
          valid: [0, 0.1, 0.5, 1.0, 2.0],
          invalid: [
            { value: -0.5, contains: ['playback_default_blend_time', 'must be >= 0'] },
            { value: 'instant', contains: ['playback_default_blend_time', 'must be a number'] },
          ],
        },
        {
          prop: 'playback_process_mode',
          valid: [0, 1, 2],
          invalid: [
            { value: 5, contains: ['playback_process_mode', '0-2'] },
            { value: 'IDLE', contains: ['playback_process_mode', 'must be a number'] },
          ],
        },
        {
          prop: 'method_call_mode',
          valid: [0, 1],
          invalid: [
            { value: 2, contains: ['method_call_mode', '0-1'] },
            { value: 'DEFERRED', contains: ['method_call_mode', 'must be a number'] },
          ],
        },
        {
          prop: 'playback_active',
          valid: ['true', 'false'],
          with: { 'anims/test': 'SubResource("Animation_1")' },
          invalid: [{ value: 'yes', contains: ['playback_active', 'boolean'] }],
        },
        {
          prop: 'autoplay',
          acceptMode: 'clean',
          valid: ['"idle"'],
          with: { 'anims/idle': 'SubResource("Animation_1")' },
          invalid: [{ value: '""', contains: ['autoplay', 'cannot be empty'] }],
        },
        {
          prop: 'root_node',
          valid: ['NodePath("..")', 'NodePath(".")', 'NodePath("/root/Node")'],
          invalid: [{ value: '""', contains: ['root_node', 'cannot be empty'] }],
        },
        {
          prop: 'current_animation_length',
          acceptMode: 'clean',
          valid: [2.5],
          with: { 'anims/test': 'SubResource("Animation_1")' },
          invalid: [{ value: -1.0, contains: ['current_animation_length', 'must be >= 0'] }],
        },
        {
          prop: 'current_animation_position',
          acceptMode: 'clean',
          valid: [1.5],
          with: { 'anims/test': 'SubResource("Animation_1")' },
          invalid: [{ value: -0.5, contains: ['current_animation_position', 'must be >= 0'] }],
        },
      ]
    );
  });

  describe('Semantic Validation', () => {
    describe('speed_scale warnings', () => {
      it('should warn when speed_scale is very slow', () => {
        expectDiagnostic(scene(node('AnimationPlayer', { speed_scale: 0.05 })), {
          prop: 'speed_scale',
          severity: 'warning',
          contains: ['speed_scale', 'very slow', '0.05'],
        });
      });

      it('should warn when speed_scale is very fast', () => {
        expectDiagnostic(scene(node('AnimationPlayer', { speed_scale: 50 })), {
          prop: 'speed_scale',
          severity: 'warning',
          contains: ['speed_scale', 'very fast', '50'],
        });
      });

      it('should not warn for normal speed_scale values', () => {
        for (const speed of [0.5, 1.0, 2.0, 5.0]) {
          expectNoDiagnostic(scene(node('AnimationPlayer', { speed_scale: speed })), { prop: 'speed_scale' });
        }
      });

      it('should provide info about negative speed_scale', () => {
        expectDiagnostic(scene(node('AnimationPlayer', { speed_scale: -2.0 })), {
          prop: 'negative',
          severity: 'info',
          contains: ['negative', 'reverse'],
        });
      });
    });

    describe('missing animations warnings', () => {
      it('should warn when no animations are defined', () => {
        expectDiagnostic(scene(node('AnimationPlayer', { speed_scale: 1.0 })), {
          prop: 'no animations',
          severity: 'warning',
          contains: ['no animations', 'anims/'],
        });
      });

      it('should not warn when animations are defined', () => {
        expectNoDiagnostic(
          scene(
            node('AnimationPlayer', {
              speed_scale: 1.0,
              'anims/idle': 'SubResource("Animation_1")',
              'anims/walk': 'SubResource("Animation_2")',
            })
          ),
          { prop: 'no animations' }
        );
      });

      it('should not warn when libraries are defined', () => {
        expectNoDiagnostic(
          scene(
            node('AnimationPlayer', {
              speed_scale: 1.0,
              libraries: 'ExtResource("AnimationLibrary_1")',
            })
          ),
          { prop: 'no animations' }
        );
      });
    });

    describe('autoplay animation existence', () => {
      it('should warn when autoplay references missing animation', () => {
        expectDiagnostic(
          scene(
            node('AnimationPlayer', {
              autoplay: '"idle"',
              'anims/walk': 'SubResource("Animation_1")',
            })
          ),
          { prop: 'autoplay', severity: 'warning', contains: ['autoplay', 'may not exist', 'idle'] }
        );
      });

      it('should not warn when autoplay animation exists', () => {
        expectNoDiagnostic(
          scene(
            node('AnimationPlayer', {
              autoplay: '"idle"',
              'anims/idle': 'SubResource("Animation_1")',
            })
          ),
          { prop: 'autoplay' }
        );
      });
    });

    describe('current_animation existence', () => {
      it('should warn when current_animation references missing animation', () => {
        expectDiagnostic(
          scene(
            node('AnimationPlayer', {
              current_animation: '"walk"',
              'anims/idle': 'SubResource("Animation_1")',
            })
          ),
          { prop: 'current_animation', severity: 'warning', contains: ['current_animation', 'may not exist', 'walk'] }
        );
      });

      it('should not warn when current_animation exists', () => {
        expectNoDiagnostic(
          scene(
            node('AnimationPlayer', {
              current_animation: '"idle"',
              'anims/idle': 'SubResource("Animation_1")',
            })
          ),
          { prop: 'current_animation' }
        );
      });
    });

    describe('blend time warnings', () => {
      it('should warn when blend time is large', () => {
        expectDiagnostic(scene(node('AnimationPlayer', { playback_default_blend_time: 3.0 })), {
          prop: 'playback_default_blend_time',
          severity: 'warning',
          contains: ['playback_default_blend_time', 'large', '3'],
        });
      });

      it('should not warn for normal blend times', () => {
        for (const time of [0, 0.1, 0.5, 1.0]) {
          expectNoDiagnostic(scene(node('AnimationPlayer', { playback_default_blend_time: time })), {
            prop: 'playback_default_blend_time',
          });
        }
      });
    });

    describe('playback_active info', () => {
      it('should provide info when playback_active is false', () => {
        expectDiagnostic(scene(node('AnimationPlayer', { playback_active: false })), {
          prop: 'playback_active',
          severity: 'info',
          contains: ['playback_active', 'false', 'will not play'],
        });
      });

      it('should not provide info when playback_active is true', () => {
        expectNoDiagnostic(scene(node('AnimationPlayer', { playback_active: true })), {
          prop: 'playback_active',
        });
      });
    });

    describe('root_node path validation', () => {
      it('should warn for unusual root_node path format', () => {
        expectDiagnostic(scene(node('AnimationPlayer', { root_node: 'NodePath("@invalid@path")' })), {
          prop: 'root_node',
          contains: ['root_node', 'unusual'],
        });
      });

      it('should not warn for standard root_node paths', () => {
        for (const path of ['NodePath("..")', 'NodePath(".")', 'NodePath("/root")']) {
          expectNoDiagnostic(scene(node('AnimationPlayer', { root_node: path })), { prop: 'root_node' });
        }
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle AnimationPlayer with no properties', () => {
      // Should have warning about no animations
      expectDiagnostic(scene(node('AnimationPlayer')), { prop: 'no animations' });
    });

    it('should handle all properties together', () => {
      expectClean(
        scene(
          node('AnimationPlayer', {
            autoplay: '"idle"',
            speed_scale: 1.0,
            playback_default_blend_time: 0.2,
            playback_process_mode: 1,
            playback_active: true,
            method_call_mode: 0,
            root_node: 'NodePath("..")',
            current_animation: '"idle"',
            'anims/idle': 'SubResource("Animation_1")',
            'anims/walk': 'SubResource("Animation_2")',
            'anims/run': 'SubResource("Animation_3")',
          })
        )
      );
    });

    it('should handle multiple validation errors', () => {
      const diagnostics = lint(
        scene(
          node('AnimationPlayer', {
            speed_scale: 0,
            playback_default_blend_time: -1.0,
            playback_process_mode: 5,
            method_call_mode: 3,
            playback_active: 'maybe',
          })
        )
      );
      expect(diagnostics.length).toBeGreaterThan(4);
      // Should have errors for: speed_scale, blend_time, process_mode, method_call_mode, playback_active
      const hasSpeedError = diagnostics.some(d => d.message.includes('speed_scale'));
      const hasBlendError = diagnostics.some(d => d.message.includes('playback_default_blend_time'));
      const hasProcessError = diagnostics.some(d => d.message.includes('playback_process_mode'));
      const hasMethodError = diagnostics.some(d => d.message.includes('method_call_mode'));
      const hasActiveError = diagnostics.some(d => d.message.includes('playback_active'));
      expect(hasSpeedError && hasBlendError && hasProcessError && hasMethodError && hasActiveError).toBe(true);
    });

    it('should handle scientific notation in numeric values', () => {
      expectClean(
        scene(
          node('AnimationPlayer', {
            speed_scale: '1e0',
            playback_default_blend_time: '2e-1',
            'anims/test': 'SubResource("Animation_1")',
          })
        )
      );
    });

    it('should handle boundary values', () => {
      expectNoErrors(
        scene(
          node('AnimationPlayer', {
            speed_scale: 0.0001,
            playback_default_blend_time: 0,
            playback_process_mode: 0,
            method_call_mode: 0,
          })
        )
      );
    });

    it('should handle complex animation setup', () => {
      expectClean(
        scene(
          node('AnimationPlayer', {
            autoplay: '"idle"',
            speed_scale: 1.0,
            playback_default_blend_time: 0.15,
            playback_process_mode: 1,
            playback_active: true,
            method_call_mode: 0,
            root_node: 'NodePath("..")',
            current_animation: '"idle"',
            current_animation_length: 2.0,
            current_animation_position: 0.5,
            'anims/idle': 'SubResource("Animation_idle")',
            'anims/walk': 'SubResource("Animation_walk")',
            'anims/run': 'SubResource("Animation_run")',
            'anims/jump': 'SubResource("Animation_jump")',
            'anims/attack': 'SubResource("Animation_attack")',
          })
        )
      );
    });

    it('should handle mixed warnings and errors', () => {
      // Extreme speed (warning) + zero blend time (valid)
      expectSeverity(
        scene(
          node('AnimationPlayer', {
            speed_scale: 0.05,
            playback_default_blend_time: 0,
            'anims/idle': 'SubResource("Animation_1")',
          })
        ),
        'warning'
      );

      // Invalid process mode (error) + large blend time (warning)
      expectSeverity(
        scene(
          node('AnimationPlayer', {
            playback_process_mode: 5,
            playback_default_blend_time: 5.0,
          })
        ),
        'error'
      );
    });

    it('should handle AnimationPlayer with libraries instead of inline anims', () => {
      // Should not have "no animations" warning
      expectNoDiagnostic(
        scene(
          node('AnimationPlayer', {
            autoplay: '"idle"',
            speed_scale: 1.0,
            libraries: 'ExtResource("AnimationLibrary_main")',
          })
        ),
        { prop: 'no animations' }
      );
    });

    it('should handle quoted animation names in autoplay', () => {
      expectNoDiagnostic(
        scene(
          node('AnimationPlayer', {
            autoplay: '"idle_animation"',
            'anims/idle_animation': 'SubResource("Animation_1")',
          })
        ),
        { prop: 'autoplay' }
      );
    });

    it('should handle reverse playback with warning', () => {
      // Should have info about reverse playback
      expectDiagnostic(
        scene(
          node('AnimationPlayer', {
            speed_scale: -1.5,
            'anims/idle': 'SubResource("Animation_1")',
          })
        ),
        { prop: 'reverse', severity: 'info', contains: ['reverse'] }
      );
    });

    it('should handle empty current_animation', () => {
      // Empty current_animation is valid (means no animation playing)
      expectNoDiagnostic(
        scene(
          node('AnimationPlayer', {
            current_animation: '""',
            'anims/idle': 'SubResource("Animation_1")',
          })
        ),
        { prop: 'current_animation' }
      );
    });
  });
});

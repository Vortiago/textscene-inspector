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
  describe('the next/<name> property-list family', () => {
    // It reaches a `.tscn` only through `_set`/`_get` (animation_player.cpp:40,
    // :75), so no ADD_PROPERTY or XML sweep sees it — and it had no test at
    // all until a `quotedString` validator shipped and errored on Godot's own
    // output across the corpus.
    const withNext = (value: string) =>
      scene(node('AnimationPlayer', { 'next/walk': value }, { name: 'Anim' }));

    it("accepts the StringName form Godot writes, since animation_get_next returns StringName", () => {
      expectNoErrors(withNext('&"idle"'));
    });

    it('accepts the plain quoted form the variant parser also reads', () => {
      expectNoErrors(withNext('"idle"'));
    });

    it('still rejects an unquoted bare word', () => {
      expectSeverity(withNext('idle'), 'error');
    });
  });

  describe('the inactive-player advisory', () => {
    // `active` and `playback_active` are ONE field (animation_player.cpp:59,98
    // forward the deprecated alias into set_active), and only the deprecated
    // spelling was ever checked — so the key Godot actually writes went by
    // unreported.
    const withActive = (properties: Record<string, string>) =>
      scene(node('AnimationPlayer', { 'anims/idle': 'SubResource("Animation_1")', ...properties }, { name: 'Anim' }));

    const INACTIVE = { ruleName: 'animationplayer-inactive' };

    it('reports the modern key Godot writes', () => {
      expectDiagnostic(withActive({ active: 'false' }), {
        ...INACTIVE,
        severity: 'warning',
        contains: ['active', 'false', 'will not play'],
      });
    });

    it('reports the deprecated playback_active alias too', () => {
      expectDiagnostic(withActive({ playback_active: 'false' }), INACTIVE);
    });

    it('stays quiet when the key is absent, which is Godot\'s default-true form', () => {
      expectNoDiagnostic(withActive({}), INACTIVE);
    });

    it('stays quiet on an explicit true', () => {
      expectNoDiagnostic(withActive({ active: 'true' }), INACTIVE);
    });

    it('lets the modern key settle a scene carrying both', () => {
      expectNoDiagnostic(withActive({ active: 'true', playback_active: 'false' }), INACTIVE);
    });
  });

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
          // animation_player.cpp:1048 hints "-4,4,0.001,or_less,or_greater" — BOTH
          // ends open — and set_speed_scale (:648) is a bare assignment, so no
          // magnitude is out of band and 0 is legal (it pauses playback).
          prop: 'speed_scale',
          valid: [0.001, 0.5, 1.0, 2.0, 10.0, 100.0, -1.0, 0, 0.00001, 10000],
          invalid: [{ value: 'fast', contains: ['speed_scale', 'must be a number'] }],
        },
        {
          // animation_player.cpp:823 is a bare assignment, so the hint at :1046
          // ("0,4096,0.01,suffix:s") only warns at either end.
          prop: 'playback_default_blend_time',
          valid: [0, 0.1, 0.5, 1.0, 2.0, 3.0, 4096],
          invalid: [
            { value: 'instant', contains: ['playback_default_blend_time', 'must be a number'] },
            {
              value: -0.01,
              severity: 'warning',
              contains: ['playback_default_blend_time', 'between 0 and 4096'],
            },
            {
              value: 4096.01,
              severity: 'warning',
              contains: ['playback_default_blend_time', 'between 0 and 4096'],
            },
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
          // animation_player.cpp:775 (set_autoplay) is a bare assignment, and an
          // empty StringName is Godot's own "no autoplay" state (line 150 guards
          // on `animation_set.has(autoplay)`), so `""`/`&""` are valid, not errors.
          prop: 'autoplay',
          acceptMode: 'clean',
          valid: ['"idle"', '""'],
          with: { 'anims/idle': 'SubResource("Animation_1")' },
          invalid: [{ value: 'idle', contains: ['autoplay'] }],
        },
        {
          // animation_mixer.cpp:484 (set_root_node) is a bare assignment; an empty
          // NodePath is accepted like any other, so only the NodePath("...") shape
          // is checked.
          prop: 'root_node',
          valid: ['NodePath("..")', 'NodePath(".")', 'NodePath("/root/Node")', 'NodePath("")'],
          invalid: [{ value: '""', contains: ['root_node', 'NodePath'] }],
        },
      ]
    );

    // animation_player.cpp:1038-1039: current_animation_length/current_animation_position
    // are PROPERTY_HINT_NONE + PROPERTY_USAGE_NONE with an empty setter method name, so
    // Godot never serialises them into a .tscn. No validator is registered for either, so
    // a scene carrying one anyway (malformed or hand-edited) is passed through untouched.
    it('carries no validator for the getter-only current_animation_length/_position', () => {
      expectClean(
        scene(
          node('AnimationPlayer', {
            'anims/test': 'SubResource("Animation_1")',
            current_animation_length: -1.0,
            current_animation_position: -0.5,
          })
        )
      );
    });
  });

  describe('Semantic Validation', () => {
    // animation_player.cpp:1048 — speed_scale PROPERTY_HINT_RANGE
    // "-4,4,0.001,or_less,or_greater": both ends open, so no speed is out of band.
    describe('speed_scale carries no advisory', () => {
      it.each([0.05, 0.5, 1.0, 2.0, 5.0, 50, -2.0, 0])(
        'says nothing about speed_scale %s',
        (speed) => {
          expectNoDiagnostic(scene(node('AnimationPlayer', { speed_scale: speed })), {
            prop: 'speed_scale',
          });
        }
      );
    });

    it('says nothing about a player with no clip source at all', () => {
      expectClean(scene(node('AnimationPlayer', { speed_scale: 1.0 })));
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
      it('errors when current_animation names an animation no library holds', () => {
        // Unlike autoplay, which NOTIFICATION_READY simply skips, this one is
        // applied through play() and hits ERR_FAIL_COND_MSG at
        // animation_player.cpp:429, so the property loads empty.
        expectDiagnostic(
          scene(
            node('AnimationPlayer', {
              current_animation: '"walk"',
              'anims/idle': 'SubResource("Animation_1")',
            })
          ),
          {
            prop: 'current_animation',
            severity: 'error',
            contains: ['current_animation', 'refuses the assignment', 'walk'],
          }
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

    // animation_player.cpp:1046 — playback_default_blend_time PROPERTY_HINT_RANGE
    // "0,4096,0.01,suffix:s", closed at both ends and enforced at neither, so the
    // bound lives on the validator and no rule reports it.
    describe('blend time warnings', () => {
      it('should warn when blend time is above the hint', () => {
        expectDiagnostic(scene(node('AnimationPlayer', { playback_default_blend_time: 5000 })), {
          prop: 'playback_default_blend_time',
          severity: 'warning',
          contains: ['5000', '4096'],
        });
      });

      it('should warn, not error, on a negative blend time', () => {
        expectDiagnostic(scene(node('AnimationPlayer', { playback_default_blend_time: -0.5 })), {
          prop: 'playback_default_blend_time',
          severity: 'warning',
          contains: ['-0.5'],
        });
      });

      it.each([0, 0.1, 0.5, 1.0, 3.0, 4096])('says nothing about blend time %s', (time) => {
        expectNoDiagnostic(scene(node('AnimationPlayer', { playback_default_blend_time: time })), {
          prop: 'playback_default_blend_time',
        });
      });
    });

    it('says nothing about any root_node path shape', () => {
      for (const path of ['NodePath("..")', 'NodePath(".")', 'NodePath("/root")', 'NodePath("@odd@path")']) {
        expectNoDiagnostic(scene(node('AnimationPlayer', { root_node: path })), { prop: 'root_node' });
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle AnimationPlayer with no properties', () => {
      expectClean(scene(node('AnimationPlayer')));
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
      // Errors for the three enum/boolean properties. speed_scale = 0 and a
      // negative blend time are no longer errors: their setters (:648 / :822) are
      // bare assignments, so the blend time only warns and speed_scale is silent.
      expect(diagnostics.length).toBeGreaterThan(2);
      expect(diagnostics.some(d => d.message.includes('playback_process_mode'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('method_call_mode'))).toBe(true);
      expect(diagnostics.some(d => d.message.includes('playback_active'))).toBe(true);
      expect(
        diagnostics.some(d => d.severity === 'error' && d.message.includes('speed_scale'))
      ).toBe(false);
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
      // Out-of-hint blend time (warning) + a valid speed_scale
      expectSeverity(
        scene(
          node('AnimationPlayer', {
            speed_scale: 0.05,
            playback_default_blend_time: 5000,
            'anims/idle': 'SubResource("Animation_1")',
          })
        ),
        'warning'
      );

      // root_node: '""' is a bare quoted empty string, not NodePath("...") syntax,
      // so it fails the format check (error) + out-of-hint blend time (warning).
      // playback_process_mode/method_call_mode no longer produce an error out of
      // range: animation_mixer.cpp:501-525 is a bare assignment for both, so
      // out-of-range is a warning (ADR-0032), not an error.
      expectSeverity(
        scene(
          node('AnimationPlayer', {
            root_node: '""',
            playback_default_blend_time: 5000,
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

    it('should not flag reverse playback (negative speed_scale is valid)', () => {
      expectNoDiagnostic(
        scene(
          node('AnimationPlayer', {
            speed_scale: -1.5,
            'anims/idle': 'SubResource("Animation_1")',
          })
        ),
        { prop: 'reverse' }
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

/**
 * An ExtResource-backed clip is unenumerable here, so it SUPPRESSES the
 * missing-clip claim rather than feeding it. Godot's tokenizer discards every
 * character <= 32 before a token (variant_parser.cpp:415-417) and the
 * `ExtResource` branch then asks only for the next token to be `(`
 * (:1089-1093), so the padded spelling loads and must suppress too — the reader
 * that ENUMERATES the clips is already whitespace-tolerant, so a tighter
 * suppression check calls a live clip name dangling.
 */
describe('AnimationPlayer clip existence — the padding Godot discards', () => {
  const withLibrary = (entry: string, props: Record<string, string>) =>
    scene(
      `[ext_resource type="Animation" path="res://walk.tres" id="1_walk"]`,
      `[sub_resource type="AnimationLibrary" id="Lib"]\n_data = {\n"walk": ${entry}\n}`,
      node('AnimationPlayer', { libraries: '{\n"": SubResource("Lib")\n}', ...props }, { name: 'Anim' })
    );

  it('says nothing about current_animation behind a padded ExtResource clip', () => {
    expectNoDiagnostic(withLibrary('ExtResource ("1_walk")', { current_animation: '"walk"' }), {
      ruleName: 'animationplayer-current-animation-missing',
    });
  });

  it('says nothing about autoplay behind a padded ExtResource clip', () => {
    expectNoDiagnostic(withLibrary('ExtResource ("1_walk")', { autoplay: '"walk"' }), {
      ruleName: 'animationplayer-autoplay-missing',
    });
  });

  // The claim still stands where the clip set IS enumerable, so the fix widens
  // the suppression rather than retiring the rule.
  it('still reports a clip no SubResource entry defines', () => {
    expectDiagnostic(withLibrary('SubResource("Anim_idle")', { current_animation: '"walk"' }), {
      ruleName: 'animationplayer-current-animation-missing',
      severity: 'error',
    });
  });
});

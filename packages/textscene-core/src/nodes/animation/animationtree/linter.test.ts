/**
 * Tests for AnimationTree linter (strict parser + semantic rules)
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

const blendTree = '[sub_resource type="AnimationNodeBlendTree" id="BlendTree_1"]';

describe('AnimationTree Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid AnimationTree properties', () => {
      expectClean(
        scene(
          blendTree,
          node('AnimationTree', {
            tree_root: 'SubResource("BlendTree_1")',
            anim_player: 'NodePath("../AnimationPlayer")',
            active: true,
            process_callback: 1,
            audio_max_polyphony: 32,
          })
        )
      );
    });

    it('should pass validation for AnimationTree with AnimationMixer properties', () => {
      expectClean(
        scene(
          '[sub_resource type="AnimationNodeStateMachine" id="StateMachine_1"]',
          node('AnimationTree', {
            tree_root: 'SubResource("StateMachine_1")',
            anim_player: 'NodePath("../AnimationPlayer")',
            active: true,
            callback_mode_process: 1,
            callback_mode_method: 0,
            callback_mode_discrete: 1,
            root_node: 'NodePath("..")',
            root_motion_track: 'NodePath("")',
            root_motion_local: false,
            deterministic: false,
            reset_on_save: true,
            audio_max_polyphony: 32,
          })
        )
      );
    });

    describe('tree_root validation', () => {
      it('should accept valid SubResource references', () => {
        expectNoErrors(
          scene(
            blendTree,
            node('AnimationTree', {
              tree_root: 'SubResource("BlendTree_1")',
              anim_player: 'NodePath("../AnimationPlayer")',
            })
          ),
          { prop: 'tree_root' }
        );
      });

      it('should accept valid ExtResource references', () => {
        expectNoErrors(
          scene(
            '[ext_resource type="AnimationNodeBlendTree" path="res://animations/blend_tree.tres" id="BlendTree_ext"]',
            node('AnimationTree', {
              tree_root: 'ExtResource("BlendTree_ext")',
              anim_player: 'NodePath("../AnimationPlayer")',
            })
          ),
          { prop: 'tree_root' }
        );
      });

      it('should reject invalid tree_root format', () => {
        expectDiagnostic(scene(node('AnimationTree', { tree_root: '"BlendTree_1"' })), {
          prop: 'tree_root',
          contains: ['tree_root', 'SubResource("id") or ExtResource("id")'],
        });
      });

      it('should reject plain string tree_root', () => {
        expectDiagnostic(scene(node('AnimationTree', { tree_root: 'invalid' })), {
          prop: 'tree_root',
          contains: ['tree_root'],
        });
      });
    });

    // anim_player + active both need a valid tree_root (with its resource) to be
    // otherwise-valid, so the shared props are lifted to baseProps + acceptChild.
    // Valid values legitimately emit warnings/info (e.g. active=false), so accept
    // is asserted as "no error" rather than fully clean.
    runPropertyValidation(
      {
        nodeType: 'AnimationTree',
        acceptChild: blendTree,
        baseProps: {
          tree_root: 'SubResource("BlendTree_1")',
          anim_player: 'NodePath("../AnimationPlayer")',
        },
        acceptMode: 'no-error',
      },
      [
        {
          prop: 'anim_player',
          valid: [
            'NodePath("../AnimationPlayer")',
            'NodePath("..")',
            'NodePath(".")',
            'NodePath("/root/AnimPlayer")',
          ],
          invalid: [
            { value: '"../AnimationPlayer"', contains: ['anim_player', 'NodePath'] },
            { value: 'AnimationPlayer', contains: ['anim_player'] },
          ],
        },
        {
          prop: 'active',
          valid: [true, false],
          invalid: [
            { value: 'yes', contains: ['active', 'boolean'] },
            { value: 1, contains: ['active'] },
          ],
        },
      ]
    );

    // Standalone numeric/NodePath properties: a bare node is enough; valid values
    // may emit warnings/info (low polyphony, root_motion info), so accept is "no error".
    runPropertyValidation({ nodeType: 'AnimationTree', acceptMode: 'no-error' }, [
      {
        prop: 'process_callback',
        valid: [0, 1, 2],
        invalid: [
          { value: 5, contains: ['process_callback', '0-2'] },
          { value: 'IDLE', contains: ['process_callback', 'must be a number'] },
        ],
      },
      { prop: 'callback_mode_process', valid: [0, 1, 2] },
      {
        prop: 'callback_mode_method',
        valid: [0, 1],
        invalid: [{ value: 3, contains: ['callback_mode_method', '0-1'] }],
      },
      { prop: 'callback_mode_discrete', valid: [0, 1, 2] },
      {
        prop: 'root_motion_track',
        valid: ['NodePath("")', 'NodePath("Skeleton3D:Root")', 'NodePath("../Skeleton/Root")'],
        invalid: [{ value: '"Skeleton3D:Root"', contains: ['root_motion_track', 'NodePath'] }],
      },
      {
        prop: 'advance_expression_base_node',
        valid: ['NodePath("..")'],
        invalid: [{ value: '".."', contains: ['advance_expression_base_node', 'NodePath'] }],
      },
      {
        // animation_mixer.cpp:542, ERR_FAIL_COND(p_audio_max_polyphony < 0 || ... > 128).
        prop: 'audio_max_polyphony',
        valid: [0, 1, 8, 16, 32, 64, 128],
        invalid: [
          { value: -5, contains: ['audio_max_polyphony', 'between 0 and 128'] },
          { value: 1000, contains: ['audio_max_polyphony', 'between 0 and 128'] },
          { value: 'many', contains: ['audio_max_polyphony', 'must be a number'] },
        ],
      },
    ]);

    describe('AnimationMixer base properties validation', () => {
      it('should accept valid root_node', () => {
        expectNoErrors(scene(node('AnimationTree', { root_node: 'NodePath("..")' })), {
          prop: 'root_node',
        });
      });

      it('should accept valid boolean properties', () => {
        expectNoErrors(
          scene(
            node('AnimationTree', {
              deterministic: true,
              reset_on_save: false,
              root_motion_local: true,
            })
          )
        );
      });

      it('should reject invalid deterministic value', () => {
        expectDiagnostic(scene(node('AnimationTree', { deterministic: 1 })), {
          prop: 'deterministic',
          contains: ['deterministic', 'boolean'],
        });
      });
    });
  });

  describe('Semantic Validation', () => {
    describe('tree_root warnings', () => {
      it('should warn when tree_root is not set', () => {
        expectDiagnostic(
          scene(node('AnimationTree', { anim_player: 'NodePath("../AnimationPlayer")' })),
          { prop: 'tree_root', severity: 'warning', contains: ['not set', 'root animation node'] }
        );
      });

      it('should error when tree_root resource does not exist', () => {
        expectDiagnostic(
          scene(
            node('AnimationTree', {
              tree_root: 'SubResource("NonExistent_1")',
              anim_player: 'NodePath("../AnimationPlayer")',
            })
          ),
          { prop: 'tree_root', severity: 'error', contains: ['does not exist', 'NonExistent_1'] }
        );
      });

      it('should not error when tree_root resource exists', () => {
        expectNoErrors(
          scene(
            blendTree,
            node('AnimationTree', {
              tree_root: 'SubResource("BlendTree_1")',
              anim_player: 'NodePath("../AnimationPlayer")',
            })
          ),
          { prop: 'tree_root' }
        );
      });
    });

    describe('anim_player warnings', () => {
      it('should detect anim_player path issues', () => {
        expectDiagnostic(
          scene(
            blendTree,
            node('AnimationTree', {
              tree_root: 'SubResource("BlendTree_1")',
              anim_player: 'NodePath("NonExistentPlayer")',
            })
          ),
          { prop: 'anim_player', severity: 'warning', contains: ['may not exist'] }
        );
      });

      it('should not warn when anim_player references AnimationPlayer', () => {
        expectNoDiagnostic(
          scene(
            blendTree,
            node('AnimationPlayer', {}, { name: 'Player' }),
            node('AnimationTree', {
              tree_root: 'SubResource("BlendTree_1")',
              anim_player: 'NodePath("Player")',
            })
          ),
          { ruleName: 'animationtree-anim-player-wrong-type' }
        );
      });

      it('should warn when anim_player path may not exist', () => {
        expectDiagnostic(
          scene(
            blendTree,
            node('AnimationTree', {
              tree_root: 'SubResource("BlendTree_1")',
              anim_player: 'NodePath("NonExistentPlayer")',
            })
          ),
          { prop: 'anim_player', severity: 'warning', contains: ['may not exist'] }
        );
      });
    });

    // Regression: the anim_player validator matched `path.endsWith(node.name)`,
    // so `../Player/AnimationPlayer` grabbed the FIRST node named "Player"
    // (a sibling CharacterBody3D) and reported its type. The real AnimationPlayer
    // lives inside an instanced sub-scene the linter cannot see. A relative ("..")
    // segment or an instance ancestor means the target may resolve into sub-scene
    // internals, so wrong-type / not-found assertions must be suppressed.
    describe('anim_player instanced sub-scene resolution', () => {
      it('should not false-flag wrong-type when anim_player traverses ".." into an instanced sibling', () => {
        const content = scene(
          '[ext_resource type="PackedScene" path="res://character.tscn" id="1_char"]',
          '[sub_resource type="AnimationNodeStateMachine" id="StateMachine_root"]',
          node('CharacterBody3D', {}, { name: 'Player' }),
          '[node name="Player" parent="." instance=ExtResource("1_char")]',
          node(
            'AnimationTree',
            {
              tree_root: 'SubResource("StateMachine_root")',
              anim_player: 'NodePath("../Player/AnimationPlayer")',
              active: true,
            },
            { parent: '.' }
          )
        );
        expectNoDiagnostic(content, { ruleName: 'animationtree-anim-player-wrong-type' });
        expectNoDiagnostic(content, { ruleName: 'animationtree-anim-player-not-found' });
      });

      it('should suppress anim_player checks when the AnimationTree itself lives under an instanced subtree', () => {
        const content = scene(
          '[ext_resource type="PackedScene" path="res://rig.tscn" id="1_rig"]',
          '[sub_resource type="AnimationNodeStateMachine" id="StateMachine_root"]',
          node('Node3D', {}, { name: 'World' }),
          '[node name="Rig" parent="." instance=ExtResource("1_rig")]',
          node(
            'AnimationTree',
            {
              tree_root: 'SubResource("StateMachine_root")',
              anim_player: 'NodePath("AnimationPlayer")',
              active: true,
            },
            { parent: 'Rig' }
          )
        );
        expectNoDiagnostic(content, { ruleName: 'animationtree-anim-player-wrong-type' });
        expectNoDiagnostic(content, { ruleName: 'animationtree-anim-player-not-found' });
      });

      it('should still flag a purely-local anim_player path that resolves to a non-AnimationPlayer node', () => {
        const content = scene(
          '[sub_resource type="AnimationNodeStateMachine" id="StateMachine_root"]',
          node('Node3D', {}, { name: 'Root' }),
          node('Label3D', {}, { name: 'NotAPlayer', parent: '.' }),
          node(
            'AnimationTree',
            {
              tree_root: 'SubResource("StateMachine_root")',
              anim_player: 'NodePath("../NotAPlayer")',
            },
            { parent: '.' }
          )
        );
        expectDiagnostic(content, {
          ruleName: 'animationtree-anim-player-wrong-type',
          contains: ['Label3D'],
        });
      });

      // Duplicate names used to force a decline, because matching by name alone
      // could not tell two "Player" nodes apart. A real walk can: the path names
      // GroupB's child specifically (node.cpp:1941).
      it('picks the right node when a name repeats, rather than declining', () => {
        const content = scene(
          '[sub_resource type="AnimationNodeStateMachine" id="StateMachine_root"]',
          node('Node3D', {}, { name: 'Root' }),
          node('Node3D', {}, { name: 'GroupA', parent: '.' }),
          node('Label3D', {}, { name: 'Player', parent: 'GroupA' }),
          node('Node3D', {}, { name: 'GroupB', parent: '.' }),
          node('AnimationPlayer', {}, { name: 'Player', parent: 'GroupB' }),
          node(
            'AnimationTree',
            {
              tree_root: 'SubResource("StateMachine_root")',
              anim_player: 'NodePath("../GroupB/Player")',
            },
            { parent: '.' }
          )
        );
        expectNoDiagnostic(content, { ruleName: 'animationtree-anim-player-wrong-type' });
        expectNoDiagnostic(content, { ruleName: 'animationtree-anim-player-not-found' });
      });
    });

    describe('active property warnings', () => {
      it('should warn when active is false', () => {
        expectDiagnostic(
          scene(
            blendTree,
            node('AnimationTree', {
              tree_root: 'SubResource("BlendTree_1")',
              anim_player: 'NodePath("../AnimationPlayer")',
              active: false,
            })
          ),
          { prop: 'active', severity: 'warning', contains: ['false', 'will not process'] }
        );
      });

      it('should not warn when active is true and all required properties set', () => {
        expectNoDiagnostic(
          scene(
            blendTree,
            node('AnimationTree', {
              tree_root: 'SubResource("BlendTree_1")',
              anim_player: 'NodePath("../AnimationPlayer")',
              active: true,
            })
          ),
          { prop: 'active' }
        );
      });
    });

    describe('root_motion_track (no diagnostic)', () => {
      it('should not produce a diagnostic when root_motion_track is set', () => {
        expectNoDiagnostic(
          scene(
            blendTree,
            node('AnimationTree', {
              tree_root: 'SubResource("BlendTree_1")',
              anim_player: 'NodePath("../AnimationPlayer")',
              root_motion_track: 'NodePath("Skeleton3D:Root")',
            })
          ),
          { prop: 'root_motion_track' }
        );
      });

      it('should not produce a diagnostic when root_motion_track is empty', () => {
        expectNoDiagnostic(
          scene(
            blendTree,
            node('AnimationTree', {
              tree_root: 'SubResource("BlendTree_1")',
              anim_player: 'NodePath("../AnimationPlayer")',
              root_motion_track: 'NodePath("")',
            })
          ),
          { prop: 'root_motion_track' }
        );
      });
    });

    describe('audio_max_polyphony', () => {
      it('carries no advisory of its own, only the enforced bound', () => {
        // The old "very low" (< 8) and "very high" (> 128) arms were invented
        // thresholds. Godot states neither: animation_mixer.cpp:542 ERR_FAILs
        // outside 0-128 and says nothing about taste inside it, so the
        // validator is the whole story and 4 is a legal value.
        expectNoDiagnostic(scene(node('AnimationTree', { audio_max_polyphony: 4 })), {
          prop: 'audio_max_polyphony',
        });
        for (const value of [0, 8, 32, 128]) {
          expectNoDiagnostic(scene(node('AnimationTree', { audio_max_polyphony: value })), {
            prop: 'audio_max_polyphony',
          });
        }
      });

      it('errors past the ceiling the engine enforces', () => {
        expectDiagnostic(scene(node('AnimationTree', { audio_max_polyphony: 256 })), {
          prop: 'audio_max_polyphony',
          severity: 'error',
        });
      });
    });

    describe('advance_expression_base_node (no diagnostic)', () => {
      it('should not produce a diagnostic when advance_expression_base_node is set', () => {
        expectNoDiagnostic(
          scene(
            blendTree,
            node('AnimationTree', {
              tree_root: 'SubResource("BlendTree_1")',
              anim_player: 'NodePath("../AnimationPlayer")',
              advance_expression_base_node: 'NodePath("..")',
            })
          ),
          { prop: 'advance_expression_base_node' }
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle AnimationTree with no properties', () => {
      const diagnostics = lint(scene(node('AnimationTree')));
      const treeRootWarning = diagnostics.find(d => d.message.includes('tree_root') && d.message.includes('not set'));
      expect(treeRootWarning).toBeDefined();
    });

    it('should handle all properties together', () => {
      const diagnostics = lint(
        scene(
          blendTree,
          node('AnimationPlayer', {}, { name: 'Player' }),
          node('AnimationTree', {
            tree_root: 'SubResource("BlendTree_1")',
            anim_player: 'NodePath("Player")',
            active: true,
            process_callback: 1,
            callback_mode_process: 1,
            callback_mode_method: 0,
            callback_mode_discrete: 1,
            root_node: 'NodePath("..")',
            root_motion_track: 'NodePath("")',
            root_motion_local: false,
            deterministic: false,
            reset_on_save: true,
            audio_max_polyphony: 32,
          })
        )
      );
      const errors = diagnostics.filter(d => d.severity === 'error');
      const warnings = diagnostics.filter(d => d.severity === 'warning');
      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });

    it('should handle multiple validation errors', () => {
      const diagnostics = lint(
        scene(
          node('AnimationTree', {
            tree_root: '"invalid"',
            anim_player: 'invalid',
            active: 'maybe',
            process_callback: 10,
            // -1, not 0: animation_mixer.cpp:542 permits 0, so the old value
            // stopped contributing a diagnostic once the bound was corrected.
            audio_max_polyphony: -1,
          })
        )
      );
      expect(diagnostics.length).toBeGreaterThan(4);
      const hasTreeRootError = diagnostics.some(d => d.message.includes('tree_root'));
      const hasAnimPlayerError = diagnostics.some(d => d.message.includes('anim_player'));
      const hasActiveError = diagnostics.some(d => d.message.includes('active'));
      const hasProcessError = diagnostics.some(d => d.message.includes('process_callback'));
      const hasPolyphonyError = diagnostics.some(d => d.message.includes('audio_max_polyphony'));
      expect(hasTreeRootError && hasAnimPlayerError && hasActiveError && hasProcessError && hasPolyphonyError).toBe(true);
    });

    it('should handle ExtResource for tree_root', () => {
      expectNoErrors(
        scene(
          '[ext_resource type="AnimationNodeBlendTree" path="res://animations/blend_tree.tres" id="BlendTree_ext"]',
          node('AnimationTree', {
            tree_root: 'ExtResource("BlendTree_ext")',
            anim_player: 'NodePath("../AnimationPlayer")',
            active: true,
          })
        ),
        { prop: 'tree_root' }
      );
    });

    it('should handle complex AnimationTree setup', () => {
      const diagnostics = lint(
        scene(
          '[sub_resource type="AnimationNodeStateMachine" id="StateMachine_1"]',
          node('AnimationPlayer', {}, { name: 'CharacterPlayer' }),
          node(
            'AnimationTree',
            {
              tree_root: 'SubResource("StateMachine_1")',
              anim_player: 'NodePath("CharacterPlayer")',
              active: true,
              process_callback: 1,
              callback_mode_process: 1,
              callback_mode_method: 0,
              callback_mode_discrete: 1,
              root_node: 'NodePath("..")',
              root_motion_track: 'NodePath("Skeleton3D:Root")',
              root_motion_local: false,
              deterministic: false,
              reset_on_save: true,
              audio_max_polyphony: 32,
              advance_expression_base_node: 'NodePath("..")',
            },
            { name: 'CharacterTree' }
          )
        )
      );
      const errors = diagnostics.filter(d => d.severity === 'error');
      const warnings = diagnostics.filter(d => d.severity === 'warning');
      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });

    it('should handle boundary values', () => {
      expectNoErrors(
        scene(
          node('AnimationTree', {
            process_callback: 0,
            callback_mode_process: 2,
            callback_mode_method: 1,
            callback_mode_discrete: 0,
            audio_max_polyphony: 1,
          })
        )
      );
    });

    it('should handle empty NodePaths', () => {
      expectNoErrors(
        scene(
          blendTree,
          node('AnimationTree', {
            tree_root: 'SubResource("BlendTree_1")',
            anim_player: 'NodePath("../AnimationPlayer")',
            root_motion_track: 'NodePath("")',
            advance_expression_base_node: 'NodePath("")',
          })
        )
      );
    });

    it('should validate AnimationTree with only required properties', () => {
      const diagnostics = lint(
        scene(
          blendTree,
          node('AnimationPlayer', {}, { name: 'Player' }),
          node('AnimationTree', {
            tree_root: 'SubResource("BlendTree_1")',
            anim_player: 'NodePath("Player")',
          })
        )
      );
      const errors = diagnostics.filter(d => d.severity === 'error');
      const warnings = diagnostics.filter(d => d.severity === 'warning');
      expect(errors).toHaveLength(0);
      expect(warnings).toHaveLength(0);
    });
  });
});

/**
 * Tests for AnimatedSprite2D linter (strict parser + semantic rules)
 */

import { describe, it, expect } from 'vitest';
import {
  node,
  scene,
  lint,
  expectClean,
  expectNoErrors,
  expectDiagnostic,
  runPropertyValidation,
} from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

/** A SpriteFrames sub-resource so AnimatedSprite2D nodes can reference an existing resource. */
const spriteFrames = '[sub_resource type="SpriteFrames" id="frames_1"]';
/** An external SpriteFrames resource. */
const extFrames = '[ext_resource type="SpriteFrames" path="res://animations.tres" id="frames_1"]';
/** Reference to the sub-resource above; added to accept-case nodes so they are otherwise valid. */
const withFrames = { sprite_frames: 'SubResource("frames_1")' };

describe('AnimatedSprite2D Linter', () => {
  describe('Strict Parser Validation (Format)', () => {
    it('should pass validation for valid AnimatedSprite2D properties', () => {
      expectClean(
        scene(
          spriteFrames,
          node('AnimatedSprite2D', {
            ...withFrames,
            animation: '"default"',
            frame: 0,
            speed_scale: 1.0,
            centered: true,
            offset: 'Vector2(0, 0)',
          })
        )
      );
    });

    describe('sprite_frames validation', () => {
      it('should accept valid sprite_frames reference format (SubResource)', () => {
        expectClean(scene(spriteFrames, node('AnimatedSprite2D', { ...withFrames })));
      });

      it('should accept valid sprite_frames reference format (ExtResource)', () => {
        expectClean(
          scene(extFrames, node('AnimatedSprite2D', { sprite_frames: 'ExtResource("frames_1")' }))
        );
      });

      it('should reject invalid sprite_frames format', () => {
        expectDiagnostic(scene(node('AnimatedSprite2D', { sprite_frames: '"invalid_format"' })), {
          prop: 'sprite_frames',
          contains: ['sprite_frames', 'resource reference'],
        });
      });

      it('should reject plain string as sprite_frames', () => {
        expectDiagnostic(scene(node('AnimatedSprite2D', { sprite_frames: 'res://animations.tres' })), {
          prop: 'sprite_frames',
          contains: ['sprite_frames'],
        });
      });
    });

    runPropertyValidation(
      { nodeType: 'AnimatedSprite2D', acceptChild: spriteFrames, baseProps: withFrames },
      [
        { prop: 'animation', valid: ['"walk"', '""', '"default"'] },
        {
          prop: 'frame',
          valid: [5, 0],
          invalid: [
            { value: -1, contains: ['frame', 'non-negative'] },
            { value: 1.5, contains: ['frame', 'integer'] },
          ],
        },
        {
          prop: 'centered',
          valid: [true, false],
          invalid: [{ value: 1, contains: ['centered', 'boolean'] }],
        },
        {
          prop: 'offset',
          valid: ['Vector2(10, 20)', 'Vector2(-10, -20)', 'Vector2(10.5, 20.75)'],
          invalid: [{ value: '"10, 20"', contains: ['offset', 'Vector2'] }],
        },
        {
          prop: 'flip_h',
          valid: [true],
          invalid: [{ value: 1, contains: ['flip_h', 'boolean'] }],
        },
        {
          prop: 'flip_v',
          valid: [false],
          invalid: [{ value: 'yes', contains: ['flip_v', 'boolean'] }],
        },
        { prop: 'autoplay', valid: ['"idle"', '""'] },
        {
          prop: 'playing',
          valid: [true, false],
          invalid: [{ value: 1, contains: ['playing', 'boolean'] }],
          acceptMode: 'no-error',
        },
      ]
    );

    describe('speed_scale validation', () => {
      it('should accept positive speed_scale', () => {
        expectClean(scene(spriteFrames, node('AnimatedSprite2D', { ...withFrames, speed_scale: 2.0 })));
      });

      it('should accept zero speed_scale (format check)', () => {
        expectNoErrors(scene(spriteFrames, node('AnimatedSprite2D', { ...withFrames, speed_scale: 0.0 })));
      });

      it('should accept negative speed_scale (format check)', () => {
        expectNoErrors(scene(spriteFrames, node('AnimatedSprite2D', { ...withFrames, speed_scale: -1.0 })));
      });

      it('should reject non-numeric speed_scale', () => {
        expectDiagnostic(scene(node('AnimatedSprite2D', { speed_scale: 'fast' })), {
          prop: 'speed_scale',
          contains: ['speed_scale', 'number'],
        });
      });
    });

    describe('frame_progress validation', () => {
      it('should accept valid frame_progress in range', () => {
        expectClean(scene(spriteFrames, node('AnimatedSprite2D', { ...withFrames, frame_progress: 0.5 })));
      });

      it('should accept frame_progress = 0', () => {
        expectClean(scene(spriteFrames, node('AnimatedSprite2D', { ...withFrames, frame_progress: 0.0 })));
      });

      it('should accept frame_progress = 1', () => {
        expectClean(scene(spriteFrames, node('AnimatedSprite2D', { ...withFrames, frame_progress: 1.0 })));
      });

      it('should accept frame_progress out of range (format check)', () => {
        expectNoErrors(scene(spriteFrames, node('AnimatedSprite2D', { ...withFrames, frame_progress: 1.5 })));
      });

      it('should reject non-numeric frame_progress', () => {
        expectDiagnostic(scene(node('AnimatedSprite2D', { frame_progress: 'half' })), {
          prop: 'frame_progress',
          contains: ['frame_progress', 'number'],
        });
      });
    });

  });

  describe('Semantic Validation (Resource References)', () => {
    it('should detect missing sprite_frames (REQUIRED)', () => {
      expectDiagnostic(scene(node('AnimatedSprite2D', { animation: '"default"' })), {
        ruleName: 'animatedsprite2d-requires-spriteframes',
        severity: 'warning',
        contains: ["requires a 'sprite_frames' property"],
      });
    });

    it('should detect missing sprite_frames resource', () => {
      const diagnostics = lint(
        scene(
          node(
            'AnimatedSprite2D',
            { sprite_frames: 'SubResource("nonexistent")' },
            { name: 'MissingSpriteFrames' }
          )
        )
      );
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toMatchObject({
        severity: 'error',
        nodeName: 'MissingSpriteFrames',
        nodeType: 'AnimatedSprite2D',
        ruleName: 'valid-animatedsprite2d-resources',
      });
      expect(diagnostics[0]!.message).toContain('SpriteFrames resource not found');
    });

    it('should pass when sprite_frames resource exists (SubResource)', () => {
      expectClean(scene(spriteFrames, node('AnimatedSprite2D', { ...withFrames })));
    });

    it('should pass when sprite_frames is external resource', () => {
      expectClean(
        scene(extFrames, node('AnimatedSprite2D', { sprite_frames: 'ExtResource("frames_1")' }))
      );
    });
  });

  describe('Semantic Validation (Animation Properties)', () => {
    it('errors when animation is set but sprite_frames is not, since Godot clears it', () => {
      expectDiagnostic(scene(node('AnimatedSprite2D', { animation: '"walk"' })), {
        ruleName: 'animatedsprite2d-animation-no-spriteframes',
        severity: 'error',
        contains: ['animation', "sprite_frames' is not set"],
      });
    });

    // `set_animation` returns at animated_sprite_2d.cpp:554-556 when the name equals the
    // one already held, and animated_sprite_2d.h:43 seeds it with SceneStringName(default_)
    // — so this scene never reaches the clearing branch the rule reports.
    it('stays silent on animation "default" without sprite_frames, which Godot accepts', () => {
      const diagnostics = lint(scene(node('AnimatedSprite2D', { animation: '"default"' })));
      expect(
        diagnostics.filter((d) => d.ruleName === 'animatedsprite2d-animation-no-spriteframes')
      ).toHaveLength(0);
      expect(diagnostics.filter((d) => d.severity === 'error')).toHaveLength(0);
    });

    it('should pass when both animation and sprite_frames are set', () => {
      expectClean(scene(spriteFrames, node('AnimatedSprite2D', { ...withFrames, animation: '"walk"' })));
    });

    it('should pass when both autoplay and sprite_frames are set', () => {
      expectClean(scene(spriteFrames, node('AnimatedSprite2D', { ...withFrames, autoplay: '"idle"' })));
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple validation errors', () => {
      const diagnostics = lint(
        scene(
          node('AnimatedSprite2D', { centered: 1, speed_scale: 'fast', frame: -5, flip_h: 'yes' })
        )
      );
      expect(diagnostics.length).toBeGreaterThan(3);
    });

    it('should handle all properties together', () => {
      expectClean(
        scene(
          spriteFrames,
          node('AnimatedSprite2D', {
            ...withFrames,
            animation: '"walk"',
            autoplay: '"idle"',
            frame: 2,
            frame_progress: 0.75,
            speed_scale: 1.5,
            centered: true,
            offset: 'Vector2(10, 20)',
            flip_h: false,
            flip_v: true,
          })
        )
      );
    });

    it('should handle node with no properties', () => {
      expectDiagnostic(scene(node('AnimatedSprite2D')), {
        ruleName: 'animatedsprite2d-requires-spriteframes',
        contains: ["requires a 'sprite_frames' property"],
      });
    });

    it('should handle scientific notation in numeric values', () => {
      expectClean(
        scene(
          spriteFrames,
          node('AnimatedSprite2D', {
            ...withFrames,
            speed_scale: '1.5e0',
            frame_progress: '5e-1',
            offset: 'Vector2(1.5e2, 2.0e1)',
          })
        )
      );
    });

    it('should handle boolean properties with proper values', () => {
      expectClean(
        scene(
          spriteFrames,
          node('AnimatedSprite2D', { ...withFrames, centered: true, flip_h: false, flip_v: true })
        )
      );
    });

    it('should handle whitespace in Vector2', () => {
      expectClean(
        scene(
          spriteFrames,
          node('AnimatedSprite2D', { ...withFrames, offset: 'Vector2(  10  ,  20  )' })
        )
      );
    });
  });

  describe('Integration Tests', () => {
    it('should validate complete character animation configuration', () => {
      expectClean(
        scene(
          '[ext_resource type="SpriteFrames" path="res://character_animations.tres" id="char_frames"]',
          node('AnimatedSprite2D', {
            sprite_frames: 'ExtResource("char_frames")',
            animation: '"idle"',
            autoplay: '"idle"',
            frame: 0,
            frame_progress: 0.0,
            speed_scale: 1.0,
            centered: true,
            offset: 'Vector2(0, -8)',
          })
        )
      );
    });

    it('should not flag reverse playback configuration (negative speed_scale is valid)', () => {
      expectClean(scene(spriteFrames, node('AnimatedSprite2D', { ...withFrames, animation: '"rewind"', speed_scale: -2.0 })));
    });

    it('should validate minimal valid configuration', () => {
      expectClean(scene(spriteFrames, node('AnimatedSprite2D', { ...withFrames })));
    });
  });
});

describe('the pre-4.0 `frames` spelling', () => {
  // `AnimatedSprite2D::_set` forwards `frames` to `set_sprite_frames`
  // (animated_sprite_2d.cpp:616-618), so the resource IS set and the animation
  // name survives. Reading only the canonical key reported "Godot clears
  // 'animation'" on 25 scenes across two shipped projects.
  const scene = `[gd_scene load_steps=2 format=3]

[sub_resource type="SpriteFrames" id="SpriteFrames_1"]

[node name="Sprite" type="AnimatedSprite2D"]
frames = SubResource("SpriteFrames_1")
animation = &"idle"
`;

  it('resolves to sprite_frames, so no rule fires', () => {
    expect(lint(scene).filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('does not ask for a sprite_frames that is already set', () => {
    expect(lint(scene).map((d) => d.ruleName)).not.toContain(
      'animatedsprite2d-requires-spriteframes'
    );
  });
});

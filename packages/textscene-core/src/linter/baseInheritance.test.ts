/**
 * End-to-end validator inheritance (#143): the base transform/visible/layout
 * validators must reach subclasses through the full Linter, so the render and
 * linter pipelines agree on which nodes get checked. Each case is a real-Godot
 * witness from the parser/linter divergence audit (demo-corpus line refs in the
 * issue): a malformed value on a subclass now errors, and the valid form the
 * corpus actually uses stays clean.
 */

import { describe, it } from 'vitest';
import { node, scene, expectClean, expectDiagnostic, expectNoDiagnostic } from './testing/testkit';
import './index.js'; // trigger all validator + rule registrations

describe('validator base-class inheritance (end-to-end)', () => {
  describe('MeshInstance3D inherits Node3D.visible (witness: player.tscn:72)', () => {
    it('rejects a malformed visible on the subclass', () => {
      expectDiagnostic(scene(node('MeshInstance3D', { visible: 'maybe' })), {
        prop: 'visible',
        contains: ['boolean'],
      });
    });

    it('accepts the witnessed visible = false', () => {
      expectNoDiagnostic(scene(node('MeshInstance3D', { visible: 'false' })), { prop: 'visible' });
    });
  });

  describe('Sprite2D inherits Node2D.scale (witness: beach_cave.tscn:31)', () => {
    it('rejects a degenerate zero scale on the subclass', () => {
      expectDiagnostic(scene(node('Sprite2D', { scale: 'Vector2(0, 0)' })), {
        prop: 'scale',
        contains: ['non-zero'],
      });
    });

    it('accepts the witnessed scale = Vector2(1.2, 1)', () => {
      expectNoDiagnostic(scene(node('Sprite2D', { scale: 'Vector2(1.2, 1)' })), { prop: 'scale' });
    });
  });

  describe('Control gains layout/theme validation (witness: custom_drawing.tscn:15/41/43)', () => {
    it('accepts the witnessed anchors_preset + offset + theme override', () => {
      expectClean(
        scene(
          node('Control', {
            anchors_preset: 15,
            offset_right: 172.0,
            'theme_override_colors/font_color': 'Color(1, 1, 1, 1)',
          })
        )
      );
    });

    it('rejects a malformed offset', () => {
      expectDiagnostic(scene(node('Control', { offset_right: 'abc' })), {
        prop: 'offset_right',
        contains: ['must be a number'],
      });
    });

    it('rejects a malformed theme-override Color', () => {
      expectDiagnostic(scene(node('Control', { 'theme_override_colors/font_color': 'Color(1, 1, 1)' })), {
        prop: 'theme_override_colors',
        contains: ['Color'],
      });
    });
  });

  describe('the valid-node3d-visibility rule reaches subclasses', () => {
    it('flags a dangling visibility_parent on a MeshInstance3D', () => {
      expectDiagnostic(scene(node('MeshInstance3D', { visibility_parent: 'NodePath("DoesNotExist")' })), {
        ruleName: 'valid-node3d-visibility',
        contains: ['not found'],
      });
    });
  });
});

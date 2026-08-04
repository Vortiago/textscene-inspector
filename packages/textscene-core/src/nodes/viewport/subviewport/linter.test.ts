/**
 * SubViewport linting — format validators (errors) + semantic rules (warnings).
 *
 * The sorting principle (CONTEXT.md): a validator failure is an error when
 * Godot's own setter refuses or alters the value, and a warning when only a
 * `PROPERTY_HINT_RANGE`/`PROPERTY_HINT_ENUM` states the bound while the setter
 * assigns straight through (ADR-0032). An advisory condition is ALWAYS a
 * warning, because committed positive fixtures may legally carry it.
 */

import { describe, it } from 'vitest';
import {
  node,
  scene,
  expectClean,
  expectDiagnostic,
  expectNoDiagnostic,
  expectNoErrors,
} from '../../../linter/testing/testkit';
import './linterParser';
import './linter';

describe('SubViewport linter', () => {
  describe('format validators (errors)', () => {
    it('accepts a fully-specified, valid SubViewport', () => {
      expectClean(
        scene(
          node('SubViewport', {
            size: 'Vector2i(600, 400)',
            size_2d_override: 'Vector2i(0, 0)',
            size_2d_override_stretch: false,
            own_world_3d: true,
            disable_3d: false,
            transparent_bg: true,
            handle_input_locally: false,
            render_target_update_mode: 4,
            render_target_clear_mode: 2,
            msaa_3d: 2,
            use_debanding: true,
            audio_listener_enable_2d: true,
            canvas_item_default_texture_filter: 0,
            gui_embed_subwindows: true,
          })
        )
      );
    });

    it('rejects a float-valued size — Vector2i is integer-only (error path)', () => {
      expectDiagnostic(scene(node('SubViewport', { size: 'Vector2i(600.5, 400)' })), {
        prop: 'size',
        severity: 'error',
      });
    });

    it('rejects a non-boolean own_world_3d', () => {
      expectDiagnostic(scene(node('SubViewport', { own_world_3d: 'yes' })), {
        prop: 'own_world_3d',
        severity: 'error',
      });
    });
  });

  describe('hinted enums (warnings)', () => {
    it('warns on an out-of-range render_target_update_mode — set_update_mode (viewport.cpp:5475-5479) bare-assigns, so the bound is only hinted (viewport.cpp:5584)', () => {
      expectDiagnostic(scene(node('SubViewport', { render_target_update_mode: 5 })), {
        prop: 'render_target_update_mode',
        severity: 'warning',
      });
    });

    it('warns on an out-of-range render_target_clear_mode — set_clear_mode (viewport.cpp:5486-5490) bare-assigns, so the bound is only hinted (viewport.cpp:5583)', () => {
      expectDiagnostic(scene(node('SubViewport', { render_target_clear_mode: 3 })), {
        prop: 'render_target_clear_mode',
        severity: 'warning',
      });
    });
  });

  describe('semantic rules (warnings)', () => {
    it('warns that a non-positive size renders nothing', () => {
      const content = scene(node('SubViewport', { size: 'Vector2i(0, 400)' }));
      expectDiagnostic(content, { ruleName: 'subviewport-empty-size', severity: 'warning' });
      // Advisory only — a zero size is legal TSCN, so it must not fail the CLI.
      expectNoErrors(content);
    });

    it('does not warn about a normal size', () => {
      expectNoDiagnostic(scene(node('SubViewport', { size: 'Vector2i(256, 256)' })), {
        ruleName: 'subviewport-empty-size',
      });
    });

    it('does not warn when size is absent (Godot defaults it to 512x512)', () => {
      expectNoDiagnostic(scene(node('SubViewport', {})), {
        ruleName: 'subviewport-empty-size',
      });
    });
  });
});

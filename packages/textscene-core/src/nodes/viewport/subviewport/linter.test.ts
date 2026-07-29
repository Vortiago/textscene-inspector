/**
 * SubViewport linting — format validators (errors) + semantic rules (warnings).
 *
 * The sorting principle (CONTEXT.md): a validator failure is ALWAYS an error,
 * because a format violation is objectively invalid; an advisory condition is
 * ALWAYS a warning, because committed positive fixtures may legally carry it.
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

    it('rejects an out-of-range render_target_update_mode', () => {
      expectDiagnostic(scene(node('SubViewport', { render_target_update_mode: 5 })), {
        prop: 'render_target_update_mode',
        severity: 'error',
      });
    });

    it('rejects an out-of-range render_target_clear_mode', () => {
      expectDiagnostic(scene(node('SubViewport', { render_target_clear_mode: 3 })), {
        prop: 'render_target_clear_mode',
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

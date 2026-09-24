/**
 * SubViewport linting: every diagnostic comes from a validator. A failure errors
 * when Godot's setter refuses or alters the value, and warns when only a
 * `PROPERTY_HINT_RANGE` or `PROPERTY_HINT_ENUM` states the bound (ADR-0032).
 */

import { describe, it } from 'vitest';
import {
  node,
  scene,
  expectClean,
  expectDiagnostic,
  expectNoErrors,
} from '../../../linter/testing/testkit';
import './linterParser';

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

    it('takes a float-valued size, which Godot converts rather than refuses', () => {
      // `_parse_construct<int32_t>` (variant_parser.cpp:577-592) accepts any
      // number token, so this loads as Vector2i(600, 400). The component is
      // bounded as the 600 Godot stores.
      expectDiagnostic(scene(node('SubViewport', { size: 'Vector2i(600.5, 400)' })), {
        severity: 'warning',
        contains: ['600.5', 'stores 600'],
      });
    });

    it('still rejects a size whose truncated component is below the floor', () => {
      expectDiagnostic(scene(node('SubViewport', { size: 'Vector2i(0.9, 400)' })), {
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

  describe('a degenerate size is an error, not an advisory', () => {
    it('errors on a size Godot would clamp, rather than warning about it', () => {
      // Viewport::_set_size raises either component to 2 (viewport.cpp:1120),
      // so 0 is altered exactly as a negative is. No warning restates it.
      expectDiagnostic(scene(node('SubViewport', { size: 'Vector2i(0, 400)' })), {
        prop: 'size',
        severity: 'error',
      });
    });

    it('accepts a normal size', () => {
      expectNoErrors(scene(node('SubViewport', { size: 'Vector2i(256, 256)' })));
    });

    it('accepts an absent size, which Godot defaults to 512x512', () => {
      expectNoErrors(scene(node('SubViewport', {})));
    });
  });
});

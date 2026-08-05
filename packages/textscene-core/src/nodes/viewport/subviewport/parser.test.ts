import { describe, expect, it } from 'vitest';
import { heading } from '../../../parser/testing/parserKit';
import { parseSubViewport } from './parser';

/**
 * Defaults are Godot's own (doc/classes/SubViewport.xml + Viewport.xml, 4.4),
 * not guesses — a wrong default silently changes what an unset property renders
 * as, which no fixture would catch.
 */
describe('parseSubViewport', () => {
  it('parses name and parent, and carries no transform (happy path)', () => {
    const result = parseSubViewport(
      heading('SubViewport', { name: 'RenderBooth', parent: '.' }),
      { size: 'Vector2i(600, 400)' }
    );
    expect(result.name).toBe('RenderBooth');
    expect(result.parent).toBe('.');
    // A SubViewport derives from Viewport < Node — it has no spatial transform,
    // and `SubViewportProperties` omits the field entirely rather than merely
    // leaving it unset.
    expect('transform' in result).toBe(false);
  });

  describe('size', () => {
    it('parses a Vector2i', () => {
      const result = parseSubViewport(heading('SubViewport', { name: 'V' }), {
        size: 'Vector2i(600, 400)',
      });
      expect(result.size).toEqual({ x: 600, y: 400 });
    });

    it('falls back to Godot’s 512x512 default when absent (edge case)', () => {
      const result = parseSubViewport(heading('SubViewport', { name: 'V' }), {});
      expect(result.size).toEqual({ x: 512, y: 512 });
    });

    it('falls back to the default on a malformed literal (error path)', () => {
      const result = parseSubViewport(heading('SubViewport', { name: 'V' }), {
        size: 'Vector2i(nope)',
      });
      expect(result.size).toEqual({ x: 512, y: 512 });
    });
  });

  describe('world boundary flags', () => {
    it('parses own_world_3d — the flag that hides the 3D subtree from the parent view', () => {
      const on = parseSubViewport(heading('SubViewport', { name: 'V' }), {
        own_world_3d: 'true',
      });
      expect(on.own_world_3d).toBe(true);
    });

    it('defaults own_world_3d to false, so 3D children share the parent World3D', () => {
      const result = parseSubViewport(heading('SubViewport', { name: 'V' }), {});
      expect(result.own_world_3d).toBe(false);
    });

    it('parses disable_3d (which does NOT affect the parent view — measured)', () => {
      const result = parseSubViewport(heading('SubViewport', { name: 'V' }), {
        disable_3d: 'true',
      });
      expect(result.disable_3d).toBe(true);
    });
  });

  describe('render-target properties', () => {
    it('parses render_target_update_mode and render_target_clear_mode', () => {
      const result = parseSubViewport(heading('SubViewport', { name: 'V' }), {
        render_target_update_mode: '4',
        render_target_clear_mode: '2',
      });
      expect(result.render_target_update_mode).toBe(4);
      expect(result.render_target_clear_mode).toBe(2);
    });

    it('defaults update mode to WHEN_VISIBLE (2) and clear mode to ALWAYS (0)', () => {
      const result = parseSubViewport(heading('SubViewport', { name: 'V' }), {});
      expect(result.render_target_update_mode).toBe(2);
      expect(result.render_target_clear_mode).toBe(0);
    });

    it('clamps an out-of-range update mode back to the default (error path)', () => {
      const result = parseSubViewport(heading('SubViewport', { name: 'V' }), {
        render_target_update_mode: '99',
      });
      expect(result.render_target_update_mode).toBe(2);
    });

    it('parses transparent_bg, which decides whether the target clears opaque', () => {
      const result = parseSubViewport(heading('SubViewport', { name: 'V' }), {
        transparent_bg: 'true',
      });
      expect(result.transparent_bg).toBe(true);
    });
  });

  describe('remaining Viewport properties the corpus authors', () => {
    it('parses them all', () => {
      const result = parseSubViewport(heading('SubViewport', { name: 'V' }), {
        handle_input_locally: 'false',
        msaa_3d: '2',
        use_debanding: 'true',
        audio_listener_enable_2d: 'true',
        canvas_item_default_texture_filter: '0',
        gui_embed_subwindows: 'true',
        size_2d_override: 'Vector2i(320, 240)',
        size_2d_override_stretch: 'true',
      });
      expect(result.handle_input_locally).toBe(false);
      expect(result.msaa_3d).toBe(2);
      expect(result.use_debanding).toBe(true);
      expect(result.audio_listener_enable_2d).toBe(true);
      expect(result.canvas_item_default_texture_filter).toBe(0);
      expect(result.gui_embed_subwindows).toBe(true);
      expect(result.size_2d_override).toEqual({ x: 320, y: 240 });
      expect(result.size_2d_override_stretch).toBe(true);
    });

    it('applies Godot defaults when every one is absent (edge case)', () => {
      const result = parseSubViewport(heading('SubViewport', { name: 'V' }), {});
      expect(result.handle_input_locally).toBe(true);
      expect(result.msaa_3d).toBe(0);
      expect(result.use_debanding).toBe(false);
      expect(result.audio_listener_enable_2d).toBe(false);
      expect(result.canvas_item_default_texture_filter).toBe(1);
      expect(result.gui_embed_subwindows).toBe(false);
      expect(result.size_2d_override).toEqual({ x: 0, y: 0 });
      expect(result.size_2d_override_stretch).toBe(false);
    });
  });

  it('handles a heading with no attributes at all (edge case)', () => {
    const result = parseSubViewport({ type: 'node', attributes: {} }, {});
    expect(result.name).toBe('');
    expect(result.parent).toBeUndefined();
    expect(result.size).toEqual({ x: 512, y: 512 });
  });
});

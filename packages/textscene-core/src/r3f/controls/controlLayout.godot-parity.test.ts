/**
 * Base-Control parity: size-flag precedence, modulate, and the 2D transform.
 *
 * Three separate gaps in the layer every 2D UI node inherits from:
 *
 * - `size_flags` precedence was INVERTED. `Container::fit_child_in_rect` tests
 *   `if (!flags.has_flag(SIZE_FILL))` FIRST — FILL short-circuits and the
 *   shrink bits are never consulted. We tested SHRINK_END/SHRINK_CENTER first,
 *   so `size_flags_vertical = 5` (FILL|SHRINK_CENTER) centred a child Godot
 *   stretches. `scenes/demos/gui/regex/regex.tscn` has two such labels.
 * - `modulate` / `self_modulate` were never parsed, so every Control's tint and
 *   alpha were dropped for the whole family.
 * - `rotation` / `scale` / `pivot_offset` were never parsed, so no Control ever
 *   got a CSS transform — `scenes/demos/gui/multiple_resolutions/main.tscn`
 *   rotates a TextureRect 45 degrees about its own centre and we drew it
 *   axis-aligned.
 */
import { describe, expect, it } from 'vitest';
import { controlLayoutStyle } from './controlLayout';
import { parseControl } from '../../nodes/2d/ui/control/parser';
import type { ControlProperties } from '../../nodes/2d/ui/control/types';

const heading = { type: 'node', attributes: { name: 'C', type: 'Control' } };

function props(raw: Record<string, string> = {}): ControlProperties {
  return parseControl(heading, raw);
}

describe('size_flags precedence', () => {
  it('stretches when FILL is set, whatever shrink bits ride along', () => {
    // 1 = FILL, 5 = FILL|SHRINK_CENTER, 9 = FILL|SHRINK_END, 13 = all three.
    for (const flag of ['1', '5', '9', '13']) {
      const style = controlLayoutStyle(props({ size_flags_vertical: flag }), 'row');
      expect(style.alignSelf, `size_flags_vertical = ${flag}`).toBe('stretch');
    }
  });

  it('consults the shrink bits only when FILL is absent', () => {
    expect(controlLayoutStyle(props({ size_flags_vertical: '4' }), 'row').alignSelf).toBe('center');
    expect(controlLayoutStyle(props({ size_flags_vertical: '8' }), 'row').alignSelf).toBe(
      'flex-end'
    );
    expect(controlLayoutStyle(props({ size_flags_vertical: '0' }), 'row').alignSelf).toBe(
      'flex-start'
    );
  });

  it('defaults to FILL when the scene names no flag', () => {
    expect(controlLayoutStyle(props(), 'row').alignSelf).toBe('stretch');
  });
});

describe('modulate', () => {
  it('parses modulate and self_modulate', () => {
    const p = props({
      modulate: 'Color(1, 1, 0, 1)',
      self_modulate: 'Color(1, 1, 1, 0.5)',
    });
    expect(p.modulate).toEqual({ r: 1, g: 1, b: 0, a: 1 });
    expect(p.selfModulate).toEqual({ r: 1, g: 1, b: 1, a: 0.5 });
  });

  it('leaves both undefined when the scene sets neither (Godot default white)', () => {
    expect(props().modulate).toBeUndefined();
    expect(props().selfModulate).toBeUndefined();
  });

  it('emits the tint as a CSS filter and the alpha as opacity', () => {
    const style = controlLayoutStyle(props({ modulate: 'Color(1, 1, 1, 0.5)' }), 'free');
    expect(style.opacity).toBeCloseTo(0.5, 6);
  });

  it('multiplies modulate and self_modulate alpha together', () => {
    const style = controlLayoutStyle(
      props({ modulate: 'Color(1, 1, 1, 0.5)', self_modulate: 'Color(1, 1, 1, 0.5)' }),
      'free'
    );
    expect(style.opacity).toBeCloseTo(0.25, 6);
  });

  it('emits no opacity for a fully opaque tint', () => {
    expect(controlLayoutStyle(props({ modulate: 'Color(1, 1, 0, 1)' }), 'free').opacity).toBe(
      undefined
    );
  });
});

describe('rotation / scale / pivot_offset', () => {
  it('parses all three plus pivot_offset_ratio', () => {
    const p = props({
      rotation: '0.785398',
      scale: 'Vector2(2, -1)',
      pivot_offset: 'Vector2(16, 16)',
      pivot_offset_ratio: 'Vector2(0.5, 0.5)',
    });
    expect(p.rotation).toBeCloseTo(0.785398, 6);
    expect(p.scale).toEqual({ x: 2, y: -1 });
    expect(p.pivotOffset).toEqual({ x: 16, y: 16 });
    expect(p.pivotOffsetRatio).toEqual({ x: 0.5, y: 0.5 });
  });

  it('emits a CSS transform about the pivot', () => {
    const style = controlLayoutStyle(
      props({ rotation: '0.785398', pivot_offset: 'Vector2(16, 16)' }),
      'free'
    );
    expect(style.transform).toContain('rotate(');
    expect(style.transformOrigin).toBe('16px 16px');
  });

  it('emits a scale transform, mirroring on a negative axis', () => {
    const style = controlLayoutStyle(props({ scale: 'Vector2(-1, 1)' }), 'free');
    expect(style.transform).toContain('scale(-1, 1)');
  });

  it('emits nothing for the identity transform', () => {
    const style = controlLayoutStyle(props({ rotation: '0', scale: 'Vector2(1, 1)' }), 'free');
    expect(style.transform).toBeUndefined();
  });

  it('DROPS rotation and scale for a Container child, as Godot does', () => {
    // `Container::fit_child_in_rect` ends with `set_rotation(0)` and
    // `set_scale(Vector2(1, 1))`, and class_control.html documents it: "If the
    // Control node is a child of a Container node, the scale will be reset to
    // Vector2(1, 1) when the scene is instantiated."
    const raw = { rotation: '0.785398', scale: 'Vector2(2, 2)' };
    expect(controlLayoutStyle(props(raw), 'row').transform).toBeUndefined();
    expect(controlLayoutStyle(props(raw), 'column').transform).toBeUndefined();
    expect(controlLayoutStyle(props(raw), 'grid').transform).toBeUndefined();
    expect(controlLayoutStyle(props(raw), 'free').transform).toBeDefined();
  });
});

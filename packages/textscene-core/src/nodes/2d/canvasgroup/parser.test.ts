import { describe, expect, it } from 'vitest';
import { parseCanvasGroup } from './parser';
import { heading } from '../../../parser/testing/parserKit';

const group = (properties: Record<string, string>) =>
  parseCanvasGroup(heading('CanvasGroup', { name: 'Group' }), properties);

describe('parseCanvasGroup', () => {
  it('takes Godot defaults of 10, 10 and false when the three are unset (canvas_group.h:37-39)', () => {
    const props = group({});
    expect(props.fit_margin).toBe(10);
    expect(props.clear_margin).toBe(10);
    expect(props.use_mipmaps).toBe(false);
  });

  it('reads fit_margin, clear_margin and use_mipmaps', () => {
    const props = group({ fit_margin: '0.0', clear_margin: '24.5', use_mipmaps: 'true' });
    expect(props.fit_margin).toBe(0);
    expect(props.clear_margin).toBe(24.5);
    expect(props.use_mipmaps).toBe(true);
  });

  it('keeps the default for a negative margin, which each setter refuses (canvas_group.cpp:34,47)', () => {
    const props = group({ fit_margin: '-4', clear_margin: '-1' });
    expect(props.fit_margin).toBe(10);
    expect(props.clear_margin).toBe(10);
  });

  it('inherits the Node2D properties', () => {
    const props = group({ position: 'Vector2(32, 64)', self_modulate: 'Color(1, 1, 1, 0.5)' });
    expect(props.position).toEqual({ x: 32, y: 64 });
    expect(props.self_modulate.a).toBe(0.5);
  });
});

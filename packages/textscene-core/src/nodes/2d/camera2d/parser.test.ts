import { describe, it, expect } from 'vitest';
import { parseCamera2D } from './parser';
import type { ParsedHeading } from '../../../parser/utils';

const heading = (attrs: Record<string, string> = {}): ParsedHeading => ({
  type: 'node',
  attributes: { type: 'Camera2D', name: 'Cam', ...attrs },
});

describe('parseCamera2D', () => {
  it('parses zoom / offset / anchor_mode / enabled', () => {
    const p = parseCamera2D(heading(), {
      zoom: 'Vector2(2, 2)',
      offset: 'Vector2(10, -5)',
      anchor_mode: '0',
      enabled: 'false',
    });
    expect(p.zoom).toEqual({ x: 2, y: 2 });
    expect(p.offset).toEqual({ x: 10, y: -5 });
    expect(p.anchor_mode).toBe(0);
    expect(p.enabled).toBe(false);
  });

  it('applies Godot defaults (zoom 1, anchor DRAG_CENTER, enabled true)', () => {
    const p = parseCamera2D(heading(), {});
    expect(p.zoom).toEqual({ x: 1, y: 1 });
    expect(p.anchor_mode).toBe(1);
    expect(p.enabled).toBe(true);
  });

  it('inherits the Node2D transform (position)', () => {
    const p = parseCamera2D(heading(), { position: 'Vector2(320, 180)' });
    expect(p.position).toEqual({ x: 320, y: 180 });
  });
});

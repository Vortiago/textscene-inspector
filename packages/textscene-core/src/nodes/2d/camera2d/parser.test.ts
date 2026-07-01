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

  it('zoom accepts fractional values', () => {
    const p = parseCamera2D(heading(), { zoom: 'Vector2(0.5, 0.75)' });
    expect(p.zoom).toEqual({ x: 0.5, y: 0.75 });
  });

  it('zoom accepts zero values', () => {
    const p = parseCamera2D(heading(), { zoom: 'Vector2(0, 0)' });
    expect(p.zoom).toEqual({ x: 0, y: 0 });
  });

  it('zoom accepts negative values', () => {
    const p = parseCamera2D(heading(), { zoom: 'Vector2(-1, -2)' });
    expect(p.zoom).toEqual({ x: -1, y: -2 });
  });

  it('zoom with scientific notation', () => {
    const p = parseCamera2D(heading(), { zoom: 'Vector2(1e-3, 2.5e2)' });
    expect(p.zoom).toEqual({ x: 0.001, y: 250 });
  });

  it('offset parses an explicit non-default (fractional) value', () => {
    // offset's default is {0,0}; a non-zero value distinguishes the parse path
    // from the fallback (a zero offset collides with the default and pins nothing —
    // the shared vec2Or zero-vector path is already covered by the zoom-zero case).
    const p = parseCamera2D(heading(), { offset: 'Vector2(12.5, -7.25)' });
    expect(p.offset).toEqual({ x: 12.5, y: -7.25 });
  });

  it('offset with large mixed-sign values', () => {
    const p = parseCamera2D(heading(), { offset: 'Vector2(-5000, 3000)' });
    expect(p.offset).toEqual({ x: -5000, y: 3000 });
  });

  it('position with large negative coordinates (inherited Node2D)', () => {
    const p = parseCamera2D(heading(), { position: 'Vector2(-10000, -8000)' });
    expect(p.position).toEqual({ x: -10000, y: -8000 });
  });

  it('malformed anchor_mode falls back to DRAG_CENTER (1)', () => {
    // intOr warn-then-fallback: a present-but-unparseable value must not
    // silently become NaN — it falls back to the Godot default (1).
    const p = parseCamera2D(heading(), { anchor_mode: 'garbage' });
    expect(p.anchor_mode).toBe(1);
  });

  it('malformed zoom falls back to default (1, 1)', () => {
    // vec2Or warn-then-fallback: a present-but-unparseable Vector2 must fall
    // back to the default, not throw or yield NaN components.
    const p = parseCamera2D(heading(), { zoom: 'not-a-vector' });
    expect(p.zoom).toEqual({ x: 1, y: 1 });
  });

  it('malformed offset falls back to default (0, 0)', () => {
    const p = parseCamera2D(heading(), { offset: 'Vector2(oops)' });
    expect(p.offset).toEqual({ x: 0, y: 0 });
  });
});

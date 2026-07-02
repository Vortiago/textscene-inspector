import { describe, it, expect } from 'vitest';
import { parseNode2D, decomposeTransform2D } from './parser';
import { heading } from '../../../parser/testing/parserKit';

describe('parseNode2D', () => {
  it('parses discrete position / rotation / scale', () => {
    const p = parseNode2D(heading('Node2D', { name: 'N' }), {
      position: 'Vector2(100, 50)',
      rotation: '1.5707963',
      scale: 'Vector2(2, 3)',
    });
    expect(p.position).toEqual({ x: 100, y: 50 });
    expect(p.rotation).toBeCloseTo(1.5707963);
    expect(p.scale).toEqual({ x: 2, y: 3 });
  });

  it('converts rotation_degrees to radians', () => {
    expect(
      parseNode2D(heading('Node2D', { name: 'N' }), { rotation_degrees: '90' }).rotation
    ).toBeCloseTo(Math.PI / 2);
  });

  it('applies Godot defaults (pos 0, rot 0, scale 1, z_as_relative true)', () => {
    const p = parseNode2D(heading('Node2D', { name: 'N' }), {});
    expect(p.position).toEqual({ x: 0, y: 0 });
    expect(p.rotation).toBe(0);
    expect(p.scale).toEqual({ x: 1, y: 1 });
    expect(p.z_index).toBe(0);
    expect(p.z_as_relative).toBe(true);
  });

  it('transform= wins over discrete props and is decomposed', () => {
    // x_axis=(2,0), y_axis=(0,3), origin=(10,20): no rotation, scale (2,3).
    const p = parseNode2D(heading('Node2D', { name: 'N' }), {
      transform: 'Transform2D(2, 0, 0, 3, 10, 20)',
      position: 'Vector2(99, 99)',
    });
    expect(p.position).toEqual({ x: 10, y: 20 });
    expect(p.rotation).toBeCloseTo(0);
    expect(p.scale.x).toBeCloseTo(2);
    expect(p.scale.y).toBeCloseTo(3);
  });

  it('reads the discrete skew property (radians, default 0)', () => {
    expect(parseNode2D(heading('Node2D', { name: 'N' }), {}).skew).toBe(0);
    expect(parseNode2D(heading('Node2D', { name: 'N' }), { skew: '0.5' }).skew).toBeCloseTo(0.5);
  });

  it('takes skew from the transform= matrix when present (not the discrete prop)', () => {
    // Sheared matrix carries skew=π/6; the discrete skew prop is ignored when
    // the matrix form wins (consistent with rotation/scale).
    const p = parseNode2D(heading('Node2D', { name: 'N' }), {
      transform: 'Transform2D(1, 0, -0.5, 0.8660254, 0, 0)',
      skew: '99',
    });
    expect(p.skew).toBeCloseTo(Math.PI / 6, 5);
  });

  it('reads z_index and the instance attribute', () => {
    const p = parseNode2D(heading('Node2D', { name: 'N', instance: 'ExtResource("1_s")' }), {
      z_index: '5',
    });
    expect(p.z_index).toBe(5);
    expect(p.instance).toBe('ExtResource("1_s")');
  });

  it('parses the CanvasItem modulate tint (defaults white opaque)', () => {
    expect(parseNode2D(heading('Node2D', { name: 'N' }), {}).modulate).toEqual({
      r: 1,
      g: 1,
      b: 1,
      a: 1,
    });
    const cyan = parseNode2D(heading('Node2D', { name: 'N' }), {
      modulate: 'Color(0, 1, 1, 1)',
    }).modulate;
    expect(cyan.r).toBeCloseTo(0);
    expect(cyan.g).toBeCloseTo(1);
    expect(cyan.b).toBeCloseTo(1);
  });
});

describe('decomposeTransform2D', () => {
  it('extracts a 90° rotation from the x-axis', () => {
    // rotation +90°: x_axis=(0,1), y_axis=(-1,0).
    const d = decomposeTransform2D('Transform2D(0, 1, -1, 0, 0, 0)')!;
    expect(d.rotation).toBeCloseTo(Math.PI / 2);
    expect(d.scale.x).toBeCloseTo(1);
    expect(d.scale.y).toBeCloseTo(1);
  });

  it('folds a negative determinant (flip) into scale.y sign', () => {
    // x_axis=(1,0), y_axis=(0,-1): det = -1 ⇒ scale.y negative.
    const d = decomposeTransform2D('Transform2D(1, 0, 0, -1, 0, 0)')!;
    expect(d.scale.y).toBeCloseTo(-1);
  });

  it('returns null on malformed input', () => {
    expect(decomposeTransform2D('not a transform')).toBeNull();
  });

  it('extracts skew from a sheared matrix (Godot get_skew)', () => {
    // rot=0, skew=π/6, scale=(1,1): x_axis=(1,0), y_axis=(-sin30°, cos30°).
    const d = decomposeTransform2D('Transform2D(1, 0, -0.5, 0.8660254, 0, 0)')!;
    expect(d.rotation).toBeCloseTo(0, 5);
    expect(d.scale.x).toBeCloseTo(1, 5);
    expect(d.scale.y).toBeCloseTo(1, 5);
    expect(d.skew).toBeCloseTo(Math.PI / 6, 5);
  });

  it('reports zero skew for an orthonormal (rotation-only) matrix', () => {
    expect(decomposeTransform2D('Transform2D(0, 1, -1, 0, 0, 0)')!.skew).toBeCloseTo(0, 6);
  });
});

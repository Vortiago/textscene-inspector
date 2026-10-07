import { describe, expect, it } from 'vitest';
import type { ParsedHeading } from '../../../../parser/utils';
import { parseCanvasLayer } from './parser';
import { TRANSFORM2D_IDENTITY } from '../../../../godot/transform2d';

function h(attributes: Record<string, string>): ParsedHeading {
  return { type: 'node', attributes };
}

describe('parseCanvasLayer', () => {
  it('parses name and layer index', () => {
    const p = parseCanvasLayer(h({ name: 'HUD', type: 'CanvasLayer' }), { layer: '2' });
    expect(p.name).toBe('HUD');
    expect(p.layer).toBe(2);
  });
  it('treats visible="false" as hidden and omits absent layer', () => {
    const p = parseCanvasLayer(h({ name: 'HUD', type: 'CanvasLayer' }), { visible: 'false' });
    expect(p.visible).toBe(false);
    expect(p.layer).toBeUndefined();
  });

  // Without the parent the node attaches to nothing, and a scene has exactly
  // one root, so the layer and its whole subtree vanish from the tree.
  it('carries the heading’s hierarchy attributes, so the layer stays in the tree', () => {
    const p = parseCanvasLayer(h({ name: 'HUD', type: 'CanvasLayer', parent: '.', index: '2' }), {});
    expect(p.parent).toBe('.');
    expect(p.index).toBe(2);
  });

  it('keeps an instanced layer’s sub-scene reference', () => {
    const p = parseCanvasLayer(h({ name: 'HUD', parent: '.', instance: 'ExtResource("1_hud")' }), {});
    expect(p.instance).toBe('ExtResource("1_hud")');
  });
});

/** `CanvasLayer::_update_xform` (`canvas_layer.cpp:103-109`): `set_rotation_and_scale`, then the origin. */
describe('parseCanvasLayer transform', () => {
  const layer = (properties: Record<string, string>) =>
    parseCanvasLayer(h({ name: 'HUD', type: 'CanvasLayer' }), properties).canvasTransform;

  it('is the identity while nothing places the layer', () => {
    expect(layer({})).toEqual(TRANSFORM2D_IDENTITY);
  });

  it('builds from offset, rotation and scale', () => {
    const t = layer({ offset: 'Vector2(420, 160)', rotation: '0.5', scale: 'Vector2(1.5, 0.75)' });
    expect(t.a).toBeCloseTo(Math.cos(0.5) * 1.5, 12);
    expect(t.b).toBeCloseTo(Math.sin(0.5) * 1.5, 12);
    expect(t.c).toBeCloseTo(-Math.sin(0.5) * 0.75, 12);
    expect(t.d).toBeCloseTo(Math.cos(0.5) * 0.75, 12);
    expect([t.tx, t.ty]).toEqual([420, 160]);
  });

  it('takes `transform` over the parts, since Godot sets it last', () => {
    const t = layer({ offset: 'Vector2(1, 2)', transform: 'Transform2D(2, 0, 0, 3, 40, 50)' });
    expect(t).toEqual({ a: 2, b: 0, c: 0, d: 3, tx: 40, ty: 50 });
  });

  it('keeps a skew that offset, rotation and scale cannot say', () => {
    const t = layer({ transform: 'Transform2D(1, 0, 0.5, 1, 0, 0)' });
    expect(t.c).toBeCloseTo(0.5, 12);
    expect(t.d).toBeCloseTo(1, 12);
  });

  it('falls back to the parts on a malformed transform', () => {
    expect(layer({ offset: 'Vector2(7, 8)', transform: 'Transform2D(not, valid)' })).toEqual({
      ...TRANSFORM2D_IDENTITY,
      tx: 7,
      ty: 8,
    });
  });
});

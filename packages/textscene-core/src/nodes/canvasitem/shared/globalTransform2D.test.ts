/**
 * resolveGlobalTransform2D climbs a caller's parent lookup through Godot's canvas parent
 * chain: it stops above a `top_level` node and below a parent that is not a CanvasItem,
 * and declines a chain it cannot decode.
 */
import { describe, expect, it } from 'vitest';
import { resolveGlobalTransform2D } from './globalTransform2D';
import type { ParentLookup } from '../../../linter/parentType';
import type { RawNode } from '../../../parser/types';

function node(type: string, rawProperties: Record<string, string> = {}): RawNode {
  return { name: type, type, children: [], rawProperties };
}

/** A parent lookup over a chain written root first. */
function chainOf(...chain: RawNode[]): (child: RawNode) => ParentLookup {
  return (child) => {
    const parent = chain[chain.indexOf(child) - 1];
    return parent ? { kind: 'known', parent } : { kind: 'root' };
  };
}

function originOf(target: RawNode, parentOf: (child: RawNode) => ParentLookup) {
  const verdict = resolveGlobalTransform2D(target, parentOf);
  return verdict.kind === 'known' ? { x: verdict.transform.tx, y: verdict.transform.ty } : verdict.kind;
}

describe('resolveGlobalTransform2D', () => {
  it('composes every Node2D ancestor up to the root', () => {
    const root = node('Node2D', { position: 'Vector2(100, 50)', scale: 'Vector2(2, 2)' });
    const target = node('Node2D', { position: 'Vector2(10, 5)' });
    expect(originOf(target, chainOf(root, target))).toEqual({ x: 120, y: 60 });
  });

  it('composes a top_level ancestor and stops above it', () => {
    const root = node('Node2D', { position: 'Vector2(1000, 1000)' });
    const detached = node('Node2D', { position: 'Vector2(100, 50)', top_level: 'true' });
    const target = node('Node2D', { position: 'Vector2(10, 5)' });
    expect(originOf(target, chainOf(root, detached, target))).toEqual({ x: 110, y: 55 });
  });

  it('stops below a parent that is not a CanvasItem', () => {
    const root = node('Node2D', { position: 'Vector2(100, 50)' });
    const target = node('Node2D', { position: 'Vector2(10, 5)' });
    expect(originOf(target, chainOf(root, node('Node'), target))).toEqual({ x: 10, y: 5 });
  });

  it('reads a node with no position as the identity', () => {
    const root = node('Node2D', { position: 'Vector2(100, 50)' });
    const target = node('Node2D');
    expect(originOf(target, chainOf(root, target))).toEqual({ x: 100, y: 50 });
  });

  it('reads a malformed position as the identity', () => {
    const root = node('Node2D', { position: 'Vector2(100, 50)' });
    const target = node('Node2D', { position: 'Vector2(10)' });
    expect(originOf(target, chainOf(root, target))).toEqual({ x: 100, y: 50 });
  });

  it('declines a chain whose scale narrows to a number the file does not state', () => {
    const root = node('Node2D', { scale: 'Vector2i(4294967296, 1)' });
    const target = node('Node2D', { position: 'Vector2(10, 5)' });
    expect(originOf(target, chainOf(root, target))).toBe('unknowable');
  });

  describe('a Control on the chain, as `Control::_update_canvas_item_transform` places it', () => {
    const panel = (extra: Record<string, string> = {}) =>
      node('Control', { offset_left: '100.0', offset_top: '50.0', ...extra });

    it('composes the offsets of a Control above a Node2D (control.cpp:719-737)', () => {
      const target = node('Node2D', { position: 'Vector2(10, 5)' });
      expect(originOf(target, chainOf(panel(), target))).toEqual({ x: 110, y: 55 });
    });

    it('composes the rotation and scale of a Control the node sits under', () => {
      const target = node('Node2D', { position: 'Vector2(10, 0)' });
      const turned = panel({ rotation: '1.5707963267948966', scale: 'Vector2(2, 2)' });
      const { x, y } = originOf(target, chainOf(turned, target)) as { x: number; y: number };
      expect(x).toBeCloseTo(100, 6);
      expect(y).toBeCloseTo(70, 6);
    });

    it('composes a Control that is the node itself', () => {
      const own = panel();
      const root = node('Node2D', { position: 'Vector2(1, 1)' });
      expect(originOf(own, chainOf(root, own))).toEqual({ x: 101, y: 51 });
    });

    it('places a Control with a right anchor by its offsets, as the right anchor only sizes it', () => {
      const target = node('Node2D', { position: 'Vector2(10, 5)' });
      expect(originOf(target, chainOf(panel({ anchor_right: '1.0' }), target))).toEqual({ x: 110, y: 55 });
    });

    it('reads a Control with no offsets as the identity (edge case)', () => {
      const target = node('Node2D', { position: 'Vector2(10, 5)' });
      expect(originOf(target, chainOf(node('Control'), target))).toEqual({ x: 10, y: 5 });
    });

    it.each([
      ['a pivot offset', { pivot_offset: 'Vector2(10, 10)' }],
      ['a grow direction that moves the left edge', { grow_horizontal: '0' }],
      ['a stated position, which the offsets no longer give', { position: 'Vector2(5, 5)' }],
    ])('declines a Control with %s, which the offsets alone do not place', (_label, extra) => {
      const target = node('Node2D', { position: 'Vector2(10, 5)' });
      expect(originOf(target, chainOf(panel(extra), target))).toBe('unknowable');
    });

    it('places a Control below a Node2D by its offsets, whatever its anchors (control.cpp:692-693)', () => {
      const target = node('Node2D', { position: 'Vector2(10, 5)' });
      const centred = panel({ anchor_left: '0.5' });
      expect(originOf(target, chainOf(node('Node2D'), centred, target))).toEqual({ x: 110, y: 55 });
    });

    it.each([
      ['below a Control', node('Control')],
      ['with no canvas item above', node('Node')],
    ])(
      'declines a left anchor away from the edge %s, which needs the rect of the parent',
      (_label, above) => {
        const target = node('Node2D', { position: 'Vector2(10, 5)' });
        const centred = panel({ anchor_left: '0.5' });
        expect(originOf(target, chainOf(above, centred, target))).toBe('unknowable');
      }
    );

    it('declines a Control that a Container lays out', () => {
      const target = node('Node2D', { position: 'Vector2(10, 5)' });
      expect(originOf(target, chainOf(node('VBoxContainer'), panel(), target))).toBe('unknowable');
    });
  });

  it('declines a chain through a parent the lookup cannot type', () => {
    const target = node('Node2D', { position: 'Vector2(10, 5)' });
    expect(originOf(target, () => ({ kind: 'unknowable' }))).toBe('unknowable');
  });
});

/**
 * A light's DRAW order is its scene-tree position, not its registration order.
 *
 * Godot applies a canvas's lights in attach order — the preorder walk of the
 * effective tree — and `light_blend_compute`'s MIX is order-dependent:
 *
 *   MIX: color.rgb = mix(color.rgb, light_color.rgb, light_color.a)
 *
 * so two overlapping MIX lights give a different colour depending which is
 * applied second. Registration order is not tree order: `freeOrdinal` hands out
 * the LOWEST free slot, and a light registers when its cookie resolves — an
 * inline `GradientTexture2D` resolves in the same tick, a `res://` PNG does not.
 * So a tree-earlier light can register second and, before this, draw second.
 *
 * The ordinal keeps its other job (stencil-ref distinctness within a pass);
 * only cross-light draw order moves onto the tree sequence.
 */

import { describe, it, expect } from 'vitest';
import { lightSequenceByPath } from './lightSequence';
import type { TscnNode } from '../../parser/types';

function node(name: string, type: string, children: TscnNode[] = []): TscnNode {
  return { name, type, properties: {}, children } as unknown as TscnNode;
}

describe('lightSequenceByPath', () => {
  it('numbers lights in preorder, which is Godot attach order', () => {
    // Root
    //  ├ A          (light, seq 0)
    //  ├ Mid
    //  │  └ B       (light, seq 1) — deeper, but earlier in preorder than C
    //  └ C          (light, seq 2)
    const roots = [
      node('Root', 'Node2D', [
        node('A', 'PointLight2D'),
        node('Mid', 'Node2D', [node('B', 'PointLight2D')]),
        node('C', 'PointLight2D'),
      ]),
    ];

    const seq = lightSequenceByPath(roots);
    expect(seq.get('Root/A')).toBe(0);
    expect(seq.get('Root/Mid/B')).toBe(1);
    expect(seq.get('Root/C')).toBe(2);
  });

  it('numbers only lights, so a sequence is dense across an unlit tree', () => {
    // The sequence indexes a render-order slot, and the volume mask has to land
    // between consecutive slots — a sparse sequence would leave gaps that the
    // 2n / 2n+1 pairing spends for nothing.
    const roots = [
      node('Root', 'Node2D', [
        node('Sprite', 'Sprite2D'),
        node('A', 'PointLight2D'),
        node('Poly', 'Polygon2D'),
        node('B', 'PointLight2D'),
      ]),
    ];

    const seq = lightSequenceByPath(roots);
    expect([...seq.values()].sort((a, b) => a - b)).toEqual([0, 1]);
    expect(seq.get('Root/A')).toBe(0);
    expect(seq.get('Root/B')).toBe(1);
  });

  it('ignores a DirectionalLight2D, which is not a positional canvas light', () => {
    const roots = [
      node('Root', 'Node2D', [
        node('Sun', 'DirectionalLight2D'),
        node('Lamp', 'PointLight2D'),
      ]),
    ];
    expect(lightSequenceByPath(roots).get('Root/Lamp')).toBe(0);
  });

  it('is empty for a tree with no lights rather than throwing', () => {
    expect(lightSequenceByPath([node('Root', 'Node2D')]).size).toBe(0);
  });
});

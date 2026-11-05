/**
 * `viewportPassSizes`: the one owner of a sub-viewport's target size. A stretching container's
 * forced rect wins over the authored `size` (`subviewport_container.cpp:94`), each axis floors at 2
 * (`viewport.cpp:1120`, `p_size.maxi(2)`), and the previewer caps it at `MAX_TEXTURE_EXTENT`.
 */
import { describe, expect, it } from 'vitest';
import type { TscnNode } from '../../../parser/types';
import type { Vector2 } from '../../../godot/math/vector';
import type { ViewportRect } from '../../../r3f/contexts/ViewportRectContext';
import { heading } from '../../../parser/testing/parserKit';
import { parseWindow } from '../../windows/window/parser';
import { viewportPassSizes, viewportSize } from './targetSize';
import { MAX_TEXTURE_EXTENT } from '../../../r3f/webglLimits.js';

function viewportTargetSize(size: Vector2, forced: ViewportRect | null): Vector2 {
  const node = { name: 'View', type: 'SubViewport', children: [], properties: { size } };
  return viewportPassSizes(node as unknown as TscnNode, forced).target;
}

describe('viewportPassSizes: the target', () => {
  it('keeps the authored size when no container forces one', () => {
    expect(viewportTargetSize({ x: 399, y: 480 }, null)).toEqual({ x: 399, y: 480 });
  });

  it('prefers the forced rect over the authored size', () => {
    expect(viewportTargetSize({ x: 399, y: 480 }, { x: 572, y: 648 })).toEqual({ x: 572, y: 648 });
  });

  it('floors each axis at 2, as Godot does for a viewport', () => {
    expect(viewportTargetSize({ x: 1, y: -40 }, null)).toEqual({ x: 2, y: 2 });
    expect(viewportTargetSize({ x: 300, y: 300 }, { x: 40, y: 0 })).toEqual({ x: 40, y: 2 });
  });

  it('caps each axis at the largest texture WebGL allocates', () => {
    expect(viewportTargetSize({ x: 2000000000, y: MAX_TEXTURE_EXTENT }, null)).toEqual({
      x: MAX_TEXTURE_EXTENT,
      y: MAX_TEXTURE_EXTENT,
    });
  });

  it('gives a non-finite axis the 2-pixel floor', () => {
    expect(viewportTargetSize({ x: Number.NaN, y: Number.POSITIVE_INFINITY }, null)).toEqual({ x: 2, y: 2 });
  });
});

describe('viewportSize', () => {
  it('floors each axis at 2 but leaves the ceiling to the GPU, as Godot does', () => {
    expect(viewportSize({ x: 1, y: 2000000000 }, null)).toEqual({ x: 2, y: 2000000000 });
  });
});

describe('viewportPassSizes: an embedded window', () => {
  it('renders at its size and shows its pixels over the content scale factor', () => {
    const properties = parseWindow(heading('Window', { name: 'Win' }), {
      size: 'Vector2i(240, 160)',
      content_scale_factor: '2.0',
    });
    const node = { name: 'Win', type: 'Window', children: [], properties } as unknown as TscnNode;
    expect(viewportPassSizes(node, null)).toEqual({
      target: { x: 240, y: 160 },
      layout: { x: 120, y: 80 },
      view: { x: 120, y: 80 },
    });
  });
});

/**
 * `viewportPassSizes`: the one owner of a sub-viewport's target size. A stretching container's
 * forced rect wins over the authored `size` (`subviewport_container.cpp:94`), each axis floors at 2
 * (`viewport.cpp:1120`, `p_size.maxi(2)`), and the previewer caps it at `MAX_TEXTURE_EXTENT`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as logger from '../../../logger';
import type { TscnNode } from '../../../parser/types';
import type { Vector2 } from '../../../godot/math/vector';
import type { ViewportRect } from '../../../r3f/contexts/ViewportRectContext';
import { heading } from '../../../parser/testing/parserKit';
import { parseWindow } from '../../windows/window/parser';
import { embedderStretch, viewportPassSizes, viewportSize, warnOfCappedTarget } from './targetSize';
import { MAX_TEXTURE_EXTENT } from '../../../r3f/webglLimits.js';

function targetOf(size: Vector2, forced: ViewportRect | null): Vector2 {
  const properties = { size, size_2d_override: { x: 0, y: 0 }, size_2d_override_stretch: false };
  const node = { name: 'View', type: 'SubViewport', children: [], properties };
  return viewportPassSizes(node as unknown as TscnNode, forced, 1).target;
}

describe('viewportPassSizes: the target', () => {
  it('keeps the authored size when no container forces one', () => {
    expect(targetOf({ x: 399, y: 480 }, null)).toEqual({ x: 399, y: 480 });
  });

  it('prefers the forced rect over the authored size', () => {
    expect(targetOf({ x: 399, y: 480 }, { x: 572, y: 648 })).toEqual({ x: 572, y: 648 });
  });

  it('floors each axis at 2, as Godot does for a viewport', () => {
    expect(targetOf({ x: 1, y: -40 }, null)).toEqual({ x: 2, y: 2 });
    expect(targetOf({ x: 300, y: 300 }, { x: 40, y: 0 })).toEqual({ x: 40, y: 2 });
  });

  it('caps each axis at the largest texture WebGL allocates', () => {
    expect(targetOf({ x: 2000000000, y: MAX_TEXTURE_EXTENT }, null)).toEqual({
      x: MAX_TEXTURE_EXTENT,
      y: MAX_TEXTURE_EXTENT,
    });
  });

  it('keeps the size Godot renders beside the capped target', () => {
    const properties = {
      size: { x: 65536, y: 100 },
      size_2d_override: { x: 0, y: 0 },
      size_2d_override_stretch: false,
    };
    const node = { name: 'View', type: 'SubViewport', children: [], properties } as unknown as TscnNode;
    expect(viewportPassSizes(node, null, 1).render).toEqual({ x: 65536, y: 100 });
  });

  it('gives a non-finite axis the 2-pixel floor', () => {
    expect(targetOf({ x: Number.NaN, y: Number.POSITIVE_INFINITY }, null)).toEqual({ x: 2, y: 2 });
  });
});

describe('viewportPassSizes: a 2D override', () => {
  function sizesOf(size2dOverride: Vector2, stretches: boolean) {
    const properties = {
      size: { x: 800, y: 450 },
      size_2d_override: size2dOverride,
      size_2d_override_stretch: stretches,
    };
    const node = { name: 'View', type: 'SubViewport', children: [], properties };
    return viewportPassSizes(node as unknown as TscnNode, null, 1);
  }

  it('stretches the override over the target, so the canvas shows the override (`viewport.cpp:1103-1105`)', () => {
    expect(sizesOf({ x: 1152, y: 648 }, true)).toEqual({
      render: { x: 800, y: 450 },
      target: { x: 800, y: 450 },
      layout: { x: 1152, y: 648 },
      view: { x: 1152, y: 648 },
    });
  });

  it('lays out in the override but draws the canvas 1:1 without the stretch (`:1212-1214`)', () => {
    expect(sizesOf({ x: 1152, y: 648 }, false)).toEqual({
      render: { x: 800, y: 450 },
      target: { x: 800, y: 450 },
      layout: { x: 1152, y: 648 },
      view: { x: 800, y: 450 },
    });
  });

  it('does not stretch an override with a zero axis, yet lays out in it', () => {
    expect(sizesOf({ x: 1152, y: 0 }, true)).toEqual({
      render: { x: 800, y: 450 },
      target: { x: 800, y: 450 },
      layout: { x: 1152, y: 0 },
      view: { x: 800, y: 450 },
    });
  });
});

describe('viewportSize', () => {
  it('floors each axis at 2 but leaves the ceiling to the GPU, as Godot does', () => {
    expect(viewportSize({ x: 1, y: 2000000000 }, null)).toEqual({ x: 2, y: 2000000000 });
  });
});

function windowNode(raw: Record<string, string>): TscnNode {
  const properties = parseWindow(heading('Window', { name: 'Win' }), { size: 'Vector2i(240, 160)', ...raw });
  return { name: 'Win', type: 'Window', children: [], properties } as unknown as TscnNode;
}

function subViewportNode(size: Vector2, size2dOverride: Vector2, stretches: boolean): TscnNode {
  const properties = { size, size_2d_override: size2dOverride, size_2d_override_stretch: stretches };
  return { name: 'View', type: 'SubViewport', children: [], properties } as unknown as TscnNode;
}

describe('viewportPassSizes: an embedded window', () => {
  it('renders at its size and shows its pixels over the content scale factor', () => {
    const node = windowNode({ content_scale_factor: '2.0' });
    expect(viewportPassSizes(node, null, 1)).toEqual({
      render: { x: 240, y: 160 },
      target: { x: 240, y: 160 },
      layout: { x: 120, y: 80 },
      view: { x: 120, y: 80 },
    });
  });
});

describe("viewportPassSizes: an embedded window under its embedder's stretch", () => {
  it('renders at the stretch and draws its canvas at the stretch times the factor (`window.cpp:1362-1367`)', () => {
    expect(viewportPassSizes(windowNode({ content_scale_factor: '2.0' }), null, 1.5)).toEqual({
      render: { x: 360, y: 240 },
      target: { x: 360, y: 240 },
      layout: { x: 120, y: 80 },
      view: { x: 120, y: 80 },
    });
  });

  it('rounds a fractional stretched size up, as `viewport_set_size` takes the ceiling (`window.cpp:1365`)', () => {
    expect(viewportPassSizes(windowNode({}), null, 1.25).render).toEqual({ x: 300, y: 200 });
    expect(viewportPassSizes(windowNode({ size: 'Vector2i(241, 161)' }), null, 1.25).render).toEqual({
      x: 302,
      y: 202,
    });
  });
});

describe('embedderStretch', () => {
  it("is the smaller axis of a stretched viewport's scale (`window.cpp:1363`)", () => {
    expect(embedderStretch(subViewportNode({ x: 1728, y: 1296 }, { x: 1152, y: 648 }, true), null)).toBe(1.5);
  });

  it('is 1 for a viewport whose override does not stretch', () => {
    expect(embedderStretch(subViewportNode({ x: 1728, y: 972 }, { x: 1152, y: 648 }, false), null)).toBe(1);
  });

  it("is a window's own stretch, from its size over its 2D override, not its embedder's", () => {
    expect(embedderStretch(windowNode({ content_scale_factor: '2.0' }), null)).toBe(2);
  });
});

describe('warnOfCappedTarget', () => {
  const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
  afterEach(() => warn.mockClear());

  function sizesOf(size: Vector2) {
    const properties = { size, size_2d_override: { x: 0, y: 0 }, size_2d_override_stretch: false };
    const node = { name: 'View', type: 'SubViewport', children: [], properties } as unknown as TscnNode;
    return viewportPassSizes(node, null, 1);
  }

  it('logs once for a path, over each rebuild of its node, the size Godot renders and the size WebGL draws', () => {
    warnOfCappedTarget('Root/Capped', sizesOf({ x: 65536, y: 100 }));
    warnOfCappedTarget('Root/Capped', sizesOf({ x: 65536, y: 100 }));
    expect(warn.mock.calls).toEqual([
      [
        `Root/Capped: the 65536 x 100 viewport is drawn at ${MAX_TEXTURE_EXTENT} x 100, the largest texture WebGL allocates`,
      ],
    ]);
  });

  it('logs nothing for a target under the cap', () => {
    warnOfCappedTarget('Root/Small', sizesOf({ x: 800, y: 450 }));
    expect(warn).not.toHaveBeenCalled();
  });
});

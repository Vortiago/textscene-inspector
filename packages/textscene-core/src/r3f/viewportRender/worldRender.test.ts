import { describe, expect, it } from 'vitest';
import { mipmapBiasUniform } from '../testing/mipmapBiasUniform';
import { rootViewportDescription } from './viewportDescription';
import { drawWorld, renderUnderWay, type WorldRender } from './worldRender';

function worldRender(mipmapBias: number): WorldRender {
  return {
    viewport: { ...rootViewportDescription(null), mipmapBias },
    shadowAtlas: null,
    hasCanvasTransform: false,
  };
}

describe('drawWorld', () => {
  it('makes the render passed the render under way while it draws', () => {
    const render = worldRender(0);
    let during: WorldRender | null = null;

    drawWorld(render, () => {
      during = renderUnderWay();
    });

    expect(during).toBe(render);
    expect(renderUnderWay()).toBeNull();
  });

  it('gives a nested draw its own render, and the outer one returns after', () => {
    const outer = worldRender(0);
    const inner = worldRender(0);
    const seen: (WorldRender | null)[] = [];

    drawWorld(outer, () => {
      drawWorld(inner, () => seen.push(renderUnderWay()));
      seen.push(renderUnderWay());
    });

    expect(seen).toEqual([inner, outer]);
  });

  it('restores the outer render when the draw throws (error case)', () => {
    const outer = worldRender(0);
    let afterThrow: WorldRender | null = null;

    drawWorld(outer, () => {
      expect(() =>
        drawWorld(worldRender(0), () => {
          throw new Error('pass failed');
        })
      ).toThrow('pass failed');
      afterThrow = renderUnderWay();
    });

    expect(afterThrow).toBe(outer);
  });

  it("samples every program at the viewport's bias while it draws, and the outer bias after", () => {
    const seen: number[] = [];

    drawWorld(worldRender(-0.5), () => {
      drawWorld(worldRender(1), () => seen.push(mipmapBiasUniform().value));
      seen.push(mipmapBiasUniform().value);
    });

    expect(seen).toEqual([1, -0.5]);
    expect(mipmapBiasUniform().value).toBe(0);
  });

  it('restores the bias when the draw throws (error case)', () => {
    expect(() =>
      drawWorld(worldRender(2), () => {
        throw new Error('pass failed');
      })
    ).toThrow('pass failed');

    expect(mipmapBiasUniform().value).toBe(0);
  });

  it('passes a bias beyond the -2..2 hint through unclamped (viewport.cpp:4904-4911)', () => {
    let seen = 0;

    drawWorld(worldRender(-7.5), () => {
      seen = mipmapBiasUniform().value;
    });

    expect(seen).toBe(-7.5);
  });
});

describe('renderUnderWay', () => {
  it('is null outside any draw (edge case)', () => {
    expect(renderUnderWay()).toBeNull();
  });
});

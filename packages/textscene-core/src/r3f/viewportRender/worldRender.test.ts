import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { renderHook } from '@testing-library/react';
import { mipmapBiasUniform } from '../testing/mipmapBiasUniform';
import { fakeCanvasRenderer } from '../testing/fakeCanvasRenderer';
import { useViewportAnisotropy } from '../viewportAnisotropy';
import { rootViewportDescription } from './viewportDescription';
import { drawWorld, renderClearsBlack, renderUnderWay, type WorldRender } from './worldRender';

function worldRender(mipmapBias: number): WorldRender {
  return {
    viewport: { ...rootViewportDescription(null), mipmapBias },
    shadowAtlas: null,
    canvasView: null,
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

describe('drawWorld and the anisotropic level', () => {
  function heldAnisotropicTexture() {
    const { gl, wrapper } = fakeCanvasRenderer({ isAllocated: true, maxAnisotropy: 16 });
    const texture = new THREE.Texture();
    texture.anisotropy = 4;
    renderHook(() => useViewportAnisotropy(texture), { wrapper });
    const lastTaps = () => gl.texParameterf.mock.calls.at(-1)?.[2] as number | undefined;
    return { lastTaps };
  }

  function render(anisotropicLevel: number, isCanvas: boolean): WorldRender {
    return {
      viewport: { ...rootViewportDescription(null), anisotropicLevel },
      shadowAtlas: null,
      canvasView: isCanvas ? { x: 1152, y: 648 } : null,
    };
  }

  it("samples a 3D draw at its viewport's level, and the root's again after it", () => {
    const { lastTaps } = heldAnisotropicTexture();
    const seen: (number | undefined)[] = [];

    drawWorld(render(1, false), () => {
      drawWorld(render(4, false), () => seen.push(lastTaps()));
      seen.push(lastTaps());
    });

    expect(seen).toEqual([16, 2]);
  });

  it("samples a canvas draw at Godot's default samplers, whatever its viewport's level", () => {
    const { lastTaps } = heldAnisotropicTexture();
    let seen: number | undefined;

    drawWorld(render(0, false), () => drawWorld(render(4, true), () => (seen = lastTaps())));

    expect(seen).toBe(4);
  });
});

describe('renderUnderWay', () => {
  it('is null outside any draw (edge case)', () => {
    expect(renderUnderWay()).toBeNull();
  });
});

describe('renderClearsBlack', () => {
  function clearsBlackWhileDrawing(facts: Partial<WorldRender['viewport']>): boolean {
    let clearsBlack = false;
    drawWorld({ ...worldRender(0), viewport: { ...worldRender(0).viewport, ...facts } }, () => {
      clearsBlack = renderClearsBlack();
    });
    return clearsBlack;
  }

  it('is false for an opaque viewport that asks for a clear', () => {
    expect(clearsBlackWhileDrawing({})).toBe(false);
  });

  it('is true for a transparent viewport', () => {
    expect(clearsBlackWhileDrawing({ transparentBackground: true })).toBe(true);
  });

  it('is true for a viewport that never asks for a clear (edge case)', () => {
    expect(clearsBlackWhileDrawing({ requestsClear: false })).toBe(true);
  });

  it('is false outside any render (error case)', () => {
    expect(renderClearsBlack()).toBe(false);
  });
});

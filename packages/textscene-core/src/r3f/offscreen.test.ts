import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import { drawOffscreen } from './offscreen';

/** The renderer state `drawOffscreen` saves and restores, with no WebGL behind it. */
class TargetRenderer {
  autoClear = true;
  target: unknown = 'screen';
  layer = 3;
  mipmapLevel = 1;

  getRenderTarget(): unknown {
    return this.target;
  }
  getActiveCubeFace(): number {
    return this.layer;
  }
  getActiveMipmapLevel(): number {
    return this.mipmapLevel;
  }
  setRenderTarget(target: unknown, layer = 0, mipmapLevel = 0): void {
    this.target = target;
    this.layer = layer;
    this.mipmapLevel = mipmapLevel;
  }

  get asWebGL(): THREE.WebGLRenderer {
    return this as unknown as THREE.WebGLRenderer;
  }
}

describe('drawOffscreen', () => {
  it('draws with autoClear off, then restores the target, its layer, its mip level and autoClear', () => {
    const renderer = new TargetRenderer();
    let autoClearWhileDrawing: boolean | undefined;

    drawOffscreen(renderer.asWebGL, () => {
      autoClearWhileDrawing = renderer.autoClear;
      renderer.setRenderTarget('pass');
    });

    expect(autoClearWhileDrawing).toBe(false);
    expect(renderer).toMatchObject({ autoClear: true, target: 'screen', layer: 3, mipmapLevel: 1 });
  });

  it('restores the renderer and rethrows when the draw throws (error case)', () => {
    const renderer = new TargetRenderer();

    expect(() =>
      drawOffscreen(renderer.asWebGL, () => {
        renderer.setRenderTarget('pass');
        throw new Error('expected a compiled program, got none');
      })
    ).toThrow('expected a compiled program');
    expect(renderer).toMatchObject({ autoClear: true, target: 'screen', layer: 3, mipmapLevel: 1 });
  });

  it('keeps autoClear off for a caller that had it off (edge case)', () => {
    const renderer = new TargetRenderer();
    renderer.autoClear = false;

    drawOffscreen(renderer.asWebGL, () => {});

    expect(renderer.autoClear).toBe(false);
  });
});

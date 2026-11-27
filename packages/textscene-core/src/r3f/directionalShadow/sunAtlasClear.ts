import type * as THREE from 'three';
import { isDirectionalShadowAtlas } from './shadowAtlas.js';

/** Lets one whole clear of the sun atlas through per pass. three clears before each light (r187 `:340`). */
export class SunAtlasClears {
  private clear: THREE.WebGLRenderer['clear'];
  private isCleared = false;

  constructor(private readonly renderer: THREE.WebGLRenderer) {
    this.clear = renderer.clear;
  }

  /** On top of every other clear hook, so a frame profile counts only the clears that reach the GPU. */
  start(): void {
    this.clear = this.renderer.clear;
    this.isCleared = false;
    this.renderer.clear = this.clearOnce;
  }

  end(): void {
    if (this.renderer.clear === this.clearOnce) this.renderer.clear = this.clear;
  }

  private readonly clearOnce: THREE.WebGLRenderer['clear'] = (color, depth, stencil) => {
    if (isDirectionalShadowAtlas(this.renderer.getRenderTarget())) {
      if (this.isCleared) return;
      this.isCleared = true;
    }
    this.clear.call(this.renderer, color, depth, stencil);
  };
}

import type * as THREE from 'three';

/** Lets one unscissored atlas clear through per pass. three clears per light (`WebGLShadowMap.js:340`). */
export class OneAtlasClear {
  private clear: THREE.WebGLRenderer['clear'];
  private isCleared = false;

  constructor(
    private readonly renderer: THREE.WebGLRenderer,
    private readonly isAtlas: (target: THREE.WebGLRenderTarget | null) => boolean
  ) {
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
    const target = this.renderer.getRenderTarget();
    if (!this.isAtlas(target)) return this.clear.call(this.renderer, color, depth, stencil);
    if (this.isCleared) return;
    this.isCleared = true;
    this.renderer.state.setScissorTest(false);
    try {
      this.clear.call(this.renderer, color, depth, stencil);
    } finally {
      this.renderer.state.setScissorTest(target!.scissorTest);
    }
  };
}

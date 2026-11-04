/**
 * The buffers one world buffer keeps for one screen-space pass, built again whenever the shape the
 * pass asks for differs from the shape they were built at.
 */

import type * as THREE from 'three';
import { sameData } from '../../utils/sameData.js';

interface ShapedBuffers<Shape> {
  readonly shape: Shape;
  dispose(): void;
}

export class FittedBuffers<Shape, Buffers extends ShapedBuffers<Shape>> {
  private buffers: Buffers | null = null;

  /**
   * `build` makes the buffers at a shape. `leave` takes a slot off them before they go, as binding
   * a deleted texture is an error.
   */
  constructor(
    private readonly build: (renderer: THREE.WebGLRenderer, shape: Shape) => Buffers,
    private readonly leave: (renderer: THREE.WebGLRenderer, buffers: Buffers) => void = () => {}
  ) {}

  /** The buffers of the last fit, or null before the first. */
  get current(): Buffers | null {
    return this.buffers;
  }

  /** The buffers at `shape`: the current ones where they were built at it, else new ones. */
  fit(renderer: THREE.WebGLRenderer, shape: Shape): Buffers {
    if (this.buffers && sameData(this.buffers.shape, shape)) return this.buffers;
    this.release(renderer);
    this.buffers = this.build(renderer, shape);
    return this.buffers;
  }

  release(renderer: THREE.WebGLRenderer): void {
    if (!this.buffers) return;
    this.leave(renderer, this.buffers);
    this.buffers.dispose();
    this.buffers = null;
  }
}

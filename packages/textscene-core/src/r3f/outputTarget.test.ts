import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { takeOutputLikeDrawingBuffer, takesOutputLikeDrawingBuffer } from './outputTarget';

describe('takeOutputLikeDrawingBuffer', () => {
  it('flags the target so three tonemaps and encodes into it', () => {
    const target = new THREE.WebGLRenderTarget(4, 4);
    takeOutputLikeDrawingBuffer(target);
    expect((target as THREE.WebGLRenderTarget & { isXRRenderTarget?: boolean }).isXRRenderTarget).toBe(true);
    target.dispose();
  });
});

describe('takesOutputLikeDrawingBuffer', () => {
  it('reads a target that takeOutputLikeDrawingBuffer flagged', () => {
    const target = new THREE.WebGLRenderTarget(4, 4);
    takeOutputLikeDrawingBuffer(target);
    expect(takesOutputLikeDrawingBuffer(target)).toBe(true);
    target.dispose();
  });

  it('reads a plain target as one that keeps three output unencoded (edge case)', () => {
    const target = new THREE.WebGLRenderTarget(4, 4);
    expect(takesOutputLikeDrawingBuffer(target)).toBe(false);
    target.dispose();
  });
});

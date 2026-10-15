import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { takeOutputLikeDrawingBuffer } from './outputTarget';

describe('takeOutputLikeDrawingBuffer', () => {
  it('flags the target so three tonemaps and encodes into it', () => {
    const target = new THREE.WebGLRenderTarget(4, 4);
    takeOutputLikeDrawingBuffer(target);
    expect((target as THREE.WebGLRenderTarget & { isXRRenderTarget?: boolean }).isXRRenderTarget).toBe(true);
    target.dispose();
  });
});

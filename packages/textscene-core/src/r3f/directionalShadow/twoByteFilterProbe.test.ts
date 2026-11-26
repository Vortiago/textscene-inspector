import type * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { filtersTwoBytesExactly, isFullPrecisionByte, measuredProbeByte } from './twoByteFilterProbe.js';

/** A renderer whose probe draw reads `byte` back. */
function rendererReading(byte: number): THREE.WebGLRenderer {
  return {
    getRenderTarget: () => null,
    setRenderTarget: () => {},
    render: () => {},
    readRenderTargetPixels: (...args: unknown[]) => ((args[5] as Uint8Array)[0] = byte),
  } as unknown as THREE.WebGLRenderer;
}

describe('the two-byte filter probe', () => {
  it('reads half a depth step as a full-precision filter', () => {
    expect(isFullPrecisionByte(128)).toBe(true);
  });

  it('reads a whole depth as a filter that rounds each byte to 8 bits', () => {
    expect([isFullPrecisionByte(0), isFullPrecisionByte(255)]).toEqual([false, false]);
  });
});

describe('measuredProbeByte', () => {
  it('gives the byte the probe read on the renderer', () => {
    const renderer = rendererReading(127);
    filtersTwoBytesExactly(renderer);

    expect(measuredProbeByte(renderer)).toBe(127);
  });

  it('gives nothing for a renderer the probe has not run on (edge case)', () => {
    expect(measuredProbeByte(rendererReading(128))).toBeNull();
  });
});

/**
 * A fake WebGL 2 context for the hooks that read the device: the 3D passes take it for a real GL
 * context, and the MSAA hooks read the sample counts it lists per renderbuffer format.
 */

import * as THREE from 'three';

/** WebGL 2 renderbuffer internal formats. */
export const RGBA8 = 0x8058;
export const SRGB8_ALPHA8 = 0x8c43;
export const RGBA16F = 0x881a;
export const DEPTH_COMPONENT24 = 0x81a6;

interface FakeContextOptions {
  /** The sample counts listed per format. A format with no entry lists none. */
  counts?: Record<number, number[]>;
  /** Collects each format a caller queries, in order. */
  queries?: number[];
  /** Lost while `current` is true, when every query answers null. */
  lost?: { current: boolean };
}

export function fakeWebGL2Context({
  counts = {},
  queries = [],
  lost = { current: false },
}: FakeContextOptions = {}): object {
  return {
    RENDERBUFFER: 0x8d41,
    SAMPLES: 0x80a9,
    RGBA8,
    SRGB8_ALPHA8,
    RGBA16F,
    DEPTH_COMPONENT24,
    getContextAttributes: () => ({}),
    isContextLost: () => lost.current,
    getInternalformatParameter: (_target: number, format: number) => {
      queries.push(format);
      return lost.current ? null : Int32Array.from(counts[format] ?? []);
    },
  };
}

/** A test-renderer `gl` factory whose renderer answers `context`, or its own when null. */
export function rendererOver(context: object | null) {
  return (defaults: THREE.WebGLRendererParameters): THREE.WebGLRenderer => {
    const gl = new THREE.WebGLRenderer(defaults);
    if (context) gl.getContext = () => context as WebGL2RenderingContext;
    return gl;
  };
}

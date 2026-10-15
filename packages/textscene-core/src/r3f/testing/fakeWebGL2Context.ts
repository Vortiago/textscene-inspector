/** A stand-in WebGL 2 context that lists multisample counts, and a test renderer drawing over it. */
import * as THREE from 'three';

/** The renderbuffer formats a sample-count query names, by their WebGL 2 enum. */
const RENDERBUFFER_FORMATS = {
  RGBA8: 0x8058,
  RGBA16F: 0x881a,
  SRGB8_ALPHA8: 0x8c43,
  DEPTH_COMPONENT24: 0x81a6,
} as const;

export type RenderbufferFormat = keyof typeof RENDERBUFFER_FORMATS;

const FORMAT_BY_ENUM = new Map<number, RenderbufferFormat>(
  (Object.keys(RENDERBUFFER_FORMATS) as RenderbufferFormat[]).map((format) => [
    RENDERBUFFER_FORMATS[format],
    format,
  ])
);

export interface FakeContextOptions {
  /** Receives each format the context is asked for, in order. */
  queries?: RenderbufferFormat[];
  /** The context is lost while `current` holds, and then lists no counts. */
  lost?: { current: boolean };
}

/**
 * A context that lists `counts` as the samples each renderbuffer format supports, and none for a
 * format `counts` leaves out. It reports attributes, as a real context does.
 */
export function fakeWebGL2Context(
  counts: Partial<Record<RenderbufferFormat, number[]>>,
  { queries = [], lost = { current: false } }: FakeContextOptions = {}
): WebGL2RenderingContext {
  const context = {
    RENDERBUFFER: 0x8d41,
    SAMPLES: 0x80a9,
    ...RENDERBUFFER_FORMATS,
    getContextAttributes: () => ({}),
    isContextLost: () => lost.current,
    getInternalformatParameter: (_target: number, glEnum: number) => {
      const format = FORMAT_BY_ENUM.get(glEnum);
      if (format) queries.push(format);
      return lost.current ? null : Int32Array.from((format && counts[format]) ?? []);
    },
  };
  return context as unknown as WebGL2RenderingContext;
}

/** The test renderer's `gl` option for a renderer whose context is `context`. */
export function rendererOver(context: object) {
  return (defaults: THREE.WebGLRendererParameters): THREE.WebGLRenderer => {
    const gl = new THREE.WebGLRenderer(defaults);
    gl.getContext = () => context as WebGL2RenderingContext;
    return gl;
  };
}

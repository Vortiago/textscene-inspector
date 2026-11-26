import type * as THREE from 'three';
import type { StoredDepthRead } from '../../shaders/spatial/directionalShadowDepth.js';
import { glRendererName } from '../../shaders/pipeline/glRendererName.js';
import { storedDepthRead } from '../directionalShadow/storedDepthRead.js';
import { measuredProbeByte } from '../directionalShadow/twoByteFilterProbe.js';

/** The GPU features a read of the sun's stored depth depends on (ADR-0094). */
export interface StoredDepthFeatures {
  /** `OES_texture_float_linear`: a float colour filters. */
  floatLinear: boolean;
  /** `EXT_color_buffer_float`: a draw writes a float colour. */
  floatRender: boolean;
  /** `EXT_texture_norm16`: a 16-bit normalised colour exists. */
  norm16: boolean;
  /** The probe's filtered byte, 128 on an exact filter and 0 on an 8-bit one, or null before it ran. */
  probeByte: number | null;
}

/** The page and GPU a frame recording ran on, so one paste explains its own cost. */
export interface RecordedDevice {
  /** The GPU the browser names, or null when it names none. */
  gpu: string | null;
  url: string;
  /** The drawing buffer, in device pixels, which a per-pixel cost scales with. */
  canvas: { width: number; height: number; pixelRatio: number };
  /** The read of the sun's stored depth the page picked for that GPU. */
  storedDepthRead: StoredDepthRead;
  features: StoredDepthFeatures;
}

export function recordedDevice(renderer: THREE.WebGLRenderer): RecordedDevice {
  const gl = renderer.getContext() as WebGL2RenderingContext;
  const extensions = new Set(gl.getSupportedExtensions() ?? []);
  return {
    gpu: glRendererName(gl),
    url: typeof window === 'undefined' ? '' : window.location.href,
    canvas: {
      width: renderer.domElement.width,
      height: renderer.domElement.height,
      pixelRatio: renderer.getPixelRatio(),
    },
    storedDepthRead: storedDepthRead(),
    features: {
      floatLinear: extensions.has('OES_texture_float_linear'),
      floatRender: extensions.has('EXT_color_buffer_float'),
      norm16: extensions.has('EXT_texture_norm16'),
      probeByte: measuredProbeByte(renderer),
    },
  };
}

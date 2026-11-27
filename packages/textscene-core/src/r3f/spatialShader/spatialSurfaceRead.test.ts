import type * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { SpatialOptions } from '../../shaders/spatial/transpileSpatial.js';
import type { SurfaceShader } from './surfaceShader.js';

const renderer = {} as THREE.WebGLRenderer;
const compiled: { options?: SpatialOptions } = {};

vi.mock('../directionalShadow/storedDepthRead.js', () => ({
  decideStoredDepthRead: (gl: THREE.WebGLRenderer) => (gl === renderer ? 'float' : 'fetched'),
  storedDepthRead: () => 'fetched',
}));

vi.mock('../../shaders/spatial/compileSpatial.js', () => ({
  compileSpatial: (_code: string, options: SpatialOptions) => {
    compiled.options = options;
    throw new Error('compiled');
  },
}));

const { spatialSurfaceOf } = await import('./spatialSurface.js');

describe('spatialSurfaceOf', () => {
  it('compiles the read its own renderer decides, before any canvas decides one (edge case)', () => {
    const shader = {
      code: '',
      file: 'a.gdshader',
      generatedFor: null,
      textures: {},
    } as unknown as SurfaceShader;
    expect(() => spatialSurfaceOf(renderer, shader, { roughnessLimiter: undefined } as never)).toThrow(
      'compiled'
    );
    expect(compiled.options?.storedDepthRead).toBe('float');
  });
});

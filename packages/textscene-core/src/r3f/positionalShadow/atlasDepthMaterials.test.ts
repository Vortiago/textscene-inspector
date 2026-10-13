import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { ProgramShader } from '../materialProgramInputs';
import { surfaceDepthMaterial } from '../materials/surfaceDepthMaterial';
import { AtlasDepthMaterial, ParaboloidDepthMaterial } from './atlasDepthMaterials';

/** The depth program as `depth`'s `onBeforeCompile` leaves it. */
function compiled(depth: THREE.Material): ProgramShader {
  const shader: ProgramShader = { ...THREE.ShaderLib.depth, uniforms: {} };
  depth.onBeforeCompile.call(depth, shader as THREE.WebGLProgramParametersWithUniforms, undefined as never);
  return shader;
}

const PACKED_DEPTH = /gl_FragColor = vec4\( packAtlasDepth\( gl_FragCoord\.z \), 0\.0, 1\.0 \);\s*}\s*$/;

describe('AtlasDepthMaterial', () => {
  it('writes the 16-bit depth the atlas stores into its colour, for the blocker search', () => {
    expect(compiled(new AtlasDepthMaterial()).fragmentShader).toMatch(PACKED_DEPTH);
  });

  it('keeps three’s own projection (edge case)', () => {
    expect(compiled(new AtlasDepthMaterial()).vertexShader).toBe(THREE.ShaderLib.depth.vertexShader);
  });

  it('keeps the packing in the copy that cuts a surface’s alpha (edge case)', () => {
    const copy = surfaceDepthMaterial(new THREE.MeshBasicMaterial(), new AtlasDepthMaterial());
    expect(compiled(copy).fragmentShader).toMatch(PACKED_DEPTH);
  });

  it('compiles apart from three’s own depth material (error case)', () => {
    expect(new AtlasDepthMaterial().customProgramCacheKey()).not.toBe(
      new THREE.MeshDepthMaterial().customProgramCacheKey()
    );
  });
});

describe('ParaboloidDepthMaterial', () => {
  it('bends each vertex onto the paraboloid after three projects it', () => {
    const { vertexShader } = compiled(new ParaboloidDepthMaterial());
    expect(vertexShader).toMatch(/#include <project_vertex>\s*vec3 paraboloidVertex = mvPosition\.xyz;/);
    expect(vertexShader).toContain('paraboloidVertex.xy /= 1.0 - paraboloidVertex.z;');
    expect(vertexShader).toContain(
      'gl_Position = projectionMatrix * vec4( paraboloidVertex.xy, paraboloidDistance, 1.0 );'
    );
  });

  it('draws nothing behind the light (edge case)', () => {
    const { vertexShader, fragmentShader } = compiled(new ParaboloidDepthMaterial());
    expect(vertexShader).toContain('paraboloidSide = mvPosition.z;');
    expect(fragmentShader).toContain('if ( paraboloidSide > 0.0 ) discard;');
  });

  it('writes the 16-bit depth the atlas stores into its colour, for the blocker search', () => {
    expect(compiled(new ParaboloidDepthMaterial()).fragmentShader).toMatch(PACKED_DEPTH);
  });

  it('keeps the bend in a copy (edge case)', () => {
    const copy = new ParaboloidDepthMaterial().clone();
    expect(compiled(copy).vertexShader).toContain('paraboloidVertex');
    expect(copy.customProgramCacheKey()).toBe(new ParaboloidDepthMaterial().customProgramCacheKey());
  });

  it('keeps the bend in the copy that cuts a surface’s alpha (edge case)', () => {
    const copy = surfaceDepthMaterial(new THREE.MeshBasicMaterial(), new ParaboloidDepthMaterial());
    const { vertexShader, fragmentShader } = compiled(copy);
    expect(vertexShader).toContain('paraboloidVertex');
    expect(fragmentShader).toContain('#include <color_fragment>');
  });

  it('compiles apart from the atlas’s plain depth material (error case)', () => {
    expect(new ParaboloidDepthMaterial().customProgramCacheKey()).not.toBe(
      new AtlasDepthMaterial().customProgramCacheKey()
    );
  });
});

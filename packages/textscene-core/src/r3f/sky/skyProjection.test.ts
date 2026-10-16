/**
 * The cube background spreads the sky as Godot's sky pass does under an orthographic camera. The
 * tests read the installed three, so a release that rewrites the replaced line fails here.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { installSkyProjection } from './skyProjection';
import { warningsOf } from '../testing/logWarnings';

const threeCubeVertex = THREE.ShaderChunk.backgroundCube_vert;
const backgroundCube = THREE.ShaderLib.backgroundCube!;
const threeCubeProgramVertex = backgroundCube.vertexShader;

afterEach(() => {
  THREE.ShaderChunk.backgroundCube_vert = threeCubeVertex;
  backgroundCube.vertexShader = threeCubeProgramVertex;
});

describe('installSkyProjection', () => {
  it('projects the cube through the projection scale under an orthographic camera', () => {
    installSkyProjection();
    expect(THREE.ShaderChunk.backgroundCube_vert).toContain('if ( isOrthographic )');
    expect(THREE.ShaderChunk.backgroundCube_vert).toContain('- mvPosition.z );');
  });

  it('hands the patched vertex to the program three compiles', () => {
    installSkyProjection();
    expect(backgroundCube.vertexShader).toBe(THREE.ShaderChunk.backgroundCube_vert);
  });

  it('keeps the far-plane depth after the projection', () => {
    installSkyProjection();
    const vertex = THREE.ShaderChunk.backgroundCube_vert;
    expect(vertex.indexOf('gl_Position.z = gl_Position.w;')).toBeGreaterThan(
      vertex.indexOf('isOrthographic')
    );
  });

  it('changes nothing on a second call (edge case)', () => {
    installSkyProjection();
    const once = THREE.ShaderChunk.backgroundCube_vert;
    installSkyProjection();
    expect(THREE.ShaderChunk.backgroundCube_vert).toBe(once);
  });

  it('keeps three’s vertex and warns when three lacks the far-plane line (error case)', () => {
    THREE.ShaderChunk.backgroundCube_vert = 'void main() {}';
    const warnings = warningsOf(() => installSkyProjection());
    expect(THREE.ShaderChunk.backgroundCube_vert).toBe('void main() {}');
    expect(warnings.join('\n')).toContain('backgroundCube_vert');
  });
});

/**
 * The program of a normal-mapped canvas item, read from the produced GLSL, since happy-dom has no
 * GPU (the `unit-*-normal-map*` goldens check pixels): each light kept apart is shaded by the
 * item's normal in Godot's order, from uniform objects the caller owns.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { normalMappedLightingProps } from './normalMappedLighting';
import { normalMappedUniforms } from './testing/lightUniforms';

/** Stand-ins for the three chunks the injection rewrites around. */
const STOCK_VERTEX = `
void main() {
  #include <project_vertex>
}
`;
const STOCK_FRAGMENT = `
void main() {
  gl_FragColor = vec4(1.0);
  #include <colorspace_fragment>
}
`;

function compile(lightCount: number, isLinearCanvas = false) {
  const shared = normalMappedUniforms();
  const props = normalMappedLightingProps(shared, lightCount, isLinearCanvas);
  const shader = {
    vertexShader: STOCK_VERTEX,
    fragmentShader: STOCK_FRAGMENT,
    uniforms: {} as Record<string, THREE.IUniform>,
  };
  props.injection.onBeforeCompile.call(new THREE.MeshBasicMaterial(), shader);
  return { props, shader, shared };
}

describe('normalMappedLightingProps', () => {
  it('defines the linear canvas at compile time, with a program key of its own', () => {
    const linear = compile(2, true);
    expect(linear.shader.fragmentShader).toContain('#define LINEAR_CANVAS\n');
    expect(compile(2).shader.fragmentShader).not.toContain('#define LINEAR_CANVAS');
    expect(linear.props.injection.cacheKey).not.toBe(compile(2).props.injection.cacheKey);
  });

  it('sizes the light loop and its arrays to the lights kept apart', () => {
    const { shader } = compile(3);
    expect(shader.fragmentShader).toContain('#define APART_LIGHT_COUNT 3');
    expect(shader.fragmentShader).toContain('uniform vec3 uLightPlaces[APART_LIGHT_COUNT];');
    expect(shader.fragmentShader).toMatch(/for \(int i = 0; i < APART_LIGHT_COUNT; i\+\+\)/);
  });

  it('reads each light from its own layer at the fragment', () => {
    const { shader } = compile(2);
    expect(shader.fragmentShader).toContain('texture(uLightLayers, vec3(lightUv, float(i)))');
  });

  it("reads a light's shadow_color from the tint layer its mode names, and none for -1", () => {
    const { shader } = compile(2);
    expect(shader.fragmentShader).toContain(
      'tintLayer < 0.0 ? vec3(0.0) : texture(uShadowTintLayers, vec3(lightUv, tintLayer)).rgb'
    );
  });

  it("ports light_normal_compute's Blinn term", () => {
    // canvas.glsl:474-494.
    const { shader } = compile(1);
    expect(shader.fragmentShader).toContain('exp2(15.0 * specular.a + 1.0) * 0.25');
    expect(shader.fragmentShader).toContain('max(4.0 * cNdotV * cNdotL, 0.75)');
  });

  it("hands the fragment its canvas position and the item's axes", () => {
    const { shader } = compile(1);
    expect(shader.vertexShader).toContain('vCanvasPosition = (modelMatrix * vec4(transformed, 1.0)).xy;');
    expect(shader.vertexShader).toContain('normalize(modelMatrix[0].xy)');
  });

  it("samples the maps where a padded tile's diffuse is clamped (tile_set.cpp:5622-5671)", () => {
    const { fragmentShader } = compile(1).shader;
    expect(fragmentShader).toContain('#ifdef TILE_UV_BOUNDS');
    expect(fragmentShader).toContain('clamp(vMapUv, vTileUvBounds.xy, vTileUvBounds.zw)');
    expect(fragmentShader).toContain('texture2D(uNormalMap, surfaceUv())');
    expect(fragmentShader).toContain('texture2D(uSpecularMap, surfaceUv())');
  });

  it("turns the normal by a tile's flips and transpose, transposed first (canvas.glsl:655-661)", () => {
    const { fragmentShader } = compile(1).shader;
    const orientation = fragmentShader.slice(fragmentShader.indexOf('#ifdef TILE_NORMAL_ORIENTATION'));
    expect(orientation.indexOf('normal.xy = -normal.yx;')).toBeGreaterThan(-1);
    expect(orientation.indexOf('normal.x = -normal.x;')).toBeGreaterThan(
      orientation.indexOf('normal.xy = -normal.yx;')
    );
    expect(orientation.indexOf('normal.y = -normal.y;')).toBeGreaterThan(
      orientation.indexOf('normal.xy = -normal.yx;')
    );
  });

  it('keys the program on the light count, which sizes it', () => {
    expect(compile(2).props.injection.cacheKey).not.toBe(compile(3).props.injection.cacheKey);
  });

  it("binds the caller's uniform objects, so later values reach the GPU", () => {
    const { shader, shared } = compile(1);
    expect(shader.uniforms.uLightLayers).toBe(shared.lightLayers);
    expect(shader.uniforms.uShadowTintLayers).toBe(shared.shadowTintLayers);
    expect(shader.uniforms.uLightPlaces).toBe(shared.places);
    expect(shader.uniforms.uLightModes).toBe(shared.modes);
    expect(shader.uniforms.uNormalMap).toBe(shared.normalMap);
    expect(shader.uniforms.uSpecularMap).toBe(shared.specularMap);
    expect(shader.uniforms.uSpecular).toBe(shared.specular);
    expect(shader.uniforms.uUsesSpecular).toBe(shared.usesSpecular);
    expect(shader.uniforms.uCanvasModulate).toBe(shared.canvasModulate);
  });

  it('forces the item transparent, as Light Only masks its alpha', () => {
    expect(compile(1).props.transparent).toBe(true);
  });
});

/**
 * The canvas-item side of the 2D light pass, read from the produced GLSL, since happy-dom has no
 * GPU (`unit-pointlight2d*` captures check pixels): the light path is present, gated by data not
 * compilation, with one list buffer and three distinct light modes.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';

import { canvasItemLightingProps, CANVAS_MODULATE_FLOOR } from './canvasItemLighting';
import { CanvasItemMaterialLightMode } from '../../godot/scene/canvasItemMaterial';
import { lightUniforms } from './testing/lightUniforms';
import type { EnumValue } from '../../godot/classdb/enumNames.js';

/** A stand-in for the three fragments the injection rewrites around. */
const STOCK_FRAGMENT = `
void main() {
  vec4 diffuseColor = vec4(1.0);
  gl_FragColor = diffuseColor;
  #include <colorspace_fragment>
}
`;

function compile(lightMode: EnumValue<typeof CanvasItemMaterialLightMode>) {
  const shared = lightUniforms();
  shared.lightMode.value = lightMode;
  const props = canvasItemLightingProps(shared);
  const shader = {
    vertexShader: '',
    fragmentShader: STOCK_FRAGMENT,
    uniforms: {} as Record<string, THREE.IUniform>,
  };
  props.injection.onBeforeCompile.call(new THREE.MeshBasicMaterial(), shader);
  return { props, shader, shared };
}

describe('canvasItemLightingProps', () => {
  it('injects the light path for an ordinary item', () => {
    const { props, shader } = compile(CanvasItemMaterialLightMode.NORMAL);
    expect(props.injection.onBeforeCompile).toBeTypeOf('function');
    expect(shader.fragmentShader).toContain('uniform sampler2D uLightList;');
    expect(shader.fragmentShader).toContain('texture2D(uLightList, lightUv)');
    // The lookup is screen-space: the accumulator is one buffer under the whole
    // canvas, not a per-item texture.
    expect(shader.fragmentShader).toContain('gl_FragCoord.xy / uLightResolution');
  });

  it('reads one list buffer, which already applies every light in order', () => {
    // A sum of per-light-group buffers would add a MIX light to the light under it.
    const { shader } = compile(CanvasItemMaterialLightMode.NORMAL);
    expect(shader.fragmentShader.match(/texture2D\(uLightList,/g)).toHaveLength(1);
    expect(shader.fragmentShader).not.toMatch(/for\s*\(/);
  });

  it("binds the caller's uniform OBJECTS, so later values reach the GPU", () => {
    // three captures what onBeforeCompile assigns at first compile and R3F never sets
    // material.needsUpdate, so a rebuilt uniform object is stranded: the identity is the contract.
    const { shader, shared } = compile(CanvasItemMaterialLightMode.NORMAL);
    expect(shader.uniforms.uLightList).toBe(shared.lightBuffer);
    expect(shader.uniforms.uShadowTint).toBe(shared.shadowTintBuffer);
    expect(shader.uniforms.uLit).toBe(shared.isLit);
    expect(shader.uniforms.uLightResolution).toBe(shared.resolution);
    expect(shader.uniforms.uCanvasModulate).toBe(shared.canvasModulate);
  });

  it('gates "no lights" with a uniform rather than a different program', () => {
    // A light registers after the items compile, so a light path compiled only once a light
    // exists leaves mounted items on a stock shader.
    const { shader } = compile(CanvasItemMaterialLightMode.NORMAL);
    expect(shader.fragmentShader).toContain('uniform float uLit;');
    expect(shader.fragmentShader).toContain(
      'uLit > 0.5 ? texture2D(uLightList, lightUv) : vec4(lightSeed, 0.0)'
    );
  });

  it('starts an unlit item from the seed', () => {
    const { shader } = compile(CanvasItemMaterialLightMode.NORMAL);
    expect(shader.fragmentShader).toContain('lightOnly ? vec3(1.0) : uCanvasModulate');
  });

  it('recovers the albedo through a FLOORED divisor, so a black canvas tint still lights', () => {
    const { shader } = compile(CanvasItemMaterialLightMode.NORMAL);
    expect(shader.fragmentShader).toContain(`max(lightSeed, vec3(${CANVAS_MODULATE_FLOOR}))`);
    expect(CANVAS_MODULATE_FLOOR).toBeGreaterThan(0);
    // Below one 8-bit step, so the floor cannot show on screen.
    expect(CANVAS_MODULATE_FLOOR).toBeLessThanOrEqual(1 / 255);
  });

  it("clamps in Godot's space before handing the fragment back to three", () => {
    // Godot's framebuffer clamps after the light is multiplied into the albedo, which is why the
    // accumulation is unclamped half-float. The shadow_color term joins inside that clamp and
    // outside the albedo multiply, where `light_shadow_compute` puts it.
    const { shader } = compile(CanvasItemMaterialLightMode.NORMAL);
    expect(shader.fragmentShader).toContain('clamp(albedo * accum.rgb + shadowTint, 0.0, 1.0)');
    expect(shader.fragmentShader).toContain('#include <colorspace_fragment>');
  });

  it('declares the mode uniform, so a light_mode edit reaches the GPU', () => {
    const { shader, shared } = compile(CanvasItemMaterialLightMode.NORMAL);
    expect(shader.uniforms.uLightMode).toBe(shared.lightMode);
    expect(shader.fragmentShader).toContain('uniform float uLightMode;');
  });

  it('leaves an Unshaded fragment untouched: no canvas tint, no light loop', () => {
    // canvas.glsl:715, :719: MODE_UNSHADED skips both.
    const { shader } = compile(CanvasItemMaterialLightMode.UNSHADED);
    const guard = shader.fragmentShader.indexOf('if (!unshaded &&');
    expect(guard).toBeGreaterThan(-1);
    // Every write the injection makes is inside that guard.
    expect(shader.fragmentShader.indexOf('gl_FragColor.rgb = godotToLinear')).toBeGreaterThan(guard);
    expect(shader.fragmentShader.indexOf('gl_FragColor.a = clamp')).toBeGreaterThan(guard);
  });

  it('leaves the fragment as it arrived while no light reaches the item', () => {
    const { shader } = compile(CanvasItemMaterialLightMode.NORMAL);
    expect(shader.fragmentShader).toContain('if (!unshaded && (uLit > 0.5 || lightOnly)) {');
  });

  it('masks a Light Only item by the summed cookie coverage', () => {
    const { props, shader } = compile(CanvasItemMaterialLightMode.LIGHT_ONLY);
    expect(shader.fragmentShader).toContain('gl_FragColor.a = clamp(gl_FragColor.a * accum.a');
    // Unconditional: `transparent` decides three's `OPAQUE` define.
    expect(props.transparent).toBe(true);
  });

  it('reads an unmodulated seed for a Light Only item, which skips the canvas tint', () => {
    const { shader } = compile(CanvasItemMaterialLightMode.LIGHT_ONLY);
    // Both seeds live in one program and `uLightMode` picks at runtime. The divide-out is by the
    // seed, so Light Only's 1.0 makes it a no-op.
    expect(shader.fragmentShader).toContain('lightOnly ? vec3(1.0) : uCanvasModulate');
    expect(shader.fragmentShader).toContain('godotToSrgb(gl_FragColor.rgb) / max(lightSeed');
  });

  it('throws, naming the hook, for a shader with no colorspace hook (error case)', () => {
    const props = canvasItemLightingProps(lightUniforms());
    const shader = {
      vertexShader: '',
      fragmentShader: 'void other() {}',
      uniforms: {} as Record<string, THREE.IUniform>,
    };
    expect(() => props.injection.onBeforeCompile.call(new THREE.MeshBasicMaterial(), shader)).toThrow(
      'expected the fragment shader of the canvas item lighting to hold "void main() {" once'
    );
  });
});

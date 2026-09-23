/**
 * The canvas-item side of the 2D light pass, read from the produced GLSL, since happy-dom has no
 * GPU (`unit-pointlight2d*` captures check pixels): the light path is present, gated by data not
 * compilation, with unrolled slots and three distinct light modes.
 */

import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { CanvasItemLightMode } from '../../resources/materials/canvasitemmaterial/types';
import { MAX_LIGHT_CLASSES } from './CanvasLighting2D';
import {
  canvasItemLightingProps,
  lightClassSampler,
  CANVAS_MODULATE_FLOOR,
  type CanvasItemLightingUniforms,
} from './canvasItemLighting';

/** A stand-in for the three fragments the injection rewrites around. */
const STOCK_FRAGMENT = `
void main() {
  vec4 diffuseColor = vec4(1.0);
  gl_FragColor = diffuseColor;
  #include <colorspace_fragment>
}
`;

function uniforms(): CanvasItemLightingUniforms {
  return {
    classBuffers: Array.from({ length: MAX_LIGHT_CLASSES }, () => ({
      value: new THREE.Texture(),
    })),
    shadowTintBuffers: Array.from({ length: MAX_LIGHT_CLASSES }, () => ({
      value: new THREE.Texture(),
    })),
    classWeights: { value: new Array<number>(MAX_LIGHT_CLASSES).fill(0) },
    resolution: { value: new THREE.Vector2(2, 2) },
    canvasModulate: { value: new THREE.Vector3(1, 1, 1) },
    lightMode: { value: CanvasItemLightMode.NORMAL },
  };
}

function compile(lightMode: CanvasItemLightMode) {
  const shared = uniforms();
  shared.lightMode.value = lightMode;
  const props = canvasItemLightingProps(shared);
  const shader = {
    vertexShader: '',
    fragmentShader: STOCK_FRAGMENT,
    uniforms: {} as Record<string, THREE.IUniform>,
  };
  props.injection.onBeforeCompile(shader);
  return { props, shader, shared };
}

describe('canvasItemLightingProps', () => {
  it('injects the light path for an ordinary item', () => {
    const { props, shader } = compile(CanvasItemLightMode.NORMAL);
    expect(props.injection.onBeforeCompile).toBeTypeOf('function');
    expect(shader.fragmentShader).toContain('uniform sampler2D uLightClass0;');
    expect(shader.fragmentShader).toContain('texture2D(uLightClass0,');
    // The lookup is screen-space: the accumulator is one buffer under the whole
    // canvas, not a per-item texture.
    expect(shader.fragmentShader).toContain('gl_FragCoord.xy / uLightResolution');
  });

  it('unrolls one sampler per class slot, never a loop-indexed array', () => {
    // GLSL ES 1.00, what three compiles an onBeforeCompile injection as,
    // cannot index a sampler by a runtime value.
    const { shader } = compile(CanvasItemLightMode.NORMAL);
    for (let slot = 0; slot < MAX_LIGHT_CLASSES; slot += 1) {
      expect(shader.fragmentShader).toContain(`uniform sampler2D ${lightClassSampler(slot)};`);
      expect(shader.fragmentShader).toContain(`uLightClassWeight[${slot}] > 0.5`);
      expect(shader.fragmentShader).toContain(`texture2D(${lightClassSampler(slot)}, lightUv)`);
    }
    expect(shader.fragmentShader).not.toMatch(/for\s*\(/);
  });

  it('binds the caller\'s uniform OBJECTS, so later values reach the GPU', () => {
    // three captures what onBeforeCompile assigns at first compile and R3F never sets
    // material.needsUpdate, so a rebuilt uniform object is stranded: the identity is the contract.
    const { shader, shared } = compile(CanvasItemLightMode.NORMAL);
    for (let slot = 0; slot < MAX_LIGHT_CLASSES; slot += 1) {
      expect(shader.uniforms[lightClassSampler(slot)]).toBe(shared.classBuffers[slot]);
    }
    expect(shader.uniforms.uLightClassWeight).toBe(shared.classWeights);
    expect(shader.uniforms.uLightResolution).toBe(shared.resolution);
    expect(shader.uniforms.uCanvasModulate).toBe(shared.canvasModulate);
  });

  it('gates "no lights" with a uniform rather than a different program', () => {
    // A light registers after the items compile, so a light path compiled only once a light
    // exists leaves mounted items on a stock shader. Every slot is emitted, and the weights decide.
    const { shader } = compile(CanvasItemLightMode.NORMAL);
    expect(shader.fragmentShader).toContain(`uniform float uLightClassWeight[${MAX_LIGHT_CLASSES}]`);
  });

  it('starts every accumulation from the seed, so one matched class reads it exactly', () => {
    // S = seed + Σ (S_class − seed): one class gives S_class, and several ADD/SUB classes give
    // their independent terms over one seed.
    const { shader } = compile(CanvasItemLightMode.NORMAL);
    expect(shader.fragmentShader).toContain('lightOnly ? vec3(1.0) : uCanvasModulate');
    expect(shader.fragmentShader).toContain('vec4 accum = vec4(lightSeed, 0.0);');
    expect(shader.fragmentShader).toContain('accum.rgb += lightClass.rgb - lightSeed;');
    expect(shader.fragmentShader).toContain('accum.a += lightClass.a;');
  });

  it('recovers the albedo through a FLOORED divisor, so a black canvas tint still lights', () => {
    const { shader } = compile(CanvasItemLightMode.NORMAL);
    expect(shader.fragmentShader).toContain(`max(lightSeed, vec3(${CANVAS_MODULATE_FLOOR}))`);
    expect(CANVAS_MODULATE_FLOOR).toBeGreaterThan(0);
    // Below one 8-bit step, so the floor cannot show on screen.
    expect(CANVAS_MODULATE_FLOOR).toBeLessThanOrEqual(1 / 255);
  });

  it('clamps in Godot\'s space before handing the fragment back to three', () => {
    // Godot's framebuffer clamps after the light is multiplied into the albedo, which is why the
    // accumulation is unclamped half-float. The shadow_color term joins inside that clamp and
    // outside the albedo multiply, where `light_shadow_compute` puts it.
    const { shader } = compile(CanvasItemLightMode.NORMAL);
    expect(shader.fragmentShader).toContain('clamp(albedo * accum.rgb + shadowTint, 0.0, 1.0)');
    expect(shader.fragmentShader).toContain('#include <colorspace_fragment>');
  });

  it('declares the mode uniform, so a light_mode edit reaches the GPU', () => {
    const { shader, shared } = compile(CanvasItemLightMode.NORMAL);
    expect(shader.uniforms.uLightMode).toBe(shared.lightMode);
    expect(shader.fragmentShader).toContain('uniform float uLightMode;');
  });

  it('leaves an Unshaded fragment untouched: no canvas tint, no light loop', () => {
    // canvas.glsl:715, :719: MODE_UNSHADED skips both.
    const { shader } = compile(CanvasItemLightMode.UNSHADED);
    const guard = shader.fragmentShader.indexOf('if (!unshaded) {');
    expect(guard).toBeGreaterThan(-1);
    // Every write the injection makes is inside that guard.
    expect(shader.fragmentShader.indexOf('gl_FragColor.rgb = godotToLinear')).toBeGreaterThan(guard);
    expect(shader.fragmentShader.indexOf('gl_FragColor.a = clamp')).toBeGreaterThan(guard);
  });

  it('masks a Light Only item by the summed cookie coverage', () => {
    const { props, shader } = compile(CanvasItemLightMode.LIGHT_ONLY);
    expect(shader.fragmentShader).toContain('gl_FragColor.a = clamp(gl_FragColor.a * accum.a');
    // Unconditional: `transparent` decides three's `OPAQUE` define.
    expect(props.transparent).toBe(true);
  });

  it('reads an unmodulated seed for a Light Only item, which skips the canvas tint', () => {
    const { shader } = compile(CanvasItemLightMode.LIGHT_ONLY);
    // Both seeds live in one program and `uLightMode` picks at runtime. The divide-out is by the
    // seed, so Light Only's 1.0 makes it a no-op.
    expect(shader.fragmentShader).toContain('lightOnly ? vec3(1.0) : uCanvasModulate');
    expect(shader.fragmentShader).toContain('godotToSrgb(gl_FragColor.rgb) / max(lightSeed');
  });

  it('leaves a shader with no colorspace hook untouched rather than throwing', () => {
    const props = canvasItemLightingProps(uniforms());
    const shader = {
      vertexShader: '',
      fragmentShader: 'void other() {}',
      uniforms: {} as Record<string, THREE.IUniform>,
    };
    expect(() => props.injection.onBeforeCompile(shader)).not.toThrow();
    expect(shader.fragmentShader).toBe('void other() {}');
  });
});

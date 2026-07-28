/**
 * The canvas-item side of the 2D light pass: what gets injected into an item's
 * shader, which of Godot's three light modes it compiles for, and how the
 * cull-mask class slots reach it.
 *
 * These read the produced GLSL rather than a rendered pixel, because happy-dom
 * has no GPU — the pixel-level check is the Godot comparison capture
 * (`unit-pointlight2d*`). What is worth pinning here is the SHAPE: that the
 * light path is present at all, that it is gated by data rather than by
 * compilation, that the slots are unrolled rather than loop-indexed, and that
 * the three light modes stay distinguishable.
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
  };
}

function compile(lightMode: CanvasItemLightMode) {
  const shared = uniforms();
  const props = canvasItemLightingProps({ uniforms: shared, lightMode });
  const shader = {
    vertexShader: '',
    fragmentShader: STOCK_FRAGMENT,
    uniforms: {} as Record<string, THREE.IUniform>,
  };
  props.onBeforeCompile?.(shader);
  return { props, shader, shared };
}

describe('canvasItemLightingProps', () => {
  it('injects the light path for an ordinary item', () => {
    const { props, shader } = compile(CanvasItemLightMode.NORMAL);
    expect(props.onBeforeCompile).toBeTypeOf('function');
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
    // three captures whatever onBeforeCompile assigns at first compile and R3F
    // never bumps material.needsUpdate, so a rebuilt uniform object would be
    // stranded — the identity is the contract.
    const { shader, shared } = compile(CanvasItemLightMode.NORMAL);
    for (let slot = 0; slot < MAX_LIGHT_CLASSES; slot += 1) {
      expect(shader.uniforms[lightClassSampler(slot)]).toBe(shared.classBuffers[slot]);
    }
    expect(shader.uniforms.uLightClassWeight).toBe(shared.classWeights);
    expect(shader.uniforms.uLightResolution).toBe(shared.resolution);
    expect(shader.uniforms.uCanvasModulate).toBe(shared.canvasModulate);
  });

  it('gates "no lights" with a uniform rather than a different program', () => {
    // Compiling the light path only once a light exists left every already-mounted
    // item on a stock shader forever, because the light registers after they compile.
    // Every slot is emitted whatever the canvas currently holds; the weights decide.
    const { shader } = compile(CanvasItemLightMode.NORMAL);
    expect(shader.fragmentShader).toContain(`uniform float uLightClassWeight[${MAX_LIGHT_CLASSES}]`);
  });

  it('starts every accumulation from the seed, so one matched class reads it exactly', () => {
    // S = seed + Σ (S_class − seed): with one class that is S_class, and with
    // several ADD/SUB classes it is their independent terms over one seed.
    const { shader } = compile(CanvasItemLightMode.NORMAL);
    expect(shader.fragmentShader).toContain('vec3 lightSeed = uCanvasModulate;');
    expect(shader.fragmentShader).toContain('vec4 accum = vec4(lightSeed, 0.0);');
    expect(shader.fragmentShader).toContain('accum.rgb += lightClass.rgb - lightSeed;');
    expect(shader.fragmentShader).toContain('accum.a += lightClass.a;');
  });

  it('recovers the albedo through a FLOORED divisor, so a black canvas tint still lights', () => {
    const { shader } = compile(CanvasItemLightMode.NORMAL);
    expect(shader.fragmentShader).toContain(`max(uCanvasModulate, vec3(${CANVAS_MODULATE_FLOOR}))`);
    expect(CANVAS_MODULATE_FLOOR).toBeGreaterThan(0);
    // Below one 8-bit step, so the floor cannot show on screen.
    expect(CANVAS_MODULATE_FLOOR).toBeLessThanOrEqual(1 / 255);
  });

  it('clamps in Godot\'s space before handing the fragment back to three', () => {
    // Godot's framebuffer clamps AFTER the light is multiplied into the albedo,
    // which is the whole reason the accumulation is unclamped half-float. The
    // shadow_color term joins INSIDE that clamp and outside the albedo multiply,
    // which is where `light_shadow_compute` puts it.
    const { shader } = compile(CanvasItemLightMode.NORMAL);
    expect(shader.fragmentShader).toContain('clamp(albedo * accum.rgb + shadowTint, 0.0, 1.0)');
    expect(shader.fragmentShader).toContain('#include <colorspace_fragment>');
  });

  it('excludes an Unshaded item from the light pass entirely', () => {
    const { props } = compile(CanvasItemLightMode.UNSHADED);
    expect(props.onBeforeCompile).toBeUndefined();
    expect(props.customProgramCacheKey).toBeUndefined();
  });

  it('masks a Light Only item by the summed cookie coverage', () => {
    const { props, shader } = compile(CanvasItemLightMode.LIGHT_ONLY);
    expect(shader.fragmentShader).toContain('gl_FragColor.a = clamp(gl_FragColor.a * accum.a');
    // The mask has to survive to the blend.
    expect(props.transparent).toBe(true);
  });

  it('reads an unmodulated seed for a Light Only item, which skips the canvas tint', () => {
    const lightOnly = compile(CanvasItemLightMode.LIGHT_ONLY).shader.fragmentShader;
    const normal = compile(CanvasItemLightMode.NORMAL).shader.fragmentShader;
    // Its albedo is the fragment as-is; only an ordinary item divides the tint out.
    expect(lightOnly).toContain('vec3 lightSeed = vec3(1.0);');
    expect(lightOnly).toContain('vec3 albedo = lit;');
    expect(lightOnly).not.toContain('max(uCanvasModulate');
    expect(normal).toContain('max(uCanvasModulate');
    expect(normal).not.toContain('gl_FragColor.a * accum.a');
  });

  it('keeps the two lit modes on separate programs', () => {
    const normal = compile(CanvasItemLightMode.NORMAL).props.customProgramCacheKey?.();
    const lightOnly = compile(CanvasItemLightMode.LIGHT_ONLY).props.customProgramCacheKey?.();
    expect(normal).toBeTruthy();
    expect(lightOnly).toBeTruthy();
    expect(normal).not.toBe(lightOnly);
  });

  it('leaves a shader with no colorspace hook untouched rather than throwing', () => {
    const props = canvasItemLightingProps({
      uniforms: uniforms(),
      lightMode: CanvasItemLightMode.NORMAL,
    });
    const shader = {
      vertexShader: '',
      fragmentShader: 'void other() {}',
      uniforms: {} as Record<string, THREE.IUniform>,
    };
    expect(() => props.onBeforeCompile?.(shader)).not.toThrow();
    expect(shader.fragmentShader).toBe('void other() {}');
  });
});

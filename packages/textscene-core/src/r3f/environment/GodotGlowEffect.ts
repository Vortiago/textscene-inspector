/**
 * `GodotGlowEffect` — Godot's glow, gather and blend and tone curve in one pass.
 *
 * ONE effect rather than a bloom-then-tonemap pair, because that is Godot's own
 * shape: `tonemap.glsl` gathers the glow pyramid, blends it, and applies the tone
 * curve in a single shader. Mirroring that is what makes the two blend orderings
 * expressible at all — Godot composites SOFTLIGHT AFTER the tone curve (with the
 * glow buffer itself tonemapped) and every other mode into linear HDR BEFORE it,
 * and a fixed pass order can only ever be one of the two.
 *
 * The pyramid is built in `update()` from buffers this effect owns, which is how
 * `BloomEffect` is built too. It cannot BE a `BloomEffect`: Godot weights its
 * seven mip levels independently (`[0, 0.8, 0.4, 0.1, 0, 0, 0]` by default, which
 * is what keeps a Godot halo tight) and `MipmapBlurPass` exposes only one global
 * radius shared by every level, so an equal-weighted pyramid is the closest it
 * can get — a haze over the whole frame instead of a halo.
 *
 * Godot's own downsample kernel is written against integer pixel coordinates and
 * does not transplant onto a normalised-UV fullscreen pass, so the chain uses the
 * standard 13-tap pyramid downsample instead. What decides the halo's SHAPE is
 * the per-level weighting, and that is ported exactly.
 */

import { BlendFunction, Effect } from 'postprocessing';
import * as THREE from 'three';
import {
  brightPassGlsl,
  glowLevelSize,
  type GlowParams,
} from '../../resources/environment/godotGlow';
import { compositeGlsl } from '../../resources/environment/godotCompositor';
import { glslFloat } from '../../resources/environment/glslLiterals';

export interface GodotGlowOptions {
  glow: GlowParams;
  /** Godot `tonemap_mode`: 0 LINEAR, 1 REINHARDT, 2 FILMIC, 3 ACES, 4 AGX. */
  toneMapMode: number;
  /** Godot `tonemap_white` — also the white point SCREEN normalises against. */
  toneMapWhite: number;
}

/** Shared by every pyramid material so they agree on how `vUv` is derived. */
const FULLSCREEN_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

export class GodotGlowEffect extends Effect {
  private readonly levelTargets: THREE.WebGLRenderTarget[] = [];
  private readonly accumulationTargets: THREE.WebGLRenderTarget[] = [];
  private readonly brightPassMaterial: THREE.ShaderMaterial;
  private readonly downsampleMaterial: THREE.ShaderMaterial;
  private readonly accumulateMaterial: THREE.ShaderMaterial;
  private readonly screen: THREE.Mesh;
  private readonly pyramidCamera: THREE.OrthographicCamera;
  private readonly weights: number[];
  private readonly maxLevel: number;

  constructor({ glow, toneMapMode, toneMapWhite }: GodotGlowOptions) {
    super('GodotGlowEffect', compositeGlsl(glow, { mode: toneMapMode, white: toneMapWhite }), {
      // This effect writes the finished frame — the glow blend and the tone
      // curve are both already applied — so the composer must not blend it into
      // the scene a second time.
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, THREE.Uniform>([
        ['godotGlowBuffer', new THREE.Uniform(null)],
        ['godotExposure', new THREE.Uniform(glow.exposure)],
      ]),
    });

    // `glowParamsFor` returns null rather than an empty pyramid, so a `GlowParams`
    // that exists always has at least one weighted level.
    this.maxLevel = glow.maxLevel;
    this.weights = glow.levels;

    this.brightPassMaterial = pyramidMaterial(
      'BrightPass',
      brightPassFragmentShader(glow),
      {
        inputBuffer: { value: null },
        texelSize: { value: new THREE.Vector2() },
      }
    );
    this.downsampleMaterial = pyramidMaterial('Downsample', downsampleFragmentShader(glow), {
      inputBuffer: { value: null },
      texelSize: { value: new THREE.Vector2() },
    });
    this.accumulateMaterial = pyramidMaterial('Accumulate', ACCUMULATE_FRAGMENT_SHADER, {
      coarserBuffer: { value: null },
      levelBuffer: { value: null },
      levelWeight: { value: 0 },
      // Zero on the coarsest rung, which has nothing summed below it. A uniform
      // rather than a `#define` so walking the pyramid does not recompile the
      // shader once per level per frame.
      coarserFactor: { value: 0 },
      texelSize: { value: new THREE.Vector2() },
    });

    // Two parallel chains, not a ping-pong pair: the coarse-to-fine sum writes
    // rung L while reading rung L+1, and every rung is a different resolution, so
    // reusing one set would mean reallocating at each step.
    for (let level = 0; level <= this.maxLevel; level++) {
      this.levelTargets.push(createTarget(`GodotGlow.Level${level}`));
      this.accumulationTargets.push(createTarget(`GodotGlow.Accumulation${level}`));
    }

    this.pyramidCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // Spans NDC exactly, so `vUv = position.xy * 0.5 + 0.5` covers 0..1. Rendered
    // as its own root — `WebGLRenderer.render` takes any `Object3D`, so a `Scene`
    // wrapper around a single fullscreen quad would buy nothing.
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.brightPassMaterial);
    this.screen.frustumCulled = false;
  }

  override setSize(width: number, height: number): void {
    for (let level = 0; level < this.levelTargets.length; level++) {
      const size = glowLevelSize(width, height, level);
      this.levelTargets[level]!.setSize(size.width, size.height);
      this.accumulationTargets[level]!.setSize(size.width, size.height);
    }
  }

  /**
   * Builds the pyramid, then hands the composite shader the weighted sum.
   *
   * Godot's `gather_glow` reads every level at the SAME uv and sums
   * `weight[i] * level[i]`. Accumulating coarse-to-fine — upsample what is
   * already summed, add the next finer level at its weight — computes that same
   * sum while only ever holding two textures live, instead of binding all seven
   * as samplers at full resolution.
   */
  override update(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget): void {
    const previousTarget = renderer.getRenderTarget();

    this.screen.material = this.brightPassMaterial;
    const brightUniforms = this.brightPassMaterial.uniforms;
    brightUniforms['inputBuffer']!.value = inputBuffer.texture;
    setTexelSize(brightUniforms, inputBuffer);
    this.renderTo(renderer, this.levelTargets[0]!);

    this.screen.material = this.downsampleMaterial;
    const downsampleUniforms = this.downsampleMaterial.uniforms;
    for (let level = 1; level <= this.maxLevel; level++) {
      const source = this.levelTargets[level - 1]!;
      downsampleUniforms['inputBuffer']!.value = source.texture;
      setTexelSize(downsampleUniforms, source);
      this.renderTo(renderer, this.levelTargets[level]!);
    }

    this.screen.material = this.accumulateMaterial;
    const uniforms = this.accumulateMaterial.uniforms;
    for (let level = this.maxLevel; level >= 0; level--) {
      const coarser = level === this.maxLevel ? null : this.accumulationTargets[level + 1]!;
      // The coarsest rung has nothing summed below it. `coarserFactor` zeroes the
      // contribution, so this only has to be a VALID binding — sampling an unbound
      // sampler2D is undefined behaviour, not zero. Its own level serves, and
      // cannot alias: this pass writes an accumulation target, never a level one.
      uniforms['coarserBuffer']!.value = (coarser ?? this.levelTargets[level]!).texture;
      uniforms['coarserFactor']!.value = coarser ? 1 : 0;
      uniforms['levelBuffer']!.value = this.levelTargets[level]!.texture;
      uniforms['levelWeight']!.value = this.weights[level]!;
      const source = coarser ?? this.levelTargets[level]!;
      setTexelSize(uniforms, source);
      this.renderTo(renderer, this.accumulationTargets[level]!);
    }

    renderer.setRenderTarget(previousTarget);
    this.uniforms.get('godotGlowBuffer')!.value = this.accumulationTargets[0]!.texture;
  }

  private renderTo(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget): void {
    renderer.setRenderTarget(target);
    renderer.render(this.screen, this.pyramidCamera);
  }

  override dispose(): void {
    for (const target of [...this.levelTargets, ...this.accumulationTargets]) {
      target.dispose();
    }
    this.brightPassMaterial.dispose();
    this.downsampleMaterial.dispose();
    this.accumulateMaterial.dispose();
    this.screen.geometry.dispose();
    super.dispose();
  }
}

/**
 * Every pyramid pass is the same fullscreen draw with a different fragment: same
 * vertex shader (so they agree on how `vUv` is derived) and no depth, because
 * none of them has geometry to sort. Only the uniforms and the fragment differ.
 */
function pyramidMaterial(
  name: string,
  fragmentShader: string,
  uniforms: Record<string, THREE.IUniform>
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: `GodotGlow.${name}`,
    uniforms,
    vertexShader: FULLSCREEN_VERTEX_SHADER,
    fragmentShader,
    depthWrite: false,
    depthTest: false,
  });
}

/** Confines the `IUniform` cast the three pyramid passes would each repeat. */
function setTexelSize(
  uniforms: Record<string, THREE.IUniform>,
  source: { width: number; height: number }
): void {
  (uniforms['texelSize']!.value as THREE.Vector2).set(1 / source.width, 1 / source.height);
}

function createTarget(name: string): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: false,
    stencilBuffer: false,
    // The bright pass keeps values well above 1 (Godot caps at 12 by default),
    // so the chain has to stay floating point or the halo clips to white.
    type: THREE.HalfFloatType,
  });
  target.texture.name = name;
  return target;
}

/**
 * Level 0 skips a rung — it goes straight from the frame to a quarter of it — so
 * this is a 4x reduction where every later level does 2x.
 *
 * Godot ships two glow implementations that filter this step differently — the
 * raster path takes four bilinear taps per 4x4 block, the compute path a separable
 * gaussian — and it runs the compute one wherever storage buffers are supported,
 * which is every desktop target. Neither transplants onto a normalised-UV pass, so
 * this shares the 13-tap downsample; the sheet records which measured closer.
 */
function brightPassFragmentShader(glow: GlowParams): string {
  return /* glsl */ `
${DOWNSAMPLE_TAPS}
${brightPassGlsl(glow)}
void main() {
  gl_FragColor = vec4(godotGlowBrightPass(max(downsample13(), 0.0)), 1.0);
}
`;
}

/**
 * The standard 13-tap pyramid downsample: four inner diagonals carry half the
 * weight, a 3×3 ring at twice the spacing plus the centre carry the other half.
 * Its whole job is to halve resolution without the aliasing a single tap leaves,
 * which is what would otherwise make a small bright object flicker as it moves.
 *
 * Declares the three uniforms it reads, so a pass that includes it cannot forget
 * one and fail at shader-compile time rather than type-check time.
 */
const DOWNSAMPLE_TAPS = /* glsl */ `
uniform sampler2D inputBuffer;
uniform vec2 texelSize;
varying vec2 vUv;

vec3 tap(vec2 offset) {
  return texture2D(inputBuffer, vUv + offset * texelSize).rgb;
}

vec3 downsample13() {
  vec3 inner = tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0))
             + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0));
  vec3 corners = tap(vec2(-2.0, -2.0)) + tap(vec2(2.0, -2.0))
               + tap(vec2(-2.0, 2.0)) + tap(vec2(2.0, 2.0));
  vec3 edges = tap(vec2(0.0, -2.0)) + tap(vec2(-2.0, 0.0))
             + tap(vec2(2.0, 0.0)) + tap(vec2(0.0, 2.0));
  vec3 center = tap(vec2(0.0));
  return inner * 0.125 + corners * 0.03125 + edges * 0.0625 + center * 0.125;
}
`;

/**
 * Godot multiplies the glow buffer by `glow_strength` at every pyramid pass, and
 * the bright pass has already applied its own — so each downsample carries one
 * more factor, reaching `strength^(i+1)` at level `i` in the order Godot does it.
 */
function downsampleFragmentShader(glow: GlowParams): string {
  return /* glsl */ `
${DOWNSAMPLE_TAPS}
void main() {
  gl_FragColor = vec4(downsample13() * ${glslFloat(glow.strength)}, 1.0);
}
`;
}

/**
 * One rung of the coarse-to-fine sum: a 9-tap tent upsample of everything
 * summed so far, plus this level at its own weight.
 */
const ACCUMULATE_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D coarserBuffer;
uniform sampler2D levelBuffer;
uniform float levelWeight;
uniform float coarserFactor;
uniform vec2 texelSize;
varying vec2 vUv;

vec3 tentUpsample(sampler2D tex, vec2 uv) {
  vec3 sum = texture2D(tex, uv).rgb * 0.25;
  sum += texture2D(tex, uv + vec2(-texelSize.x, 0.0)).rgb * 0.125;
  sum += texture2D(tex, uv + vec2(texelSize.x, 0.0)).rgb * 0.125;
  sum += texture2D(tex, uv + vec2(0.0, -texelSize.y)).rgb * 0.125;
  sum += texture2D(tex, uv + vec2(0.0, texelSize.y)).rgb * 0.125;
  sum += texture2D(tex, uv + vec2(-texelSize.x, -texelSize.y)).rgb * 0.0625;
  sum += texture2D(tex, uv + vec2(texelSize.x, -texelSize.y)).rgb * 0.0625;
  sum += texture2D(tex, uv + vec2(-texelSize.x, texelSize.y)).rgb * 0.0625;
  sum += texture2D(tex, uv + vec2(texelSize.x, texelSize.y)).rgb * 0.0625;
  return sum;
}

void main() {
  vec3 accumulated = tentUpsample(coarserBuffer, vUv) * coarserFactor;
  accumulated += texture2D(levelBuffer, vUv).rgb * levelWeight;
  gl_FragColor = vec4(accumulated, 1.0);
}
`;


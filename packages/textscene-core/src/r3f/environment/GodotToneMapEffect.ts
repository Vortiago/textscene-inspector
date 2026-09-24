/**
 * Godot's tonemap pass as one effect: the tone curve, plus the glow gather and blend under
 * `FLAG_USE_GLOW`, as in `tonemap.glsl`. One shader lets SOFTLIGHT composite after the curve, with
 * the glow buffer tonemapped, and every other mode before it, which a fixed pass order cannot express.
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

export interface GodotToneMapOptions {
  /** Null when the environment has no glow: `FLAG_USE_GLOW` clear. */
  glow: GlowParams | null;
  /** Godot `tonemap_mode`: 0 LINEAR, 1 REINHARDT, 2 FILMIC, 3 ACES, 4 AGX. */
  toneMapMode: number;
  /**
   * Godot's `env->white`: the value the curve maps to 1.0, and, after the per-curve floor, the
   * point SCREEN normalises the glow against.
   */
  toneMapWhite: number;
  /**
   * Godot `tonemap_exposure`, applied to the scene colour once at the top of
   * `main()`. The bright pass has already applied the same value to the glow.
   */
  toneMapExposure: number;
  /**
   * Godot `tonemap_agx_contrast`, read only by AgX. Threaded, not defaulted, so this path and the
   * in-material one draw the same curve.
   */
  toneMapAgxContrast?: number;
}

/** Shared by every pyramid material so they agree on how `vUv` is derived. */
const FULLSCREEN_VERTEX_SHADER = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

export class GodotToneMapEffect extends Effect {
  /** Null when the environment has no glow: nothing to gather, nothing to own. */
  private readonly pyramid: GlowPyramid | null;

  constructor({
    glow,
    toneMapMode,
    toneMapWhite,
    toneMapExposure,
    toneMapAgxContrast,
  }: GodotToneMapOptions) {
    const uniforms = new Map<string, THREE.Uniform>([
      ['godotExposure', new THREE.Uniform(toneMapExposure)],
    ]);
    // Only the glow arm of the shader reads it.
    if (glow) uniforms.set('godotGlowBuffer', new THREE.Uniform(null));

    super(
      'GodotToneMapEffect',
      compositeGlsl(glow, {
        mode: toneMapMode,
        white: toneMapWhite,
        agxContrast: toneMapAgxContrast,
      }),
      {
        // The effect writes the finished frame, glow and curve applied, so the composer must not
        // blend it into the scene again.
        blendFunction: BlendFunction.SRC,
        uniforms,
      }
    );

    this.pyramid = glow ? new GlowPyramid(glow) : null;
  }

  override setSize(width: number, height: number): void {
    this.pyramid?.setSize(width, height);
  }

  /** Builds the pyramid, then hands the composite shader the weighted sum. */
  override update(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget): void {
    if (!this.pyramid) return;
    this.uniforms.get('godotGlowBuffer')!.value = this.pyramid.gather(renderer, inputBuffer);
  }

  override dispose(): void {
    this.pyramid?.dispose();
    super.dispose();
  }
}

/**
 * The glow buffers and passes, owned as `BloomEffect` owns its own. Not a `BloomEffect`: Godot
 * weights its seven levels apart (`[0, 0.8, 0.4, 0.1, 0, 0, 0]` by default), while `MipmapBlurPass`
 * has one radius for every level, which gives a haze instead of a halo.
 */
class GlowPyramid {
  private readonly levelTargets: THREE.WebGLRenderTarget[] = [];
  private readonly accumulationTargets: THREE.WebGLRenderTarget[] = [];
  private readonly brightPassMaterial: THREE.ShaderMaterial;
  private readonly downsampleMaterial: THREE.ShaderMaterial;
  private readonly accumulateMaterial: THREE.ShaderMaterial;
  private readonly screen: THREE.Mesh;
  private readonly pyramidCamera: THREE.OrthographicCamera;
  private readonly weights: number[];
  private readonly maxLevel: number;

  constructor(glow: GlowParams) {
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
    // Spans NDC exactly, so `vUv = position.xy * 0.5 + 0.5` covers 0..1. Rendered as its own root,
    // since `WebGLRenderer.render` takes any `Object3D`.
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.brightPassMaterial);
    this.screen.frustumCulled = false;
  }

  setSize(width: number, height: number): void {
    for (let level = 0; level < this.levelTargets.length; level++) {
      const size = glowLevelSize(width, height, level);
      this.levelTargets[level]!.setSize(size.width, size.height);
      this.accumulationTargets[level]!.setSize(size.width, size.height);
    }
  }

  /**
   * Builds the pyramid and returns the sum `weight[i] * level[i]` that Godot's `gather_glow` reads at
   * one uv. Accumulating coarse to fine, upsampling the sum and adding the next level, holds two
   * textures live instead of binding all seven as samplers.
   */
  gather(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget): THREE.Texture {
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
      // On the coarsest rung `coarserFactor` zeroes the contribution, but the binding must be valid:
      // an unbound sampler2D is undefined, not zero. Its own level serves, and cannot alias, since
      // this pass writes an accumulation target.
      uniforms['coarserBuffer']!.value = (coarser ?? this.levelTargets[level]!).texture;
      uniforms['coarserFactor']!.value = coarser ? 1 : 0;
      uniforms['levelBuffer']!.value = this.levelTargets[level]!.texture;
      uniforms['levelWeight']!.value = this.weights[level]!;
      const source = coarser ?? this.levelTargets[level]!;
      setTexelSize(uniforms, source);
      this.renderTo(renderer, this.accumulationTargets[level]!);
    }

    renderer.setRenderTarget(previousTarget);
    return this.accumulationTargets[0]!.texture;
  }

  private renderTo(renderer: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget): void {
    renderer.setRenderTarget(target);
    renderer.render(this.screen, this.pyramidCamera);
  }

  dispose(): void {
    for (const target of [...this.levelTargets, ...this.accumulationTargets]) {
      target.dispose();
    }
    this.brightPassMaterial.dispose();
    this.downsampleMaterial.dispose();
    this.accumulateMaterial.dispose();
    this.screen.geometry.dispose();
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
 * Level 0 goes from the frame to a quarter of it, a 4x reduction where later levels do 2x. Godot's
 * raster glow takes four bilinear taps per 4x4 block, and its compute glow, run on every desktop
 * target, a separable gaussian. Neither transplants to normalised UV, so this uses the 13-tap one.
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
 * The standard 13-tap pyramid downsample, since Godot's integer-pixel kernel does not transplant to
 * normalised UV; the ported per-level weights decide the halo shape. It halves resolution without
 * the aliasing that makes a small bright object flicker, and declares the uniforms it reads.
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
 * Godot multiplies the glow buffer by `glow_strength` at every pyramid pass, after the bright pass
 * applied its own, so each downsample carries one more factor: `strength^(i+1)` at level `i`.
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


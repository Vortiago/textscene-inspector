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
  blendGlsl,
  brightPassGlsl,
  effectiveLevelWeights,
  type GlowParams,
} from '../../resources/environment/godotGlow';
import { toneMappingEffectGlsl } from '../../resources/environment/godotToneMapping';

export interface GodotGlowOptions {
  glow: GlowParams;
  /** Godot `tonemap_mode`: 0 LINEAR, 1 REINHARDT, 2 FILMIC, 3 ACES, 4 AGX. */
  toneMapMode: number;
  /** Godot `tonemap_exposure`. */
  toneMapExposure: number;
  /** Godot `tonemap_white` — also the white point SCREEN normalises against. */
  toneMapWhite: number;
}

/**
 * Godot's glow buffer is allocated at half the internal render size, and its
 * gather pass then writes level 0 at half of THAT — it box-samples straight to
 * quarter resolution rather than stepping down one level at a time. So every
 * level is one octave coarser than a half-resolution chain would make it, which
 * is why a halo built on the coarse levels reads wide and flat in Godot instead
 * of tight and bright.
 */
const FIRST_LEVEL_DIVISOR = 4;

/** LINEAR has no ported curve; exposure is all it applies. */
const LINEAR_TONE_CURVE = /* glsl */ `vec3 godotToneMap(vec3 color, float exposure) {
  return color * exposure;
}`;

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
  private readonly emptyLevel: THREE.DataTexture;
  private readonly screen: THREE.Mesh;
  private readonly pyramidScene: THREE.Scene;
  private readonly pyramidCamera: THREE.OrthographicCamera;
  private readonly weights: number[];
  private readonly maxLevel: number;

  constructor({ glow, toneMapMode, toneMapExposure, toneMapWhite }: GodotGlowOptions) {
    super('GodotGlowEffect', compositeFragmentShader(glow, toneMapMode, toneMapWhite), {
      // This effect writes the finished frame — the glow blend and the tone
      // curve are both already applied — so the composer must not blend it into
      // the scene a second time.
      blendFunction: BlendFunction.SRC,
      uniforms: new Map<string, THREE.Uniform>([
        ['godotGlowBuffer', new THREE.Uniform(null)],
        ['godotExposure', new THREE.Uniform(toneMapExposure)],
      ]),
    });

    this.maxLevel = Math.max(0, glow.maxLevel);
    this.weights = effectiveLevelWeights(glow);

    this.brightPassMaterial = new THREE.ShaderMaterial({
      name: 'GodotGlow.BrightPass',
      uniforms: { inputBuffer: { value: null } },
      vertexShader: FULLSCREEN_VERTEX_SHADER,
      fragmentShader: brightPassFragmentShader(glow),
      depthWrite: false,
      depthTest: false,
    });
    this.downsampleMaterial = new THREE.ShaderMaterial({
      name: 'GodotGlow.Downsample',
      uniforms: {
        inputBuffer: { value: null },
        texelSize: { value: new THREE.Vector2() },
      },
      vertexShader: FULLSCREEN_VERTEX_SHADER,
      fragmentShader: DOWNSAMPLE_FRAGMENT_SHADER,
      depthWrite: false,
      depthTest: false,
    });
    this.accumulateMaterial = new THREE.ShaderMaterial({
      name: 'GodotGlow.Accumulate',
      uniforms: {
        coarserBuffer: { value: null },
        levelBuffer: { value: null },
        levelWeight: { value: 0 },
        // Zero on the coarsest rung, which has nothing summed below it. A
        // uniform rather than a `#define` so walking the pyramid does not
        // recompile the shader once per level per frame.
        coarserFactor: { value: 0 },
        texelSize: { value: new THREE.Vector2() },
      },
      vertexShader: FULLSCREEN_VERTEX_SHADER,
      fragmentShader: ACCUMULATE_FRAGMENT_SHADER,
      depthWrite: false,
      depthTest: false,
    });

    // Bound wherever a sampler must stay valid but contribute nothing; sampling
    // an unbound sampler2D is undefined behaviour, not zero.
    this.emptyLevel = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
    this.emptyLevel.needsUpdate = true;

    for (let level = 0; level <= this.maxLevel; level++) {
      this.levelTargets.push(createTarget(`GodotGlow.Level${level}`));
      this.accumulationTargets.push(createTarget(`GodotGlow.Accumulation${level}`));
    }

    this.pyramidCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    // Spans NDC exactly, so `vUv = position.xy * 0.5 + 0.5` covers 0..1.
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.brightPassMaterial);
    this.screen.frustumCulled = false;
    this.pyramidScene = new THREE.Scene();
    this.pyramidScene.add(this.screen);
  }

  override setSize(width: number, height: number): void {
    for (let level = 0; level < this.levelTargets.length; level++) {
      const divisor = FIRST_LEVEL_DIVISOR * Math.pow(2, level);
      const w = Math.max(1, Math.floor(width / divisor));
      const h = Math.max(1, Math.floor(height / divisor));
      this.levelTargets[level]?.setSize(w, h);
      this.accumulationTargets[level]?.setSize(w, h);
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
    this.brightPassMaterial.uniforms['inputBuffer']!.value = inputBuffer.texture;
    this.renderTo(renderer, this.levelTargets[0]);

    this.screen.material = this.downsampleMaterial;
    for (let level = 1; level <= this.maxLevel; level++) {
      const source = this.levelTargets[level - 1]!;
      const downsampleUniforms = this.downsampleMaterial.uniforms;
      downsampleUniforms['inputBuffer']!.value = source.texture;
      (downsampleUniforms['texelSize']!.value as THREE.Vector2).set(
        1 / source.width,
        1 / source.height
      );
      this.renderTo(renderer, this.levelTargets[level]);
    }

    this.screen.material = this.accumulateMaterial;
    const uniforms = this.accumulateMaterial.uniforms;
    for (let level = this.maxLevel; level >= 0; level--) {
      const coarser = level === this.maxLevel ? null : this.accumulationTargets[level + 1]!;
      uniforms['coarserBuffer']!.value = coarser ? coarser.texture : this.emptyLevel;
      uniforms['coarserFactor']!.value = coarser ? 1 : 0;
      uniforms['levelBuffer']!.value = this.levelTargets[level]!.texture;
      uniforms['levelWeight']!.value = this.weights[level] ?? 0;
      const source = coarser ?? this.levelTargets[level]!;
      (uniforms['texelSize']!.value as THREE.Vector2).set(1 / source.width, 1 / source.height);
      this.renderTo(renderer, this.accumulationTargets[level]);
    }

    renderer.setRenderTarget(previousTarget);
    this.uniforms.get('godotGlowBuffer')!.value = this.accumulationTargets[0]!.texture;
  }

  private renderTo(
    renderer: THREE.WebGLRenderer,
    target: THREE.WebGLRenderTarget | undefined
  ): void {
    if (!target) return;
    renderer.setRenderTarget(target);
    renderer.render(this.pyramidScene, this.pyramidCamera);
  }

  override dispose(): void {
    for (const target of [...this.levelTargets, ...this.accumulationTargets]) {
      target.dispose();
    }
    this.brightPassMaterial.dispose();
    this.downsampleMaterial.dispose();
    this.accumulateMaterial.dispose();
    this.screen.geometry.dispose();
    this.emptyLevel.dispose();
    super.dispose();
  }
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

function brightPassFragmentShader(glow: GlowParams): string {
  return /* glsl */ `
uniform sampler2D inputBuffer;
varying vec2 vUv;
${brightPassGlsl(glow)}
void main() {
  vec3 color = max(texture2D(inputBuffer, vUv).rgb, 0.0);
  gl_FragColor = vec4(godotGlowBrightPass(color), 1.0);
}
`;
}

/**
 * The standard 13-tap pyramid downsample: four inner diagonals carry half the
 * weight, a 3×3 ring at twice the spacing plus the centre carry the other half.
 * Its whole job is to halve resolution without the aliasing a box filter leaves,
 * which is what would otherwise make a small bright object flicker as it moves.
 */
const DOWNSAMPLE_FRAGMENT_SHADER = /* glsl */ `
uniform sampler2D inputBuffer;
uniform vec2 texelSize;
varying vec2 vUv;

vec3 tap(vec2 offset) {
  return texture2D(inputBuffer, vUv + offset * texelSize).rgb;
}

void main() {
  vec3 inner = tap(vec2(-1.0, -1.0)) + tap(vec2(1.0, -1.0))
             + tap(vec2(-1.0, 1.0)) + tap(vec2(1.0, 1.0));
  vec3 corners = tap(vec2(-2.0, -2.0)) + tap(vec2(2.0, -2.0))
               + tap(vec2(-2.0, 2.0)) + tap(vec2(2.0, 2.0));
  vec3 edges = tap(vec2(0.0, -2.0)) + tap(vec2(-2.0, 0.0))
             + tap(vec2(2.0, 0.0)) + tap(vec2(0.0, 2.0));
  vec3 center = tap(vec2(0.0));
  gl_FragColor = vec4(
    inner * 0.125 + corners * 0.03125 + edges * 0.0625 + center * 0.125,
    1.0
  );
}
`;

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

/**
 * The composite, in Godot's order. `apply_glow` runs either side of the tone
 * curve depending on the blend mode, and SOFTLIGHT additionally tonemaps the
 * glow buffer before blending so both operands sit in the same compressed range.
 */
function compositeFragmentShader(
  glow: GlowParams,
  toneMapMode: number,
  toneMapWhite: number
): string {
  const curve = toneMappingEffectGlsl(toneMapMode, toneMapWhite) ?? LINEAR_TONE_CURVE;
  const composite = glow.blendAfterToneMapping
    ? /* glsl */ `  vec3 color = godotToneMap(max(inputColor.rgb, 0.0), godotExposure);
  color = godotGlowBlend(color, godotToneMap(glow, godotExposure));`
    : /* glsl */ `  vec3 color = godotGlowBlend(max(inputColor.rgb, 0.0), glow);
  color = godotToneMap(color, godotExposure);`;

  return /* glsl */ `
uniform sampler2D godotGlowBuffer;
uniform float godotExposure;
${curve}
${blendGlsl(glow, toneMapWhite)}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 glow = texture2D(godotGlowBuffer, uv).rgb * ${glslLiteral(glow.intensity)};
${composite}
  outputColor = vec4(color, inputColor.a);
}
`;
}

function glslLiteral(value: number): string {
  if (!Number.isFinite(value)) return '0.0';
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

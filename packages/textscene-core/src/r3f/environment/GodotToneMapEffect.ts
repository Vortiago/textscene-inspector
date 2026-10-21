/**
 * Godot's tonemap pass as one effect: the tone curve, plus the glow gather and blend under
 * `FLAG_USE_GLOW` and the colour adjustments under `FLAG_USE_BCS`, as in `tonemap.glsl`. One shader
 * lets SOFTLIGHT composite after the curve, with the glow buffer tonemapped, and every other mode
 * before it, which a fixed pass order cannot express.
 */

import { BlendFunction, Effect } from 'postprocessing';
import * as THREE from 'three';
import { glowLevelCap, glowLevelSize, type GlowParams } from '../../resources/environment/godotGlow';
import {
  BLUR_BLURRED_UNIFORM,
  BLUR_SOURCE_UNIFORM,
  firstLevelBlurGlsl,
  GLOW_TEXTURE_SIZE_UNIFORM,
  glowLevelUniform,
  laterLevelBlurGlsl,
  type LevelBlurGlsl,
} from '../../resources/environment/godotGlowPyramid';
import {
  compositeProgram,
  GLOW_MAP_UNIFORM,
  type CompositeOptions,
} from '../../resources/environment/godotCompositor';
import { applyTextureState } from '../../resources/textures/applyTextureState';
import { defaultWhiteTexture } from '../materials/defaultWhiteTexture';
import { drawFullScreen, fullScreenPass } from '../fullScreenPass';
import { drawOffscreen } from '../offscreen';

export class GodotToneMapEffect extends Effect {
  /** Null when the environment has no glow: nothing to gather, nothing to own. */
  private readonly pyramid: GlowPyramid | null;

  constructor(options: CompositeOptions) {
    const { fragmentShader, uniforms } = compositeProgram(options);
    super('GodotToneMapEffect', fragmentShader, {
      // The effect writes the finished frame, glow and curve applied, so the composer must not
      // blend it into the scene again.
      blendFunction: BlendFunction.SRC,
      uniforms: new Map(Object.entries(uniforms).map(([name, value]) => [name, new THREE.Uniform(value)])),
    });

    this.clearGlowMap();
    this.pyramid = options.glow ? new GlowPyramid(options.glow, this.uniforms) : null;
  }

  /** Samples `map` as the glow map. The caller owns `map`. A no-op when the composite samples no map. */
  setGlowMap(map: THREE.Texture): void {
    const uniform = this.uniforms.get(GLOW_MAP_UNIFORM);
    if (uniform) uniform.value = map;
  }

  /** Samples white, which leaves the glow unscaled: the state while the map loads. */
  clearGlowMap(): void {
    this.setGlowMap(defaultWhiteTexture());
  }

  override setSize(width: number, height: number): void {
    this.pyramid?.setSize(width, height);
  }

  /** Builds the pyramid the composite shader gathers from. */
  override update(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget): void {
    this.pyramid?.build(renderer, inputBuffer);
  }

  override dispose(): void {
    this.pyramid?.dispose();
    super.dispose();
  }
}

/**
 * The view of `glowMap` Godot samples: the raw texels, through the texture's non-sRGB view
 * (`renderer_scene_render_rd.cpp:707`), clamped (`tone_mapper.cpp:177`). A clone when the shared
 * texture diverges, which the caller frees with `releaseBoundTexture`.
 */
export function glowMapView(glowMap: THREE.Texture): THREE.Texture {
  return applyTextureState(glowMap, { colorSpace: THREE.NoColorSpace, repeat: false });
}

/**
 * The glow levels and the passes that build them, owned as `BloomEffect` owns its own. Not a
 * `BloomEffect`: Godot weights its seven levels apart (`[0, 0.8, 0.4, 0.1, 0, 0, 0]` by default),
 * while `MipmapBlurPass` has one radius for every level, which gives a haze instead of a halo.
 */
class GlowPyramid {
  private readonly levelTargets: THREE.WebGLRenderTarget[] = [];
  /** Each level's horizontal blur, which its vertical pass reads. */
  private readonly horizontalTargets: THREE.WebGLRenderTarget[] = [];
  private readonly firstBlur: LevelBlur;
  private readonly laterBlur: LevelBlur;
  private readonly maxLevel: number;
  private readonly gatheredLevels: number[];
  /** The highest level built and read for the frame size, which `setSize` lowers for a small frame. */
  private topLevel: number;
  /** The composite's size uniform, which `setSize` writes. Null under the Linear upscale mode. */
  private readonly textureSize: THREE.Vector2 | null;

  /** Binds each gathered level's sampler in `compositeUniforms`, and rebinds it on every resize. */
  constructor(
    glow: GlowParams,
    private readonly compositeUniforms: Map<string, THREE.Uniform>
  ) {
    // `glowParamsFor` returns null rather than an empty pyramid, so a `GlowParams`
    // that exists always has at least one weighted level.
    this.maxLevel = glow.maxLevel;
    this.topLevel = glow.maxLevel;
    this.gatheredLevels = glow.gatheredLevels;
    this.firstBlur = new LevelBlur('First', firstLevelBlurGlsl(glow));
    this.laterBlur = new LevelBlur('Later', laterLevelBlurGlsl(glow));

    for (let level = 0; level <= this.maxLevel; level++) {
      this.levelTargets.push(createTarget(`GodotGlow.Level${level}`));
      this.horizontalTargets.push(createTarget(`GodotGlow.Horizontal${level}`));
    }
    const sizeUniform = compositeUniforms.get(GLOW_TEXTURE_SIZE_UNIFORM);
    this.textureSize = sizeUniform ? (sizeUniform.value = new THREE.Vector2()) : null;
    this.rebindLevels();
  }

  /**
   * A level past the cap reads the last level there is. Godot's `textureLod` clamps a lod to the
   * last mip of the glow texture the same way (`tonemap.glsl:384-406`).
   */
  private rebindLevels(): void {
    for (const level of this.gatheredLevels) {
      this.compositeUniforms.get(glowLevelUniform(level))!.value =
        this.levelTargets[Math.min(level, this.topLevel)]!.texture;
    }
  }

  setSize(width: number, height: number): void {
    this.topLevel = Math.min(this.maxLevel, glowLevelCap(width, height));
    const glowTexture = glowLevelSize(width, height, 0);
    this.textureSize?.set(glowTexture.width, glowTexture.height);
    for (let level = 0; level < this.levelTargets.length; level++) {
      const size = glowLevelSize(width, height, level);
      this.levelTargets[level]!.setSize(size.width, size.height);
      this.horizontalTargets[level]!.setSize(size.width, size.height);
    }
    this.rebindLevels();
  }

  /** Blurs the frame into level 0 and each level into the next (`renderer_scene_render_rd.cpp:603-613`). */
  build(renderer: THREE.WebGLRenderer, inputBuffer: THREE.WebGLRenderTarget): void {
    drawOffscreen(renderer, () => {
      for (let level = 0; level <= this.topLevel; level++) {
        const source = level === 0 ? inputBuffer : this.levelTargets[level - 1]!;
        const blur = level === 0 ? this.firstBlur : this.laterBlur;
        blur.draw(renderer, source, this.horizontalTargets[level]!, this.levelTargets[level]!);
      }
    });
  }

  dispose(): void {
    for (const target of [...this.levelTargets, ...this.horizontalTargets]) {
      target.dispose();
    }
    this.firstBlur.dispose();
    this.laterBlur.dispose();
  }
}

/** One level's two passes: each pass reads the texture the one before wrote. */
class LevelBlur {
  private readonly horizontal: THREE.ShaderMaterial;
  private readonly vertical: THREE.ShaderMaterial;

  constructor(name: string, glsl: LevelBlurGlsl) {
    this.horizontal = fullScreenPass(`GodotGlow.${name}Horizontal`, glsl.horizontal, {
      [BLUR_SOURCE_UNIFORM]: { value: null },
    });
    this.vertical = fullScreenPass(`GodotGlow.${name}Vertical`, glsl.vertical, {
      [BLUR_BLURRED_UNIFORM]: { value: null },
    });
  }

  draw(
    renderer: THREE.WebGLRenderer,
    source: THREE.WebGLRenderTarget,
    horizontalTarget: THREE.WebGLRenderTarget,
    destination: THREE.WebGLRenderTarget
  ): void {
    this.horizontal.uniforms[BLUR_SOURCE_UNIFORM]!.value = source.texture;
    drawFullScreen(renderer, this.horizontal, horizontalTarget);
    this.vertical.uniforms[BLUR_BLURRED_UNIFORM]!.value = horizontalTarget.texture;
    drawFullScreen(renderer, this.vertical, destination);
  }

  dispose(): void {
    this.horizontal.dispose();
    this.vertical.dispose();
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

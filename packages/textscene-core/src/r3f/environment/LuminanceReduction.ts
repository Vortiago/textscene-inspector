/**
 * The luminance of the HDR frame, which an auto exposure divides the exposure by: the frame reduced
 * level by level to one texel, as Godot's `Luminance::luminance_reduction` does
 * (`servers/rendering/renderer_rd/effects/luminance.cpp`). The reduction owns its levels as
 * `GlowPyramid` owns its own. Written only by `reduce`, which the effect calls for each frame.
 */

import * as THREE from 'three';
import type { AutoExposure } from '../../resources/cameraattributes/types';
import {
  AUTO_EXPOSURE_SCALE_UNIFORM,
  LUMINANCE_MAX_UNIFORM,
  LUMINANCE_MIN_UNIFORM,
  LUMINANCE_SOURCE_UNIFORM,
  LUMINANCE_UNIFORM,
  luminanceChainSizes,
  luminanceReduceGlsl,
} from '../../resources/environment/godotLuminance';
import { drawFullScreen, fullScreenPass } from '../fullScreenPass';
import { drawOffscreen } from '../offscreen';
import { createPassTarget } from './passTarget';

/**
 * Godot reduces into R32F levels (`luminance.cpp`), so a dark frame keeps its digits. The passes read
 * texels with `texelFetch`, so no filter blends a level.
 */
const LEVEL = { type: THREE.FloatType, minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter };

export class LuminanceReduction {
  /** Every level but the last, which `result` is. Resized with the frame. */
  private levels: THREE.WebGLRenderTarget[] = [];
  /** The one-texel last level. It outlives a resize, so the shaders that sample it stay bound. */
  private readonly result = createPassTarget('GodotLuminance.Result', LEVEL);
  /** The levels and the result, in the order they draw. Rebuilt when the frame size changes. */
  private chain: THREE.WebGLRenderTarget[] = [this.result];
  /** The pass that draws each target of `chain`. Each reads the target before it. */
  private passes: THREE.ShaderMaterial[] = [];
  private frameWidth = 0;
  private frameHeight = 0;

  constructor(private readonly autoExposure: AutoExposure) {}

  /** The luminance in its red channel. */
  get texture(): THREE.Texture {
    return this.result.texture;
  }

  /** The uniforms of a shader that divides by the luminance over the scale, shared by reference. */
  get gainUniforms(): Record<string, THREE.IUniform> {
    return {
      [LUMINANCE_UNIFORM]: { value: this.texture },
      [AUTO_EXPOSURE_SCALE_UNIFORM]: { value: this.autoExposure.scale },
    };
  }

  /** Reduces `frame` to the result texture, level by level. */
  reduce(renderer: THREE.WebGLRenderer, frame: THREE.WebGLRenderTarget): void {
    if (frame.width !== this.frameWidth || frame.height !== this.frameHeight) this.fitTo(frame);
    this.passes[0]!.uniforms[LUMINANCE_SOURCE_UNIFORM]!.value = frame.texture;
    drawOffscreen(renderer, () => {
      for (let index = 0; index < this.chain.length; index++) {
        drawFullScreen(renderer, this.passes[index]!, this.chain[index]!);
      }
    });
  }

  dispose(): void {
    for (const target of this.chain) target.dispose();
    this.disposePasses();
    this.levels = [];
    this.chain = [this.result];
  }

  private fitTo({ width, height }: THREE.WebGLRenderTarget): void {
    this.frameWidth = width;
    this.frameHeight = height;
    const sizes = luminanceChainSizes(width, height);
    for (const target of this.levels.splice(sizes.length - 1)) target.dispose();
    for (let index = this.levels.length; index < sizes.length - 1; index++) {
      this.levels.push(createPassTarget(`GodotLuminance.Level${index}`, LEVEL));
    }
    this.levels.forEach((target, index) => target.setSize(sizes[index]!.width, sizes[index]!.height));
    this.chain = [...this.levels, this.result];
    this.rebuildPasses();
  }

  /** One pass for each target, so a level draws with the uniforms it was given and none uploads twice. */
  private rebuildPasses(): void {
    this.disposePasses();
    this.passes = this.chain.map((_, index) => {
      const clamps = index === this.chain.length - 1;
      return fullScreenPass(
        `GodotLuminance.Pass${index}`,
        luminanceReduceGlsl({ readsFrame: index === 0, clamps }),
        {
          [LUMINANCE_SOURCE_UNIFORM]: { value: index === 0 ? null : this.chain[index - 1]!.texture },
          ...(clamps && {
            [LUMINANCE_MIN_UNIFORM]: { value: this.autoExposure.minLuminance },
            [LUMINANCE_MAX_UNIFORM]: { value: this.autoExposure.maxLuminance },
          }),
        }
      );
    });
  }

  private disposePasses(): void {
    for (const pass of this.passes) pass.dispose();
    this.passes = [];
  }
}

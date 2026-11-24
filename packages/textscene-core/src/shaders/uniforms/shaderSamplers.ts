import type { UniformNode } from '../language/shaderTree.js';
import { isSamplerType, textureKindOf, type TextureKind } from '../language/types.js';

/** A sampler uniform as a texture slot loads its value. */
export interface ShaderSampler {
  /** The texture the sampler reads: a Cubemap for `samplerCube`. */
  readonly kind: TextureKind;
  /** `source_color`, which decodes an sRGB texture. */
  readonly isColor: boolean;
}

/** Each sampler of `uniforms` by name. */
export function shaderSamplers(uniforms: readonly UniformNode[]): Record<string, ShaderSampler> {
  const samplers = uniforms.filter((uniform) => isSamplerType(uniform.type));
  return Object.fromEntries(
    samplers.map((uniform) => [
      uniform.name,
      { kind: textureKindOf(uniform.type), isColor: uniform.usesColor },
    ])
  );
}

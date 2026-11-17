import type { AuthoredSky, BuiltInSkyProperties, ShaderSkyText, Sky } from '../../resources/sky/types';
import type { ShaderDecoders } from '../../shaders/preprocessor/decoders';
import { perObject } from '../../utils/perObject';
import type { SkyTranspiler } from './skyTranspiler';

/** The sky with its shader read, or null while the transpiler or the decoders its `#if` may need load. */
export function useReadSky(
  sky: AuthoredSky,
  transpiler: SkyTranspiler | null,
  decoders: ShaderDecoders | null
): Sky | null {
  if (!isShaderSky(sky)) return sky as Sky<BuiltInSkyProperties>;
  if (!transpiler || !decoders) return null;
  return readShaderSkyOf(transpiler)(sky)(decoders);
}

function isShaderSky(sky: AuthoredSky): sky is Sky<ShaderSkyText> {
  return sky.material.kind === 'shader';
}

/** One read sky for each sky and decoders, as viewports that draw one sky share its bake. */
const readShaderSkyOf = perObject((transpiler: SkyTranspiler) =>
  perObject((sky: Sky<ShaderSkyText>) =>
    perObject((decoders: ShaderDecoders): Sky => ({
      ...sky,
      material: transpiler.readShaderSky(sky.material, decoders),
    }))
  )
);

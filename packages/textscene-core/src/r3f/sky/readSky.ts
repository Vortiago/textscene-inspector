import type { AuthoredSky, BuiltInSkyProperties, ShaderSkyText, Sky } from '../../resources/sky/types';
import type { ProjectShaderOptions } from '../../shaders/rendererShaderOptions';
import { withAutomaticBake } from '../../resources/sky/decode';
import { perObject } from '../../utils/perObject';
import type { SkyTranspiler } from './skyTranspiler';

/** The sky with its shader read, or null while the transpiler or the parse options load. */
export function useReadSky(
  sky: AuthoredSky,
  transpiler: SkyTranspiler | null,
  options: ProjectShaderOptions | null
): Sky | null {
  if (!isShaderSky(sky)) return sky as Sky<BuiltInSkyProperties>;
  if (!transpiler || !options) return null;
  return readShaderSkyOf(transpiler)(sky)(options);
}

function isShaderSky(sky: AuthoredSky): sky is Sky<ShaderSkyText> {
  return sky.material.kind === 'shader';
}

/** One read sky for each sky and options, as viewports that draw one sky share its bake. */
const readShaderSkyOf = perObject((transpiler: SkyTranspiler) =>
  perObject((sky: Sky<ShaderSkyText>) =>
    perObject((options: ProjectShaderOptions): Sky =>
      withAutomaticBake({ ...sky, material: transpiler.readShaderSky(sky.material, options) })
    )
  )
);

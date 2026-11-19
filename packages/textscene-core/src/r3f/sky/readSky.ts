import type { AuthoredSky, Sky } from '../../resources/sky/types';
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
  if (!transpiler || !options) return null;
  return readSkyOf(transpiler)(sky)(options);
}

/** One read sky for each sky and options, as viewports that draw one sky share its bake. */
const readSkyOf = perObject((transpiler: SkyTranspiler) =>
  perObject((sky: AuthoredSky) =>
    perObject((options: ProjectShaderOptions): Sky =>
      withAutomaticBake({ ...sky, material: transpiler.readShaderSky(sky.material, options) })
    )
  )
);

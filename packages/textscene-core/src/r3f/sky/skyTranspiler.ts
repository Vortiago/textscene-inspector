import { useEffect, useState } from 'react';
import { warn } from '../../logger';
import { memoisedImport } from '../../resources/memoisedImport';

/** Imported by the first shader sky only: it holds the shader parser, which would double the first paint. */
const loadSkyTranspiler = memoisedImport(() => import('../../resources/sky/shaderSky'));

export type SkyTranspiler = Awaited<ReturnType<typeof loadSkyTranspiler>>;

/** The transpiler for a sky that needs it, or null: no need, still loading, or the import failed. */
export function useSkyTranspiler(isNeeded: boolean): SkyTranspiler | null {
  const loaded = loadSkyTranspiler.state();
  const [transpiler, setTranspiler] = useState<SkyTranspiler | null>(
    typeof loaded === 'object' ? loaded.module : null
  );
  useEffect(() => {
    if (!isNeeded || transpiler) return undefined;
    let isCurrent = true;
    loadSkyTranspiler().then(
      (module) => isCurrent && setTranspiler(module),
      (error: unknown) => warn('[Sky] could not load the sky transpiler', error)
    );
    return () => {
      isCurrent = false;
    };
  }, [isNeeded, transpiler]);
  return isNeeded ? transpiler : null;
}

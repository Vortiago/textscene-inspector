import { useMemo } from 'react';
import type { ShaderSkyProperties } from '../../resources/sky/types.js';
import type { ProjectShaderOptions } from '../../shaders/rendererShaderOptions.js';
import { useShaderErrorReport } from '../contexts/ShaderErrorsContext.js';
import type { SkyTranspiler } from './skyTranspiler.js';

/** Reports why a sky shader draws Godot's default sky, once the transpiler and its options load. */
export function useShaderSkyErrorReport(
  material: ShaderSkyProperties | null,
  transpiler: SkyTranspiler | null,
  options: ProjectShaderOptions | null
): void {
  const refusal = useMemo(
    () => (!material || !transpiler || !options ? null : transpiler.shaderSkyRefusal(material, options)),
    [material, transpiler, options]
  );
  useShaderErrorReport(refusal);
}

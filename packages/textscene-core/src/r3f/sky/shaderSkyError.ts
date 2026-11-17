import { useMemo } from 'react';
import type { SkyProperties } from '../../resources/sky/types.js';
import type { ShaderDecoders } from '../../shaders/preprocessor/decoders.js';
import { useShaderErrorReport } from '../contexts/ShaderErrorsContext.js';
import type { SkyTranspiler } from './skyTranspiler.js';

/** Reports why a sky shader draws Godot's default sky, once the transpiler and its decoders load. */
export function useShaderSkyErrorReport(
  material: SkyProperties | null,
  transpiler: SkyTranspiler | null,
  decoders: ShaderDecoders | null
): void {
  const refusal = useMemo(
    () =>
      material?.kind !== 'shader' || !transpiler || !decoders
        ? null
        : transpiler.shaderSkyRefusal(material, decoders),
    [material, transpiler, decoders]
  );
  useShaderErrorReport(refusal);
}

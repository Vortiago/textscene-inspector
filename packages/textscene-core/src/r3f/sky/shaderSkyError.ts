import { useMemo } from 'react';
import { shaderSkyRefusal } from '../../resources/sky/shaderSky.js';
import type { SkyProperties } from '../../resources/sky/types.js';
import type { ShaderDecoders } from '../../shaders/preprocessor/decoders.js';
import { useShaderErrorReport } from '../contexts/ShaderErrorsContext.js';

/** Reports why a sky shader draws Godot's default sky, once the decoders its `#if` may need load. */
export function useShaderSkyErrorReport(material: SkyProperties, decoders: ShaderDecoders | null): void {
  const code = material.kind === 'shader' ? material.code : null;
  const refusal = useMemo(
    () => (code === null || decoders === null ? null : shaderSkyRefusal(code, decoders)),
    [code, decoders]
  );
  useShaderErrorReport(refusal);
}

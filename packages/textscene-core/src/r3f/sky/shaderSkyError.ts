import { useMemo } from 'react';
import { shaderSkyRefusal } from '../../resources/sky/shaderSky.js';
import type { SkyProperties } from '../../resources/sky/types.js';
import type { ShaderDecoders } from '../../shaders/preprocessor/decoders.js';
import { useShaderErrorReport } from '../contexts/ShaderErrorsContext.js';

/** Reports why a sky shader draws Godot's default sky, once the decoders its `#if` may need load. */
export function useShaderSkyErrorReport(material: SkyProperties, decoders: ShaderDecoders | null): void {
  const refusal = useMemo(
    () => (material.kind !== 'shader' || decoders === null ? null : shaderSkyRefusal(material, decoders)),
    [material, decoders]
  );
  useShaderErrorReport(refusal);
}

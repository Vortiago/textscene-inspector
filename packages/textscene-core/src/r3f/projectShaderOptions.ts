import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { projectRenderingMethod } from '../parser/projectSettingsParser.js';
import { rendererShaderOptions, type ProjectShaderOptions } from '../shaders/rendererShaderOptions.js';
import { projectShaderOptionsOf } from './keptShaderOptions.js';
import { useProjectSettings } from './contexts/ProjectSettingsContext.js';
import { useShaderDecoders } from './shaderDecoders.js';

/** The options once the decoders load, and null while they load. */
export function useProjectShaderOptions(code: string | null): ProjectShaderOptions | null {
  const decoders = useShaderDecoders(code);
  const gl = useThree((state) => state.gl);
  const { settings } = useProjectSettings();
  const renderingMethod = projectRenderingMethod(settings);
  return useMemo(
    () => decoders && projectShaderOptionsOf(decoders, rendererShaderOptions(gl, renderingMethod)),
    [decoders, gl, renderingMethod]
  );
}

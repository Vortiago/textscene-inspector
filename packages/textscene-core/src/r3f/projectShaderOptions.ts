import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { projectRenderingMethod } from '../parser/projectSettingsParser.js';
import type { ShaderDecoders } from '../shaders/preprocessor/decoders.js';
import {
  rendererShaderOptions,
  type ProjectShaderOptions,
  type RendererShaderOptions,
} from '../shaders/language/rendererShaderOptions.js';
import { perObject } from '../utils/perObject.js';
import { useProjectSettings } from './contexts/ProjectSettingsContext.js';
import { useShaderDecoders } from './shaderDecoders.js';

/** The options once the decoders load, and null while they load. */
export function useProjectShaderOptions(code: string | null): ProjectShaderOptions | null {
  const decoders = useShaderDecoders(code);
  const gl = useThree((state) => state.gl);
  const { settings } = useProjectSettings();
  const renderingMethod = useMemo(() => projectRenderingMethod(settings), [settings]);
  return useMemo(
    () => decoders && projectShaderOptionsOf(decoders, rendererShaderOptions(gl, renderingMethod)),
    [decoders, gl, renderingMethod]
  );
}

/** Written only by `projectShaderOptionsOf`: one object for each decoders and renderer options. */
const optionsOf = perObject((_decoders: ShaderDecoders) => new Map<string, ProjectShaderOptions>());

/** One object for equal options, as each compile and read sky is kept for its options object. */
export function projectShaderOptionsOf(
  decoders: ShaderDecoders,
  renderer: RendererShaderOptions
): ProjectShaderOptions {
  const kept = optionsOf(decoders);
  const key = `${renderer.renderingMethod}:${renderer.glVaryings}`;
  const options = kept.get(key) ?? { decoders, ...renderer };
  kept.set(key, options);
  return options;
}

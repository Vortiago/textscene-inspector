import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { projectSampling } from '../../parser/projectSettingsParser';
import type { LazyImport } from '../../resources/memoisedImport';
import { useLazyModuleState } from '../../resources/useLazyModule';
import type { ProjectShaderOptions } from '../../shaders/rendererShaderOptions';
import type { ProjectSampling } from '../../shaders/uniforms/samplerState';
import { warnOnce } from '../../utils/warnOnce';
import { useNodesHandler } from '../canvasRenderer/canvasNodesHandler';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';
import { useProjectShaderOptions } from '../projectShaderOptions';

/** A loaded translator module, and the project's options it translates `shader` with. */
export interface ShaderTranslator<Module> {
  readonly module: Module;
  readonly options: ProjectShaderOptions;
  readonly sampling: ProjectSampling;
}

/** The translator `load` imports, null while anything loads; a failed load warns `loadFailure` once. */
export function useShaderTranslator<Module>(
  load: LazyImport<Module>,
  /** The text a decoder call is read from, or null for a text Godot generates, which calls none. */
  fileCode: string | null,
  loadFailure: string
): ShaderTranslator<Module> | null {
  const gl = useThree((state) => state.gl);
  const loaded = useLazyModuleState(load, true);
  const module = typeof loaded === 'object' && loaded !== null ? loaded.module : null;
  const nodesHandler = useNodesHandler(gl);
  const options = useProjectShaderOptions(fileCode);
  const { settings } = useProjectSettings();
  const sampling = useMemo(() => projectSampling(settings), [settings]);
  const isLoadFailed = loaded === 'failed' || nodesHandler === 'failed';
  useEffect(() => {
    if (isLoadFailed) warnOnce(load, loadFailure, loadFailure);
  }, [load, isLoadFailed, loadFailure]);
  const isReady = module !== null && options !== null && nodesHandler === 'ready';
  return useMemo(
    () => (isReady ? { module, options, sampling } : null),
    [isReady, module, options, sampling]
  );
}

/** Warns once for `material` with the reason its translator refuses it, while there is one. */
export function useShaderRefusalWarning(material: object, refusal: string | null): void {
  useEffect(() => {
    if (refusal) warnOnce(material, 'refused', refusal);
  }, [material, refusal]);
}

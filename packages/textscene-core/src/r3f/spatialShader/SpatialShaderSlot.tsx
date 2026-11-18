import { useEffect, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import { projectSampling } from '../../parser/projectSettingsParser';
import type { ShaderText } from '../../resources/materials/shadermaterial/types';
import { memoisedImport } from '../../resources/memoisedImport';
import { useLazyModuleState } from '../../resources/useLazyModule';
import { warnOnce } from '../../utils/warnOnce';
import { useNodesHandler } from '../canvasRenderer/canvasNodesHandler';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';
import { drawGroupOf, materialAt, placeMaterial, type MaterialHost } from '../materials/swappedMaterials';
import { useProjectShaderOptions } from '../projectShaderOptions';
import { useShaderTextures } from '../shaderTextures/shaderTextures';

/** Imported by the first spatial shader only: it holds the shader parser and three's TSL. */
const loadSpatialSurface = memoisedImport(() => import('./spatialSurface'));

const LOAD_FAILURE =
  "[material] The previewer could not load its spatial shader translator, and draws Godot's default 3D surface. Reload to try again.";

interface SpatialShaderSlotProps {
  shader: ShaderText;
  /** R3F attach key: `material-N` for a mesh of several surfaces. */
  attach?: string;
  /** What the surface draws while the translator loads, and for a shader it refuses. */
  fallback: ReactNode;
}

export function SpatialShaderSlot({ shader, attach, fallback }: SpatialShaderSlotProps) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const loaded = useLazyModuleState(loadSpatialSurface, true);
  const module = typeof loaded === 'object' && loaded !== null ? loaded.module : null;
  const nodesHandler = useNodesHandler(gl, true);
  const options = useProjectShaderOptions(shader.code);
  const { settings } = useProjectSettings();
  const sampling = useMemo(() => projectSampling(settings), [settings]);
  const isReady = module !== null && options !== null && nodesHandler === 'ready';
  const surface = useMemo(
    () => (isReady ? module.spatialSurfaceOf(gl, shader, { ...options, sampling }) : null),
    [isReady, module, gl, shader, options, sampling]
  );
  const drawn = surface && 'spatial' in surface ? surface : null;
  const spatial = drawn?.spatial ?? null;
  useEffect(() => (spatial ? () => module!.disposeSpatial(spatial) : undefined), [module, spatial]);

  const refusal = surface && 'refusal' in surface ? surface.refusal : null;
  const isLoadFailed = loaded === 'failed' || nodesHandler === 'failed';
  useEffect(() => {
    if (refusal) warnOnce(shader, 'refused', refusal);
    else if (isLoadFailed) warnOnce(loadSpatialSurface, 'failed', LOAD_FAILURE);
  }, [shader, refusal, isLoadFailed]);

  const samplers = drawn?.samplers ?? null;
  const [textures, textureSlots] = useShaderTextures(
    useMemo(() => samplers && { references: shader.textures, samplers }, [samplers, shader.textures])
  );
  useLayoutEffect(() => {
    if (!spatial) return;
    module!.setMaterialParameters(spatial.parameters, shader.parameters, textures);
    invalidate();
  }, [module, spatial, shader.parameters, textures, invalidate]);

  const surfaceAttach = useMemo(
    () => module && godotSurfaceAttach(attach, module.withGodotSurface),
    [module, attach]
  );
  if (!spatial || !surfaceAttach) return <>{fallback}</>;
  return (
    <>
      <primitive object={spatial.material} attach={surfaceAttach} />
      {textureSlots}
    </>
  );
}

interface GodotSurfaceHost extends MaterialHost {
  geometry: THREE.BufferGeometry;
}

/** Godot's attributes before the material: three builds the program from the attributes of the first draw. */
function godotSurfaceAttach(
  attach: string | undefined,
  withGodotSurface: (geometry: THREE.BufferGeometry) => void
) {
  const drawGroup = drawGroupOf(attach);
  return (host: GodotSurfaceHost, material: THREE.Material) => {
    if (host.geometry.getAttribute('position')) withGodotSurface(host.geometry);
    const previous = materialAt(host, drawGroup);
    placeMaterial(host, drawGroup, material);
    return () => {
      if (previous) placeMaterial(host, drawGroup, previous);
    };
  };
}

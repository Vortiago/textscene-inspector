import { useEffect, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import type * as THREE from 'three';
import type { PointDraw } from '../../shaders/spatial/spatialPipeline';
import { projectRoughnessLimiter } from '../../parser/projectSettingsParser';
import { memoisedImport } from '../../resources/memoisedImport';
import { useProjectSettings } from '../contexts/ProjectSettingsContext';
import {
  drawGroupOf,
  materialAt,
  placeMaterial,
  type MaterialAttach,
  type MaterialHost,
} from '../materials/swappedMaterials';
import { OTHER_DRAWS_SURFACE } from '../materials/useOneSurfaceStartingMaterial';
import { generatedFallbackOf } from '../../shaders/fault/shaderRefusal';
import { useShaderTextures } from '../shaderTextures/shaderTextures';
import { useShaderRefusalWarning, useShaderTranslator } from '../shaderTranslator/useShaderTranslator';
import type { SurfaceShaderSource } from './surfaceShader';

/** Imported by the first spatial shader only: it holds the shader parser and three's TSL. */
const loadSpatialSurface = memoisedImport(() => import('./spatialSurface'));

type SpatialSurfaceModule = typeof import('./spatialSurface');

const loadFailureOf = (fallback: string) =>
  `[material] The previewer could not load its spatial shader translator, and draws ${fallback}. Reload to try again.`;

interface SpatialShaderSlotProps {
  source: SurfaceShaderSource;
  /** R3F attach key: `material-N` for a mesh of several surfaces, or a fade's swap of one surface. */
  attach?: string | MaterialAttach;
  /** What the surface draws while the translator loads, and for a shader it refuses. */
  fallback: ReactNode;
  /** What the surface draws for a sampled texture that never draws: the missing-texture placeholder. */
  placeholder?: ReactNode;
}

export function SpatialShaderSlot({ source, attach, fallback, placeholder }: SpatialShaderSlotProps) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const scene = useThree((state) => state.scene);
  const { material, fileCode, isGenerated, fallbackName } = sourceOf(source);
  const translator = useShaderTranslator(loadSpatialSurface, fileCode, loadFailureOf(fallbackName));
  const module = translator?.module ?? null;
  const shader = useMemo(() => module?.surfaceShaderOf(source) ?? null, [module, source]);
  const { settings } = useProjectSettings();
  const roughnessLimiter = useMemo(() => projectRoughnessLimiter(settings), [settings]);
  const surface = useMemo(
    () =>
      translator &&
      shader &&
      translator.module.spatialSurfaceOf(gl, shader, {
        ...translator.options,
        sampling: translator.sampling,
        roughnessLimiter,
      }),
    [translator, gl, shader, roughnessLimiter]
  );
  const drawn = surface && 'spatial' in surface ? surface : null;
  const spatial = drawn?.spatial ?? null;
  useEffect(() => (spatial ? () => module!.disposeSpatial(spatial) : undefined), [module, spatial]);
  useShaderRefusalWarning(material, surface && 'refusal' in surface ? surface.refusal : null);

  const samplers = drawn?.samplers ?? null;
  const [textures, textureSlots, slotStates] = useShaderTextures(
    useMemo(() => samplers && shader && { references: shader.textures, samplers }, [samplers, shader])
  );
  useLayoutEffect(() => {
    if (!spatial || !shader) return;
    module!.setParameterValues(spatial.parameters, shader.parametersWith(textures, slotStates.byKey));
    invalidate();
  }, [module, spatial, shader, textures, slotStates, invalidate]);

  const surfaceAttach = useMemo(
    () => module && spatial && godotSurfaceAttach(attach, module, spatial.pointDraw, scene),
    [module, attach, spatial, scene]
  );
  if (!spatial || !surfaceAttach) return <>{fallback}</>;
  // A texture that never draws takes the placeholder, the mark the classic material gives it.
  const held = slotStates.outcome === 'missing' && placeholder ? placeholder : null;
  // A generated shader waits for its textures, so the classic material that already draws them stays.
  const waiting = isGenerated && slotStates.outcome !== 'settled' ? fallback : null;
  if (held ?? waiting) {
    return (
      <>
        {held ?? waiting}
        {textureSlots}
      </>
    );
  }
  return (
    <>
      <primitive object={spatial.material} attach={surfaceAttach} />
      {textureSlots}
    </>
  );
}

interface GodotSurfaceHost extends MaterialHost, THREE.Object3D {
  geometry: THREE.BufferGeometry;
}

type SurfaceModule = Pick<SpatialSurfaceModule, 'withGodotSurface' | 'drawPoints'>;

/** Godot's attributes before the material: three builds the program from the attributes of the first draw. */
function godotSurfaceAttach(
  attach: string | MaterialAttach | undefined,
  module: SurfaceModule,
  pointDraw: PointDraw | null,
  scene: THREE.Scene
) {
  const placed = typeof attach === 'function' ? attach : placedAt(drawGroupOf(attach));
  const drawGroup = typeof attach === 'function' ? null : drawGroupOf(attach);
  return (host: GodotSurfaceHost, material: THREE.Material) => {
    if (host.geometry.getAttribute('position')) module.withGodotSurface(host.geometry);
    const stopPoints = pointDraw && module.drawPoints(host, drawGroup, material, pointDraw, scene);
    const detach = placed(host, stopPoints ? OTHER_DRAWS_SURFACE : material);
    return () => {
      stopPoints?.();
      detach();
    };
  };
}

/** Places a material at `drawGroup`, and puts back the one it replaced on detach. */
const placedAt =
  (drawGroup: number | null): MaterialAttach =>
  (host, material) => {
    const previous = materialAt(host, drawGroup);
    placeMaterial(host, drawGroup, material);
    return () => {
      if (previous) placeMaterial(host, drawGroup, previous);
    };
  };

/** What its surfaces warn once for, the text decoders read, whether Godot writes it, and its fallback. */
function sourceOf(source: SurfaceShaderSource) {
  if ('shader' in source) {
    const fallbackName = "Godot's default 3D surface";
    return { material: source.shader, fileCode: source.shader.code, isGenerated: false, fallbackName };
  }
  if ('baseMaterial' in source) {
    const fallbackName = generatedFallbackOf(source.baseMaterial.materialClass);
    return { material: source.baseMaterial, fileCode: null, isGenerated: true, fallbackName };
  }
  return {
    material: source.defaultMaterial,
    fileCode: null,
    isGenerated: true,
    fallbackName: 'the classic material',
  };
}

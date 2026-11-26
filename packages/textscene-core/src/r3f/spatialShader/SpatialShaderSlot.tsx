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
import { useShaderTextures } from '../shaderTextures/shaderTextures';
import { useShaderRefusalWarning, useShaderTranslator } from '../shaderTranslator/useShaderTranslator';
import type { SurfaceShaderSource } from './surfaceShader';
import { sampledTexturesOutcome } from '../shaderTextures/samplerValues';

/** Imported by the first spatial shader only: it holds the shader parser and three's TSL. */
const loadSpatialSurface = memoisedImport(() => import('./spatialSurface'));

type SpatialSurfaceModule = typeof import('./spatialSurface');

const LOAD_FAILURE =
  "[material] The previewer could not load its spatial shader translator, and draws Godot's default 3D surface. Reload to try again.";
const GENERATED_LOAD_FAILURE =
  '[material] The previewer could not load its spatial shader translator, and draws the classic material. Reload to try again.';

interface SpatialShaderSlotProps {
  source: SurfaceShaderSource;
  /** R3F attach key: `material-N` for a mesh of several surfaces, or a fade's swap of one surface. */
  attach?: string | MaterialAttach;
  /** What the surface draws while the translator loads, and for a shader it refuses. */
  fallback: ReactNode;
  /** What a generated shader draws for a texture that never draws, the classic rule's placeholder. */
  placeholder?: ReactNode;
}

export function SpatialShaderSlot({ source, attach, fallback, placeholder }: SpatialShaderSlotProps) {
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  const scene = useThree((state) => state.scene);
  const { material, fileCode, isGenerated } = sourceOf(source);
  const loadFailure = isGenerated ? GENERATED_LOAD_FAILURE : LOAD_FAILURE;
  const translator = useShaderTranslator(loadSpatialSurface, fileCode, loadFailure);
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
    module!.setParameterValues(spatial.parameters, shader.parametersWith(textures, slotStates));
    invalidate();
  }, [module, spatial, shader, textures, slotStates, invalidate]);

  const surfaceAttach = useMemo(
    () => module && spatial && godotSurfaceAttach(attach, module, spatial.pointDraw, scene),
    [module, attach, spatial, scene]
  );
  if (!spatial || !surfaceAttach) return <>{fallback}</>;
  // A generated shader waits for its textures, so the classic material that already draws them stays.
  const textureOutcome = isGenerated
    ? sampledTexturesOutcome(shader!.textures, samplers!, slotStates)
    : 'settled';
  if (textureOutcome !== 'settled') {
    return (
      <>
        {textureOutcome === 'missing' ? (placeholder ?? fallback) : fallback}
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

/** The material its surfaces warn once for, the text decoders read, and whether Godot writes the text. */
function sourceOf(source: SurfaceShaderSource) {
  if ('shader' in source)
    return { material: source.shader, fileCode: source.shader.code, isGenerated: false };
  const material = 'baseMaterial' in source ? source.baseMaterial : source.defaultMaterial;
  return { material, fileCode: null, isGenerated: true };
}

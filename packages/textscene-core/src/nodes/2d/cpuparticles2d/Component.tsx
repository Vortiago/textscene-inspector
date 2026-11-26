/**
 * <CPUParticles2D> draws Godot's CPU particle emitter as a frozen pose: evaluated once at mount
 * (`simulate.ts`, which says why there is no clock), and drawn through the canvas mesh body as one
 * copy of the texture quad for each particle (`poseInstances.ts`). `emitting = false` draws nothing,
 * as Godot's `_update_internal` returns early, but the node still positions children.
 */

import { useMemo, useState } from 'react';
import type * as THREE from 'three';
import { affineInverseTransform2D, type Transform2DColumns } from '../../../godot/math/transform2d';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useNodeReference } from '../../../resources/reading';
import { threeMatrixFromTransform2D } from '../../../r3f/node2dTransform';
import type { CanvasItemMaterialProperties } from '../../../resources/materials/canvasitemmaterial/types';
import { CanvasMeshBody } from '../../../r3f/canvasMesh/CanvasMeshBody';
import { useCanvasMeshTexture } from '../../../r3f/canvasMesh/useCanvasMeshTexture';
import type { CanvasSurface } from '../../../r3f/canvasMesh/canvasSurface';
import { multiMeshCommands, type CanvasShaderCommand } from '../../../r3f/canvasShader/canvasCommands';
import type { ImageSize } from '../../../resources/formats/image/imagePixels';
import { canvasInstancesGeometry } from '../../../r3f/meshes/canvasMeshInstances';
import { particlesFlipbook } from '../../../r3f/particlesFlipbook';
import { useEmissionTransform } from './emissionTransform';
import { particleQuad, poseInstances } from './poseInstances';
import { useParticleResources } from '../../shared/cpuparticles/useParticleResources';
import { loadSimulate } from './simulateModule';
import type { RenderedParticle } from './simulate';
import type { CPUParticles2DProperties } from './types';
import { useDisposeOnRelease } from '../../../r3f/useDisposeOnRelease';
import { useLazyModuleState } from '../../../resources/useLazyModule';

/** The quad of an emitter with no texture (`cpu_particles_2d.cpp:186-192`). */
const UNTEXTURED_QUAD: ImageSize = { width: 1, height: 1 };

/** The frozen pose, and where it draws inside the emitter: through the inverse of its emission transform. */
interface PlacedPose {
  readonly particles: readonly RenderedParticle[];
  readonly placement: Transform2DColumns;
}

interface ParticleInput {
  pose: PlacedPose | null;
  /** The texture's size, or undefined while it draws untextured. */
  size: ImageSize | undefined;
}

export function CPUParticles2D({ node, children }: NodeComponentProps) {
  const props = node.properties as CPUParticles2DProperties;
  const scope = useSceneResources();
  // The body loads no maps while the emitter is not emitting, since it draws no surface.
  const reference = useNodeReference(props.texture, scope);
  const texture = useCanvasMeshTexture(props, { reference });
  // A callback ref, not useRef: the emission transform is sampled once the anchor has a world matrix.
  const [anchor, setAnchor] = useState<THREE.Group | null>(null);
  const pose = useFrozenPose(props, anchor);
  const size = texture.size;
  const surfaces = useMemo(
    () =>
      props.emitting
        ? {
            input: { pose, size },
            useSurfaces: useParticleSurfaces,
            shadedCommands: () => particleCommands({ pose, size }),
          }
        : null,
    [props.emitting, pose, size]
  );
  // Godot draws a texture that fails to load as none: its loader leaves the property null, and the
  // multimesh draws with white (`cpu_particles_2d.cpp:1288-1291`).
  return (
    <CanvasMeshBody node={node} props={props} texture={texture} withoutTexture="white" surfaces={surfaces}>
      {/* The emitter's own place in its canvas, which the emission transform samples. */}
      <group ref={setAnchor} name={`${node.name}_Emitter`} />
      {children}
    </CanvasMeshBody>
  );
}

/** The pose of an emitting emitter, null until it exists, sampled where `anchor` sits. */
function useFrozenPose(props: CPUParticles2DProperties, anchor: THREE.Object3D | null): PlacedPose | null {
  const emissionTransform = useEmissionTransform(anchor, props.local_coords);
  const { curves, scaleCurves, colorRamp, colorInitialRamp } = useParticleResources({
    params: props.params,
    scaleCurves: { x: props.scale_curve_x, y: props.scale_curve_y },
    colorRamp: props.color_ramp,
    colorInitialRamp: props.color_initial_ramp,
  });
  const loaded = useLazyModuleState(loadSimulate, props.emitting);
  const simulate = loaded && typeof loaded === 'object' ? loaded.module : null;
  return useMemo(
    () =>
      simulate && {
        particles: simulate.simulateFrozenPose({
          props,
          curves,
          scaleCurves,
          colorRamp,
          colorInitialRamp,
          emissionTransform,
        }),
        // Godot draws the canvas-space pose at the canvas transform (`renderer_canvas_cull.cpp:267`).
        placement: affineInverseTransform2D(emissionTransform),
      },
    [simulate, props, curves, scaleCurves, colorRamp, colorInitialRamp, emissionTransform]
  );
}

/** Godot's quad is the texture's size, or 1 by 1 with none (`cpu_particles_2d.cpp:186-192`). */
const sizeOf = (size: ImageSize | undefined): [number, number] => {
  const { width, height } = size ?? UNTEXTURED_QUAD;
  return [width, height];
};

/** `canvas_item_add_multimesh` of the pose, a particle an instance (`cpu_particles_2d.cpp:1293`). */
function particleCommands({ pose, size }: ParticleInput): CanvasShaderCommand[] {
  if (!pose) return [];
  return multiMeshCommands([particleQuad(...sizeOf(size))], poseInstances(pose.particles), pose.placement);
}

/** The texture quad copied for each particle in pose order, or null until the pose exists and for none. */
function useParticleSurfaces(
  { pose, size }: ParticleInput,
  material: CanvasItemMaterialProperties | null
): readonly CanvasSurface[] | null {
  const flipbook = useMemo(() => particlesFlipbook(material), [material]);
  // The normal map then turns with the canvas basis, not the emitter's (`canvas.glsl:708`).
  const canvasPlacement = useMemo(() => pose && threeMatrixFromTransform2D(pose.placement), [pose]);
  // An unset ViewportTexture reports size 0, so its quads have no area (`viewport.cpp:156-160`).
  const [width, height] = sizeOf(size);
  const geometry = useMemo(
    () =>
      pose && pose.particles.length > 0
        ? canvasInstancesGeometry(particleQuad(width, height), poseInstances(pose.particles), flipbook)
        : null,
    [pose, width, height, flipbook]
  );
  useDisposeOnRelease(geometry);

  // Each particle has its own colour and alpha, and each quad is wound by its own transform's
  // determinant. The canvas-item facing draws the mesh once, in index order, so a mirrored particle
  // composites in emission order.
  return useMemo(
    () =>
      geometry && canvasPlacement
        ? [{ geometry, vertexColors: 'instance' as const, matrix: canvasPlacement }]
        : null,
    [geometry, canvasPlacement]
  );
}

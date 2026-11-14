/**
 * <CPUParticles2D> draws Godot's CPU particle emitter as a frozen pose: evaluated once at mount
 * (`simulate.ts`, which says why there is no clock), and drawn through the canvas mesh body as one
 * copy of the texture quad for each particle (`poseInstances.ts`). `emitting = false` draws nothing,
 * as Godot's `_update_internal` returns early, but the node still positions children.
 */

import { useMemo, useState } from 'react';
import type * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useNodeReference } from '../../../resources/reading';
import { threeMatrixFromTransform2D } from '../../../r3f/node2dTransform';
import type { CanvasItemMaterialProperties } from '../../../resources/materials/canvasitemmaterial/types';
import { CanvasMeshBody } from '../../../r3f/canvasMesh/CanvasMeshBody';
import { useCanvasMeshTexture } from '../../../r3f/canvasMesh/useCanvasMeshTexture';
import type { CanvasSurface } from '../../../r3f/canvasMesh/canvasSurface';
import type { ImageSize } from '../../../resources/formats/image/imagePixels';
import { canvasInstancesGeometry } from '../../../r3f/meshes/canvasMeshInstances';
import { particlesFlipbook } from '../../../r3f/particlesFlipbook';
import { useEmissionTransform } from './emissionTransform';
import { particleQuad, poseInstances } from './poseInstances';
import { useParticleResources } from '../../shared/cpuparticles/useParticleResources';
import { loadSimulate } from './simulateModule';
import type { CPUParticles2DProperties } from './types';
import { useDisposeOnRelease } from '../../../r3f/useDisposeOnRelease';
import { useLazyModule } from '../../../resources/useLazyModule';

/** The quad of an emitter with no texture (`cpu_particles_2d.cpp:186-192`). */
const UNTEXTURED_QUAD: ImageSize = { width: 1, height: 1 };

interface ParticleInput {
  props: CPUParticles2DProperties;
  /** The group the pose samples its emission transform from, once it is in the tree. */
  container: THREE.Group | null;
  /** The texture's size, or undefined while it draws untextured. */
  size: ImageSize | undefined;
}

export function CPUParticles2D({ node, children }: NodeComponentProps) {
  const props = node.properties as CPUParticles2DProperties;
  const scope = useSceneResources();
  // An emitter that is not emitting draws nothing, so it loads no texture and no maps.
  const reference = useNodeReference(props.emitting ? props.texture : undefined, scope);
  const texture = useCanvasMeshTexture(props, { reference });
  // A callback ref, not useRef: the emission-transform sample runs once the
  // container is in the tree, since its world matrix does not exist before.
  const [container, setContainer] = useState<THREE.Group | null>(null);
  const bodyGroup = useMemo(() => ({ name: `${node.name}_Particles`, ref: setContainer }), [node.name]);
  const surfaces = useMemo(
    () =>
      props.emitting
        ? { input: { props, container, size: texture.size }, useSurfaces: useParticleSurfaces }
        : null,
    [props, container, texture.size]
  );
  // Godot draws a texture that fails to load as none: its loader leaves the property null, and the
  // multimesh draws with white (`cpu_particles_2d.cpp:1288-1291`).
  return (
    <CanvasMeshBody
      node={node}
      props={props}
      texture={texture}
      withoutTexture="white"
      surfaces={surfaces}
      bodyGroup={bodyGroup}
    >
      {children}
    </CanvasMeshBody>
  );
}

/**
 * The one surface of the frozen pose: a copy of the texture quad for each particle, in pose order,
 * placed back in canvas space. Null until the pose exists, and for an empty pose.
 */
function useParticleSurfaces(
  { props, container, size }: ParticleInput,
  material: CanvasItemMaterialProperties | null
): readonly CanvasSurface[] | null {
  const flipbook = useMemo(() => particlesFlipbook(material), [material]);
  const emissionTransform = useEmissionTransform(container, props.local_coords);
  // The pose is in canvas space, where Godot draws it, so the mesh cancels the emitter's canvas
  // transform. The normal map then turns with the canvas basis, not the emitter's (`canvas.glsl:708`).
  const canvasPlacement = useMemo(
    () => threeMatrixFromTransform2D(emissionTransform).invert(),
    [emissionTransform]
  );

  const { curves, scaleCurves, colorRamp, colorInitialRamp } = useParticleResources({
    params: props.params,
    scaleCurves: { x: props.scale_curve_x, y: props.scale_curve_y },
    colorRamp: props.color_ramp,
    colorInitialRamp: props.color_initial_ramp,
  });

  const simulate = useLazyModule(loadSimulate);
  const pose = useMemo(
    () =>
      simulate &&
      simulate.simulateFrozenPose({
        props,
        curves,
        scaleCurves,
        colorRamp,
        colorInitialRamp,
        emissionTransform,
      }),
    [simulate, props, curves, scaleCurves, colorRamp, colorInitialRamp, emissionTransform]
  );

  // Godot's quad is the texture's size, or 1 by 1 with none (`cpu_particles_2d.cpp:186-192`). An
  // unset ViewportTexture reports size 0, so its quads have no area (`viewport.cpp:156-160`).
  const { width, height } = size ?? UNTEXTURED_QUAD;
  const geometry = useMemo(
    () =>
      pose && pose.length > 0
        ? canvasInstancesGeometry(particleQuad(width, height), poseInstances(pose), flipbook)
        : null,
    [pose, width, height, flipbook]
  );
  useDisposeOnRelease(geometry);

  // Each particle has its own colour and alpha, and each quad is wound by its own transform's
  // determinant. The canvas-item facing draws the mesh once, in index order, so a mirrored particle
  // composites in emission order.
  return useMemo(
    () => (geometry ? [{ geometry, vertexColors: 'instance' as const, matrix: canvasPlacement }] : null),
    [geometry, canvasPlacement]
  );
}

/**
 * <CPUParticles2D> draws Godot's CPU particle emitter as a frozen pose: evaluated
 * once at mount (`simulate.ts`, which says why there is no clock) and merged into
 * one geometry (`particleGeometry.ts`). `emitting = false` draws nothing, as
 * Godot's `_update_internal` returns early, but the node still positions children.
 */

import { useMemo, useState } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { CanvasItemGroup } from '../../../r3f/components/CanvasItemGroup';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useCanvas2DTexture } from '../../../r3f/canvas2DTextureDecode';
import { useNode2DCanvasTextureSampler } from '../../../r3f/canvasItemTextureSampler';
import { threeMatrixFromTransform2D } from '../../../r3f/node2dTransform';
import { instanceColorDefines, useCanvasColorSpace } from '../../../r3f/canvasColorSpace';
import { materialProgramInputs } from '../../../r3f/materialProgramInputs';
import { useTexture2D, type Texture2DResult } from '../../../resources/useTexture2D';
import type { CanvasItemPixelMaterial } from '../../../r3f/components/LitCanvasItemPixels';
import type { CanvasItemMaterialProperties } from '../../../resources/materials/canvasitemmaterial/types';
import { useEmissionTransform } from './emissionTransform';
import { buildParticleGeometry } from './particleGeometry';
import { particlesFlipbook } from '../../../r3f/particlesFlipbook';
import { useParticleResources } from '../../shared/cpuparticles/useParticleResources';
import { loadSimulate } from './simulateModule';
import type { CPUParticles2DProperties } from './types';
import { useDisposeOnRelease } from '../../../r3f/useDisposeOnRelease';
import { useLazyModule } from '../../../resources/useLazyModule';

/** The quad of an emitter with no texture (`cpu_particles_2d.cpp:186-192`). */
const UNTEXTURED_QUAD = { width: 1, height: 1 };

export function CPUParticles2D({ node, children }: NodeComponentProps) {
  const props = node.properties as CPUParticles2DProperties;
  const { externalResources, internalResources } = useSceneResources();
  const {
    texture: resolvedTexture,
    size,
    missing,
    canvasTexture,
  } = useTexture2D(props.texture, externalResources, internalResources);
  // A CanvasTexture's own filter and repeat win over the item's.
  const sampler = useNode2DCanvasTextureSampler(props, canvasTexture?.texture);
  // An emitter that is not emitting draws nothing, so it uploads no view and loads no maps.
  const texture = useCanvas2DTexture(props.emitting ? resolvedTexture : null, sampler);

  return (
    <CanvasItem2D
      node={node}
      props={props}
      canvasTexture={props.emitting ? canvasTexture : undefined}
      body={({ color, opacity }, material, pixelMaterial) =>
        props.emitting ? (
          <ParticleField
            props={props}
            name={node.name}
            texture={texture}
            size={size}
            missing={missing}
            color={color}
            opacity={opacity}
            material={material}
            pixelMaterial={pixelMaterial}
          />
        ) : null
      }
    >
      {children}
    </CanvasItem2D>
  );
}

function ParticleField({
  props,
  name,
  texture,
  size,
  missing,
  color,
  opacity,
  material,
  pixelMaterial,
}: {
  props: CPUParticles2DProperties;
  name: string;
  /** The view the particles sample, with the CanvasTexture's sampler where it names one. */
  texture: THREE.Texture | null;
  size: Texture2DResult['size'];
  /** The texture is set but failed to load. */
  missing: boolean;
  color: THREE.Color;
  opacity: number;
  material: CanvasItemMaterialProperties | null;
  pixelMaterial: CanvasItemPixelMaterial;
}) {
  const flipbook = useMemo(() => particlesFlipbook(material), [material]);

  // A callback ref, not useRef: the emission-transform sample runs once the
  // container is in the tree, since its world matrix does not exist before.
  const [container, setContainer] = useState<THREE.Group | null>(null);
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

  // Godot's quad is the texture's size, falling back to 1x1 when the emitter has none
  // (`cpu_particles_2d.cpp:186-192`).
  // An unset ViewportTexture reports size 0, so its quads have no area (`viewport.cpp:156-160`).
  const { width, height } = (texture && size) || UNTEXTURED_QUAD;

  const geometry = useMemo(
    () => pose && buildParticleGeometry(pose, width, height, flipbook),
    [pose, width, height, flipbook]
  );
  useDisposeOnRelease(geometry);

  // The field draws from the first frame on a 1x1 quad while the texture loads, so
  // this material compiles mapless unless a fresh one replaces it
  // (`materialProgramInputs.ts`). Called from the drawing arm: the group mounts
  // before a geometry can exist, as `useEmissionTransform` samples its world matrix.
  const canvasSpace = useCanvasColorSpace();
  const particleMesh = (geom: THREE.BufferGeometry) => {
    const program = materialProgramInputs({
      props: {
        map: texture,
        color,
        opacity,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        // The vertex colours hold each particle's colour, with the texture or without it.
        defines: instanceColorDefines(canvasSpace),
      },
      // Each particle has its own vertex colour and alpha, and each quad is wound
      // by its own transform's determinant (`particleGeometry.ts`). A split by
      // facing would composite a mirrored particle out of emission order, so
      // the canvas-item facing draws the mesh once, in index order.
      merge: [pixelMaterial],
    });
    return (
      <mesh geometry={geom} matrix={canvasPlacement} matrixAutoUpdate={false}>
        <meshBasicMaterial key={program.key} {...program.props} />
      </mesh>
    );
  };

  return (
    <CanvasItemGroup ref={setContainer} name={`${name}_Particles`}>
      {missing ? (
        // One marker for the emitter, not one per particle: the Resources tab
        // names the path, and overlapping magenta quads would bury the scene.
        <MissingResourcePlaceholder shape="plane" name={name} />
      ) : geometry ? (
        particleMesh(geometry)
      ) : null}
    </CanvasItemGroup>
  );
}

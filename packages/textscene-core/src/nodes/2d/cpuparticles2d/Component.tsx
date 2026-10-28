/**
 * <CPUParticles2D> draws Godot's CPU particle emitter as a frozen pose: evaluated
 * once at mount (`simulate.ts`, which says why there is no clock) and merged into
 * one geometry (`particleGeometry.ts`). `emitting = false` draws nothing, as
 * Godot's `_update_internal` returns early, but the node still positions children.
 */

import { useCallback, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { CanvasItemGroup } from '../../../r3f/components/CanvasItemGroup';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useLoadedFiles } from '../../../resources/useLoadedFiles';
import { useCanvas2DTexture } from '../../../r3f/canvas2DTextureDecode';
import { useNode2DTextureSampler } from '../../../r3f/canvasItemTextureSampler';
import { CANVAS_SRGB_DEFINES } from '../../../r3f/canvasSrgbMultiply';
import { materialProgramInputs } from '../../../r3f/materialProgramInputs';
import { useTexture2D } from '../../../resources/useTexture2D';
import { textureSize } from '../../../resources/textures/textureSize';
import type { CanvasItemPixelMaterial } from '../../../r3f/components/LitCanvasItemPixels';
import type { CanvasItemMaterialProperties } from '../../../resources/materials/canvasitemmaterial/types';
import { useEmissionTransform } from './emissionTransform';
import { buildParticleGeometry, type ParticleFlipbook } from './particleGeometry';
import { particleFiles, resolveParticleCurves, resolveParticleGradient } from './sceneResources';
import { simulateFrozenPose } from './simulate';
import type { CPUParticles2DProperties } from './types';
import { useDisposeOnRelease } from '../../../r3f/useDisposeOnRelease';

/** The quad of an emitter with no texture (`cpu_particles_2d.cpp:186-192`). */
const UNTEXTURED_QUAD = { width: 1, height: 1 };

export function CPUParticles2D({ node, children }: NodeComponentProps) {
  const props = node.properties as CPUParticles2DProperties;

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={({ color, opacity }, material, pixelMaterial) =>
        props.emitting ? (
          <ParticleField
            props={props}
            name={node.name}
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

/**
 * The emitter's flipbook, or null when its material has none. `particles_anim`,
 * a CanvasItemMaterial setting only a particles node drives, makes the texture a
 * sheet of cells, and a particle picks its cell from its simulated anim value.
 */
function particleFlipbook(material: CanvasItemMaterialProperties | null): ParticleFlipbook | null {
  if (!material?.particlesAnimation) return null;
  return {
    hFrames: material.particlesAnimHFrames,
    vFrames: material.particlesAnimVFrames,
    loop: material.particlesAnimLoop,
  };
}

function ParticleField({
  props,
  name,
  color,
  opacity,
  material,
  pixelMaterial,
}: {
  props: CPUParticles2DProperties;
  name: string;
  color: THREE.Color;
  opacity: number;
  material: CanvasItemMaterialProperties | null;
  pixelMaterial: CanvasItemPixelMaterial;
}) {
  const pools = useSceneResources();
  const { externalResources, internalResources } = pools;
  const flipbook = useMemo(() => particleFlipbook(material), [material]);
  const { texture: resolvedTexture, missing } = useTexture2D(
    props.texture,
    externalResources,
    internalResources
  );
  const sampler = useNode2DTextureSampler(props);
  const texture = useCanvas2DTexture(resolvedTexture, sampler);

  // A callback ref, not useRef: the emission-transform sample runs once the
  // container is in the tree, since its world matrix does not exist before.
  const [container, setContainer] = useState<THREE.Group | null>(null);
  const emissionTransform = useEmissionTransform(container, props.local_coords);

  const planFiles = useCallback(() => particleFiles(props, pools), [props, pools]);
  const { loadedFile } = useLoadedFiles(planFiles);
  const curves = useMemo(
    () => resolveParticleCurves(props.params, pools, loadedFile),
    [props.params, pools, loadedFile]
  );
  const colorRamp = useMemo(
    () => resolveParticleGradient(props.color_ramp, pools, loadedFile),
    [props.color_ramp, pools, loadedFile]
  );
  const colorInitialRamp = useMemo(
    () => resolveParticleGradient(props.color_initial_ramp, pools, loadedFile),
    [props.color_initial_ramp, pools, loadedFile]
  );

  const pose = useMemo(
    () => simulateFrozenPose({ props, curves, colorRamp, colorInitialRamp, emissionTransform }),
    [props, curves, colorRamp, colorInitialRamp, emissionTransform]
  );

  // Godot's quad is the texture's size, falling back to 1x1 when the emitter has none
  // (`cpu_particles_2d.cpp:186-192`).
  // An unset ViewportTexture reports size 0, so its quads have no area (`viewport.cpp:156-160`).
  const { width, height } = textureSize(texture) ?? UNTEXTURED_QUAD;

  const geometry = useMemo(
    () => buildParticleGeometry(pose, width, height, flipbook),
    [pose, width, height, flipbook]
  );
  useDisposeOnRelease(geometry);

  // The field draws from the first frame on a 1x1 quad while the texture loads, so
  // this material compiles mapless unless a fresh one replaces it
  // (`materialProgramInputs.ts`). Called from the drawing arm: the group mounts
  // before a geometry can exist, as `useEmissionTransform` samples its world matrix.
  const particleMesh = (geom: THREE.BufferGeometry) => {
    const program = materialProgramInputs({
      props: {
        map: texture,
        color,
        opacity,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        // The vertex colours hold each particle's sRGB colour, which multiplies in sRGB
        // (`canvas.glsl:189`), with the texture or without it.
        defines: CANVAS_SRGB_DEFINES,
      },
      // Each particle has its own vertex colour and alpha, and each quad is wound
      // by its own transform's determinant (`particleGeometry.ts`). A split by
      // facing would composite a mirrored particle out of emission order, so
      // the canvas-item facing draws the mesh once, in index order.
      merge: [pixelMaterial],
    });
    return (
      <mesh geometry={geom}>
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

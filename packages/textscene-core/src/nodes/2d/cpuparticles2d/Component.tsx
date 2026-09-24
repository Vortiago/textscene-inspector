/**
 * <CPUParticles2D> draws Godot's CPU particle emitter as a frozen pose: evaluated
 * once at mount (`simulate.ts`, which says why there is no clock) and merged into
 * one geometry (`particleGeometry.ts`). `emitting = false` draws nothing, as
 * Godot's `_update_internal` returns early, but the node still positions children.
 */

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { CanvasItemGroup } from '../../../r3f/components/CanvasItemGroup';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useCanvas2DMap } from '../../../r3f/canvas2DTextureDecode';
import { canvasItemFacing } from '../../../r3f/canvasItemFacing';
import { materialProgramInputs } from '../../../r3f/materialProgramInputs';
import { useTexture2D } from '../../../resources/useTexture2D';
import {
  canvasItemBlendState,
  type CanvasItemBlendState,
} from '../../../resources/materials/canvasitemmaterial/renderer';
import { CanvasItemBlendMode } from '../../../resources/materials/canvasitemmaterial/types';
import type { CanvasItemLightingProps } from '../../../r3f/lighting2d/useCanvasItemLighting';
import type { CanvasItemMaterialProperties } from '../../../resources/materials/canvasitemmaterial/types';
import { useEmissionTransform } from './emissionTransform';
import { buildParticleGeometry, type ParticleFlipbook } from './particleGeometry';
import { resolveParticleCurves, resolveParticleGradient } from './sceneResources';
import { simulateFrozenPose } from './simulate';
import type { CPUParticles2DProperties } from './types';

export function CPUParticles2D({ node, children }: NodeComponentProps) {
  const props = node.properties as CPUParticles2DProperties;

  return (
    <CanvasItem2D
      node={node}
      props={props}
      body={({ color, opacity }, material, lighting) =>
        props.emitting ? (
          <ParticleField
            props={props}
            name={node.name}
            color={color}
            opacity={opacity}
            blend={canvasItemBlendState(material?.blendMode ?? CanvasItemBlendMode.MIX)}
            material={material}
            lighting={lighting}
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
  blend,
  material,
  lighting,
}: {
  props: CPUParticles2DProperties;
  name: string;
  color: THREE.Color;
  opacity: number;
  blend: CanvasItemBlendState;
  material: CanvasItemMaterialProperties | null;
  lighting: CanvasItemLightingProps;
}) {
  const { externalResources, internalResources } = useSceneResources();
  const flipbook = useMemo(() => particleFlipbook(material), [material]);
  const { texture: resolvedTexture, missing } = useTexture2D(
    props.texture,
    externalResources,
    internalResources
  );
  const { texture, defines: decodeDefines } = useCanvas2DMap(resolvedTexture);

  // A callback ref, not useRef: the emission-transform sample runs once the
  // container is in the tree, since its world matrix does not exist before.
  const [container, setContainer] = useState<THREE.Group | null>(null);
  const emissionTransform = useEmissionTransform(container, props.local_coords);

  const curves = useMemo(
    () => resolveParticleCurves(props.params, internalResources),
    [props.params, internalResources]
  );
  const colorRamp = useMemo(
    () => resolveParticleGradient(props.color_ramp, internalResources),
    [props.color_ramp, internalResources]
  );
  const colorInitialRamp = useMemo(
    () => resolveParticleGradient(props.color_initial_ramp, internalResources),
    [props.color_initial_ramp, internalResources]
  );

  const pose = useMemo(
    () => simulateFrozenPose({ props, curves, colorRamp, colorInitialRamp, emissionTransform }),
    [props, curves, colorRamp, colorInitialRamp, emissionTransform]
  );

  // Godot's quad is the texture's pixel size, falling back to 1x1 when the
  // emitter has none (`cpu_particles_2d.cpp:186-192`).
  const image = texture?.image as { width?: number; height?: number } | null | undefined;
  const width = image?.width ?? 1;
  const height = image?.height ?? 1;

  const geometry = useMemo(
    () => buildParticleGeometry(pose, width, height, flipbook),
    [pose, width, height, flipbook]
  );
  useEffect(() => () => geometry?.dispose(), [geometry]);

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
        defines: decodeDefines,
      },
      // Each particle has its own vertex colour and alpha, and each quad is wound
      // by its own transform's determinant (`particleGeometry.ts`). A split by
      // facing would composite a mirrored particle out of emission order, so
      // `canvasItemFacing()` draws the mesh once, in index order.
      merge: [canvasItemFacing(), blend, lighting],
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

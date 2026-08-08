/**
 * <CPUParticles2D> — Godot's CPU particle emitter, drawn as a FROZEN POSE.
 *
 * The emitter is evaluated once at mount (`simulate.ts`) and the resulting
 * quads are merged into a single geometry (`particleGeometry.ts`). There is no
 * clock and no `useFrame`: Godot's own `preprocess` is a fixed-step settle that
 * runs only at `time == 0`, the golden-image harness fails a scene that never
 * settles, and the animation transport is selection-driven and starts stopped
 * (ADR-0012). See simulate.ts for the full argument.
 *
 * `emitting = false` draws nothing — Godot's `_update_internal` returns before
 * it touches the multimesh buffer — while the node still positions its
 * children, which is what a script-triggered one-shot emitter relies on.
 */

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import type { NodeComponentProps } from '../../../r3f/NodeComponentRegistry';
import { CanvasItem2D } from '../../../r3f/components/CanvasItem2D';
import { MissingResourcePlaceholder } from '../../../r3f/components/MissingResourcePlaceholder';
import { useSceneResources } from '../../../r3f/SceneResourcesContext';
import { useCanvas2DMap } from '../../../r3f/canvas2DTextureDecode';
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
 * The emitter's flipbook, or null when its material has none. `particles_anim`
 * is the one CanvasItemMaterial setting only a particles node can drive: it
 * makes the texture a sheet of cells rather than one image, and a particle
 * picks its cell from the anim value the simulation carries.
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

  // A callback ref (not useRef) so the emission-transform sample runs once the
  // container is actually in the tree — its world matrix does not exist before.
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

  return (
    <group ref={setContainer} name={`${name}_Particles`}>
      {missing ? (
        // One marker for the emitter, not one per particle: the Resources tab
        // is where the path is named, and N overlapping magenta quads would
        // bury the scene rather than explain it.
        <MissingResourcePlaceholder shape="plane" name={name} />
      ) : geometry ? (
        <mesh geometry={geometry}>
          <meshBasicMaterial
            map={texture}
            color={color}
            opacity={opacity}
            vertexColors
            transparent
            depthWrite={false}
            side={THREE.DoubleSide}
            defines={decodeDefines}
            {...blend}
            {...lighting}
          />
        </mesh>
      ) : null}
    </group>
  );
}

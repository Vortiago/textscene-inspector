/**
 * The mesh at every particle of a settled CPUParticles3D: each part one instanced draw over the
 * particle buffer, an InstancedMesh or a THREE.Points, with its overlay.
 */

import { useLayoutEffect, useMemo } from 'react';
import type * as THREE from 'three';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { resolveMaterialSource, type MaterialSource } from '../../../../r3f/materials/materialSource';
import { SurfaceMaterialSlot } from '../../../../r3f/materials/SurfaceMaterialSlot';
import { SurfaceMaterialSlots, surfaceSources } from '../../../../r3f/materials/SurfaceMaterialSlots';
import { useOneSurfaceStartingMaterial } from '../../../../r3f/materials/useOneSurfaceStartingMaterial';
import { overlayDrawProps } from '../../../../r3f/materials/materialOverlay';
import { withParticleDraw } from '../../../../r3f/materials/godotParticlesProgram';
import { useMeshContent } from '../../../../r3f/meshes/meshContent';
import {
  instanceMatrices,
  raycastInstancedPoints,
  useSharedInstances,
} from '../../../../r3f/meshes/sharedInstances';
import { drawHookProps, type ShadowCastingEffects } from '../../../../r3f/shadowCasting';
import { visualLayersUserData } from '../../../../r3f/visualLayers';
import { boxlessUserData } from '../../../../r3f/bounds';
import { geometryDrawsPoints } from '../../../../resources/meshes/godotSurface';
import { useResourceResolution } from '../../../../resources/useSubOrExtResource';
import { particleCount, particleGeometry, writeParticles } from './particleInstances';
import type { CPUParticles3DProperties } from './types';

interface ParticleMeshProps {
  properties: CPUParticles3DProperties;
  buffer: Float32Array;
  shadow: ShadowCastingEffects;
}

/** The mesh at every particle. A node with no mesh, or one that is not loaded yet, draws none. */
export function ParticleMesh({ properties, buffer, shadow }: ParticleMeshProps) {
  const pools = useSceneResources();
  const content = useMeshContent(useResourceResolution(properties.mesh, pools));
  const override = useMemo(
    () => resolveMaterialSource(properties.materialOverride, pools),
    [properties.materialOverride, pools]
  );
  const overlay = useMemo(
    () => resolveMaterialSource(properties.materialOverlay, pools),
    [properties.materialOverlay, pools]
  );
  if (content.kind !== 'surfaced') return null;
  return (
    <>
      {content.mesh.parts.map((part, i) => {
        const draw: ParticleDraw = {
          // `material_override` stands in front of each surface's own material (`render_forward_clustered.cpp:4206`).
          sources: surfaceSources(part.materials).map((source) => override ?? source),
          overlay,
          buffer,
          shadow,
          godotLayers: properties.layers,
        };
        return <ParticlePart key={i} source={part.geometry} draw={draw} />;
      })}
    </>
  );
}

/** What each part of the mesh draws at every particle. */
interface ParticleDraw {
  /** The material of each draw group. */
  sources: readonly (MaterialSource | undefined)[];
  /** `material_overlay`, drawn over every surface. */
  overlay: MaterialSource | undefined;
  buffer: Float32Array;
  shadow: ShadowCastingEffects;
  godotLayers: number;
}

/**
 * A part at every particle, as one instanced draw with the overlay's as a second draw of the same
 * instances. Each is keyed on the count, as three sizes an InstancedMesh's buffer at construction.
 * three's own frustum cull reads the instance matrices, not the billboards the program draws, so
 * the scene cull's box alone culls them.
 */
function ParticlePart({ source, draw }: { source: THREE.BufferGeometry; draw: ParticleDraw }) {
  const geometry = useParticleGeometry(source, draw.buffer);
  const startingMaterial = useOneSurfaceStartingMaterial(draw.sources.length);
  const Drawn = geometryDrawsPoints(source) ? ParticlePoints : ParticleMeshInstances;
  return (
    <Drawn
      key={particleCount(draw.buffer)}
      geometry={geometry}
      startingMaterial={startingMaterial}
      draw={draw}
    />
  );
}

interface InstancedDrawProps {
  geometry: THREE.InstancedBufferGeometry;
  startingMaterial: THREE.Material | THREE.Material[] | undefined;
  draw: ParticleDraw;
}

/** THREE.Points over the instanced geometry, picked at each instance. */
function ParticlePoints({ geometry, startingMaterial, draw }: InstancedDrawProps) {
  const { sources, overlay, shadow, godotLayers } = draw;
  return (
    <>
      <points
        args={[geometry, startingMaterial]}
        frustumCulled={false}
        raycast={raycastInstancedPoints}
        {...drawHookProps(shadow)}
        userData={drawUserData(godotLayers)}
      >
        <SurfaceMaterialSlots sources={sources} points="instances" particles={withParticleDraw} />
      </points>
      {overlay && (
        <points
          args={[geometry]}
          frustumCulled={false}
          {...overlayDrawProps(shadow)}
          userData={boxlessUserData()}
        >
          <SurfaceMaterialSlot source={overlay} points="instances" particles={withParticleDraw} />
        </points>
      )}
    </>
  );
}

/** An InstancedMesh, and the overlay's, each reading the geometry's instance matrices: one write places both. */
function ParticleMeshInstances({ geometry, startingMaterial, draw }: InstancedDrawProps) {
  const { sources, overlay, shadow, godotLayers } = draw;
  // Each mesh gets its own matrices back before r3f disposes it: three frees a disposed
  // InstancedMesh's matrices (`WebGLObjects.js:78`), which the other draw still reads.
  const sharesMatrices = (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    const own = mesh.instanceMatrix;
    mesh.instanceMatrix = instanceMatrices(geometry);
    return () => {
      mesh.instanceMatrix = own;
    };
  };
  return (
    <>
      <instancedMesh
        ref={sharesMatrices}
        args={[geometry, startingMaterial, geometry.instanceCount]}
        frustumCulled={false}
        {...drawHookProps(shadow)}
        userData={drawUserData(godotLayers)}
      >
        <SurfaceMaterialSlots sources={sources} particles={withParticleDraw} />
      </instancedMesh>
      {overlay && (
        <instancedMesh
          ref={sharesMatrices}
          args={[geometry, undefined, geometry.instanceCount]}
          frustumCulled={false}
          {...overlayDrawProps(shadow)}
          userData={boxlessUserData()}
        >
          <SurfaceMaterialSlot source={overlay} particles={withParticleDraw} />
        </instancedMesh>
      )}
    </>
  );
}

/** A particle draw's userData: the node's `layers`, and no box of its own for the editor. */
function drawUserData(godotLayers: number) {
  return { ...visualLayersUserData(godotLayers), ...boxlessUserData() };
}

/**
 * `source` as an instanced particle geometry for `buffer`'s particles, whose matrices, colours and
 * custom data it holds before each paint, released with the draw. The overlay shares it.
 */
function useParticleGeometry(
  source: THREE.BufferGeometry,
  buffer: Float32Array
): THREE.InstancedBufferGeometry {
  const count = particleCount(buffer);
  const geometry = useMemo(() => particleGeometry(source, count), [source, count]);
  useSharedInstances(geometry, source);
  useLayoutEffect(() => writeParticles(geometry, buffer), [geometry, buffer]);
  return geometry;
}

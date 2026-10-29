/**
 * The mesh at every particle of a settled CPUParticles3D: one InstancedMesh per triangle part, or one
 * THREE.Points per points part, each with its overlay. It loads with the simulation, off the
 * initial-paint path.
 */

import { useLayoutEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { resolveMaterialSource, type MaterialSource } from '../../../../r3f/materials/materialSource';
import { SurfaceMaterialSlot } from '../../../../r3f/materials/SurfaceMaterialSlot';
import { SurfaceMaterialSlots, surfaceSources } from '../../../../r3f/materials/SurfaceMaterialSlots';
import { useOneSurfaceStartingMaterial } from '../../../../r3f/materials/useOneSurfaceStartingMaterial';
import { overlayDrawProps } from '../../../../r3f/materials/materialOverlay';
import { useMeshContent } from '../../../../r3f/meshes/meshContent';
import { drawHookProps, type ShadowCastingEffects } from '../../../../r3f/shadowCasting';
import { useDisposeOnRelease } from '../../../../r3f/useDisposeOnRelease';
import { visualLayersUserData } from '../../../../r3f/visualLayers';
import { boxlessUserData } from '../../../../r3f/bounds';
import { geometryDrawsPoints } from '../../../../resources/meshes/godotSurface';
import { useResourceResolution } from '../../../../resources/useSubOrExtResource';
import {
  particleCount,
  particleGeometry,
  particlePoints,
  releaseParticleGeometry,
  writeParticleData,
  writeParticleMatrices,
} from './particleInstances';
import type { SettledParticles } from './simulate';
import type { CPUParticles3DProperties } from './types';

interface ParticleMeshProps {
  properties: CPUParticles3DProperties;
  settled: SettledParticles;
  buffer: Float32Array;
  shadow: ShadowCastingEffects;
}

/** The mesh at every particle. A node with no mesh, or one that is not loaded yet, draws none. */
export function ParticleMesh({ properties, settled, buffer, shadow }: ParticleMeshProps) {
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
  // Godot draws no instance while the emitter is off (`cpu_particles_3d.cpp:1338`).
  if (content.kind !== 'surfaced' || !settled.state) return null;
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
        return geometryDrawsPoints(part.geometry) ? (
          <ParticlePoints key={i} source={part.geometry} draw={draw} />
        ) : (
          <ParticleInstances key={i} source={part.geometry} draw={draw} />
        );
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
 * A triangle part as one InstancedMesh, with the overlay's as a second. Each is keyed on the
 * count, as three sizes the instance buffer at construction. three's own frustum cull reads the
 * instance matrices, not the billboards the program draws, so the scene cull's box alone culls them.
 */
function ParticleInstances({ source, draw }: { source: THREE.BufferGeometry; draw: ParticleDraw }) {
  const { sources, overlay, buffer, shadow, godotLayers } = draw;
  const count = particleCount(buffer);
  const geometry = useParticleGeometry(source, buffer);
  const startingMaterial = useOneSurfaceStartingMaterial(sources.length);
  const meshRef = useParticleMatrices(buffer, geometry);
  const overlayRef = useParticleMatrices(buffer, geometry);
  return (
    <>
      <instancedMesh
        key={count}
        ref={meshRef}
        args={[geometry, startingMaterial, count]}
        frustumCulled={false}
        {...drawHookProps(shadow)}
        userData={drawUserData(godotLayers)}
      >
        <SurfaceMaterialSlots sources={sources} drawsParticles />
      </instancedMesh>
      {overlay && (
        <instancedMesh
          key={`overlay-${count}`}
          ref={overlayRef}
          args={[geometry, undefined, count]}
          frustumCulled={false}
          {...overlayDrawProps(shadow)}
          userData={boxlessUserData()}
        >
          <SurfaceMaterialSlot source={overlay} drawsParticles />
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
 * `source` as an instanced particle geometry for `buffer`'s particles, whose colours and custom data
 * it holds before each paint, released with the draw. The overlay shares it.
 */
function useParticleGeometry(source: THREE.BufferGeometry, buffer: Float32Array): THREE.BufferGeometry {
  const count = particleCount(buffer);
  const geometry = useMemo(() => particleGeometry(source, count), [source, count]);
  useLayoutEffect(() => () => releaseParticleGeometry(geometry, source), [geometry, source]);
  useLayoutEffect(() => writeParticleData(geometry, buffer), [geometry, buffer]);
  return geometry;
}

/** A ref for an InstancedMesh of `geometry`, whose instance matrices hold `buffer` before each paint. */
function useParticleMatrices(buffer: Float32Array, geometry: THREE.BufferGeometry) {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  // Every arg is a dependency: a changed arg rebuilds the mesh with identity instance matrices.
  useLayoutEffect(() => {
    if (meshRef.current) writeParticleMatrices(meshRef.current, buffer);
  }, [buffer, geometry]);
  return meshRef;
}

/** A points part as one THREE.Points holding every particle's points, new for each buffer. */
function ParticlePoints({ source, draw }: { source: THREE.BufferGeometry; draw: ParticleDraw }) {
  const { sources, overlay, buffer, shadow, godotLayers } = draw;
  const geometry = useMemo(() => particlePoints(source, buffer), [source, buffer]);
  useDisposeOnRelease(geometry);
  const startingMaterial = useOneSurfaceStartingMaterial(sources.length);
  return (
    <>
      <points
        args={[geometry, startingMaterial]}
        {...drawHookProps(shadow)}
        userData={drawUserData(godotLayers)}
      >
        <SurfaceMaterialSlots sources={sources} drawsPoints drawsParticles />
      </points>
      {overlay && (
        <points args={[geometry]} {...overlayDrawProps(shadow)} userData={boxlessUserData()}>
          <SurfaceMaterialSlot source={overlay} drawsPoints drawsParticles />
        </points>
      )}
    </>
  );
}

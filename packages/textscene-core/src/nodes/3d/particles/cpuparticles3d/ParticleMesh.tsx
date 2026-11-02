/**
 * The mesh at every particle of a settled CPUParticles3D: each part one instanced draw over the
 * particle buffer, an InstancedMesh or a THREE.Points, with its material's `next_pass` chain and
 * its overlay, whose own chain draws after the part's surface chains.
 */

import { useLayoutEffect, useMemo } from 'react';
import type * as THREE from 'three';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { resolveMaterialSource, type MaterialSource } from '../../../../r3f/materials/materialSource';
import { SurfaceMaterialSlot } from '../../../../r3f/materials/SurfaceMaterialSlot';
import { SurfaceMaterialSlots, surfaceSources } from '../../../../r3f/materials/SurfaceMaterialSlots';
import {
  NextPassChain,
  NextPassLink,
  nextPassRenderOrder,
  type ChainDrawFactory,
  type ChainDrawSpec,
} from '../../../../r3f/materials/nextPass';
import { useOneSurfaceStartingMaterial } from '../../../../r3f/materials/useOneSurfaceStartingMaterial';
import { NO_RAYCAST, overlayDrawProps } from '../../../../r3f/materials/materialOverlay';
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

/** What a part's draws read together: geometry, starting material and its emitter's draw. */
interface ParticlePartDraws {
  geometry: THREE.InstancedBufferGeometry;
  startingMaterial: THREE.Material | THREE.Material[] | undefined;
  draw: ParticleDraw;
}

/**
 * A part at every particle, as one instanced draw, with the part's chains and its
 * overlay. Keyed on the count, as three sizes an InstancedMesh's buffer at
 * construction. three's own frustum cull reads the instance matrices, not the
 * billboards the program draws, so the scene cull's box alone culls them.
 */
function ParticlePart({ source, draw }: { source: THREE.BufferGeometry; draw: ParticleDraw }) {
  const geometry = useParticleGeometry(source, draw.buffer);
  const startingMaterial = useOneSurfaceStartingMaterial(draw.sources.length);
  const points = geometryDrawsPoints(source);
  const Draws = points ? ParticlePoints : ParticleMeshInstances;
  return <Draws key={particleCount(draw.buffer)} draws={{ geometry, startingMaterial, draw }} />;
}

/**
 * Each instanced draw gets its own matrices back before r3f disposes it: three frees a
 * disposed InstancedMesh's matrices (`WebGLObjects.js:78`), which the part's other
 * draws read. Memoise the returned ref beside the geometry, so a re-render keeps it.
 */
function sharesInstanceMatrices(geometry: THREE.InstancedBufferGeometry) {
  return (mesh: THREE.InstancedMesh | null) => {
    if (!mesh) return;
    const own = mesh.instanceMatrix;
    mesh.instanceMatrix = instanceMatrices(geometry);
    return () => {
      mesh.instanceMatrix = own;
    };
  };
}

/**
 * One chain link of the part's surfaces: the same instanced draw the surface is, at the
 * link's draw order, reading the geometry's shared instance matrices. It casts nothing
 * and is picked nowhere.
 */
function ParticleChainDraw({ spec, points }: { spec: ChainDrawSpec; points: boolean }) {
  const startingMaterial = useOneSurfaceStartingMaterial(spec.surfaceCount);
  // A points emitter shares only geometry; an instanced one counts its instances on it.
  const instanceCount = (spec.geometry as THREE.InstancedBufferGeometry).instanceCount;
  const sharesMatrices = useMemo(
    () => sharesInstanceMatrices(spec.geometry as THREE.InstancedBufferGeometry),
    [spec.geometry]
  );
  if (points) {
    // A points emitter shares only geometry, and a point's size rides its material.
    return (
      <points
        args={[spec.geometry, startingMaterial]}
        frustumCulled={false}
        renderOrder={nextPassRenderOrder(spec.ordinal)}
        raycast={NO_RAYCAST}
        {...drawHookProps(spec.shadow)}
        userData={boxlessUserData()}
      >
        <SurfaceMaterialSlot
          source={spec.source}
          attach={spec.attach}
          points="instances"
          particles={withParticleDraw}
        />
      </points>
    );
  }
  return (
    <instancedMesh
      ref={sharesMatrices}
      args={[spec.geometry, startingMaterial, instanceCount]}
      frustumCulled={false}
      renderOrder={nextPassRenderOrder(spec.ordinal)}
      raycast={NO_RAYCAST}
      {...drawHookProps(spec.shadow)}
      userData={boxlessUserData()}
    >
      <SurfaceMaterialSlot source={spec.source} attach={spec.attach} particles={withParticleDraw} />
    </instancedMesh>
  );
}

/** The chain factory of a part whose particles draw as `points` says. */
function chainDrawOf(points: boolean): ChainDrawFactory {
  return (spec) => <ParticleChainDraw spec={spec} points={points} />;
}

/**
 * `source` as an instanced particle geometry for `buffer`'s particles, whose matrices, colours and
 * custom data it holds before each paint, released with the draw. The overlay and the chain share it.
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

/** THREE.Points over the instanced geometry, picked at each instance. */
function ParticlePoints({ draws }: { draws: ParticlePartDraws }) {
  const { geometry, startingMaterial, draw } = draws;
  return (
    <>
      <points
        args={[geometry, startingMaterial]}
        frustumCulled={false}
        raycast={raycastInstancedPoints}
        {...drawHookProps(draw.shadow)}
        userData={drawnUserData(draw.godotLayers)}
      >
        <SurfaceMaterialSlots sources={draw.sources} points="instances" particles={withParticleDraw} />
      </points>
      <NextPassChain
        sources={draw.sources}
        geometry={geometry}
        drawsPoints
        shadow={draw.shadow}
        draw={chainDrawOf(true)}
        overlay={overlayOf(draws, true)}
      />
    </>
  );
}

/** An InstancedMesh, and the chain's and the overlay's, each reading the geometry's instance matrices. */
function ParticleMeshInstances({ draws }: { draws: ParticlePartDraws }) {
  const { geometry, startingMaterial, draw } = draws;
  const sharesMatrices = useMemo(() => sharesInstanceMatrices(geometry), [geometry]);
  return (
    <>
      <instancedMesh
        ref={sharesMatrices}
        args={[geometry, startingMaterial, geometry.instanceCount]}
        frustumCulled={false}
        {...drawHookProps(draw.shadow)}
        userData={drawnUserData(draw.godotLayers)}
      >
        <SurfaceMaterialSlots sources={draw.sources} particles={withParticleDraw} />
      </instancedMesh>
      <NextPassChain
        sources={draw.sources}
        geometry={geometry}
        drawsPoints={false}
        shadow={draw.shadow}
        draw={chainDrawOf(false)}
        overlay={overlayOf(draws, false)}
      />
    </>
  );
}

/**
 * The part's overlay at the explicit order one past its surface chains, and its own
 * `next_pass` chain, whose links draw after it
 * (`render_forward_clustered.cpp:4230-4239`), as another instanced draw each.
 */
function OverlayDraw({
  geometry,
  overlay,
  shadow,
  points,
  order,
}: {
  geometry: THREE.InstancedBufferGeometry;
  overlay: MaterialSource;
  shadow: ShadowCastingEffects;
  points: boolean;
  order: number;
}) {
  const overlayDraw = points ? (
    <points
      args={[geometry]}
      frustumCulled={false}
      {...overlayDrawProps(shadow)}
      renderOrder={order}
      userData={boxlessUserData()}
    >
      <SurfaceMaterialSlot source={overlay} points="instances" particles={withParticleDraw} />
    </points>
  ) : (
    <InstancedOverlayDraw geometry={geometry} overlay={overlay} shadow={shadow} order={order} />
  );
  return (
    <>
      {overlayDraw}
      <NextPassLink
        source={overlay}
        ordinal={order}
        drawsSelf={false}
        // The overlay drew at this order; its own key lands in the set on recursion,
        // so a cycle back to the overlay material ends its chain.
        visited={new Set()}
        geometry={geometry}
        attach="material"
        surfaceCount={1}
        drawsPoints={points}
        shadow={shadow}
        draw={chainDrawOf(points)}
      />
    </>
  );
}

/** The overlay draw of a part that instances its mesh, keeping the shared instance matrices. */
function InstancedOverlayDraw({
  geometry,
  overlay,
  shadow,
  order,
}: {
  geometry: THREE.InstancedBufferGeometry;
  overlay: MaterialSource;
  shadow: ShadowCastingEffects;
  order: number;
}) {
  const sharesMatrices = useMemo(() => sharesInstanceMatrices(geometry), [geometry]);
  return (
    <instancedMesh
      ref={sharesMatrices}
      args={[geometry, undefined, geometry.instanceCount]}
      frustumCulled={false}
      {...overlayDrawProps(shadow)}
      renderOrder={order}
      userData={boxlessUserData()}
    >
      <SurfaceMaterialSlot source={overlay} particles={withParticleDraw} />
    </instancedMesh>
  );
}

/** The part's overlay element at the order one past its surface chains, or none without an overlay. */
function overlayOf(
  draws: ParticlePartDraws,
  points: boolean
): ((order: number) => React.ReactNode) | undefined {
  if (!draws.draw.overlay) return undefined;
  return (order) => (
    <OverlayDraw
      geometry={draws.geometry}
      overlay={draws.draw.overlay!}
      shadow={draws.draw.shadow}
      points={points}
      order={order}
    />
  );
}

/** A particle draw's userData: the node's `layers`, and no box of its own for the editor. */
function drawnUserData(godotLayers: number) {
  return { ...visualLayersUserData(godotLayers), ...boxlessUserData() };
}

/**
 * <CPUParticles3D> draws Godot's CPU particle emitter as a frozen pose: the settle of its enter-tree
 * (`simulate.ts`), each particle an instance of the mesh under the node's transform, as Godot writes
 * the buffer in node space (`cpu_particles_3d.cpp:1281-1283`). The cull measures the live particles.
 * Godot's editor gizmos draw on it: the `visibility_aabb` box with its axes for every node, and the
 * emission shape for the selected node.
 */

import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { EMPTY_AABB } from '../../../../godot/math/aabb';
import { sameTransform3D, type Transform3D } from '../../../../godot/math/transform3d';
import type { Vector3 } from '../../../../godot/math/vector';
import { CPUParticles3DDrawOrder } from '../../../../godot/scene/particles3d';
import type { NodeComponentProps } from '../../../../r3f/NodeComponentRegistry';
import type { TscnNode } from '../../../../parser/types';
import { useSceneResources } from '../../../../r3f/SceneResourcesContext';
import { PluginGizmo, SelectedOnly } from '../../../../r3f/gizmo/PluginGizmo';
import { resolveMaterialSource, type MaterialSource } from '../../../../r3f/materials/materialSource';
import { SurfaceMaterialSlot } from '../../../../r3f/materials/SurfaceMaterialSlot';
import { SurfaceMaterialSlots, surfaceSources } from '../../../../r3f/materials/SurfaceMaterialSlots';
import { useOneSurfaceStartingMaterial } from '../../../../r3f/materials/useOneSurfaceStartingMaterial';
import { overlayDrawProps } from '../../../../r3f/materials/materialOverlay';
import { useMeshContent } from '../../../../r3f/meshes/meshContent';
import { realGlobalTransform3D } from '../../../../r3f/nodeTreeTransforms';
import { drawHookProps, type ShadowCastingEffects } from '../../../../r3f/shadowCasting';
import { useDisposeOnRelease } from '../../../../r3f/useDisposeOnRelease';
import { visualLayersUserData } from '../../../../r3f/visualLayers';
import { boxlessUserData } from '../../../../r3f/bounds';
import { boxPlacement } from '../../../../r3f/visibilityRange/placements';
import { useGeometryInstance } from '../../../../r3f/visibilityRange/geometryInstance';
import { geometryDrawsPoints } from '../../../../resources/meshes/godotSurface';
import { useResourceResolution } from '../../../../resources/useSubOrExtResource';
import { Node3D } from '../../../base/node3d/Component';
import { useMeshAabb } from '../../meshinstance3d/meshAabb';
import { useParticleResources } from '../../../shared/cpuparticles/useParticleResources';
import { CPUParticlesBoxGizmo, EmissionShapeGizmo } from '../gizmo/ParticleGizmos';
import { particlesAabb } from './ownAabb';
import {
  particleCount,
  particleGeometry,
  particlePoints,
  releaseParticleGeometry,
  writeParticleData,
  writeParticleMatrices,
} from './particleInstances';
import { particleRows, particlesInDrawOrder, settleParticles, type SettledParticles } from './simulate';
import type { CPUParticles3DProperties } from './types';

export function CPUParticles3D({ node, children }: NodeComponentProps) {
  const properties = node.properties as CPUParticles3DProperties;
  const pools = useSceneResources();
  const nodeRef = useRef<THREE.Group | null>(null);

  const emissionTransform = useEmissionTransform(nodeRef, node);
  const resources = useParticleResources(properties.simulation);
  const settled = useMemo(
    () =>
      emissionTransform &&
      settleParticles({
        sim: properties.simulation,
        emission: properties.emission,
        ...resources,
        emissionTransform,
      }),
    [properties, resources, emissionTransform]
  );
  const viewAxis = useViewAxis(properties.simulation.drawOrder === CPUParticles3DDrawOrder.VIEW_DEPTH);
  const rows = useMemo(() => settled && particleRows(settled), [settled]);
  const buffer = useMemo(
    () => settled && rows && particlesInDrawOrder(settled, rows, viewAxis),
    [settled, rows, viewAxis]
  );

  const meshAabb = useMeshAabb(properties.mesh, pools);
  const ownAabb = useMemo(
    () => rows && particlesAabb(properties, rows, meshAabb),
    [properties, rows, meshAabb]
  );
  const placement = useMemo(() => boxPlacement(nodeRef, ownAabb), [ownAabb]);
  const shadow = useGeometryInstance(placement);

  return (
    <Node3D node={node} ref={nodeRef}>
      {settled && buffer && (
        <ParticleMesh properties={properties} settled={settled} buffer={buffer} shadow={shadow} />
      )}
      <PluginGizmo drawnFor="every-node">
        {/* The box the node authors, `AABB()` for none, and not the parser's null (the multimesh box). */}
        <CPUParticlesBoxGizmo box={properties.visibilityAabb ?? EMPTY_AABB} />
        <SelectedOnly>
          <EmissionShapeGizmo emission={properties.emission} />
        </SelectedOnly>
      </PluginGizmo>
      {children}
    </Node3D>
  );
}

/**
 * The emitter's global transform: a `local_coords = false` emitter emits from it, and a VIEW_DEPTH
 * emitter sorts through its inverse. three holds the ancestors, so it is sampled again for each
 * parse of the node, and changes identity only when it changes. Null until the first sample, so the emitter
 * settles once on mount, from the transform it draws under.
 */
function useEmissionTransform(
  nodeRef: RefObject<THREE.Object3D | null>,
  parsed: TscnNode
): Transform3D | null {
  const [transform, setTransform] = useState<Transform3D | null>(null);
  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    // A layout pass runs before the renderer's own `updateMatrixWorld`, so the ancestors refresh.
    node.updateWorldMatrix(true, false);
    const next = realGlobalTransform3D(node);
    setTransform((previous) => (previous && sameTransform3D(previous, next) ? previous : next));
  }, [nodeRef, parsed]);
  return transform;
}

/**
 * The axis a VIEW_DEPTH emitter sorts along: the global `basis.get_column(2)` of the camera that
 * renders (`cpu_particles_3d.cpp:1256-1258`), read each frame, and null for any other order. Godot
 * sorts each frame, so a moved camera sorts again.
 */
function useViewAxis(sortsByView: boolean): Vector3 | null {
  const [axis, setAxis] = useState<Vector3 | null>(null);
  useFrame(({ camera }) => {
    if (!sortsByView) return;
    const e = camera.matrixWorld.elements;
    if (axis && axis.x === e[8] && axis.y === e[9] && axis.z === e[10]) return;
    setAxis({ x: e[8]!, y: e[9]!, z: e[10]! });
  });
  return sortsByView ? axis : null;
}

interface ParticleMeshProps {
  properties: CPUParticles3DProperties;
  settled: SettledParticles;
  buffer: Float32Array;
  shadow: ShadowCastingEffects;
}

/** The mesh at every particle. A node with no mesh, or one that is not loaded yet, draws none. */
function ParticleMesh({ properties, settled, buffer, shadow }: ParticleMeshProps) {
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

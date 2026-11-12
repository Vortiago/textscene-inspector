/**
 * A mesh at every instance of a buffer: each part one instanced draw, an InstancedMesh or a
 * THREE.Points, with one more instanced draw for each `next_pass` link and for the overlay. Every
 * draw of a part reads one instanced geometry, so one write places them all.
 */

import { useLayoutEffect, useMemo } from 'react';
import type * as THREE from 'three';
import { geometryDrawsPoints } from '../../resources/meshes/godotSurface';
import { boxlessUserData } from '../bounds';
import { extraDrawProps } from '../materials/extraDraw';
import type { MaterialSource } from '../materials/materialSource';
import { NextPassChain, type ChainDrawFactory, type ChainDrawSpec } from '../materials/nextPass';
import { orderByPass } from '../materials/passOrder';
import { SurfaceMaterialSlot } from '../materials/SurfaceMaterialSlot';
import { SurfaceMaterialSlots, overriddenSources } from '../materials/SurfaceMaterialSlots';
import { useOneSurfaceStartingMaterial } from '../materials/useOneSurfaceStartingMaterial';
import {
  instanceMatrices,
  pointPlacementOf,
  raycastInstancedPoints,
  useSharedInstances,
} from '../meshes/sharedInstances';
import { drawHookProps, type ShadowCastingEffects } from '../shadowCasting';
import { useInstanceDrawOr, type OwnInstanceDraw } from '../visibilityRange/geometryInstance';
import { visualLayersUserData } from '../visualLayers';
import type { InstancesBounds, MeshInstances } from './meshInstances';
import type { MeshPart } from './SurfacedMeshDrawer';

interface InstancedPartsProps {
  parts: readonly MeshPart[];
  instances: MeshInstances;
  owner?: OwnInstanceDraw;
}

export function InstancedParts({ parts, instances, owner }: InstancedPartsProps) {
  return (
    <>
      {parts.map((part, index) => (
        <InstancedPart key={index} part={part} instances={instances} owner={owner} />
      ))}
    </>
  );
}

/** What every draw of one part at the instances shares. */
interface PartAtInstances {
  geometry: THREE.InstancedBufferGeometry;
  /** Null for instances that three culls none of. */
  bounds: InstancesBounds | null;
  userData: object;
  particles: MeshInstances['particles'];
}

function InstancedPart({ part, instances, owner }: { part: MeshPart } & Omit<InstancedPartsProps, 'parts'>) {
  const { override, overlay, shadow, layers } = useInstanceDrawOr(owner);
  const { count, geometryOver, particles } = instances;
  const source = part.geometry;
  const geometry = useMemo(() => geometryOver(source, count), [geometryOver, source, count]);
  useSharedInstances(geometry, source);
  useLayoutEffect(() => instances.write(geometry), [instances, geometry]);
  const { boundsOver } = instances;
  const bounds = useMemo(() => boundsOver(source), [boundsOver, source]);
  const placed = useMemo<PartAtInstances>(() => {
    const userData = { ...visualLayersUserData(layers), ...(bounds ? null : boxlessUserData()) };
    return { geometry, bounds, userData, particles };
  }, [geometry, bounds, layers, particles]);

  const sources = overriddenSources(part.materials, override);
  const drawsPoints = geometryDrawsPoints(source);
  const drawExtra: ChainDrawFactory = (spec) => <ExtraInstancedDraw spec={spec} placed={placed} />;
  return (
    <>
      <OwnInstancedDraw placed={placed} sources={sources} shadow={shadow} />
      <NextPassChain
        sources={sources}
        geometry={geometry}
        drawsPoints={drawsPoints}
        godotLayers={layers}
        shadow={shadow}
        draw={drawExtra}
        overlay={overlay}
      />
    </>
  );
}

/** The part's own draw at every instance, with the material of each draw group. */
function OwnInstancedDraw({
  placed,
  sources,
  shadow,
}: {
  placed: PartAtInstances;
  sources: readonly (MaterialSource | undefined)[];
  shadow: ShadowCastingEffects;
}) {
  const { geometry, bounds, userData, particles } = placed;
  const startingMaterial = useOneSurfaceStartingMaterial(sources.length);
  const mounted = useMemo(() => mountsAtInstances(placed), [placed]);
  const slots = (
    <SurfaceMaterialSlots sources={sources} points={pointPlacementOf(geometry)} particles={particles} />
  );
  if (geometryDrawsPoints(geometry)) {
    return (
      <points
        ref={mounted}
        args={[geometry, startingMaterial]}
        frustumCulled={bounds !== null}
        // `THREE.Points` tests the source positions alone, so each instance is picked by itself.
        raycast={raycastInstancedPoints}
        {...drawHookProps(shadow)}
        userData={userData}
      >
        {slots}
      </points>
    );
  }
  return (
    <instancedMesh
      ref={mounted}
      args={[geometry, startingMaterial, NO_OWN_MATRICES]}
      count={geometry.instanceCount}
      frustumCulled={bounds !== null}
      {...drawHookProps(shadow)}
      userData={userData}
    >
      {slots}
    </instancedMesh>
  );
}

/**
 * One `next_pass` link or the overlay at every instance: the instanced draw its part is, at the
 * link's place in the draw order. It casts nothing of its own, so only the colour hooks mount.
 */
function ExtraInstancedDraw({ spec, placed }: { spec: ChainDrawSpec; placed: PartAtInstances }) {
  const { geometry, bounds, userData, particles } = placed;
  const startingMaterial = useOneSurfaceStartingMaterial(spec.surfaceCount);
  const mounted = useMemo(() => mountsAtInstances(placed, orderByPass), [placed]);
  const { onBeforeRender, onAfterRender } = spec.shadow;
  const slot = (
    <SurfaceMaterialSlot
      source={spec.source}
      attach={spec.attach}
      points={pointPlacementOf(geometry)}
      particles={particles}
    />
  );
  if (spec.drawsPoints) {
    return (
      <points
        ref={mounted}
        args={[geometry, startingMaterial]}
        frustumCulled={bounds !== null}
        {...extraDrawProps(spec.ordinal)}
        onBeforeRender={onBeforeRender}
        onAfterRender={onAfterRender}
        userData={userData}
      >
        {slot}
      </points>
    );
  }
  return (
    <instancedMesh
      ref={mounted}
      args={[geometry, startingMaterial, NO_OWN_MATRICES]}
      count={geometry.instanceCount}
      frustumCulled={bounds !== null}
      {...extraDrawProps(spec.ordinal)}
      onBeforeRender={onBeforeRender}
      onAfterRender={onAfterRender}
      userData={userData}
    >
      {slot}
    </instancedMesh>
  );
}

/**
 * The size of the matrix buffer an InstancedMesh builds for itself. The draw reads the geometry's
 * matrices, so its own buffer holds nothing, and a new geometry rebuilds the draw for a new count.
 */
const NO_OWN_MATRICES = 0;

type InstancedObject = THREE.InstancedMesh | THREE.Points;

/**
 * The `ref` of one draw of a part. The draw takes the bounds of every instance, which typed props
 * do not hold, and an InstancedMesh reads the geometry's instance matrices. The mesh gets its own
 * matrices back before r3f disposes it: three frees the matrices of a disposed InstancedMesh
 * (r187 `WebGLObjects.js:78`), which the part's other draws read.
 */
function mountsAtInstances(
  { geometry, bounds }: PartAtInstances,
  onMount?: (object: InstancedObject) => void
) {
  return (object: InstancedObject | null) => {
    if (!object) return undefined;
    onMount?.(object);
    if (bounds) Object.assign(object, bounds);
    if (!('instanceMatrix' in object)) return undefined;
    const own = object.instanceMatrix;
    object.instanceMatrix = instanceMatrices(geometry);
    return () => {
      object.instanceMatrix = own;
    };
  };
}

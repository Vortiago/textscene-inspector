/**
 * A mesh at every instance of a buffer: each part one instanced draw, an InstancedMesh or a
 * THREE.Points, with one more instanced draw for each `next_pass` link and for the overlay. Every
 * draw of a part reads one instanced geometry, so one write places them all.
 */

import { useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { geometryDrawsPoints } from '../../resources/meshes/godotSurface';
import { perObject } from '../../utils/perObject';
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
  const drawsPoints = geometryDrawsPoints(geometry);
  const Drawn = instancedTag(drawsPoints);
  return (
    <Drawn
      ref={mounted}
      args={[geometry, startingMaterial, NO_OWN_MATRICES]}
      frustumCulled={bounds !== null}
      // `THREE.Points` tests the source positions alone, so each instance is picked by itself.
      raycast={drawsPoints ? raycastInstancedPoints : RAYCAST_OF_INSTANCED_MESH}
      {...drawHookProps(shadow)}
      userData={userData}
    >
      <SurfaceMaterialSlots sources={sources} points={pointPlacementOf(geometry)} particles={particles} />
    </Drawn>
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
  const Drawn = instancedTag(spec.drawsPoints);
  return (
    <Drawn
      ref={mounted}
      args={[geometry, startingMaterial, NO_OWN_MATRICES]}
      frustumCulled={bounds !== null}
      {...extraDrawProps(spec.ordinal)}
      onBeforeRender={spec.shadow.onBeforeRender}
      onAfterRender={spec.shadow.onAfterRender}
      userData={userData}
    >
      <SurfaceMaterialSlot
        source={spec.source}
        attach={spec.attach}
        points={pointPlacementOf(geometry)}
        particles={particles}
      />
    </Drawn>
  );
}

/**
 * The element of one instanced draw: a part that draws points instances a `THREE.Points`. Typed as
 * the InstancedMesh alone, since a `THREE.Points` takes the same arguments and ignores the count.
 */
function instancedTag(drawsPoints: boolean): 'instancedMesh' {
  return (drawsPoints ? 'points' : 'instancedMesh') as 'instancedMesh';
}

const RAYCAST_OF_INSTANCED_MESH = THREE.InstancedMesh.prototype.raycast;

/**
 * The size of the matrix buffer an InstancedMesh builds for itself, which a `THREE.Points` ignores.
 * The draw reads the geometry's matrices, so its own buffer holds nothing.
 */
const NO_OWN_MATRICES = 0;

type InstancedObject = THREE.InstancedMesh | THREE.Points;

/**
 * The matrices each InstancedMesh built for itself, read on its first mount. r3f runs a ref more
 * than once on a rebuilt object, and a later run would read the shared matrices as the mesh's own.
 */
const ownMatricesOf = perObject((mesh: THREE.InstancedMesh) => mesh.instanceMatrix);

/**
 * The `ref` of one draw of a part. The draw takes the bounds of every instance, which typed props
 * do not hold, and an InstancedMesh reads the geometry's instance matrices and count. The mesh gets its own
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
    const own = ownMatricesOf(object);
    object.count = geometry.instanceCount;
    object.instanceMatrix = instanceMatrices(geometry);
    return () => {
      object.instanceMatrix = own;
    };
  };
}

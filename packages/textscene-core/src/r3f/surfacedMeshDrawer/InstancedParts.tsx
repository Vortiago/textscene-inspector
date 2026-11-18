/**
 * A mesh at every instance of a buffer: each part one instanced draw, an InstancedMesh, a
 * THREE.Points or a THREE.LineSegments, with one more instanced draw for each `next_pass` link and for the overlay. Every
 * draw of a part reads one instanced geometry, so one write places them all.
 */

import { useLayoutEffect, useMemo, type ReactNode } from 'react';
import type * as THREE from 'three';
import { geometryPrimitive } from '../../resources/meshes/godotSurface';
import { drawnTag } from '../meshes/meshContent';
import { perObject } from '../../utils/perObject';
import { boxlessUserData } from '../bounds';
import { extraDrawProps } from '../materials/extraDraw';
import type { ScopedReference } from '../../resources/reading';
import { NextPassChain, type ChainDrawFactory, type ChainDrawSpec } from '../materials/nextPass';
import { orderByPass } from '../materials/passOrder';
import { SurfaceMaterialSlot } from '../materials/SurfaceMaterialSlot';
import { SurfaceMaterialSlots, overriddenSources } from '../materials/SurfaceMaterialSlots';
import { useOneSurfaceStartingMaterial } from '../materials/useOneSurfaceStartingMaterial';
import {
  instanceMatrices,
  listedSlotOf,
  raycastInstanced,
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
  const primitive = geometryPrimitive(source);
  const drawExtra: ChainDrawFactory = (spec) => <ExtraInstancedDraw spec={spec} placed={placed} />;
  return (
    <>
      <OwnInstancedDraw placed={placed} sources={sources} shadow={shadow} />
      <NextPassChain
        sources={sources}
        geometry={geometry}
        primitive={primitive}
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
  sources: readonly (ScopedReference | undefined)[];
  shadow: ShadowCastingEffects;
}) {
  const { geometry, particles } = placed;
  // Points and line segments test the source positions alone, so each instance is picked by itself.
  const raycast = geometryPrimitive(geometry) === 'triangles' ? undefined : raycastInstanced;
  return (
    <InstancedDraw
      placed={placed}
      surfaceCount={sources.length}
      settings={{ ...drawHookProps(shadow), raycast }}
    >
      <SurfaceMaterialSlots sources={sources} {...listedSlotOf(geometry)} particles={particles} />
    </InstancedDraw>
  );
}

/**
 * One `next_pass` link or the overlay at every instance: the instanced draw its part is, at the
 * link's place in the draw order. It casts nothing of its own, so only the colour hooks mount.
 */
function ExtraInstancedDraw({ spec, placed }: { spec: ChainDrawSpec; placed: PartAtInstances }) {
  const { onBeforeRender, onAfterRender } = spec.shadow;
  return (
    <InstancedDraw
      placed={placed}
      surfaceCount={spec.surfaceCount}
      onMount={orderByPass}
      settings={{ ...extraDrawProps(spec.ordinal), onBeforeRender, onAfterRender }}
    >
      <SurfaceMaterialSlot
        source={spec.source}
        attach={spec.attach}
        {...listedSlotOf(placed.geometry)}
        particles={placed.particles}
      />
    </InstancedDraw>
  );
}

/**
 * What the own draw and an extra draw of a part set on their object. An absent one keeps three's
 * default: r3f skips a prop that is undefined (9.8.2 `applyProps`).
 */
type InstancedDrawSettings = Partial<ReturnType<typeof drawHookProps> & ReturnType<typeof extraDrawProps>>;

/**
 * One instanced draw of a part: an InstancedMesh, or a `THREE.Points` or `THREE.LineSegments` for a part that draws them.
 * Each setting is a named prop, so the element spreads nothing that could hold a material slot.
 */
function InstancedDraw({
  placed,
  surfaceCount,
  onMount,
  settings,
  children,
}: {
  placed: PartAtInstances;
  /** The draw groups of the draw, which size its invisible starting materials. */
  surfaceCount: number;
  onMount?: (object: InstancedObject) => void;
  settings: InstancedDrawSettings;
  children: ReactNode;
}) {
  const { geometry, bounds, userData } = placed;
  const startingMaterial = useOneSurfaceStartingMaterial(surfaceCount);
  const mounted = useMemo(() => mountsAtInstances(placed, onMount), [placed, onMount]);
  const primitive = geometryPrimitive(geometry);
  if (primitive !== 'triangles') {
    const Drawn = drawnTag(primitive);
    return (
      <Drawn
        ref={mounted}
        args={[geometry, startingMaterial]}
        frustumCulled={bounds !== null}
        renderOrder={settings.renderOrder}
        raycast={settings.raycast}
        castShadow={settings.castShadow}
        receiveShadow={settings.receiveShadow}
        onBeforeRender={settings.onBeforeRender}
        onAfterRender={settings.onAfterRender}
        onBeforeShadow={settings.onBeforeShadow}
        onAfterShadow={settings.onAfterShadow}
        userData={userData}
      >
        {children}
      </Drawn>
    );
  }
  return (
    <instancedMesh
      ref={mounted}
      args={[geometry, startingMaterial, NO_OWN_MATRICES]}
      count={geometry.instanceCount}
      frustumCulled={bounds !== null}
      renderOrder={settings.renderOrder}
      raycast={settings.raycast}
      castShadow={settings.castShadow}
      receiveShadow={settings.receiveShadow}
      onBeforeRender={settings.onBeforeRender}
      onAfterRender={settings.onAfterRender}
      onBeforeShadow={settings.onBeforeShadow}
      onAfterShadow={settings.onAfterShadow}
      userData={userData}
    >
      {children}
    </instancedMesh>
  );
}

/**
 * The size of the matrix buffer an InstancedMesh builds for itself. The draw reads the geometry's
 * matrices, so its own buffer holds nothing, and a new geometry rebuilds the draw for a new count.
 */
const NO_OWN_MATRICES = 0;

type InstancedObject = THREE.InstancedMesh | THREE.Points | THREE.LineSegments;

/**
 * The matrices each InstancedMesh built for itself, read on its first mount. r3f runs a ref more
 * than once on a rebuilt object, and a later run would read the shared matrices as the mesh's own.
 */
const ownMatricesOf = perObject((mesh: THREE.InstancedMesh) => mesh.instanceMatrix);

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
    const own = ownMatricesOf(object);
    object.instanceMatrix = instanceMatrices(geometry);
    return () => {
      object.instanceMatrix = own;
    };
  };
}

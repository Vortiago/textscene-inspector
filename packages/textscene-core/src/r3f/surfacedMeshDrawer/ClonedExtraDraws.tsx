/**
 * The extra draws of a mesh inside a cloned GLB: each `next_pass` link and the overlay. The target
 * is a cloned object with no element, so each one mounts by hand as a sibling draw of the surface
 * it covers (ADR-0039). This is the surfaced mesh drawer's adapter for a cloned object.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { MISSING_TEXTURE_MATERIAL } from '../../resources/materials/standardmaterial3d/materialBag.js';
import { materialFromBag } from '../../resources/materials/standardmaterial3d/build.js';
import type { SurfaceSlot } from '../../resources/formats/glb/surfaceMaterials.js';
import { extraDrawProps } from '../materials/extraDraw.js';
import { materialSourceKey, resolveNextPass, type MaterialSource } from '../materials/materialSource.js';
import { NOTHING_DRAWN, visitedWith } from '../materials/nextPass.js';
import { OVERLAY_ORDINAL_PAST_CHAINS, orderByPass } from '../materials/passOrder.js';
import { GLTF_SURFACE } from '../materials/surfaceTextures.js';
import { OTHER_DRAWS_SURFACE } from '../materials/useOneSurfaceStartingMaterial.js';
import { useSurfaceMaterial } from '../materials/useSurfaceMaterial.js';
import { useDisposeOnRelease } from '../useDisposeOnRelease.js';
import { setVisualLayers, visualLayersOf } from '../visualLayers.js';

/**
 * The sibling draws `useClonedExtraDraws` holds in a clone. Written only there: added with the
 * mount, deleted with its release.
 */
const extraDraws = new WeakSet<THREE.Object3D>();

/**
 * Whether `object` is an extra draw this module mounted. A mesh of several primitives is a Group,
 * so an extra draw beside a primitive sits under the mesh too, and it is no surface of the mesh.
 */
export function isClonedExtraDraw(object: THREE.Object3D): boolean {
  return extraDraws.has(object);
}

/** What `useSurfaceMaterial` gave the caller that drew a material on the clone. */
type DrawnMaterial = Pick<ReturnType<typeof useSurfaceMaterial>, 'material' | 'scalars'>;

/**
 * The `next_pass` chain of a material that already drew the `covered` slots: the material a caller
 * swapped into them. The chain resolves in the tables of the file that wrote that material.
 */
export function ClonedChain({
  covered,
  source,
  drawn,
}: {
  /** The slots the material drew, or null while it drew none. */
  covered: readonly SurfaceSlot[] | null;
  source: MaterialSource;
  /** The caller's own load of `source`, so the chain adds no second one. */
  drawn: DrawnMaterial;
}) {
  const nextSource = useNextSource(drawn);
  const visited = useMemo(() => visitedWith(NOTHING_DRAWN, source), [source]);
  if (nextSource === undefined) return null;
  return <ClonedLink covered={covered} source={nextSource} ordinal={1} visited={visited} />;
}

/**
 * `material_overlay` on a mesh inside a cloned GLB: one more draw of every holder among `slots`,
 * beside it, with the overlay's own `next_pass` chain after it
 * (`render_forward_clustered.cpp:4228-4241`). One material over a grouped geometry draws every
 * surface, so each holder takes one draw whatever its surface count.
 */
export function ClonedOverlay({ slots, source }: { slots: readonly SurfaceSlot[]; source: MaterialSource }) {
  const everyHolder = useMemo(() => slots.filter(isFirstOfHolder).map(asOneSurface), [slots]);
  const pass = useClonedPass(source);
  // The overlay draws whatever it reads, as its React draw does. Only a link skips the stencil.
  useClonedExtraDraws(everyHolder, pass.material, OVERLAY_ORDINAL_PAST_CHAINS);
  const visited = useMemo(() => visitedWith(NOTHING_DRAWN, source), [source]);
  if (pass.nextSource === undefined) return null;
  return (
    <ClonedLink
      covered={everyHolder}
      source={pass.nextSource}
      ordinal={OVERLAY_ORDINAL_PAST_CHAINS + 1}
      visited={visited}
    />
  );
}

function isFirstOfHolder(slot: SurfaceSlot): boolean {
  return slot.index === 0;
}

/** The slot as the only surface of its holder, so a chain draw over it takes one material. */
function asOneSurface(slot: SurfaceSlot): SurfaceSlot {
  return { ...slot, count: 1 };
}

/** The pass after a loaded material, resolved in the tables of the file that wrote it. */
function useNextSource({ material, scalars }: DrawnMaterial): MaterialSource | undefined {
  return useMemo(
    () => (material && scalars ? resolveNextPass(scalars.nextPass, material) : undefined),
    [material, scalars]
  );
}

/**
 * One pass over a clone, built through the same `useSurfaceMaterial` load on the glTF surface: its
 * material, disposed with the pass, and the pass after it.
 */
function useClonedPass(source: MaterialSource | undefined) {
  const loaded = useSurfaceMaterial(source, GLTF_SURFACE);
  const { isAbsent, bags } = loaded;
  const material = useMemo(() => {
    // The pass's own file cannot load: Godot's `!material` guard ends the chain there
    // (`render_forward_clustered.cpp:4192`). Anything else unresolved draws the
    // placeholder its React surface slot draws, until its texture arrives.
    if (isAbsent) return null;
    return materialFromBag(bags ? bags.unfaded : MISSING_TEXTURE_MATERIAL);
  }, [isAbsent, bags]);
  useDisposeOnRelease(material);
  return { material, nextSource: useNextSource(loaded), readsStencil: loaded.scalars?.readsStencil === true };
}

/**
 * One link of a `next_pass` chain over the covered slots. A link that reads the stencil draws
 * nothing here, which requests no stencil buffer, and the walk continues past it. A link whose
 * material already drew is cut, so each material of a hand-written cycle draws once.
 */
function ClonedLink({
  covered,
  source,
  ordinal,
  visited,
}: {
  /** The slots the chain's first material drew, or null while it drew none. */
  covered: readonly SurfaceSlot[] | null;
  source: MaterialSource;
  ordinal: number;
  visited: ReadonlySet<string>;
}) {
  const pass = useClonedPass(source);
  // The mount takes a null material for a pass still loading and for one that reads the stencil,
  // and no slots for a cut pass. Each leaves the tree as it was.
  const isCut = visited.has(materialSourceKey(source));
  useClonedExtraDraws(isCut ? null : covered, pass.readsStencil ? null : pass.material, ordinal);
  if (isCut || pass.nextSource === undefined) return null;
  return (
    <ClonedLink
      covered={covered}
      source={pass.nextSource}
      ordinal={ordinal + 1}
      visited={visitedWith(visited, source)}
    />
  );
}

/**
 * Mounts one sibling draw per covered surface slot, drawing `link` at the link's draw
 * order over the holder's geometry, and picking nothing. The tree is restored on the
 * link's departure.
 */
function useClonedExtraDraws(
  covered: readonly SurfaceSlot[] | null,
  link: THREE.Material | null,
  ordinal: number
): void {
  useEffect(() => {
    if (!link || !covered) return undefined;

    const added: THREE.Object3D[] = [];
    for (const { holder, index, count } of covered) {
      // The sibling mirrors the holder's class of drawn object: an InstancedMesh draws its
      // instances, and a glTF's points or line primitives carry materials their own class
      // draws, which a plain Mesh sibling would not draw.
      const mesh = chainSibling(holder, chainMaterial(holder instanceof THREE.Mesh ? count : 1, index, link));
      if (!mesh) continue;
      Object.assign(mesh, extraDrawProps(ordinal));
      orderByPass(mesh);
      // Beside the holder, so the link draws where the surface draws.
      holder.parent?.add(mesh);
      extraDraws.add(mesh);
      added.push(mesh);
    }
    return () => {
      for (const mesh of added) {
        mesh.parent?.remove(mesh);
        extraDraws.delete(mesh);
      }
    };
  }, [covered, link, ordinal]);
}

/** The starting slots of a chain draw on a holder with `count` surfaces, the link in its own group. */
function chainMaterial(
  count: number,
  index: number,
  link: THREE.Material
): THREE.Material | THREE.Material[] {
  if (count === 1) return link;
  const materials: THREE.Material[] = Array.from({ length: count }, () => OTHER_DRAWS_SURFACE);
  materials[index] = link;
  return materials;
}

/**
 * The sibling draw over a surface slot's holder, where the holder draws: its transform,
 * skinning, instances, culling, visual layers and per-surface draw hooks ride along, so
 * the link lands, deforms, culls and is seen where the surface draws. Null for a class this mount
 * does not mirror, which takes no extra draw.
 */
function chainSibling(
  holder: THREE.Object3D,
  materials: THREE.Material | THREE.Material[]
): THREE.Object3D | null {
  let sibling: THREE.Object3D;
  if (holder instanceof THREE.SkinnedMesh) {
    // The skinned branch binds the surface's skinning, so the link deforms as the surface does.
    const skinned = new THREE.SkinnedMesh(holder.geometry, materials);
    skinned.bindMode = holder.bindMode;
    skinned.bind(holder.skeleton, holder.bindMatrix);
    sibling = skinned;
  } else if (holder instanceof THREE.InstancedMesh) {
    // The instances ride through the holder's own attributes: the sibling never disposes
    // them, so sharing the buffer writes no reader against the holder's own draw.
    const instanced = new THREE.InstancedMesh(holder.geometry, materials, holder.count);
    instanced.instanceMatrix = holder.instanceMatrix;
    if (holder.instanceColor) instanced.instanceColor = holder.instanceColor;
    sibling = instanced;
  } else if (holder instanceof THREE.Points) {
    sibling = new THREE.Points(holder.geometry, materials);
  } else if (holder instanceof THREE.Line) {
    sibling = new (
      holder.constructor as new (
        geometry: THREE.BufferGeometry,
        material: THREE.Material | THREE.Material[]
      ) => THREE.Line
    )(holder.geometry, materials);
  } else if (holder instanceof THREE.Mesh) {
    sibling = new THREE.Mesh(holder.geometry, materials);
  } else {
    return null;
  }
  sibling.position.copy(holder.position);
  sibling.quaternion.copy(holder.quaternion);
  sibling.scale.copy(holder.scale);
  sibling.visible = holder.visible;
  sibling.frustumCulled = holder.frustumCulled;
  sibling.castShadow = holder.castShadow;
  sibling.onBeforeRender = holder.onBeforeRender;
  sibling.onAfterRender = holder.onAfterRender;
  sibling.onBeforeShadow = holder.onBeforeShadow;
  sibling.onAfterShadow = holder.onAfterShadow;
  setVisualLayers(sibling, visualLayersOf(holder));
  return sibling;
}

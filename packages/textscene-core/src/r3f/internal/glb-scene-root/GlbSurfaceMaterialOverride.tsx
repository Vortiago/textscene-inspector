/**
 * `surface_material_override/0` on a mesh inside a loaded GLB. Not in the pure, synchronous
 * `applyGlbNodeOverrides`: its material may load asynchronously, which React handles
 * declaratively. The override material's own `next_pass` chain links build through the
 * imperative adapter, each mounted as a sibling draw beside each replaced surface.
 */

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { MISSING_TEXTURE_MATERIAL } from '../../../resources/materials/standardmaterial3d/materialBag.js';
import { materialFromBag } from '../../../resources/materials/standardmaterial3d/build.js';
import { surfaceSlotsUnder, type SurfaceSlot } from '../../../resources/formats/glb/surfaceMaterials.js';
import { GLTF_SURFACE } from '../../materials/surfaceTextures.js';
import { useSurfaceMaterial } from '../../materials/useSurfaceMaterial.js';
import { materialSourceKey, resolveNextPass, type MaterialSource } from '../../materials/materialSource.js';
import { nextPassRenderOrder, visitedWith } from '../../materials/nextPass.js';
import { NO_RAYCAST } from '../../materials/materialOverlay.js';
import { OTHER_DRAWS_SURFACE } from '../../materials/useOneSurfaceStartingMaterial.js';

import { registerFadedCopyBuilders, unfadedMaterial } from '../../materials/fadedMeshMaterials.js';
import { useDisposeOnRelease } from '../../useDisposeOnRelease.js';

interface GlbSurfaceMaterialOverrideProps {
  /** The GLB-internal object whose surface materials are being replaced. */
  target: THREE.Object3D;
  /** Where the override material lives, already resolved. */
  source: MaterialSource;
  /** Which surface materials under `target` it replaces. Every one by default. Stable identity. */
  replaces?: (current: THREE.Material) => boolean;
}

/**
 * The override material, built and disposed here: the target is a cloned GLB with no R3F element,
 * so it installs the bags of `useSurfaceMaterial` itself (ADR-0039). A material this previewer
 * cannot build still replaces the glTF's own with Godot's default (ADR-0041). One still loading,
 * or one that never loads, replaces nothing, as Godot's null does. A missing texture draws magenta.
 */
export function GlbSurfaceMaterialOverride({
  target,
  source,
  replaces = everySurface,
}: GlbSurfaceMaterialOverrideProps) {
  // The geometry is the glTF's: no Godot mesh sub-resource for a triplanar material to tile
  // against, and UVs in Godot's top-down V.
  const { isAbsent, bags, material: resource, scalars } = useSurfaceMaterial(source, GLTF_SURFACE);
  const material = useMemo(() => {
    if (isAbsent) return null;
    if (!bags) return materialFromBag(MISSING_TEXTURE_MATERIAL);
    const unfaded = materialFromBag(bags.unfaded);
    registerFadedCopyBuilders(unfaded, {
      unfaded: (extra) => materialFromBag(bags.unfaded, extra),
      alphaPass: () => materialFromBag(bags.alphaPass),
    });
    return unfaded;
  }, [isAbsent, bags]);
  useDisposeOnRelease(material);
  const covered = useGlbMaterialSwap(target, material, replaces);
  // The override drew the surface, so its own `next_pass` runs from ordinal 1, resolved
  // in the tables of the file that wrote the override material.
  const nextSource = useMemo(
    () => (resource && scalars ? resolveNextPass(scalars.nextPass, resource) : undefined),
    [resource, scalars]
  );
  const visited = useMemo(() => new Set([materialSourceKey(source)]), [source]);
  if (nextSource === undefined) return null;
  return <GlbNextPassLink covered={covered} source={nextSource} ordinal={1} visited={visited} />;
}

/**
 * One link of the override material's `next_pass` chain, built through the same
 * `useSurfaceMaterial` load on the glTF surface. A stencil-reading link draws nothing
 * here, which requests no stencil buffer, and the walk continues past it; a link whose
 * material already drew is cut, drawing each material of a hand-written cycle once.
 */
function GlbNextPassLink({
  covered,
  source,
  ordinal,
  visited,
}: {
  /** The slots the override's swap covered, or null while it covered none. */
  covered: readonly SurfaceSlot[] | null;
  source: MaterialSource | undefined;
  ordinal: number;
  visited: ReadonlySet<string>;
}) {
  const { isAbsent, bags, material: resource, scalars } = useSurfaceMaterial(source, GLTF_SURFACE);
  const link = useMemo(() => {
    if (isAbsent || !bags) return null;
    return materialFromBag(bags.unfaded);
  }, [isAbsent, bags]);
  useDisposeOnRelease(link);
  const nextSource = useMemo(
    () => (resource && scalars ? resolveNextPass(scalars.nextPass, resource) : undefined),
    [resource, scalars]
  );

  // A pass whose material already drew on this surface is cut: the walk drew it once and
  // continued through it already, so its repeat ends here. The mount takes a null link
  // for a still-loading pass, a cut one and a stencil-reading one, all of which leave
  // the tree as it was while the walk continues past them.
  const cut = source !== undefined && visited.has(materialSourceKey(source));
  useGlbChainMount(cut ? null : covered, scalars?.readsStencil === true ? null : link, ordinal);
  if (cut) return null;
  if (nextSource === undefined) return null;
  return (
    <GlbNextPassLink
      covered={covered}
      source={nextSource}
      ordinal={ordinal + 1}
      visited={visitedWith(visited, source)}
    />
  );
}

/**
 * Mounts one sibling draw per covered surface slot, drawing `link` at the link's draw
 * order over the holder's geometry, and picking nothing. The tree is restored on the
 * link's departure, as the swap restores each slot.
 */
function useGlbChainMount(
  covered: readonly SurfaceSlot[] | null,
  link: THREE.Material | null,
  ordinal: number
): void {
  useEffect(() => {
    if (!link || !covered) return undefined;

    const added: THREE.Mesh[] = [];
    for (const { holder, index, count } of covered) {
      // A points or line surface draws no triangle geometry for a sibling Mesh to share,
      // so its surface carries the swap alone and no chain draw.
      if (!holder.isMesh) continue;
      const mesh = chainSibling(holder, chainMaterial(count, index, link));
      mesh.renderOrder = nextPassRenderOrder(ordinal);
      mesh.raycast = NO_RAYCAST;
      mesh.receiveShadow = true;
      // Beside the holder, so the link draws where the surface draws.
      holder.parent?.add(mesh);
      added.push(mesh);
    }
    return () => {
      for (const mesh of added) mesh.parent?.remove(mesh);
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
 * The sibling draw over a surface slot's holder, where the holder draws: its local
 * transform and skinning ride along, so the link lands where the surface draws and
 * deforms as the surface deforms.
 */
function chainSibling(holder: THREE.Mesh, materials: THREE.Material | THREE.Material[]): THREE.Mesh {
  if (holder instanceof THREE.SkinnedMesh) {
    // The skinned branch binds the surface's skinning, so the link deforms as the surface does.
    const skinned = new THREE.SkinnedMesh(holder.geometry, materials);
    skinned.position.copy(holder.position);
    skinned.quaternion.copy(holder.quaternion);
    skinned.scale.copy(holder.scale);
    skinned.bindMode = holder.bindMode;
    skinned.bind(holder.skeleton, holder.bindMatrix);
    return skinned;
  }
  const mesh = new THREE.Mesh(holder.geometry, materials);
  mesh.position.copy(holder.position);
  mesh.quaternion.copy(holder.quaternion);
  mesh.scale.copy(holder.scale);
  return mesh;
}

/**
 * Puts `material` into every surface slot under `target` that `replaces` accepts: a glTF node
 * with several primitives arrives as a Group of Meshes. Restores each slot on unmount, since the
 * GLB clone is long-lived and a reload that dropped the override would leave the swap behind. A
 * slot another override has since taken keeps that override's material. A slot the range fade
 * holds in the alpha pass counts as its unfaded material, which the next fade draws again.
 * Returns the slots the swap covered, as its last run accepted them, so a chain link draws
 * beside exactly them whenever its own material lands.
 */
function useGlbMaterialSwap(
  target: THREE.Object3D,
  material: THREE.Material | null,
  replaces: (current: THREE.Material) => boolean
): readonly SurfaceSlot[] | null {
  const [covered, setCovered] = useState<readonly SurfaceSlot[] | null>(null);
  useEffect(() => {
    if (!material) {
      setCovered(null);
      return undefined;
    }

    const restore: Array<() => void> = [];
    const taken: SurfaceSlot[] = [];
    for (const slot of surfaceSlotsUnder(target)) {
      const held = slot.read();
      if (held === undefined) continue;
      const current = unfadedMaterial(held);
      if (!replaces(current)) continue;
      slot.assign(material);
      restore.push(() => {
        const now = slot.read();
        if (now && unfadedMaterial(now) === material) slot.assign(current);
      });
      taken.push(slot);
    }
    // The same slot set keeps the covered array: the chain's siblings rebuild nothing
    // for a re-assign of the slots they already side.
    setCovered((previous) => (coveredKey(previous) === coveredKey(taken) ? previous : taken));
    return () => restore.forEach((undo) => undo());
  }, [target, material, replaces]);
  return covered;
}

/** The covered set's identity: the holders and their slot indexes, joined. */
function coveredKey(slots: readonly SurfaceSlot[] | null): string | null {
  return slots === null ? null : slots.map((slot) => `${slot.holder.uuid}:${slot.index}`).join(',');
}

/** A node's own override takes every surface under its target. */
function everySurface(): boolean {
  return true;
}

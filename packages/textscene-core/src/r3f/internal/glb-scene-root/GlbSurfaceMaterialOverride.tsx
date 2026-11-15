/**
 * The materials an override node sets on a mesh inside a loaded GLB: `material_override` or
 * `surface_material_override/N` in its slots, and `material_overlay` beside them. A material may
 * load late, so React mounts each one. The surfaced mesh drawer's adapter for a cloned object
 * draws each `next_pass` link and the overlay (`ClonedExtraDraws.tsx`).
 */

import { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { MISSING_TEXTURE_MATERIAL } from '../../../resources/materials/standardmaterial3d/materialBag.js';
import { materialFromBag } from '../../../resources/materials/standardmaterial3d/build.js';
import { surfaceSlotsUnder, type SurfaceSlot } from '../../../resources/formats/glb/surfaceMaterials.js';
import { GLTF_SURFACE } from '../../materials/surfaceTextures.js';
import { useSurfaceMaterial } from '../../materials/useSurfaceMaterial.js';
import type { ScopedReference } from '../../../resources/reading/index.js';
import { ClonedChain, ClonedOverlay, isClonedExtraDraw } from '../../surfacedMeshDrawer/ClonedExtraDraws.js';

import { registerFadedCopyBuilders, unfadedMaterial } from '../../materials/fadedMeshMaterials.js';
import { useDisposeOnRelease } from '../../useDisposeOnRelease.js';

/** The slots of the GLB's own surfaces under `target`, without the extra draws beside them. */
function ownSurfaceSlotsUnder(target: THREE.Object3D): SurfaceSlot[] {
  return surfaceSlotsUnder(target).filter((slot) => !isClonedExtraDraw(slot.holder));
}

/**
 * Whether a surface takes the override. `surfaceIndex` counts the mesh's primitives in the glTF's
 * order, which is the surface order of the mesh Godot imports.
 */
export type SurfaceFilter = (current: THREE.Material, surfaceIndex: number) => boolean;

interface GlbSurfaceMaterialOverrideProps {
  /** The GLB-internal object whose surface materials are being replaced. */
  target: THREE.Object3D;
  /** Where the override material lives, already resolved. */
  source: ScopedReference;
  /**
   * Which surfaces under `target` it replaces, by the surface's material and its index in the
   * mesh. Every one by default. Stable identity.
   */
  replaces?: SurfaceFilter;
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
  const loaded = useSurfaceMaterial(source, GLTF_SURFACE);
  const { isAbsent, bags } = loaded;
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
  return <ClonedChain covered={covered} source={source} drawn={loaded} />;
}

/** `material_overlay` on a mesh inside a loaded GLB, over every surface of the GLB's own under `target`. */
export function GlbMaterialOverlay({ target, source }: { target: THREE.Object3D; source: ScopedReference }) {
  const slots = useMemo(() => ownSurfaceSlotsUnder(target), [target]);
  return <ClonedOverlay slots={slots} source={source} />;
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
  replaces: SurfaceFilter
): readonly SurfaceSlot[] | null {
  const [covered, setCovered] = useState<readonly SurfaceSlot[] | null>(null);
  useEffect(() => {
    if (!material) {
      setCovered(null);
      return undefined;
    }

    const restore: Array<() => void> = [];
    const taken: SurfaceSlot[] = [];
    for (const [surfaceIndex, slot] of ownSurfaceSlotsUnder(target).entries()) {
      const held = slot.read();
      if (held === undefined) continue;
      const current = unfadedMaterial(held);
      if (!replaces(current, surfaceIndex)) continue;
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

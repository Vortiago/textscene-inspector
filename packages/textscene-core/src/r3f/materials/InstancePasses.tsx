/**
 * What a geometry instance adds to one surface draw of its leaf: `material_override` in place of
 * the surface's own material, the `next_pass` chain of whichever material draws, and
 * `material_overlay` with its own chain (`render_forward_clustered.cpp:4202-4241`). The base hands
 * them over (`useInstanceDraw`), so a leaf passes only what it draws.
 */

import { useEffect, useLayoutEffect, useMemo, type ReactNode, type RefObject } from 'react';
import type * as THREE from 'three';
import { useInstanceDraw } from '../visibilityRange/geometryInstance';
import type { MaterialSource } from './materialSource';
import { NextPassChain } from './nextPass';
import { ExtraDrawSiteContext } from './extraDraw';
import { orderByPass } from './passOrder';
import { SurfaceMaterialSlots, overriddenSources } from './SurfaceMaterialSlots';
import type { SurfacePrimitive } from '../../resources/meshes/godotSurface';
import { listedSlot } from '../meshes/sharedInstances';

/** The draw a leaf mounts the passes in, which every extra draw copies. */
interface BaseDraw {
  /** The base draw, whose geometry every extra draw shares, but for an overlay with an `overlayGeometry`. */
  meshRef: RefObject<THREE.Object3D | null>;
  /** What the base draws, so every extra draw draws it too. */
  primitive?: SurfacePrimitive;
  /** The skeleton that skins the base, or null for an unskinned draw. */
  skeleton?: THREE.Skeleton | null;
  /**
   * The surfaces the leaf draws after this one, each as its own object, which the alpha pass
   * sorts every draw of this surface after (`orderByPass`). Zero by default.
   */
  laterSurfaces?: number;
  /**
   * The object a node billboard or `fixed_size` of the leaf moves, at or above the base draw. The
   * extra draws then stay at the node's own pose (`extraDraw.ts`). Omitted, nothing moves it.
   */
  posedRef?: RefObject<THREE.Object3D | null>;
  /**
   * The geometry `material_overlay` fills, where the base draw holds another: the mesh Godot holds
   * for a leaf whose own material draws a stand-in. Omitted, the overlay shares the base draw's.
   */
  overlayGeometry?: THREE.BufferGeometry;
}

interface InstancePassesProps extends BaseDraw {
  /** The material of each draw group, before `material_override`. A leaf that builds its own omits it. */
  sources?: readonly (MaterialSource | undefined)[];
  /** The material a leaf builds itself, as an element to mount while no `material_override` stands. */
  ownMaterial?: ReactNode;
}

/** The one draw group of a leaf that builds its own material. */
const ONE_SURFACE: readonly undefined[] = [undefined];

/** A material the leaf builds itself holds no `next_pass`. */
const NO_CHAIN: readonly MaterialSource[] = [];

/** Mounts inside the base draw: the material slot of each draw group, each slot's chain, and the overlay. */
export function InstancePasses(props: InstancePassesProps) {
  const {
    meshRef,
    primitive = 'triangles',
    skeleton,
    laterSurfaces = 0,
    posedRef,
    ownMaterial,
    overlayGeometry,
  } = props;
  const { override, overlay, shadow, layers, instance } = useInstanceDraw();
  const site = useMemo(
    () => ({ nodePose: posedRef ? { instance, posedRef } : null, laterSurfaces }),
    [instance, posedRef, laterSurfaces]
  );
  // No dependencies: a rebuilt base draw is a new object. The layout pass sorts it before paint,
  // and the passive pass sorts the first one, whose ref lands after this layout pass.
  const sortBase = () => {
    if (laterSurfaces > 0) orderByPass(meshRef.current, laterSurfaces);
  };
  useLayoutEffect(sortBase);
  useEffect(sortBase);
  const drawsOwnMaterial = props.sources === undefined && !override;
  if (drawsOwnMaterial && !overlay) return ownMaterial;
  const sources = overriddenSources(props.sources ?? ONE_SURFACE, override);
  return (
    <ExtraDrawSiteContext.Provider value={site}>
      {drawsOwnMaterial ? (
        ownMaterial
      ) : (
        <SurfaceMaterialSlots sources={sources} {...listedSlot(primitive, 'mesh')} />
      )}
      <NextPassChain
        meshRef={meshRef}
        sources={drawsOwnMaterial ? NO_CHAIN : sources}
        primitive={primitive}
        skeleton={skeleton}
        godotLayers={layers}
        shadow={shadow}
        overlay={overlay}
        overlayGeometry={overlayGeometry}
      />
    </ExtraDrawSiteContext.Provider>
  );
}

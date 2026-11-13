/**
 * What every extra draw of a geometry instance takes: a `next_pass` link or the overlay, drawn
 * beside the surface draw it covers. `extraDrawProps` sets its object, a React element and a cloned
 * object alike. `useExtraDrawRef` sorts a React one by its pass (`passOrder.ts`) and holds it at
 * the node's own pose under a node billboard or `fixed_size` (`extraDrawPose.ts`).
 */

import { createContext, useCallback, useContext } from 'react';
import type * as THREE from 'three';
import { drawAtNodePose, type PosedLeaf } from './extraDrawPose';
import { NO_RAYCAST } from './noRaycast';
import { nextPassRenderOrder, orderByPass } from './passOrder';

/** What a leaf's extra draws take from the surface draw they cover. */
export interface ExtraDrawSite {
  /** Null where no node billboard or `fixed_size` moves the surface draw, the case of most leaves. */
  nodePose: PosedLeaf | null;
  /** The surfaces the leaf draws after this one, each as its own object (`orderByPass`). */
  laterSurfaces: number;
}

const ONE_UNMOVED_SURFACE: ExtraDrawSite = { nodePose: null, laterSurfaces: 0 };

export const ExtraDrawSiteContext = createContext<ExtraDrawSite>(ONE_UNMOVED_SURFACE);
ExtraDrawSiteContext.displayName = 'ExtraDrawSiteContext';

/** The `ref` of an extra draw's element, which releases the node pose with the draw or the site. */
export function useExtraDrawRef(): (object: THREE.Object3D | null) => void | (() => void) {
  const { nodePose, laterSurfaces } = useContext(ExtraDrawSiteContext);
  return useCallback(
    (object) => {
      orderByPass(object, laterSurfaces);
      return object && nodePose ? drawAtNodePose(object, nodePose) : undefined;
    },
    [nodePose, laterSurfaces]
  );
}

/**
 * What every extra draw sets on its object, a React element and a cloned object alike: its place
 * in the instance's draw order, no picking, since the surface's own draw is the node's pickable
 * body, and shadows received as the surface receives them.
 *
 * @canonical The object settings of an extra draw
 */
export function extraDrawProps(ordinal: number) {
  return { renderOrder: nextPassRenderOrder(ordinal), raycast: NO_RAYCAST, receiveShadow: true };
}

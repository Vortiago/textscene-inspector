/**
 * Each GeometryInstance3D's link to the scene cull. The registry mounts every GeometryInstance3D
 * component in `withGeometryInstance`, which gives it one from the node's data, drawn or not, so a
 * visibility parent the previewer does not draw still decides its dependants. The drawer inside
 * places it and reads the shadow effects the cull gates, and the cull fades each surface it adds.
 */

import { useThree } from '@react-three/fiber';
import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { hasGeometryBase } from '../../godot/geometryBase';
import type { GeometryInstance3DProperties } from '../../nodes/3d/geometryinstance3d/types';
import { useNodePath } from '../contexts/NodePathContext';
import { useTreeOrder } from '../contexts/TreeOrderContext';
import type { NodeComponent, NodeComponentProps } from '../NodeComponentRegistry';
import { useParentType } from '../parentSpaceScope';
import { rangedShadowCastingEffects, type ShadowCastingEffects } from '../shadowCasting';
import { FadedSurfacesContext } from '../materials/swappedMaterials';
import { registerVisibilityInstance } from './visibilityScene';
import { useVisibilityParent } from './VisibilityParentContext';
import { UNPLACED, type InstancePlacement } from './placements';
import { CulledInstance } from './culledInstance';

interface GeometryInstanceScope {
  instance: CulledInstance;
  shadow: ShadowCastingEffects;
}

/** Null outside a GeometryInstance3D component, and inside the nodes it renders as its children. */
const GeometryInstanceContext = createContext<GeometryInstanceScope | null>(null);
GeometryInstanceContext.displayName = 'GeometryInstanceContext';

/**
 * The component the registry mounts for a GeometryInstance3D type: `Drawer`, with the node's
 * instance registered with the scene cull for as long as it mounts. The cull runs before every
 * render, so even the first draw is culled.
 */
export function withGeometryInstance(Drawer: NodeComponent): NodeComponent {
  function GeometryInstanceComponent({ node, children }: NodeComponentProps) {
    const scene = useThree((state) => state.scene);
    const path = useNodePath();
    const parentPath = useVisibilityParent();
    const order = useTreeOrder();
    const parentType = useParentType();
    const properties = node.properties as GeometryInstance3DProperties;
    const instance = useMemo(() => new CulledInstance(), []);

    useLayoutEffect(() => {
      instance.update({ path, parentPath, order }, properties);
      instance.hasBase = hasGeometryBase(node.type, node.rawProperties, parentType);
    });
    useLayoutEffect(() => registerVisibilityInstance(scene, instance), [scene, instance]);

    const shadow = useMemo(
      () => rangedShadowCastingEffects(properties.castShadow, instance),
      [properties.castShadow, instance]
    );
    const scope = useMemo(() => ({ instance, shadow }), [instance, shadow]);
    // The nodes it renders as children take their own scope, or none.
    return (
      <GeometryInstanceContext.Provider value={scope}>
        <FadedSurfacesContext.Provider value={instance}>
          <Drawer node={node}>
            {children == null ? children : <OutsideInstance>{children}</OutsideInstance>}
          </Drawer>
        </FadedSurfacesContext.Provider>
      </GeometryInstanceContext.Provider>
    );
  }
  GeometryInstanceComponent.displayName = `withGeometryInstance(${Drawer.displayName ?? Drawer.name})`;
  return GeometryInstanceComponent;
}

/** The nodes a drawer renders as its children, outside its instance's scope and fade. */
function OutsideInstance({ children }: { children: ReactNode }) {
  return (
    <GeometryInstanceContext.Provider value={null}>
      <FadedSurfacesContext.Provider value={null}>{children}</FadedSurfacesContext.Provider>
    </GeometryInstanceContext.Provider>
  );
}

const MISSING_SCOPE = 'expected a GeometryInstance3D drawer inside withGeometryInstance, got none';

/** The enclosing GeometryInstance3D's scope. Its drawer's tree always has one. */
function useGeometryInstanceScope(): GeometryInstanceScope {
  const scope = useContext(GeometryInstanceContext);
  if (!scope) throw new Error(MISSING_SCOPE);
  return scope;
}

/**
 * Places the enclosing node's instance, and returns its `cast_shadow` with the draw hooks that
 * skip its colour and sun-shadow draws while the cull culls it.
 */
export function useGeometryInstance(placement: InstancePlacement): ShadowCastingEffects {
  const { instance, shadow } = useGeometryInstanceScope();
  useLayoutEffect(() => {
    instance.placement = placement;
    return () => {
      instance.placement = UNPLACED;
    };
  }, [instance, placement]);
  return shadow;
}

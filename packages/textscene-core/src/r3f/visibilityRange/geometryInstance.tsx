/**
 * Each GeometryInstance3D's link to the scene cull. `withGeometryInstance` gives every
 * GeometryInstance3D component one from the node's data, drawn or not, so a visibility parent the
 * previewer does not draw still decides its dependants. The drawer inside places it and reads the
 * shadow effects the cull gates, and the cull fades each surface the drawer adds.
 */

import { useThree } from '@react-three/fiber';
import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { hasGeometryBase } from '../../godot/geometryBase';
import type { GeometryInstance3DProperties } from '../../nodes/3d/geometryinstance3d/types';
import { useNodePath } from '../contexts/NodePathContext';
import type { NodeComponent, NodeComponentProps } from '../NodeComponentRegistry';
import { useParentType } from '../parentSpaceScope';
import { rangedShadowCastingEffects, type ShadowCastingEffects } from '../shadowCasting';
import {
  FadedSurfacesContext,
  useSwappedMaterials,
  type MaterialAttach,
} from '../materials/swappedMaterials';
import type { FadeVariants } from '../materials/fadeVariants';
import { registerVisibilityInstance } from './visibilityScene';
import { useVisibilityParent } from './VisibilityParentContext';
import type { InstancePlacement } from './placements';
import { CulledInstance, UNPLACED } from './culledInstance';

interface GeometryInstanceScope {
  instance: CulledInstance;
  shadow: ShadowCastingEffects;
}

/** Null outside a GeometryInstance3D component, and inside the nodes it renders as its children. */
const GeometryInstanceContext = createContext<GeometryInstanceScope | null>(null);
GeometryInstanceContext.displayName = 'GeometryInstanceContext';

/** Written only by `withGeometryInstance`, so the registry can tell its components apart. */
const geometryInstanceComponents = new WeakSet<NodeComponent>();

/** Whether `withGeometryInstance` made the component. */
export function isGeometryInstanceComponent(Component: NodeComponent): boolean {
  return geometryInstanceComponents.has(Component);
}

/**
 * The component a GeometryInstance3D type registers: `Drawer`, with the node's instance registered
 * with the scene cull for as long as it mounts. The cull runs before every render, so even the
 * first draw is culled.
 */
export function withGeometryInstance(Drawer: NodeComponent): NodeComponent {
  function GeometryInstanceComponent({ node, children }: NodeComponentProps) {
    const scene = useThree((state) => state.scene);
    const path = useNodePath();
    const parentPath = useVisibilityParent();
    const parentType = useParentType();
    const properties = node.properties as GeometryInstance3DProperties;
    const instance = useMemo(() => new CulledInstance(), []);

    useLayoutEffect(() => {
      instance.update(path, parentPath, properties);
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
  geometryInstanceComponents.add(GeometryInstanceComponent);
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

/**
 * The function attaches of one surface the enclosing instance's drawer builds itself, at `attach`:
 * its unfaded and alpha-pass materials, which the cull swaps.
 */
export function useInstanceSurface(attach?: string): FadeVariants<MaterialAttach> {
  const swapped = useSwappedMaterials(attach);
  if (!swapped) throw new Error(MISSING_SCOPE);
  return swapped;
}

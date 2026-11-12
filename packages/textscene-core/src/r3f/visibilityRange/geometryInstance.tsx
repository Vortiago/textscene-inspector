/**
 * Each GeometryInstance3D's link to the scene cull, and what Godot sets on the instance for every
 * geometry type: `material_override`, `material_overlay` (`visual_instance_3d.cpp:211-228`),
 * `layers` and `cast_shadow`. The registry mounts every GeometryInstance3D component in
 * `withGeometryInstance`, drawn or not, so an undrawn visibility parent still decides its dependants.
 */

import { useThree } from '@react-three/fiber';
import { createContext, useContext, useLayoutEffect, useMemo, type ReactNode } from 'react';
import { hasGeometryBase } from '../../godot/scene/geometryBase';
import type { GeometryInstance3DProperties } from '../../nodes/3d/geometryinstance3d/types';
import { useNodePath } from '../contexts/NodePathContext';
import { useTreeOrder } from '../contexts/TreeOrderContext';
import type { NodeComponent, NodeComponentProps } from '../NodeComponentRegistry';
import { useParentType } from '../parentSpaceScope';
import { rangedShadowCastingEffects, type ShadowCastingEffects } from '../shadowCasting';
import { FadedSurfacesContext } from '../materials/swappedMaterials';
import { resolveMaterialSource, type MaterialSource } from '../materials/materialSource';
import { useSceneResources } from '../SceneResourcesContext';
import type { DrawnInstance } from '../surfaceDrawHooks';
import { registerVisibilityInstance } from './visibilityScene';
import { useVisibilityParent } from './VisibilityParentContext';
import { UNPLACED, type InstancePlacement } from './placements';
import { CulledInstance } from './culledInstance';

/** What the base hands every draw of its instance. */
export interface InstanceDraw {
  /** `cast_shadow`, with the draw hooks that skip its colour and sun-shadow draws while culled. */
  shadow: ShadowCastingEffects;
  /** `material_override`: in place of every surface's material. Undefined for none. */
  override: MaterialSource | undefined;
  /** `material_overlay`: every surface drawn a second time. Undefined for none. */
  overlay: MaterialSource | undefined;
  /** `layers`: the render mask a Decal's and a ReflectionProbe's masks test. */
  layers: number;
  /** The instance as the draw hooks read it: its cull state and the node's own pose. */
  instance: DrawnInstance;
}

/** The draw, with the instance as the base places it. */
type GeometryInstanceScope = InstanceDraw & { instance: CulledInstance };

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
    const pools = useSceneResources();
    const override = useMemo(
      () => resolveMaterialSource(properties.materialOverride, pools),
      [properties.materialOverride, pools]
    );
    const overlay = useMemo(
      () => resolveMaterialSource(properties.materialOverlay, pools),
      [properties.materialOverlay, pools]
    );
    const { layers } = properties;
    const scope = useMemo(
      () => ({ shadow, override, overlay, layers, instance }),
      [instance, shadow, override, overlay, layers]
    );
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

/** Places the enclosing node's instance for the scene cull, until the drawer unmounts. */
export function useGeometryInstance(placement: InstancePlacement): void {
  const { instance } = useGeometryInstanceScope();
  useLayoutEffect(() => {
    instance.placement = placement;
    return () => {
      instance.placement = UNPLACED;
    };
  }, [instance, placement]);
}

/** What the enclosing node's base hands each draw of its instance. */
export function useInstanceDraw(): InstanceDraw {
  return useGeometryInstanceScope();
}

/** What a drawer under no GeometryInstance3D owns of its draws: it holds no instance material. */
export type OwnInstanceDraw = Pick<InstanceDraw, 'shadow' | 'layers'>;

/**
 * `useInstanceDraw` for a drawer some callers mount under no GeometryInstance3D: `own` stands
 * where no base does, with no instance material.
 */
export function useInstanceDrawOr(own: OwnInstanceDraw | undefined): Omit<InstanceDraw, 'instance'> {
  const scope = useContext(GeometryInstanceContext);
  if (own) return { ...own, override: undefined, overlay: undefined };
  if (!scope) throw new Error(MISSING_SCOPE);
  return scope;
}

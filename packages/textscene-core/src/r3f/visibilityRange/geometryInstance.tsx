/**
 * Each GeometryInstance3D's link to the scene cull. `withGeometryInstance` gives every
 * GeometryInstance3D component one from the node's data, drawn or not, so a visibility parent the
 * previewer does not draw still decides its dependants. The drawer inside places it and reads the
 * shadow effects and the fade the cull gates.
 */

import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { fadeAlpha, forcesAlphaPass, geometryFade } from '../../godot/fadeAlpha';
import { hasSurface, type Aabb } from '../../godot/aabb';
import { hasGeometryBase } from '../../godot/geometryBase';
import { hasVisibilityRange, NO_VISIBILITY_RANGE, type VisibilityRange } from '../../godot/visibilityRange';
import type { GeometryInstance3DProperties } from '../../nodes/3d/geometryinstance3d/types';
import { useNodePath } from '../contexts/NodePathContext';
import type { NodeComponent, NodeComponentProps } from '../NodeComponentRegistry';
import { useParentType } from '../parentSpaceScope';
import { rangedShadowCastingEffects, type ShadowCastingEffects } from '../shadowCasting';
import type { RangeGate } from '../surfaceDrawHooks';
import { registerVisibilityInstance, type VisibilityInstance, type VisibilityLinks } from './visibilityScene';
import { useVisibilityParent } from './VisibilityParentContext';
import { copyAabb, type InstancePlacement } from './placements';

export interface GeometryInstanceDraw {
  /** `cast_shadow`, with draw hooks that skip a culled instance's colour and sun-shadow draws. */
  shadow: ShadowCastingEffects;
  /** The fade every surface blends at (`geometryFade`), for the material slots. */
  fade: number;
  /** A ref for an object with no draw hooks, which the cull hides outright when it culls it. */
  hideWhenCulled: (object: THREE.Object3D | null) => void;
}

const NODE_ORIGIN: Readonly<THREE.Vector3> = new THREE.Vector3();

/** Where an instance sits until its drawer places it: nowhere the cull can measure but the origin. */
const UNPLACED: InstancePlacement = Object.freeze({
  nodeMatrixWorld: () => false,
  ownAabb: () => false,
});

/** Scratch for one `worldBox` or `isIndexed` call: the cull measures one instance at a time. */
const nodeMatrix = new THREE.Matrix4();
const ownBox = new THREE.Box3();
const ownSize = new THREE.Vector3();

/**
 * One instance's link to the scene cull. React writes its inputs after each commit, and the cull
 * writes `isVisible` before each render, which the draw hooks read through the `RangeGate`.
 */
class CulledInstance implements VisibilityInstance, RangeGate {
  isVisible = true;
  links: VisibilityLinks = { path: null, parentPath: null, hasRange: false };
  range: VisibilityRange = NO_VISIBILITY_RANGE;
  /** Whether its render instance has a geometry base (`godot/geometryBase.ts`). */
  hasBase = false;
  transparency = 0;
  customAabb: Aabb | null = null;
  placement = UNPLACED;
  hidden: THREE.Object3D | null = null;
  /** The range fade React last received. */
  private committedFade = 1;

  constructor(private readonly commitFade: (fade: number) => void) {}

  /** Takes the node's data. A change of links hands the cull a new links object. */
  update(path: string | null, parentPath: string | null, properties: GeometryInstance3DProperties): void {
    const hasRange = hasVisibilityRange(properties.visibilityRange);
    const { links } = this;
    if (links.path !== path || links.parentPath !== parentPath || links.hasRange !== hasRange) {
      this.links = { path, parentPath, hasRange };
    }
    this.range = properties.visibilityRange;
    this.transparency = properties.transparency;
    this.customAabb = properties.customAabb;
  }

  /**
   * A base whose own box has a surface (`renderer_scene_cull.cpp:1675-1681`). A box not yet
   * measured counts as one, so a drawer that has not placed it keeps its links.
   */
  get isIndexed(): boolean {
    if (!this.hasBase) return false;
    if (this.customAabb) return hasSurface(this.customAabb.size);
    return !this.placement.ownAabb(ownBox) || hasSurface(ownBox.getSize(ownSize));
  }

  worldBox(target: THREE.Box3): void {
    // `custom_aabb` replaces the instance's own (`renderer_scene_cull.cpp:1988-1992`). Before
    // its geometry exists, the instance is a point at its origin.
    if (this.customAabb) copyAabb(target, this.customAabb);
    else if (!this.placement.ownAabb(target)) target.set(NODE_ORIGIN, NODE_ORIGIN);
    if (this.placement.nodeMatrixWorld(nodeMatrix)) target.applyMatrix4(nodeMatrix);
  }

  apply(isVisible: boolean, fade: number, isCanvasRender: boolean): void {
    this.isVisible = isVisible;
    if (this.hidden) this.hidden.visible = isVisible;
    if (!isCanvasRender || drawsAlike(fade, this.committedFade, this.transparency)) return;
    this.committedFade = fade;
    this.commitFade(fade);
  }
}

/**
 * Whether two range fades draw the same pixels: Godot quantises the fade to a byte and switches
 * passes at one threshold, so a re-render waits for either to change.
 */
function drawsAlike(a: number, b: number, transparency: number): boolean {
  const fadeA = geometryFade(transparency, a);
  const fadeB = geometryFade(transparency, b);
  return fadeAlpha(fadeA) === fadeAlpha(fadeB) && forcesAlphaPass(fadeA) === forcesAlphaPass(fadeB);
}

interface GeometryInstanceScope {
  instance: CulledInstance;
  shadow: ShadowCastingEffects;
  fade: number;
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
    const [rangeFade, setRangeFade] = useState(1);
    const instance = useMemo(() => new CulledInstance(setRangeFade), []);

    useLayoutEffect(() => {
      instance.update(path, parentPath, properties);
      instance.hasBase = hasGeometryBase(node.type, node.rawProperties, parentType);
    });
    useLayoutEffect(() => registerVisibilityInstance(scene, instance), [scene, instance]);

    const shadow = useMemo(
      () => rangedShadowCastingEffects(properties.castShadow, instance),
      [properties.castShadow, instance]
    );
    const fade = geometryFade(properties.transparency, rangeFade);
    const scope = useMemo(() => ({ instance, shadow, fade }), [instance, shadow, fade]);
    // The nodes it renders as children take their own scope, or none.
    return (
      <GeometryInstanceContext.Provider value={scope}>
        <Drawer node={node}>
          {children == null ? (
            children
          ) : (
            <GeometryInstanceContext.Provider value={null}>{children}</GeometryInstanceContext.Provider>
          )}
        </Drawer>
      </GeometryInstanceContext.Provider>
    );
  }
  GeometryInstanceComponent.displayName = `withGeometryInstance(${Drawer.displayName ?? Drawer.name})`;
  geometryInstanceComponents.add(GeometryInstanceComponent);
  return GeometryInstanceComponent;
}

/** The enclosing GeometryInstance3D's scope. Its drawer's tree always has one. */
function useGeometryInstanceScope(): GeometryInstanceScope {
  const scope = useContext(GeometryInstanceContext);
  if (!scope) throw new Error('expected a GeometryInstance3D drawer inside withGeometryInstance, got none');
  return scope;
}

/** Places the enclosing node's instance, and returns what its drawer draws with. */
export function useGeometryInstance(placement: InstancePlacement): GeometryInstanceDraw {
  const { instance, shadow, fade } = useGeometryInstanceScope();
  useLayoutEffect(() => {
    instance.placement = placement;
    return () => {
      instance.placement = UNPLACED;
    };
  }, [instance, placement]);
  const hideWhenCulled = useCallback(
    (object: THREE.Object3D | null) => {
      instance.hidden = object;
      if (object) object.visible = instance.isVisible;
    },
    [instance]
  );
  return { shadow, fade, hideWhenCulled };
}

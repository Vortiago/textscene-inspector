/**
 * What a GeometryInstance3D's drawer takes from the scene cull: the shadow effects its draw hooks
 * gate on the cull, and the fade its surfaces blend at. Every drawer of a GeometryInstance3D reads
 * it, so the range, the visibility parent and `transparency` reach each one the same way.
 */

import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { fadeAlpha, forcesAlphaPass, geometryFade } from '../../godot/fadeAlpha';
import type { Aabb } from '../../godot/aabb';
import type { VisibilityRange } from '../../godot/visibilityRange';
import type { GeometryInstance3DProperties } from '../../nodes/3d/geometryinstance3d/types';
import { useNodePath } from '../contexts/NodePathContext';
import { rangedShadowCastingEffects, type ShadowCastingEffects } from '../shadowCasting';
import type { RangeGate } from '../surfaceDrawHooks';
import { registerVisibilityInstance, type VisibilityInstance } from './visibilityScene';
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

/** Scratch for one `worldBox` call: the cull measures one instance at a time. */
const nodeMatrix = new THREE.Matrix4();

/**
 * One instance's link to the scene cull. React writes its inputs after each commit, and the cull
 * writes `isVisible` before each render, which the draw hooks read through the `RangeGate`.
 */
class CulledInstance implements VisibilityInstance, RangeGate {
  isVisible = true;
  path: string | null = null;
  range!: VisibilityRange;
  parentPath: string | null = null;
  transparency = 0;
  customAabb: Aabb | null = null;
  placement!: InstancePlacement;
  hidden: THREE.Object3D | null = null;
  /** The range fade React last received. */
  private committedFade = 1;

  constructor(private readonly commitFade: (fade: number) => void) {}

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

/**
 * Registers the instance with the scene cull. The cull runs before every render, so even the
 * first draw is culled. Only the fade reaches React, one render after the cull computes it.
 */
export function useGeometryInstance(
  properties: GeometryInstance3DProperties,
  placement: InstancePlacement
): GeometryInstanceDraw {
  const scene = useThree((state) => state.scene);
  const path = useNodePath();
  const parentPath = useVisibilityParent();
  const [rangeFade, setRangeFade] = useState(1);
  const instance = useMemo(() => new CulledInstance(setRangeFade), []);

  useLayoutEffect(() => {
    instance.path = path;
    instance.parentPath = parentPath;
    instance.range = properties.visibilityRange;
    instance.transparency = properties.transparency;
    instance.customAabb = properties.customAabb;
    instance.placement = placement;
  });
  useLayoutEffect(() => registerVisibilityInstance(scene, instance), [scene, instance]);

  const shadow = useMemo(
    () => rangedShadowCastingEffects(properties.castShadow, instance),
    [properties.castShadow, instance]
  );
  const hideWhenCulled = useCallback(
    (object: THREE.Object3D | null) => {
      instance.hidden = object;
      if (object) object.visible = instance.isVisible;
    },
    [instance]
  );
  return { shadow, fade: geometryFade(properties.transparency, rangeFade), hideWhenCulled };
}

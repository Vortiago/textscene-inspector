/**
 * Godot's 2D canvas light pass (`drivers/gles3/shaders/canvas.glsl`). The albedo enters every light
 * term, so `color.rgb = albedo × S`: S starts at a seed, then each light on the item's list adds
 * `rgb * a`, subtracts it or mixes toward `rgb` by `a`, in list order. S depends only on the seed
 * and on the list, so it is accumulated once per (seed, list) offscreen, and each item multiplies
 * by its own. A MIX over an ADD does not commute, so a list's lights must share one buffer.
 */
/*
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { RGBA } from '../canvasItemModulate.js';
import { ShadowCasterStage } from './ShadowCasterStage.js';
import { CanvasLightSequenceProvider } from './useLightSequence.js';
import { planLightLists, type LightListPlan, type PassMeshRole } from './itemLightList.js';
import { CanvasLighting2DContext, type CanvasLighting2D, type CanvasLightList } from './lightPassContext.js';
import { useLightRegistry, usePlacementRegistry } from './lightRegistry.js';
import { useAccumulationTargets } from './lightAccumulationTargets.js';
import { createSeedMaterial, LightAccumulatorSeed } from './lightSeedQuad.js';
import { useLightAccumulationPass, type AccumulationList, type PassMesh } from './lightAccumulationPass.js';
import { capItemLights, type CappedItem } from './itemLightCap.js';

export { useCanvasLighting2D, type CanvasLighting2D, type CanvasLightSlot } from './lightPassContext.js';
export {
  useCapItemLights,
  usePassMeshRef,
  useRegisterCanvasLight2D,
  useRegisterLitItem,
} from './lightPassDeclarations.js';

export interface CanvasLighting2DProviderProps {
  /**
   * The canvas tint, where `S` starts for an ordinary item. It is the `canvasModulateColor(nodes)`
   * the dispatcher publishes to the items, so the seed and the tint they divide out agree.
   */
  canvasModulate: RGBA;
  children: ReactNode;
}

/** The ids of the plans that `needs` a buffer. */
function planIds(plans: readonly LightListPlan[], needs: (plan: LightListPlan) => boolean): string[] {
  return plans.filter(needs).map((plan) => plan.id);
}

export function CanvasLighting2DProvider({ canvasModulate, children }: CanvasLighting2DProviderProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  const [lights, registerLight] = useLightRegistry();
  const [placements, registerItem] = usePlacementRegistry();
  const plans = useMemo(() => planLightLists(lights, placements), [lights, placements]);

  // Half-float, since Godot clamps only after multiplying the light into the albedo: blending onto
  // the canvas would clamp first and flatten an `energy = 2` torch into a disc with no falloff.
  // Alpha holds the summed cookie coverage `light_only_alpha` (`color.a *= light_only_alpha`).
  const targets = useAccumulationTargets(planIds(plans, () => true));
  // Light Only seeds from white, and MIX interpolates toward the light, so the seed must be there
  // while the lights apply: a second pass over the same quads with another seed, run only for a
  // list a Light Only item reads. Godot's transparent default `shadow_color` adds nothing, so the
  // tint pass runs only for a list a tinting light shadows.
  const lightOnlyTargets = useAccumulationTargets(planIds(plans, (plan) => plan.hasLightOnly));
  const shadowTintTargets = useAccumulationTargets(planIds(plans, (plan) => plan.tintsShadow));

  // Read by the pass each frame, so a mesh needs no re-render of the provider to join it.
  const passMeshes = useRef(new Set<PassMesh>()).current;
  const registerPassMesh = useCallback(
    (mesh: THREE.Object3D, ordinal: number, role: PassMeshRole) => {
      const entry = { mesh, ordinal, role };
      passMeshes.add(entry);
      return () => {
        passMeshes.delete(entry);
      };
    },
    [passMeshes]
  );

  // Read by the cap each frame, like the pass meshes, with what each item was last handed.
  const cappedItems = useRef(new Map<CappedItem, readonly number[] | null>()).current;
  const registerCappedItem = useCallback(
    (item: CappedItem) => {
      cappedItems.set(item, null);
      return () => {
        cappedItems.delete(item);
      };
    },
    [cappedItems]
  );
  // Ahead of the pass at -1, so a frame's lists follow the rects of the frame before.
  useFrame(() => capItemLights({ lights, items: cappedItems, passMeshes }), -2);

  const accumulationLists = useMemo<AccumulationList[]>(
    () =>
      plans.map((plan) => ({
        entries: new Map(plan.entries.map((entry) => [entry.ordinal, entry])),
        target: targets.get(plan.id)!,
        lightOnlyTarget: lightOnlyTargets.get(plan.id) ?? null,
        shadowTintTarget: shadowTintTargets.get(plan.id) ?? null,
      })),
    [plans, targets, lightOnlyTargets, shadowTintTargets]
  );

  const seedMaterial = useMemo(createSeedMaterial, []);
  useEffect(() => () => seedMaterial.dispose(), [seedMaterial]);

  const resolution = useRef(new THREE.Vector2(1, 1)).current;

  useLightAccumulationPass({
    gl,
    scene,
    camera,
    lists: accumulationLists,
    passMeshes,
    seedMaterial,
    canvasModulate,
    resolution,
  });

  const value = useMemo<CanvasLighting2D>(() => {
    const lists = new Map<string, CanvasLightList>();
    plans.forEach((plan, index) => {
      const accumulation = accumulationLists[index]!;
      const list: CanvasLightList = {
        buffer: accumulation.target.texture,
        lightOnlyBuffer: accumulation.lightOnlyTarget?.texture ?? null,
        shadowTintBuffer: accumulation.shadowTintTarget?.texture ?? null,
      };
      for (const id of plan.placementIds) lists.set(id, list);
    });
    return { lists, resolution, registerLight, registerItem, registerCappedItem, registerPassMesh };
  }, [
    plans,
    accumulationLists,
    resolution,
    registerLight,
    registerItem,
    registerCappedItem,
    registerPassMesh,
  ]);

  return (
    <CanvasLighting2DContext.Provider value={value}>
      {plans.length > 0 && <LightAccumulatorSeed material={seedMaterial} />}
      {/* Occluders matter only to lights, so their registry lives with this pass. The light
          list's order is a canvas-wide fact too, derived once here, not by each light. */}
      <CanvasLightSequenceProvider>
        <ShadowCasterStage>{children}</ShadowCasterStage>
      </CanvasLightSequenceProvider>
    </CanvasLighting2DContext.Provider>
  );
}

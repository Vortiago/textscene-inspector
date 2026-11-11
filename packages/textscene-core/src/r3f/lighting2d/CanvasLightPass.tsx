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
import { useThree } from '@react-three/fiber';
import { CanvasModulateContext } from '../canvasModulate.js';
import { canvasNumbersOf, CanvasColorSpaceProvider, type CanvasColorSpace } from '../canvasColorSpace.js';
import { ShadowCasterStage } from './ShadowCasterStage.js';
import { CanvasLightSequenceProvider } from './useLightSequence.js';
import {
  planLightLists,
  APART_ATTACHMENTS,
  type ApartLightPlan,
  type ListAttachments,
  type CanvasLightDeclaration,
  type LightListPlan,
  type PassMeshRole,
} from './itemLightList.js';
import {
  CanvasLighting2DContext,
  type ApartPlacer,
  type CanvasLighting2D,
  type CanvasLightList,
  type LightPassStep,
} from './lightPassContext.js';
import type { LightPassHost } from './lightPassHost.js';
import { useLightRegistry, usePlacementRegistry } from './lightRegistry.js';
import { useAccumulationTargets, useLayeredAccumulationTargets } from './lightAccumulationTargets.js';
import { createSeedMaterial, LightAccumulatorSeed } from './lightSeedQuad.js';
import {
  renderLightLists,
  type AccumulationList,
  type PassMesh,
  type SummedAccumulation,
} from './lightAccumulationPass.js';
import { capItemLights, type CappedItem } from './itemLightCap.js';
import type { Rect2 } from '../../godot/math/rect2.js';
import type { Rgba } from '../../godot/math/math.js';
import { useDisposeOnRelease } from '../useDisposeOnRelease.js';

interface CanvasLightPassProps {
  /** The canvas the pass lights, and the caller that runs it. */
  host: LightPassHost;
  /**
   * The canvas tint, where `S` starts for an ordinary item. It is the `useCanvasModulateColor(nodes)`
   * of this canvas, which the pass publishes to the items, so the seed and the tint they divide out agree.
   */
  canvasModulate: Rgba;
  /** The space the canvas draws in. The pass provides it to everything inside, so the seed and the items agree. */
  space: CanvasColorSpace;
  children: ReactNode;
}

/** The attachment count of each plan with a summed buffer, by plan id. */
function summedAttachments(plans: readonly LightListPlan[]): ReadonlyMap<string, number> {
  return new Map(plans.flatMap((plan) => (plan.attachments ? [[plan.id, plan.attachments.count]] : [])));
}

/** The shape of the layered target of each plan that keeps its lights apart, by plan id. */
function apartShapes(
  plans: readonly LightListPlan[]
): ReadonlyMap<string, { layers: number; attachments: number }> {
  return new Map(
    plans.flatMap((plan) =>
      plan.lightsApart
        ? [
            [
              plan.id,
              {
                layers: plan.lightsApart.entries.length,
                attachments: plan.lightsApart.tintsShadow ? APART_ATTACHMENTS.shadowTint + 1 : 1,
              },
            ],
          ]
        : []
    )
  );
}

/** The texture of `buffer` in a list's summed target, or null while the list holds none. */
function summedTexture(
  summed: SummedAccumulation | null,
  buffer: keyof Omit<ListAttachments, 'count'>
): THREE.Texture | null {
  if (!summed) return null;
  const attachment = summed.attachments[buffer];
  return attachment < 0 ? null : summed.target.textures[attachment]!;
}

/** Each layer's mode, as `ApartLightBuffers.modes` describes it. */
function apartModes(
  lights: ReadonlyMap<number, CanvasLightDeclaration>,
  apart: ApartLightPlan
): THREE.Vector3[] {
  return apart.entries.map((entry, layer) => {
    const light = lights.get(entry.ordinal)!;
    return new THREE.Vector3(light.sequence === null ? 1 : 0, light.mixes ? 1 : 0, apart.tintLayers[layer]!);
  });
}

/**
 * One canvas's 2D light pass. The host runs it once a frame, so a SubViewport can run it inside its
 * own ordered pass, after it has framed its camera and before it draws its target.
 *
 * @canonical The 2D light pass of a canvas
 */
export function CanvasLightPass({ host, canvasModulate, space, children }: CanvasLightPassProps) {
  const gl = useThree((s) => s.gl);
  const { scene, camera, readBufferSize, readClip } = host;
  const seedModulate = useMemo(() => canvasNumbersOf(space, canvasModulate), [space, canvasModulate]);

  const [lights, registerLight] = useLightRegistry();
  const [placements, registerItem] = usePlacementRegistry();
  const plans = useMemo(() => planLightLists(lights, placements), [lights, placements]);

  // One target per list holds the buffers its items read, and one draw fills them all: a light's
  // shadow is evaluated once per fragment, as in Godot (`canvas.glsl:839`). The buffers are floats,
  // since blending onto the canvas would clamp before the albedo multiply and flatten `energy = 2`.
  // The `shadow_color` buffer exists only for a list a tinting light shadows (`light_2d.h:58`).
  const summedTargets = useAccumulationTargets(summedAttachments(plans));
  // A normal term scales each light before it blends, so a normal-mapped item reads each light alone.
  const apartTargets = useLayeredAccumulationTargets(apartShapes(plans));

  // Read by the pass each frame, like the pass meshes.
  const apartPlacers = useRef(new Map<number, ApartPlacer>()).current;
  const registerApartPlacer = useCallback(
    (ordinal: number, placer: ApartPlacer) => {
      apartPlacers.set(ordinal, placer);
      return () => {
        if (apartPlacers.get(ordinal) === placer) apartPlacers.delete(ordinal);
      };
    },
    [apartPlacers]
  );
  // One per ordinal, kept for the canvas's life, so an item binds it once: ordinals are dense and
  // reused, so the map stays as small as the most lights the canvas has held at once.
  const apartPlaces = useRef(new Map<number, THREE.Vector3>()).current;
  const apartPlace = useCallback(
    (ordinal: number) => {
      let place = apartPlaces.get(ordinal);
      if (!place) {
        place = new THREE.Vector3();
        apartPlaces.set(ordinal, place);
      }
      return place;
    },
    [apartPlaces]
  );
  const apartOrdinals = useMemo(
    () => new Set(plans.flatMap((plan) => plan.lightsApart?.entries.map((entry) => entry.ordinal) ?? [])),
    [plans]
  );

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
  // Written by the cap each frame, read by the pass that follows it.
  const windows = useRef(new Map<string, Rect2>()).current;

  // Read by the pass each frame, like the pass meshes.
  const passSteps = useRef(new Set<LightPassStep>()).current;
  const registerPassStep = useCallback(
    (step: LightPassStep) => {
      step(camera, readClip());
      passSteps.add(step);
      return () => {
        passSteps.delete(step);
      };
    },
    [camera, readClip, passSteps]
  );

  const accumulationLists = useMemo<AccumulationList[]>(
    () =>
      plans.map((plan) => ({
        entries: new Map(plan.entries.map((entry) => [entry.ordinal, entry])),
        placementIds: plan.placementIds,
        summed: plan.attachments && { target: summedTargets.get(plan.id)!, attachments: plan.attachments },
        apart: plan.lightsApart && { ...plan.lightsApart, target: apartTargets.get(plan.id)! },
      })),
    [plans, summedTargets, apartTargets]
  );

  const seedMaterial = useMemo(createSeedMaterial, []);
  useDisposeOnRelease(seedMaterial);

  const resolution = useRef(new THREE.Vector2(1, 1)).current;

  // Each frame, the steps and the cap measure first, so the lists follow the rects of the frame
  // before, and the accumulation draws after.
  const run = useCallback(() => {
    // A host that moves its camera this frame leaves `matrixWorldInverse` a frame old, and the
    // list windows project through it before the first draw refreshes it.
    camera.updateMatrixWorld();
    const clip = readClip();
    for (const step of passSteps) step(camera, clip);
    capItemLights({ lights, items: cappedItems, passMeshes, viewport: clip.rect, windows });
    for (const ordinal of apartOrdinals) apartPlacers.get(ordinal)?.(apartPlace(ordinal));
    renderLightLists({
      gl,
      scene,
      camera,
      lists: accumulationLists,
      passMeshes,
      seedMaterial,
      canvasModulate: seedModulate,
      resolution,
      readBufferSize,
      windows,
    });
  }, [
    gl,
    scene,
    camera,
    readBufferSize,
    readClip,
    passSteps,
    lights,
    cappedItems,
    passMeshes,
    windows,
    apartOrdinals,
    apartPlacers,
    apartPlace,
    accumulationLists,
    seedMaterial,
    seedModulate,
    resolution,
  ]);
  useEffect(() => {
    host.run.current = run;
    return () => {
      host.run.current = null;
    };
  }, [host, run]);

  const value = useMemo<CanvasLighting2D>(() => {
    const lists = new Map<string, CanvasLightList>();
    plans.forEach((plan, index) => {
      const accumulation = accumulationLists[index]!;
      const { apart, summed } = accumulation;
      const list: CanvasLightList = {
        buffer: summedTexture(summed, 'plain'),
        lightOnlyBuffer: summedTexture(summed, 'lightOnly'),
        shadowTintBuffer: summedTexture(summed, 'shadowTint'),
        apart: apart && {
          buffer: apart.target.textures[APART_ATTACHMENTS.light]!,
          shadowTintBuffer: apart.target.textures[APART_ATTACHMENTS.shadowTint] ?? null,
          places: apart.entries.map((entry) => apartPlace(entry.ordinal)),
          modes: apartModes(lights, apart),
        },
      };
      for (const id of plan.placementIds) lists.set(id, list);
    });
    return {
      lists,
      resolution,
      registerLight,
      registerItem,
      registerCappedItem,
      registerApartPlacer,
      registerPassMesh,
      registerPassStep,
    };
  }, [
    plans,
    lights,
    accumulationLists,
    apartPlace,
    resolution,
    registerLight,
    registerItem,
    registerCappedItem,
    registerApartPlacer,
    registerPassMesh,
    registerPassStep,
  ]);

  return (
    <CanvasColorSpaceProvider value={space}>
      <CanvasLighting2DContext.Provider value={value}>
        {plans.length > 0 && <LightAccumulatorSeed material={seedMaterial} />}
        {/* Occluders matter only to lights, so their registry lives with this pass. The light
            list's order is a canvas-wide fact too, derived once here, not by each light. */}
        <CanvasLightSequenceProvider viewportPath={host.canvasPath}>
          <CanvasModulateContext.Provider value={canvasModulate}>
            <ShadowCasterStage>{children}</ShadowCasterStage>
          </CanvasModulateContext.Provider>
        </CanvasLightSequenceProvider>
      </CanvasLighting2DContext.Provider>
    </CanvasColorSpaceProvider>
  );
}

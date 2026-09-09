/**
 * Godot's 2D canvas light pass, ported.
 *
 * `drivers/gles3/shaders/canvas.glsl` captures the item's albedo BEFORE the
 * canvas tint, then folds that albedo into every light term:
 *
 *   vec4 base_color = color;                     // the albedo
 *   color *= canvas_modulation;                  // unless Unshaded / Light Only
 *   light_color.rgb *= light_base_color.rgb * light_base_color.a;  // .a is energy
 *   light_color.rgb *= base_color.rgb;
 *   light_blend_compute(...)                     // ADD / SUB / MIX against color
 *
 * The albedo appears in every term, so the whole pass collapses to
 *
 *   color.rgb = albedo x S,   S = seed, then per light
 *                 ADD: S += light.rgb * light.a
 *                 SUB: S -= light.rgb * light.a
 *                 MIX: S  = mix(S, light.rgb, light.a)
 *
 * and `S` does not depend on the item — only on the SEED, which is the canvas
 * modulate for an ordinary item and an unmodulated white for a `Light Only` one,
 * and on WHICH LIGHTS REACH THE ITEM. That is the fact this module is built on:
 * `S` is accumulated ONCE per (seed, light set) into an offscreen buffer, and
 * every canvas item multiplies its own albedo by what its buffer holds beneath it.
 *
 * MIX is why the seed cannot simply be added afterwards: it INTERPOLATES the
 * accumulator toward the light, so the seed has to be present while the lights
 * are applied. The two seeds therefore mean two passes — but over the same
 * quads, the same blend state and the same layer, with only the seed quad's
 * uniform differing. The Light Only pass is allocated and run only when the
 * canvas actually holds a Light Only item.
 *
 * WHICH LIGHTS REACH AN ITEM is Godot's cull test — the item's `light_mask`
 * against the light's `range_item_cull_mask`, the item's accumulated `z_final`
 * against the light's z window, and the item's CANVAS layer against the light's
 * layer window (see `lightCullKey`). Those five light-side values are the whole
 * of it, so two lights that agree on all five are INDISTINGUISHABLE to every
 * item on the canvas: the lights partition into classes by that TUPLE, and one
 * accumulation per class covers every item exactly. An item then reads the
 * classes it is not culled from, usually exactly one, which is the accumulation
 * it would have got from a single-class canvas.
 *
 * The partition cannot be finer-grained than a class, because the buffer is a
 * screen-space SUM: once two lights land in it, no fragment can subtract one of
 * them back out. It is also no coarser for free — but every light that leaves
 * the four range properties alone carries the same tail
 * `(mask, -1024, 1024, 0, 0)`, so a scene that authors no window has exactly the
 * classes it had when the mask alone was the key.
 *
 * The buffers are half-float, which is the load-bearing part. Godot clamps only
 * after multiplying the light into the albedo; a fragment blended straight onto
 * the canvas is clamped to [0, 1] BEFORE that multiply, so a torch at
 * `energy = 2` flattens into a saturated disc with no falloff. Accumulating
 * unclamped, then multiplying, reproduces Godot's ordering exactly.
 *
 * The ALPHA channel carries a second quantity: the summed cookie coverage
 * `light_only_alpha`, which is the mask a Light Only item is drawn through
 * (`color.a *= light_only_alpha`).
 *
 * `S` is seeded by a full-screen quad rather than by a clear colour, so the seed
 * passes through no colour-management path on its way into a `NoColorSpace`
 * target, and the renderer's global clear state is never touched.
 *
 * Lights are drawn on camera layers, so collecting them needs no second scene
 * graph: each class's pre-pass points the camera at the seed layer plus that
 * class's layer and renders the tree that is already mounted.
 *
 * SHADOWS sit one level down, per light rather than per class: a
 * `LightOccluder2D` shadow is a property of ONE light's cookie, so each light
 * stamps its own shadow volumes into the STENCIL buffer immediately before its
 * quad and the quad rejects what it stamped (`ShadowVolumeMask`). Three things
 * here serve that and nothing else: the accumulators carry a stencil buffer,
 * each class pass clears it once, and `register` hands every light an ORDINAL
 * so the stamps of the lights sharing a pass cannot be confused for each other.
 *
 * The pieces live in sibling modules: the camera-layer allocation in
 * `lightPassLayers.ts`, what the pass publishes in `lightPassContext.ts`, the
 * declaring side in `lightPassDeclarations.ts`, the mounted-tuple bookkeeping in
 * `lightClassRegistry.ts`, the buffers in `lightAccumulationTargets.ts`, the
 * seed quad in `lightSeedQuad.tsx` and the per-frame render in
 * `lightAccumulationPass.ts`.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { warn } from '../../logger';
import type { RGBA } from '../canvasItemModulate.js';
import { ShadowCasterStage } from './ShadowCasterStage.js';
import { CanvasLightSequenceProvider } from './useLightSequence.js';
import { lightCullKeyId } from './lightCullKey.js';
import {
  CanvasLighting2DContext,
  type CanvasLighting2D,
} from './lightPassContext.js';
import {
  LIGHT_LAYER,
  MAX_LIGHT_CLASSES,
  SHADOW_TINT_LAYER,
} from './lightPassLayers.js';
import {
  useDeclarationCount,
  useKeyedDeclarationCount,
  useLightClassRegistry,
} from './lightClassRegistry.js';
import {
  useAccumulationTargets,
  useSelectedAccumulationTargets,
} from './lightAccumulationTargets.js';
import { createSeedMaterial, LightAccumulatorSeed } from './lightSeedQuad.js';
import { useLightAccumulationPass } from './lightAccumulationPass.js';

export {
  LIGHT_LAYER,
  LIGHT_SEED_LAYER,
  LIGHT_UNCLASSED_LAYER,
  MAX_LIGHT_CLASSES,
  SHADOW_TINT_LAYER,
} from './lightPassLayers.js';
export {
  useCanvasLighting2D,
  type CanvasLightClass,
  type CanvasLighting2D,
  type CanvasLightSlot,
} from './lightPassContext.js';
export {
  useLightClassLayer,
  useRegisterCanvasLight2D,
  useRegisterLightOnlyItem,
  useRegisterShadowTint,
  useShadowTintLayer,
} from './lightPassDeclarations.js';

export interface CanvasLighting2DProviderProps {
  /**
   * The canvas tint in force — the value `S` starts from for an ordinary item.
   * It comes from the same `canvasModulateColor(nodes)` the dispatcher publishes
   * to the items, so the seed and the tint the items divide back out cannot
   * disagree.
   */
  canvasModulate: RGBA;
  children: ReactNode;
}

export function CanvasLighting2DProvider({
  canvasModulate,
  children,
}: CanvasLighting2DProviderProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  const [cullKeys, register] = useLightClassRegistry();
  const [lightOnlyCount, registerLightOnly] = useDeclarationCount();
  const [shadowTintKeys, registerShadowTint] = useKeyedDeclarationCount();

  const classCount = Math.min(cullKeys.length, MAX_LIGHT_CLASSES);
  const lit = classCount > 0;
  const needsLightOnly = lit && lightOnlyCount > 0;
  const shadowTintClasses = cullKeys
    .slice(0, classCount)
    .map((key) => shadowTintKeys.has(lightCullKeyId(key)));

  const targets = useAccumulationTargets(classCount);
  const lightOnlyTargets = useAccumulationTargets(needsLightOnly ? classCount : 0);
  const shadowTintTargets = useSelectedAccumulationTargets(shadowTintClasses);

  const overflow = cullKeys.length - MAX_LIGHT_CLASSES;
  useEffect(() => {
    if (overflow <= 0) return;
    warn(
      `[CanvasLighting2D] ${overflow + MAX_LIGHT_CLASSES} distinct light cull tuples ` +
        `(range_item_cull_mask + range_z + range_layer) on one canvas; only ` +
        `${MAX_LIGHT_CLASSES} can be accumulated, so lights culling ` +
        `${cullKeys.slice(MAX_LIGHT_CLASSES).map(lightCullKeyId).join(', ')} are not drawn`
    );
  }, [overflow, cullKeys]);

  const seedMaterial = useMemo(createSeedMaterial, []);
  useEffect(() => () => seedMaterial.dispose(), [seedMaterial]);

  const resolution = useRef(new THREE.Vector2(1, 1)).current;

  useLightAccumulationPass({
    gl,
    scene,
    camera,
    targets,
    lightOnlyTargets,
    shadowTintTargets,
    seedMaterial,
    canvasModulate,
    resolution,
  });

  const value = useMemo<CanvasLighting2D>(
    () => ({
      classes: targets.map((target, index) => ({
        key: cullKeys[index]!,
        buffer: target.texture,
        lightOnlyBuffer: lightOnlyTargets[index]?.texture ?? null,
        shadowTintBuffer: shadowTintTargets[index]?.texture ?? null,
        layer: LIGHT_LAYER + index,
        shadowTintLayer: shadowTintTargets[index] ? SHADOW_TINT_LAYER + index : undefined,
      })),
      resolution,
      register,
      registerLightOnly,
      registerShadowTint,
    }),
    [
      targets,
      lightOnlyTargets,
      shadowTintTargets,
      cullKeys,
      resolution,
      register,
      registerLightOnly,
      registerShadowTint,
    ]
  );

  return (
    <CanvasLighting2DContext.Provider value={value}>
      {lit && <LightAccumulatorSeed material={seedMaterial} />}
      {/* Occluders only matter to lights, so the registry that finds them lives
          with the pass that consumes them rather than in the stage above. The
          light list's ORDER is the same kind of canvas-wide fact, derived once
          here rather than by every light for itself. */}
      <CanvasLightSequenceProvider>
        <ShadowCasterStage>{children}</ShadowCasterStage>
      </CanvasLightSequenceProvider>
    </CanvasLighting2DContext.Provider>
  );
}

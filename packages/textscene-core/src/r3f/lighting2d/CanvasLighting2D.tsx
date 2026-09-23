/**
 * Godot's 2D canvas light pass (`drivers/gles3/shaders/canvas.glsl`). The albedo enters every light
 * term, so `color.rgb = albedo × S`: S starts at a seed, then each light adds `rgb * a`, subtracts
 * it or mixes toward `rgb` by `a`. S depends only on the seed and on which lights reach the item,
 * so it is accumulated once per (seed, light class) offscreen, and each item multiplies by it.
 */
/*
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
   * The canvas tint, where `S` starts for an ordinary item. It is the `canvasModulateColor(nodes)`
   * the dispatcher publishes to the items, so the seed and the tint they divide out agree.
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

  // Two lights that agree on the five-value cull tuple (`lightCullKey`) are the same to every
  // item, so one accumulation per tuple class covers every item. An item reads the classes it is
  // not culled from, usually one. `register` gives each light an ordinal, so the stencil stamps of
  // lights sharing a pass stay apart.
  const [cullKeys, register] = useLightClassRegistry();
  const [lightOnlyCount, registerLightOnly] = useDeclarationCount();
  const [shadowTintKeys, registerShadowTint] = useKeyedDeclarationCount();

  const classCount = Math.min(cullKeys.length, MAX_LIGHT_CLASSES);
  const lit = classCount > 0;
  const needsLightOnly = lit && lightOnlyCount > 0;
  const shadowTintClasses = cullKeys
    .slice(0, classCount)
    .map((key) => shadowTintKeys.has(lightCullKeyId(key)));

  // Half-float, since Godot clamps only after multiplying the light into the albedo: blending onto
  // the canvas would clamp first and flatten an `energy = 2` torch into a disc with no falloff.
  // Alpha holds the summed cookie coverage `light_only_alpha` (`color.a *= light_only_alpha`).
  const targets = useAccumulationTargets(classCount);
  // Light Only seeds from white, and MIX interpolates toward the light, so the seed must be there
  // while the lights apply: a second pass over the same quads with another seed uniform, run only
  // when the canvas holds a Light Only item.
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
      {/* Occluders matter only to lights, so their registry lives with this pass. The light
          list's order is a canvas-wide fact too, derived once here, not by each light. */}
      <CanvasLightSequenceProvider>
        <ShadowCasterStage>{children}</ShadowCasterStage>
      </CanvasLightSequenceProvider>
    </CanvasLighting2DContext.Provider>
  );
}

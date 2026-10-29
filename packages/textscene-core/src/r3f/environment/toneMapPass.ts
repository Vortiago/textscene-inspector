/**
 * Godot's tonemap pass of one viewport. The 3D world draws into a linear half-float buffer, which
 * resolves its samples (`render_forward_clustered.cpp:2402`), then the tonemap effect reads it and
 * writes the viewport's target (`:2514`). The root canvas and every SubViewport draw through it.
 */

import { useCallback, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { EffectPass } from 'postprocessing';
import { useThree } from '@react-three/fiber';
import { glowParamsFor } from '../../resources/environment/godotGlow';
import { NO_ENVIRONMENT_TONE_MAPPING } from '../../godot/rendering/environment/toneMapping';
import { useMultisampledTarget } from '../multisampledTarget';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import { drawOffscreen } from '../offscreen';
import { createPassTarget } from './passTarget';
import { useGodotToneMapEffect } from './useGodotToneMapEffect';
import type { GodotToneMapEffect } from './GodotToneMapEffect';
import { useWorldToneMap } from './worldToneMap';

/**
 * The world buffer's texel type. Godot draws every 3D frame into RGBA16F
 * (`renderer_scene_render_rd.cpp:1128`), and its rounding shows (ADR-0061).
 */
const SCENE_BUFFER_TYPE = THREE.HalfFloatType;

export interface ToneMapPass {
  /** The buffer the world draws into, at the viewport's `msaa_3d` samples. */
  worldBuffer: THREE.WebGLRenderTarget;
  /** Tonemaps what `worldBuffer` holds into the target, and leaves the renderer as it found it. */
  toneMap: () => void;
}

export interface ToneMapPassOptions {
  /** The target the pass writes, null for the canvas. */
  target: THREE.WebGLRenderTarget | null;
  /** Godot's `msaa_3d` mode. */
  msaaMode: number;
  width: number;
  height: number;
  /** Whether the target keeps the buffer's alpha: the viewport's transparent background. */
  transparentBackground: boolean;
  /** The viewport's `use_debanding`. */
  usesDebanding: boolean;
  /** The name the buffer's texture carries. */
  name: string;
}

/** The tonemap effect reads no time, since a frame draws at its settled luminance. */
const NO_ELAPSED_TIME = 0;

/**
 * The world buffer and the tonemap pass of one viewport, tonemapped with the Environment and the
 * auto exposure of the world it mounts in. Glow runs on the Environment's flag alone, as Godot's
 * glow chain runs (`renderer_scene_render_rd.cpp:575`, `:686`).
 *
 * @canonical Godot's tonemap pass of a viewport
 */
export function useToneMapPass(options: ToneMapPassOptions): ToneMapPass {
  const { target, msaaMode, width, height, transparentBackground, usesDebanding, name } = options;
  const world = useWorldToneMap();
  const { settings } = world;
  const glow = useMemo(() => settings && glowParamsFor(settings), [settings]);
  const effect = useGodotToneMapEffect({
    glow,
    adjustments: settings?.adjustments ?? null,
    toneMapping: settings?.toneMapping ?? NO_ENVIRONMENT_TONE_MAPPING,
    autoExposure: world.autoExposure,
    transparentBackground,
    usesDebanding,
    resources: world.resources,
  });
  const createWorldBuffer = useCallback(() => worldBufferOf(width, height, name), [width, height, name]);
  const worldBuffer = useMultisampledTarget(msaaMode, createWorldBuffer);
  const gl = useThree((state) => state.gl);
  const pass = useEffectPass(effect, width, height);
  return useMemo(() => {
    const draw = () => pass.render(gl, worldBuffer, target, NO_ELAPSED_TIME);
    return { worldBuffer, toneMap: () => drawOffscreen(gl, draw) };
  }, [gl, pass, worldBuffer, target]);
}

function worldBufferOf(width: number, height: number, name: string): THREE.WebGLRenderTarget {
  const buffer = createPassTarget(`${name}::world`, { type: SCENE_BUFFER_TYPE });
  buffer.depthBuffer = true;
  buffer.setSize(width, height);
  return buffer;
}

/** `effect` in a pass of its own, sized to the target. */
function useEffectPass(effect: GodotToneMapEffect, width: number, height: number): EffectPass {
  const gl = useThree((state) => state.gl);
  const pass = useMemo(() => {
    const built = new BorrowedEffectPass(effect);
    built.initialize(gl, true, SCENE_BUFFER_TYPE);
    return built;
  }, [gl, effect]);
  useLayoutEffect(() => pass.setSize(width, height), [pass, width, height]);
  useDisposeOnRelease(pass);
  return pass;
}

/** An effect pass that leaves its effect to the effect's owner, `useGodotToneMapEffect`. */
class BorrowedEffectPass extends EffectPass {
  constructor(effect: GodotToneMapEffect) {
    super(undefined, effect);
  }

  override dispose(): void {
    this.setEffects([]);
    super.dispose();
  }
}

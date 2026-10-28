/**
 * Godot's tonemap pass for an offscreen target. The 3D world draws into a linear HDR buffer, which
 * resolves its samples (`render_forward_clustered.cpp:2402`), then the tonemap effect reads it and
 * writes the target (`:2514`). The root canvas's compositor does the same on the drawing buffer.
 */

import { useCallback, useLayoutEffect, useMemo, type MutableRefObject } from 'react';
import * as THREE from 'three';
import { EffectPass } from 'postprocessing';
import { useThree } from '@react-three/fiber';
import { glowParamsFor } from '../../resources/environment/godotGlow';
import { NO_ENVIRONMENT_TONE_MAPPING } from '../../godot/rendering/environment/toneMapping';
import { useMultisampledTarget } from '../multisampledTarget';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import { drawOffscreen } from '../offscreen';
import { createPassTarget } from './passTarget';
import { SCENE_BUFFER_TYPE } from './useCompositorPass';
import { useGodotToneMapEffect } from './useGodotToneMapEffect';
import type { GodotToneMapEffect } from './GodotToneMapEffect';
import { useWorldToneMap } from './worldToneMap';

export interface OffscreenToneMap {
  /** The buffer the world draws into, at the viewport's `msaa_3d` samples. */
  worldBuffer: THREE.WebGLRenderTarget;
  /** Tonemaps what `worldBuffer` holds into the target, and leaves the renderer as it found it. */
  toneMap: () => void;
}

interface OffscreenToneMapOptions {
  /** The target the pass writes. */
  target: THREE.WebGLRenderTarget;
  /** Godot's `msaa_3d` mode. */
  msaaMode: number;
  width: number;
  height: number;
  /** Whether the target keeps the buffer's alpha: a SubViewport's `transparent_bg`. */
  transparentBackground: boolean;
  /** A SubViewport's `use_debanding`. */
  usesDebanding: boolean;
  /** The name the buffer's texture carries. */
  name: string;
}

/** The tonemap effect reads no time, since a frame draws at its settled luminance. */
const NO_ELAPSED_TIME = 0;

/**
 * Mounts the world buffer and the tonemap pass of one offscreen viewport in the world it sits in,
 * and hands them to `stage` while it stays mounted. A pass in a portal of its own world mounts it
 * inside the portal, so it reads that world's Environment.
 *
 * @canonical Godot's tonemap pass into a render target
 */
export function OffscreenToneMapStage({
  stage,
  ...options
}: OffscreenToneMapOptions & { stage: MutableRefObject<OffscreenToneMap | null> }): null {
  const toneMap = useOffscreenToneMap(options);
  useLayoutEffect(() => {
    stage.current = toneMap;
    return () => {
      if (stage.current === toneMap) stage.current = null;
    };
  }, [stage, toneMap]);
  return null;
}

function useOffscreenToneMap(options: OffscreenToneMapOptions): OffscreenToneMap {
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

/** An effect pass that leaves its effect to the effect's owner, as the compositor's `primitive` does. */
class BorrowedEffectPass extends EffectPass {
  constructor(effect: GodotToneMapEffect) {
    super(undefined, effect);
  }

  override dispose(): void {
    this.setEffects([]);
    super.dispose();
  }
}

/**
 * Godot's tonemap pass for an offscreen target. The 3D world draws into a linear HDR buffer, which
 * resolves its samples (`render_forward_clustered.cpp:2402`), then the tonemap effect reads it and
 * writes the target (`:2514`). The root canvas's compositor does the same on the drawing buffer.
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
import { SCENE_BUFFER_TYPE } from './useCompositorPass';
import { useGodotToneMapEffect } from './useGodotToneMapEffect';
import type { GodotToneMapEffect } from './GodotToneMapEffect';
import type { WorldToneMap } from './worldToneMap';

export interface OffscreenToneMap {
  /** The buffer the world draws into, at the viewport's `msaa_3d` samples. */
  worldBuffer: THREE.WebGLRenderTarget;
  /** Tonemaps what `worldBuffer` holds into `target`, and leaves the renderer as it found it. */
  toneMap: (gl: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget) => void;
}

interface OffscreenToneMapOptions {
  /** The world's Environment and auto exposure. */
  world: WorldToneMap;
  /** Godot's `msaa_3d` mode. */
  msaaMode: number;
  width: number;
  height: number;
  /** Whether the target keeps the buffer's alpha: a SubViewport's `transparent_bg`. */
  transparentBackground: boolean;
  /** The name the buffer's texture carries. */
  name: string;
}

/**
 * The world buffer and the tonemap pass of one offscreen viewport. The hook owns both.
 *
 * @canonical Godot's tonemap pass into a render target
 */
export function useOffscreenToneMap(options: OffscreenToneMapOptions): OffscreenToneMap {
  const { world, msaaMode, width, height, transparentBackground, name } = options;
  const { settings } = world;
  const glow = useMemo(() => settings && glowParamsFor(settings), [settings]);
  const effect = useGodotToneMapEffect({
    glow,
    adjustments: settings?.adjustments ?? null,
    toneMapping: settings?.toneMapping ?? NO_ENVIRONMENT_TONE_MAPPING,
    autoExposure: world.autoExposure,
    transparentBackground,
    resources: world.resources,
  });
  const createWorldBuffer = useCallback(() => worldBufferOf(width, height, name), [width, height, name]);
  const worldBuffer = useMultisampledTarget(msaaMode, createWorldBuffer);
  const pass = useEffectPass(effect, width, height);
  const toneMap = useCallback(
    (gl: THREE.WebGLRenderer, target: THREE.WebGLRenderTarget) =>
      drawOffscreen(gl, () => pass.render(gl, worldBuffer, target, 0)),
    [pass, worldBuffer]
  );
  return { worldBuffer, toneMap };
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

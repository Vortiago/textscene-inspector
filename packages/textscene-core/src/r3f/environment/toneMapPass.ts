/**
 * Godot's tonemap pass of one viewport. The 3D world draws into a linear half-float buffer, which
 * resolves its samples (`render_forward_clustered.cpp:2402`), then the tonemap effect reads it and
 * writes the viewport's target (`:2514`). The root canvas and every SubViewport draw through it.
 */

import { useCallback, useLayoutEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { glowParamsFor } from '../../resources/environment/godotGlow';
import { NO_ENVIRONMENT_TONE_MAPPING } from '../../godot/rendering/environment/toneMapping';
import { useMultisampledTarget } from '../offscreen/multisampledTarget';
import { drawOffscreen } from '../offscreen/draw';
import { createPassTarget } from './passTarget';
import { useGodotToneMapEffect } from './useGodotToneMapEffect';
import { usePassToneMap } from './passToneMap';

/**
 * The world buffer's texel type. Godot draws every 3D frame into RGBA16F
 * (`renderer_scene_render_rd.cpp:1128`), and its rounding shows (ADR-0061).
 */
const SCENE_BUFFER_TYPE = THREE.HalfFloatType;

export interface ToneMapPass {
  /** The buffer the world draws into, at the viewport's `msaa_3d` samples. */
  worldBuffer: THREE.WebGLRenderTarget;
  /**
   * Renders `scene` into `worldBuffer`, cleared by the render itself, and leaves the renderer as it
   * found it. Three applies the clear colour in the bound target's colour space only inside a
   * render's own clear (r187 `WebGLBackground.js:53`), so a clear before it writes the canvas's sRGB value.
   */
  drawWorld: (scene: THREE.Scene, camera: THREE.Camera) => void;
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

/**
 * The world buffer and the tonemap pass of one viewport, tonemapped with the Environment and the
 * auto exposure its pass draws with (`usePassToneMap`). Glow runs on the Environment's flag alone, as Godot's
 * glow chain runs (`renderer_scene_render_rd.cpp:575`, `:686`).
 *
 * @canonical Godot's tonemap pass of a viewport
 */
export function useToneMapPass(options: ToneMapPassOptions): ToneMapPass {
  const { target, msaaMode, width, height, transparentBackground, usesDebanding, name } = options;
  const passToneMap = usePassToneMap();
  const { settings } = passToneMap;
  const glow = useMemo(() => settings && glowParamsFor(settings), [settings]);
  const effect = useGodotToneMapEffect({
    glow,
    adjustments: settings?.adjustments ?? null,
    toneMapping: settings?.toneMapping ?? NO_ENVIRONMENT_TONE_MAPPING,
    autoExposure: passToneMap.autoExposure,
    transparentBackground,
    usesDebanding,
    glowMap: passToneMap.glowMap,
  });
  const worldBuffer = useWorldBuffer(msaaMode, width, height, name);
  const gl = useThree((state) => state.gl);
  useLayoutEffect(() => effect.setSize(width, height), [effect, width, height]);
  return useMemo(() => {
    const toneMapDraw = () => effect.render(gl, worldBuffer, target);
    return {
      worldBuffer,
      drawWorld: (scene, camera) =>
        drawOffscreen(gl, () => {
          gl.autoClear = true;
          gl.setRenderTarget(worldBuffer);
          gl.render(scene, camera);
        }),
      toneMap: () => drawOffscreen(gl, toneMapDraw),
    };
  }, [gl, effect, worldBuffer, target]);
}

/** The world buffer, resized in place as the viewport resizes. */
function useWorldBuffer(
  msaaMode: number,
  width: number,
  height: number,
  name: string
): THREE.WebGLRenderTarget {
  const createWorldBuffer = useCallback(() => worldBufferOf(name), [name]);
  const worldBuffer = useMultisampledTarget(msaaMode, createWorldBuffer);
  useLayoutEffect(() => worldBuffer.setSize(width, height), [worldBuffer, width, height]);
  return worldBuffer;
}

function worldBufferOf(name: string): THREE.WebGLRenderTarget {
  const buffer = createPassTarget(`${name}::world`, { type: SCENE_BUFFER_TYPE });
  buffer.depthBuffer = true;
  return buffer;
}

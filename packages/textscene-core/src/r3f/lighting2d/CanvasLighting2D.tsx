/**
 * Godot's 2D canvas light pass, ported.
 *
 * `drivers/gles3/shaders/canvas.glsl` computes, per light, per fragment:
 *
 *   light_color.rgb *= light_base_color.rgb * light_base_color.a;  // .a is energy
 *   light_color.rgb *= base_color.rgb;                             // the albedo
 *   color.rgb += light_color.rgb * light_color.a;                  // BLEND_MODE_ADD
 *
 * The albedo appears inside every term, so the whole pass collapses to
 *
 *   color = albedo x (canvas_modulation + SUM of light_i)
 *
 * and the sum does not depend on the item. That is the fact this module is
 * built on: the lights are accumulated ONCE into an offscreen buffer, and every
 * canvas item multiplies its own albedo by what that buffer holds beneath it.
 *
 * The buffer is a half-float target, which is the load-bearing part. Godot
 * clamps only after multiplying the light into the albedo; a fragment blended
 * straight onto the canvas is clamped to [0, 1] BEFORE that multiply, so a torch
 * at `energy = 2` flattens into a saturated disc with no falloff. Accumulating
 * unclamped, then multiplying, reproduces Godot's ordering exactly.
 *
 * Lights are drawn on their own camera layer, so collecting them needs no second
 * scene graph: the pre-pass just points the camera at that layer and renders the
 * tree that is already mounted.
 *
 * Portions ported from Godot Engine (MIT).
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';

/**
 * The camera layer light quads live on. Nothing else may use it: the pre-pass
 * renders exactly this layer, and the main pass renders everything except it.
 */
export const LIGHT_LAYER = 1;

export interface CanvasLighting2D {
  /** Accumulated `SUM of light_i` in Godot's sRGB space, unclamped. */
  readonly buffer: THREE.Texture | null;
  /** Viewport size in device pixels, for the screen-space lookup. */
  readonly resolution: THREE.Vector2;
  /** True once at least one light has registered — otherwise items skip the lookup. */
  readonly active: boolean;
  register(): () => void;
}

const INERT: CanvasLighting2D = {
  buffer: null,
  resolution: new THREE.Vector2(1, 1),
  active: false,
  register: () => () => {},
};

const CanvasLighting2DContext = createContext<CanvasLighting2D>(INERT);

/** The lighting in force, or an inert value outside a 2D stage (3D, unit tests). */
export function useCanvasLighting2D(): CanvasLighting2D {
  return useContext(CanvasLighting2DContext);
}

/**
 * Declares that a light is present. The count is what gates the pre-pass — with
 * no lights the buffer is never allocated and every canvas item takes the
 * unlit path, which is the 3D workspace and most fixtures.
 */
export function useRegisterCanvasLight2D(enabled: boolean): void {
  const { register } = useCanvasLighting2D();
  const active = enabled;
  useMemo(() => undefined, []);
  // Registration is an effect, not a render-time mutation: it has to unwind on
  // unmount and must not run twice under StrictMode's double render.
  useIsomorphicRegistration(active, register);
}

function useIsomorphicRegistration(active: boolean, register: () => () => void): void {
  const cleanup = useRef<(() => void) | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    cleanup.current?.();
    cleanup.current = active ? register() : null;
  }, [active, register]);
}

export function CanvasLighting2DProvider({ children }: { children: ReactNode }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  const [lightCount, setLightCount] = useState(0);
  const register = useCallback(() => {
    setLightCount((n) => n + 1);
    return () => setLightCount((n) => n - 1);
  }, []);

  const width = Math.max(1, Math.floor(size.width));
  const height = Math.max(1, Math.floor(size.height));

  // Half-float so the accumulation stays unclamped, and NoColorSpace so three
  // writes the shader's raw sRGB-space value instead of re-encoding it.
  const target = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      depthBuffer: false,
      stencilBuffer: false,
    });
    rt.texture.colorSpace = THREE.NoColorSpace;
    rt.texture.minFilter = THREE.LinearFilter;
    rt.texture.magFilter = THREE.LinearFilter;
    return rt;
  }, [width, height]);
  useMemo(() => () => target.dispose(), [target]);

  const resolution = useMemo(() => new THREE.Vector2(width, height), [width, height]);

  // Before the main pass: point the camera at the light layer alone and let the
  // already-mounted tree draw itself into the accumulation buffer.
  useFrame(() => {
    if (lightCount === 0) return;
    const previousTarget = gl.getRenderTarget();
    const previousMask = camera.layers.mask;
    camera.layers.set(LIGHT_LAYER);
    gl.setRenderTarget(target);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, false, false);
    gl.render(scene, camera);
    gl.setRenderTarget(previousTarget);
    camera.layers.mask = previousMask;
  }, -1);

  const value = useMemo<CanvasLighting2D>(
    () => ({
      buffer: lightCount > 0 ? target.texture : null,
      resolution,
      active: lightCount > 0,
      register,
    }),
    [lightCount, target, resolution, register]
  );

  return (
    <CanvasLighting2DContext.Provider value={value}>{children}</CanvasLighting2DContext.Provider>
  );
}

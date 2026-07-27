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
 * modulate for an ordinary item and an unmodulated white for a `Light Only` one.
 * That is the fact this module is built on: `S` is accumulated ONCE per distinct
 * seed into an offscreen buffer, and every canvas item multiplies its own albedo
 * by what that buffer holds beneath it.
 *
 * MIX is why the seed cannot simply be added afterwards: it INTERPOLATES the
 * accumulator toward the light, so the seed has to be present while the lights
 * are applied. The two seeds therefore mean two passes — but over the same
 * quads, the same blend state and the same layer, with only the seed quad's
 * uniform differing. The Light Only pass is allocated and run only when the
 * canvas actually holds a Light Only item.
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
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import type { RGBA } from '../canvasItemModulate.js';

/**
 * The camera layer light quads live on. Nothing else may use it: the pre-pass
 * renders exactly this layer, and the main pass renders everything except it.
 */
export const LIGHT_LAYER = 1;

/** Draw order within the light layer — the seed must land under every light. */
const SEED_RENDER_ORDER = -1;

export interface CanvasLighting2D {
  /**
   * `S` seeded from the canvas modulate in rgb, and the summed cookie coverage
   * in alpha — in Godot's sRGB space and unclamped. Null when the canvas holds
   * no light, in which case items fall back to the canvas modulate they know.
   */
  readonly buffer: THREE.Texture | null;
  /** The same accumulation seeded from an unmodulated white, for Light Only items. */
  readonly lightOnlyBuffer: THREE.Texture | null;
  /**
   * The accumulators' size in DEVICE pixels, which is what `gl_FragCoord` is
   * measured in. MUTATED in place each frame, so an item that binds it as a
   * uniform value stays in step without re-rendering.
   */
  readonly resolution: THREE.Vector2;
  /** Declares a light on the canvas; the returned callback withdraws it. */
  register(): () => void;
  /** Declares an item that needs the unmodulated accumulation. */
  registerLightOnly(): () => void;
}

const INERT: CanvasLighting2D = {
  buffer: null,
  lightOnlyBuffer: null,
  resolution: new THREE.Vector2(1, 1),
  register: () => () => {},
  registerLightOnly: () => () => {},
};

const CanvasLighting2DContext = createContext<CanvasLighting2D>(INERT);

/** The lighting in force, or an inert value outside a 2D stage (3D, unit tests). */
export function useCanvasLighting2D(): CanvasLighting2D {
  return useContext(CanvasLighting2DContext);
}

/** A counter of declarations, incremented for as long as each one is mounted. */
function useDeclarationCount(): [number, () => () => void] {
  const [count, setCount] = useState(0);
  const declare = useCallback(() => {
    setCount((n) => n + 1);
    return () => setCount((n) => Math.max(0, n - 1));
  }, []);
  return [count, declare];
}

/**
 * Declares that a light is present. The count is what gates the accumulator —
 * with no lights it is never allocated and every canvas item reads its canvas
 * modulate straight from its uniform, which is the 3D workspace and most
 * fixtures.
 *
 * Registration is an EFFECT: it has to unwind on unmount, and a provider
 * `setState` reached from a child's render is a React update-during-render.
 */
export function useRegisterCanvasLight2D(enabled: boolean): void {
  const { register } = useCanvasLighting2D();
  useEffect(() => {
    if (!enabled) return undefined;
    return register();
  }, [enabled, register]);
}

/** Declares an item whose light mode needs the unmodulated accumulation. */
export function useRegisterLightOnlyItem(enabled: boolean): void {
  const { registerLightOnly } = useCanvasLighting2D();
  useEffect(() => {
    if (!enabled) return undefined;
    return registerLightOnly();
  }, [enabled, registerLightOnly]);
}

function createAccumulationTarget(): THREE.WebGLRenderTarget {
  // Half-float so the accumulation stays unclamped, and NoColorSpace so three
  // writes the shader's raw sRGB-space value instead of re-encoding it.
  const rt = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthBuffer: false,
    stencilBuffer: false,
  });
  rt.texture.colorSpace = THREE.NoColorSpace;
  rt.texture.minFilter = THREE.LinearFilter;
  rt.texture.magFilter = THREE.LinearFilter;
  rt.texture.wrapS = THREE.ClampToEdgeWrapping;
  rt.texture.wrapT = THREE.ClampToEdgeWrapping;
  return rt;
}

const SEED_VERTEX = /* glsl */ `
void main() {
  // A full-NDC quad from a unit plane: the accumulator is screen-space, so the
  // seed has to cover the whole target wherever the canvas camera is panned.
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}
`;

const SEED_FRAGMENT = /* glsl */ `
uniform vec3 uSeed;
void main() {
  // rgb: where Godot's base pass leaves the item, with the albedo divided out.
  // alpha: no light has been counted yet.
  gl_FragColor = vec4(uSeed, 0.0);
}
`;

function createSeedMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: SEED_VERTEX,
    fragmentShader: SEED_FRAGMENT,
    uniforms: { uSeed: { value: new THREE.Vector3(1, 1, 1) } },
    // NoBlending, so the quad overwrites rather than accumulates — this IS the
    // clear. `transparent` puts it in the same sorted list as the light quads,
    // which is what lets `renderOrder` place it beneath them.
    blending: THREE.NoBlending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
}

/** Writes `S`'s starting value over the whole accumulator, under every light. */
function LightAccumulatorSeed({ material }: { material: THREE.ShaderMaterial }) {
  const toLightLayer = useCallback((mesh: THREE.Mesh | null) => {
    mesh?.layers.set(LIGHT_LAYER);
  }, []);

  return (
    <mesh
      ref={toLightLayer}
      material={material}
      renderOrder={SEED_RENDER_ORDER}
      // The quad ignores every matrix, so its bounds say nothing about where it
      // lands; culling it against the panned camera would drop the seed.
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

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

  const [lightCount, register] = useDeclarationCount();
  const [lightOnlyCount, registerLightOnly] = useDeclarationCount();

  const lit = lightCount > 0;
  const needsLightOnly = lit && lightOnlyCount > 0;

  const target = useMemo(() => (lit ? createAccumulationTarget() : null), [lit]);
  const lightOnlyTarget = useMemo(
    () => (needsLightOnly ? createAccumulationTarget() : null),
    [needsLightOnly]
  );
  // A cleanup belongs to an effect: a useMemo factory's return value is the
  // memoised VALUE, and React never calls it.
  useEffect(() => () => target?.dispose(), [target]);
  useEffect(() => () => lightOnlyTarget?.dispose(), [lightOnlyTarget]);

  const seedMaterial = useMemo(createSeedMaterial, []);
  useEffect(() => () => seedMaterial.dispose(), [seedMaterial]);

  const resolution = useRef(new THREE.Vector2(1, 1)).current;

  const { r, g, b } = canvasModulate;

  // Before the main pass: point the camera at the light layer alone and let the
  // already-mounted tree draw itself into the accumulators. Priority is negative
  // so this runs ahead of R3F's own render, which still happens as usual —
  // fiber only takes the loop over for POSITIVE priorities.
  useFrame(() => {
    if (!target) return;
    // The targets and the lookup are all in device pixels, because that is what
    // `gl_FragCoord` is measured in. Sizing from the CSS size instead reads the
    // buffer at the wrong scale on any display where dpr is not 1.
    gl.getDrawingBufferSize(resolution);
    const previousTarget = gl.getRenderTarget();
    const previousMask = camera.layers.mask;
    camera.layers.set(LIGHT_LAYER);

    const seed = seedMaterial.uniforms.uSeed!.value as THREE.Vector3;
    for (const pass of [
      { rt: target, seed: [r, g, b] as const },
      // Light Only skips `color *= canvas_modulation`, so its accumulation is
      // the same lights over an unmodulated seed.
      { rt: lightOnlyTarget, seed: [1, 1, 1] as const },
    ]) {
      if (!pass.rt) continue;
      if (pass.rt.width !== resolution.x || pass.rt.height !== resolution.y) {
        pass.rt.setSize(resolution.x, resolution.y);
      }
      seed.set(pass.seed[0], pass.seed[1], pass.seed[2]);
      gl.setRenderTarget(pass.rt);
      gl.render(scene, camera);
    }

    gl.setRenderTarget(previousTarget);
    camera.layers.mask = previousMask;
  }, -1);

  const value = useMemo<CanvasLighting2D>(
    () => ({
      buffer: target?.texture ?? null,
      lightOnlyBuffer: lightOnlyTarget?.texture ?? null,
      resolution,
      register,
      registerLightOnly,
    }),
    [target, lightOnlyTarget, resolution, register, registerLightOnly]
  );

  return (
    <CanvasLighting2DContext.Provider value={value}>
      {lit && <LightAccumulatorSeed material={seedMaterial} />}
      {children}
    </CanvasLighting2DContext.Provider>
  );
}

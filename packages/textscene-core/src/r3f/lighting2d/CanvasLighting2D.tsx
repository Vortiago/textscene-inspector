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
 * WHICH LIGHTS REACH AN ITEM is Godot's `RendererCanvasCull`:
 *
 *   if (light->item_mask & ci->light_mask) { ...apply light... }
 *
 * (`item_mask` is the `range_item_cull_mask` property; the light's own
 * `light_mask` is its CanvasItem mask and says nothing about what it lights.)
 * Two lights that share a `range_item_cull_mask` are therefore INDISTINGUISHABLE
 * to every item on the canvas, so the lights partition into classes by that
 * mask, and one accumulation per class covers every item exactly. An item then
 * reads the classes its own `light_mask` selects, usually exactly one, which is
 * the accumulation it would have got from a single-class canvas.
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
import { warn } from '../../logger';
import type { RGBA } from '../canvasItemModulate.js';
import { ShadowCasterStage } from './ShadowCasterStage.js';

/**
 * How many distinct `range_item_cull_mask` classes one canvas may accumulate.
 * The item-side injection unrolls one sampler per class, and GLSL ES 1.00
 * (which is what three compiles an `onBeforeCompile` injection as) cannot index
 * a sampler array by a runtime value, so the count has to be a compile-time
 * constant.
 *
 * There is a SECOND ceiling, and it is the tighter one: every lit 2D item now
 * binds two samplers per class (the accumulation and the `shadow_color` term)
 * on top of its own texture. WebGL2 guarantees 16 fragment texture units, so
 * the practical cap is around seven classes, not the fourteen the indexing rule
 * alone would allow. Raising this constant costs two units per lit item, and
 * overshooting shows up as a link-time sampler-limit failure rather than as a
 * dropped light.
 */
export const MAX_LIGHT_CLASSES = 4;

/**
 * The first camera layer light quads live on; class `i` uses `LIGHT_LAYER + i`.
 * Nothing else may use these: a class pre-pass renders exactly its own layer
 * (plus the seed), and the main pass renders neither.
 */
export const LIGHT_LAYER = 1;

/**
 * The seed quad's own layer. Every class pass enables it, so the seed is written
 * once per pass without belonging to any class.
 */
export const LIGHT_SEED_LAYER = LIGHT_LAYER + MAX_LIGHT_CLASSES;

/**
 * Where class `i`'s `shadow_color` quads draw: `SHADOW_TINT_LAYER + i`.
 *
 * They need a pass of their own because their term is the one thing in the light
 * pipeline that is NOT multiplied by the item's albedo. `light_shadow_compute`
 * runs AFTER `light_color.rgb *= base_color.rgb`, and its `mix` overwrites rgb
 * outright, so `shadow_color` reaches the canvas neat. The ordinary accumulator
 * cannot carry it: every item multiplies that buffer by its own albedo.
 *
 * Measured on Godot 4.6.3 — one shadow over surfaces of 0.25 and 0.75 albedo, at
 * equal distance from the light, adds the SAME 15/255 to each. An albedo-scaled
 * term would have added 3x more to the second.
 */
export const SHADOW_TINT_LAYER = LIGHT_SEED_LAYER + 1;

/**
 * Where a light lands when its cull-mask class did not fit in
 * `MAX_LIGHT_CLASSES`, or before the provider has classified it. No pass ever
 * enables this layer, so such a quad is simply never drawn, which is the
 * dropping the warning below announces.
 */
export const LIGHT_UNCLASSED_LAYER = SHADOW_TINT_LAYER + MAX_LIGHT_CLASSES;

/** Draw order within a light layer: the seed must land under every light. */
const SEED_RENDER_ORDER = -1;

/** One `range_item_cull_mask` value's accumulation. */
export interface CanvasLightClass {
  /** The `range_item_cull_mask` every light in this class shares. */
  readonly cullMask: number;
  /**
   * `S` seeded from the canvas modulate in rgb, and this class's summed cookie
   * coverage in alpha, in Godot's sRGB space and unclamped.
   */
  readonly buffer: THREE.Texture;
  /** The same accumulation seeded from an unmodulated white, for Light Only items. */
  readonly lightOnlyBuffer: THREE.Texture | null;
  /**
   * The albedo-free `shadow_color` accumulation, added AFTER an item multiplies
   * by its albedo. Null unless some light in this class tints its shadow, which
   * is Godot's default and so the usual case.
   */
  readonly shadowTintBuffer: THREE.Texture | null;
  /** The camera layer this class's light quads draw on. */
  readonly layer: number;
  /** The camera layer this class's `shadow_color` quads draw on. */
  readonly shadowTintLayer: number;
}

/** One light's place in its class's pass, handed out by `register`. */
export interface CanvasLightSlot {
  /**
   * This light's index among the lights of its class — dense, reused on
   * withdrawal, and distinct only WITHIN the class, which is all the stencil
   * needs since a class pass renders no other class's layer.
   */
  readonly ordinal: number;
  /** Withdraws the light and frees the ordinal. Idempotent. */
  release(): void;
}

export interface CanvasLighting2D {
  /**
   * The cull-mask classes in force, ascending by mask. Empty when the canvas
   * holds no light, in which case items fall back to the canvas modulate they
   * already know.
   */
  readonly classes: readonly CanvasLightClass[];
  /**
   * The accumulators' size in DEVICE pixels, which is what `gl_FragCoord` is
   * measured in. MUTATED in place each frame, so an item that binds it as a
   * uniform value stays in step without re-rendering.
   */
  readonly resolution: THREE.Vector2;
  /**
   * Declares a light of this `range_item_cull_mask` on the canvas and takes a
   * slot in that class's pass.
   */
  register(cullMask: number): CanvasLightSlot;
  /** Declares an item that needs the unmodulated accumulation. */
  registerLightOnly(): () => void;
  /** Declares a light that tints its shadow, so the extra pass is worth running. */
  registerShadowTint(): () => void;
}

const INERT: CanvasLighting2D = {
  classes: [],
  resolution: new THREE.Vector2(1, 1),
  register: () => ({ ordinal: 0, release: () => {} }),
  registerLightOnly: () => () => {},
  registerShadowTint: () => () => {},
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

const EMPTY_MASKS: readonly number[] = [];

function sameMasks(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((mask, i) => mask === b[i]);
}

/** The lowest ordinal `taken` has not handed out. */
function freeOrdinal(taken: ReadonlySet<number>): number {
  let ordinal = 0;
  while (taken.has(ordinal)) ordinal += 1;
  return ordinal;
}

/**
 * The distinct `range_item_cull_mask` values currently mounted, ascending, and
 * a slot allocator within each.
 *
 * Ascending rather than mount-ordered so a class's index, and therefore its
 * camera layer, depends only on WHICH masks are present, never on which light
 * mounted first. The live SLOTS per mask are what make the withdrawal of one of
 * several lights sharing a mask leave the class standing, and reusing the
 * lowest free ordinal keeps the numbering dense across a scene that mounts and
 * unmounts lights — which matters because they index an 8-bit stencil.
 */
function useCullMaskRegistry(): [readonly number[], (cullMask: number) => CanvasLightSlot] {
  const [masks, setMasks] = useState<readonly number[]>(EMPTY_MASKS);
  const taken = useRef(new Map<number, Set<number>>()).current;

  const publish = useCallback(() => {
    const next = [...taken.keys()].sort((a, b) => a - b);
    setMasks((previous) => (sameMasks(previous, next) ? previous : next));
  }, [taken]);

  const declare = useCallback(
    (cullMask: number): CanvasLightSlot => {
      let slots = taken.get(cullMask);
      if (!slots) {
        slots = new Set<number>();
        taken.set(cullMask, slots);
      }
      const ordinal = freeOrdinal(slots);
      slots.add(ordinal);
      publish();

      // A second release must not free the ordinal a LATER light has since been
      // given: React's strict double-invoke replays the cleanup on its own.
      let released = false;
      return {
        ordinal,
        release: () => {
          if (released) return;
          released = true;
          const live = taken.get(cullMask);
          if (!live) return;
          live.delete(ordinal);
          if (live.size === 0) taken.delete(cullMask);
          publish();
        },
      };
    },
    [taken, publish]
  );

  return [masks, declare];
}

/**
 * Declares that a light of this `range_item_cull_mask` is present. The classes
 * are what gate the accumulators: with no lights none is allocated and every
 * canvas item reads its canvas modulate straight from its uniform, which is the
 * 3D workspace and most fixtures.
 *
 * Registration is an EFFECT: it has to unwind on unmount, and a provider
 * `setState` reached from a child's render is a React update-during-render.
 *
 * Returns the light's ordinal within its class, which is what its stencil ref
 * and its draw order are derived from. It is 0 for the frame between mounting
 * and the effect running, and 0 is a legitimate ordinal, so an unregistered
 * light shares a ref with the first registered one for exactly that frame.
 */
export function useRegisterCanvasLight2D(enabled: boolean, cullMask: number): number {
  const { register } = useCanvasLighting2D();
  const [ordinal, setOrdinal] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    const slot = register(cullMask);
    setOrdinal(slot.ordinal);
    return slot.release;
  }, [enabled, cullMask, register]);
  return ordinal;
}

/**
 * The camera layer a light of this cull mask must draw its quad on: the layer
 * of its class, or `LIGHT_UNCLASSED_LAYER` while it has none.
 */
export function useLightClassLayer(cullMask: number): number {
  const { classes } = useCanvasLighting2D();
  return classes.find((lightClass) => lightClass.cullMask === cullMask)?.layer
    ?? LIGHT_UNCLASSED_LAYER;
}

/**
 * The camera layer a light draws its `shadow_color` quad on, or undefined while
 * its class has none. Separate from `useLightClassLayer` because the tint pass
 * must NOT see the cookie quads.
 */
export function useShadowTintLayer(cullMask: number): number | undefined {
  const { classes } = useCanvasLighting2D();
  return classes.find((lightClass) => lightClass.cullMask === cullMask)?.shadowTintLayer;
}

/** Declares a light that tints its shadow, so its class allocates the extra pass. */
export function useRegisterShadowTint(enabled: boolean): void {
  const { registerShadowTint } = useCanvasLighting2D();
  useEffect(() => {
    if (!enabled) return undefined;
    return registerShadowTint();
  }, [enabled, registerShadowTint]);
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
  //
  // The stencil is what carries the shadows, and three defaults it OFF — the
  // masks would then stamp nothing and every quad's test would pass, which
  // renders as no shadows at all rather than as an error. WebGL2 allocates the
  // pair as one DEPTH24_STENCIL8 attachment, which coexists with a half-float
  // colour attachment, so the depth buffer comes along and is simply unused:
  // everything in the pass draws with `depthTest` off.
  const rt = new THREE.WebGLRenderTarget(1, 1, {
    type: THREE.HalfFloatType,
    depthBuffer: true,
    stencilBuffer: true,
  });
  rt.texture.colorSpace = THREE.NoColorSpace;
  rt.texture.minFilter = THREE.LinearFilter;
  rt.texture.magFilter = THREE.LinearFilter;
  rt.texture.wrapS = THREE.ClampToEdgeWrapping;
  rt.texture.wrapT = THREE.ClampToEdgeWrapping;
  return rt;
}

/** `count` accumulators, disposed together when the count changes. */
function useAccumulationTargets(count: number): THREE.WebGLRenderTarget[] {
  const targets = useMemo(
    () => Array.from({ length: count }, createAccumulationTarget),
    [count]
  );
  // A cleanup belongs to an effect: a useMemo factory's return value is the
  // memoised VALUE, and React never calls it.
  useEffect(() => () => targets.forEach((target) => target.dispose()), [targets]);
  return targets;
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
  const toSeedLayer = useCallback((mesh: THREE.Mesh | null) => {
    mesh?.layers.set(LIGHT_SEED_LAYER);
  }, []);

  return (
    <mesh
      ref={toSeedLayer}
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

  const [cullMasks, register] = useCullMaskRegistry();
  const [lightOnlyCount, registerLightOnly] = useDeclarationCount();
  const [shadowTintCount, registerShadowTint] = useDeclarationCount();

  const classCount = Math.min(cullMasks.length, MAX_LIGHT_CLASSES);
  const lit = classCount > 0;
  const needsLightOnly = lit && lightOnlyCount > 0;
  const needsShadowTint = lit && shadowTintCount > 0;

  const targets = useAccumulationTargets(classCount);
  const lightOnlyTargets = useAccumulationTargets(needsLightOnly ? classCount : 0);
  const shadowTintTargets = useAccumulationTargets(needsShadowTint ? classCount : 0);

  const overflow = cullMasks.length - MAX_LIGHT_CLASSES;
  useEffect(() => {
    if (overflow <= 0) return;
    warn(
      `[CanvasLighting2D] ${overflow + MAX_LIGHT_CLASSES} distinct range_item_cull_mask ` +
        `values on one canvas; only ${MAX_LIGHT_CLASSES} can be accumulated, so lights ` +
        `masked ${cullMasks.slice(MAX_LIGHT_CLASSES).join(', ')} are not drawn`
    );
  }, [overflow, cullMasks]);

  const seedMaterial = useMemo(createSeedMaterial, []);
  useEffect(() => () => seedMaterial.dispose(), [seedMaterial]);

  const resolution = useRef(new THREE.Vector2(1, 1)).current;

  const { r, g, b } = canvasModulate;

  // Before the main pass: point the camera at one class's layer (plus the seed)
  // and let the already-mounted tree draw itself into that class's accumulators.
  // Priority is negative so this runs ahead of R3F's own render, which still
  // happens as usual: fiber only takes the loop over for POSITIVE priorities.
  useFrame(() => {
    if (targets.length === 0) return;
    // The targets and the lookup are all in device pixels, because that is what
    // `gl_FragCoord` is measured in. Sizing from the CSS size instead reads the
    // buffer at the wrong scale on any display where dpr is not 1.
    gl.getDrawingBufferSize(resolution);
    const previousTarget = gl.getRenderTarget();
    const previousMask = camera.layers.mask;

    const seed = seedMaterial.uniforms.uSeed!.value as THREE.Vector3;
    for (let index = 0; index < targets.length; index += 1) {
      for (const pass of [
        { rt: targets[index], seed: [r, g, b] as const, layer: LIGHT_LAYER + index },
        // Light Only skips `color *= canvas_modulation`, so its accumulation is
        // the same lights over an unmodulated seed.
        { rt: lightOnlyTargets[index], seed: [1, 1, 1] as const, layer: LIGHT_LAYER + index },
        // The albedo-free term. Its layer carries the shadow_color quads and the
        // volume masks (which sit on both layers) but NOT the cookie quads, so
        // this buffer holds only what a shadowed pixel adds. The seed is black,
        // which is how the target gets zeroed without touching the renderer's
        // clear colour.
        {
          rt: shadowTintTargets[index],
          seed: [0, 0, 0] as const,
          layer: SHADOW_TINT_LAYER + index,
        },
      ]) {
        if (!pass.rt) continue;
        camera.layers.set(LIGHT_SEED_LAYER);
        camera.layers.enable(pass.layer);
        if (pass.rt.width !== resolution.x || pass.rt.height !== resolution.y) {
          pass.rt.setSize(resolution.x, resolution.y);
        }
        seed.set(pass.seed[0], pass.seed[1], pass.seed[2]);
        gl.setRenderTarget(pass.rt);
        // One clear per PASS, not per light: within a pass each light stamps its
        // own ref, so last frame's stamps are the only ones that could be
        // mistaken for this frame's. Leaving them would make a light that has
        // stopped casting keep the hole it cut.
        gl.clear(false, false, true);
        gl.render(scene, camera);
      }
    }

    gl.setRenderTarget(previousTarget);
    camera.layers.mask = previousMask;
  }, -1);

  const value = useMemo<CanvasLighting2D>(
    () => ({
      classes: targets.map((target, index) => ({
        cullMask: cullMasks[index]!,
        buffer: target.texture,
        lightOnlyBuffer: lightOnlyTargets[index]?.texture ?? null,
        shadowTintBuffer: shadowTintTargets[index]?.texture ?? null,
        layer: LIGHT_LAYER + index,
        shadowTintLayer: SHADOW_TINT_LAYER + index,
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
      cullMasks,
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
          with the pass that consumes them rather than in the stage above. */}
      <ShadowCasterStage>{children}</ShadowCasterStage>
    </CanvasLighting2DContext.Provider>
  );
}

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
import { CanvasLightSequenceProvider } from './useLightSequence.js';
import {
  compareLightCullKeys,
  lightCullKeyId,
  sameLightCullKey,
  type LightCullKey,
} from './lightCullKey.js';

/**
 * How many distinct light classes one canvas may accumulate.
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

/** One cull tuple's accumulation. */
export interface CanvasLightClass {
  /** The cull tuple every light in this class shares — see `lightCullKey`. */
  readonly key: LightCullKey;
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
  /**
   * The camera layer this class's `shadow_color` quads draw on — set only while
   * `shadowTintBuffer` is, so a light is never told to draw a tint quad into a
   * pass that does not run. The two are allocated together and withdrawn
   * together; splitting them would put an untinted frame on screen for the
   * commit between a light declaring its tint and its class getting a target.
   */
  readonly shadowTintLayer: number | undefined;
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
   * The light classes in force, ordered by their cull tuple (cull mask first).
   * Empty when the canvas holds no light, in which case items fall back to the
   * canvas modulate they already know.
   */
  readonly classes: readonly CanvasLightClass[];
  /**
   * The accumulators' size in DEVICE pixels, which is what `gl_FragCoord` is
   * measured in. MUTATED in place each frame, so an item that binds it as a
   * uniform value stays in step without re-rendering.
   */
  readonly resolution: THREE.Vector2;
  /**
   * Declares a light of this cull tuple on the canvas and takes a slot in that
   * class's pass.
   */
  register(key: LightCullKey): CanvasLightSlot;
  /** Declares an item that needs the unmodulated accumulation. */
  registerLightOnly(): () => void;
  /**
   * Declares a light that tints its shadow, so ITS class allocates the extra
   * pass. Keyed, unlike `registerLightOnly`: an item can read any class, but a
   * light belongs to exactly one.
   */
  registerShadowTint(key: LightCullKey): () => void;
}

const INERT: CanvasLighting2D = {
  classes: [],
  resolution: new THREE.Vector2(1, 1),
  register: (_key: LightCullKey) => ({ ordinal: 0, release: () => {} }),
  registerLightOnly: () => () => {},
  registerShadowTint: (_key: LightCullKey) => () => {},
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

const EMPTY_KEYS: readonly LightCullKey[] = [];

function sameKeys(a: readonly LightCullKey[], b: readonly LightCullKey[]): boolean {
  return a.length === b.length && a.every((key, i) => sameLightCullKey(key, b[i]!));
}

const EMPTY_IDS: ReadonlySet<string> = new Set();

/**
 * The same counter as `useDeclarationCount`, but per cull tuple: it publishes
 * WHICH tuples have a declaration rather than how many there are in total.
 */
function useKeyedDeclarationCount(): [
  ReadonlySet<string>,
  (key: LightCullKey) => () => void,
] {
  const [ids, setIds] = useState<ReadonlySet<string>>(EMPTY_IDS);
  const counts = useRef(new Map<string, number>()).current;

  const publish = useCallback(() => {
    setIds((previous) => {
      if (previous.size === counts.size && [...counts.keys()].every((id) => previous.has(id))) {
        return previous;
      }
      return new Set(counts.keys());
    });
  }, [counts]);

  const declare = useCallback(
    (key: LightCullKey) => {
      const id = lightCullKeyId(key);
      counts.set(id, (counts.get(id) ?? 0) + 1);
      publish();

      // As in `useLightClassRegistry`: strict double-invoke replays a cleanup,
      // and a second decrement would drop a live declaration's count.
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const remaining = (counts.get(id) ?? 0) - 1;
        if (remaining > 0) counts.set(id, remaining);
        else counts.delete(id);
        publish();
      };
    },
    [counts, publish]
  );

  return [ids, declare];
}

/** The lowest ordinal `taken` has not handed out. */
function freeOrdinal(taken: ReadonlySet<number>): number {
  let ordinal = 0;
  while (taken.has(ordinal)) ordinal += 1;
  return ordinal;
}

/** One live class: the tuple it accumulates for, and the ordinals in use. */
interface LiveClass {
  key: LightCullKey;
  slots: Set<number>;
}

/**
 * The distinct cull tuples currently mounted, in tuple order, and a slot
 * allocator within each.
 *
 * Sorted rather than mount-ordered so a class's index, and therefore its camera
 * layer, depends only on WHICH tuples are present, never on which light mounted
 * first. Keyed by the tuple's VALUE, since a light rebuilds its key object on
 * every render. The live SLOTS per tuple are what make the withdrawal of one of
 * several lights sharing a class leave the class standing, and reusing the
 * lowest free ordinal keeps the numbering dense across a scene that mounts and
 * unmounts lights — which matters because they index an 8-bit stencil.
 */
function useLightClassRegistry(): [
  readonly LightCullKey[],
  (key: LightCullKey) => CanvasLightSlot,
] {
  const [keys, setKeys] = useState<readonly LightCullKey[]>(EMPTY_KEYS);
  const taken = useRef(new Map<string, LiveClass>()).current;

  const publish = useCallback(() => {
    const next = [...taken.values()].map((live) => live.key).sort(compareLightCullKeys);
    setKeys((previous) => (sameKeys(previous, next) ? previous : next));
  }, [taken]);

  const declare = useCallback(
    (key: LightCullKey): CanvasLightSlot => {
      const id = lightCullKeyId(key);
      let live = taken.get(id);
      if (!live) {
        live = { key, slots: new Set<number>() };
        taken.set(id, live);
      }
      const ordinal = freeOrdinal(live.slots);
      live.slots.add(ordinal);
      publish();

      // A second release must not free the ordinal a LATER light has since been
      // given: React's strict double-invoke replays the cleanup on its own.
      let released = false;
      return {
        ordinal,
        release: () => {
          if (released) return;
          released = true;
          const current = taken.get(id);
          if (!current) return;
          current.slots.delete(ordinal);
          if (current.slots.size === 0) taken.delete(id);
          publish();
        },
      };
    },
    [taken, publish]
  );

  return [keys, declare];
}

/**
 * Declares that a light of this cull tuple is present. The classes are what
 * gate the accumulators: with no lights none is allocated and every canvas item
 * reads its canvas modulate straight from its uniform, which is the 3D
 * workspace and most fixtures.
 *
 * Registration is an EFFECT: it has to unwind on unmount, and a provider
 * `setState` reached from a child's render is a React update-during-render.
 *
 * The effect depends on the tuple's five NUMBERS rather than on the key object,
 * and rebuilds the key inside itself. A light rebuilds its key on any re-render,
 * so an object dependency would withdraw and re-register the light — and
 * therefore reshuffle every ordinal in its class — on a render that changed
 * nothing.
 *
 * Returns the light's ordinal within its class, which is what its stencil ref is
 * derived from. It is 0 for the frame between mounting and the effect running,
 * and 0 is a legitimate ordinal, so an unregistered light shares a ref with the
 * first registered one for exactly that frame.
 */
export function useRegisterCanvasLight2D(enabled: boolean, key: LightCullKey): number {
  const { register } = useCanvasLighting2D();
  const [ordinal, setOrdinal] = useState(0);
  const { itemCullMask, zMin, zMax, layerMin, layerMax } = key;
  useEffect(() => {
    if (!enabled) return undefined;
    const slot = register({ itemCullMask, zMin, zMax, layerMin, layerMax });
    setOrdinal(slot.ordinal);
    return slot.release;
  }, [enabled, itemCullMask, zMin, zMax, layerMin, layerMax, register]);
  return ordinal;
}

/** The class accumulating this cull tuple, or undefined while it has none. */
function useLightClass(key: LightCullKey): CanvasLightClass | undefined {
  const { classes } = useCanvasLighting2D();
  return classes.find((lightClass) => sameLightCullKey(lightClass.key, key));
}

/**
 * The camera layer a light of this cull tuple must draw its quad on: the layer
 * of its class, or `LIGHT_UNCLASSED_LAYER` while it has none.
 */
export function useLightClassLayer(key: LightCullKey): number {
  return useLightClass(key)?.layer ?? LIGHT_UNCLASSED_LAYER;
}

/**
 * The camera layer a light draws its `shadow_color` quad on, or undefined while
 * its class has none. Separate from `useLightClassLayer` because the tint pass
 * must NOT see the cookie quads.
 */
export function useShadowTintLayer(key: LightCullKey): number | undefined {
  return useLightClass(key)?.shadowTintLayer;
}

/** Declares a light that tints its shadow, so its class allocates the extra pass. */
export function useRegisterShadowTint(enabled: boolean, key: LightCullKey): void {
  const { registerShadowTint } = useCanvasLighting2D();
  const { itemCullMask, zMin, zMax, layerMin, layerMax } = key;
  useEffect(() => {
    if (!enabled) return undefined;
    return registerShadowTint({ itemCullMask, zMin, zMax, layerMin, layerMax });
  }, [enabled, itemCullMask, zMin, zMax, layerMin, layerMax, registerShadowTint]);
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

/**
 * One accumulator per class `wanted` selects, aligned with the class indices and
 * `null` for the rest.
 *
 * Per class rather than canvas-wide because a `shadow_color` belongs to ONE
 * light and therefore to one class. Allocating for the others would spend a
 * screen-sized half-float target and a full-scene render per frame on a buffer
 * that can only ever come out black.
 */
function useSelectedAccumulationTargets(
  wanted: readonly boolean[]
): readonly (THREE.WebGLRenderTarget | null)[] {
  const signature = wanted.map((on) => (on ? '1' : '0')).join('');
  const targets = useMemo(
    () => [...signature].map((on) => (on === '1' ? createAccumulationTarget() : null)),
    [signature]
  );
  useEffect(() => () => targets.forEach((target) => target?.dispose()), [targets]);
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

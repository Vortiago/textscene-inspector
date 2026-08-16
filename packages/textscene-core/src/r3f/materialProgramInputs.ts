/**
 * `materialProgramInputs()` — a material's props and the React `key` that has to
 * travel with them, derived from the SAME merged object, so that a program input
 * arriving late (a texture, a define, a forced `transparent`) reaches the shader
 * and not just the material.
 *
 * three bakes a material's texture-slot presence and its `defines` into the
 * program SOURCE — `USE_MAP` and the define block are written once, at the
 * compile `WebGLRenderer.setProgram` performs for that material. `setProgram`
 * re-derives a program only when `material.version` has moved past the compiled
 * one, or for the short list of state it re-examines itself (lights, output
 * colour space, batching/instancing/skinning, `envMap`, scene fog, clipping
 * planes, vertex alphas, morphs, tone mapping) — a map appearing where there was
 * none is not on that list, and neither is a `defines` entry. So a material
 * compiled while its texture was still loading samples nothing forever: the
 * polygon paints its flat fill colour over the whole shape, however correctly
 * `map` is assigned after.
 *
 * Nothing upstream bumps `material.needsUpdate` for us. `@react-three/fiber`'s
 * `applyProps` assigns `root[key] = value` and stops (fiber 9.6.1 dist), which
 * is the same reason `useCanvasItemLighting` owns its uniform objects for an
 * item's whole life instead of rebuilding them. Worse for `defines`
 * specifically: `applyProps` SKIPS an `undefined` value outright ("Ignore
 * setting undefined props"), so defines that stop applying — a `Sprite2D` whose
 * texture swaps from a `res://` file to a ViewportTexture that keeps its own
 * colour space — cannot even be CLEARED through the prop, and the material would
 * keep decoding a sample that no longer needs it.
 *
 * Hence a key rather than a `needsUpdate` bump: React remounts the element,
 * R3F constructs a fresh material, and its first and only compile sees the
 * finished set.
 *
 * The key must depend ONLY on what the program depends on. A texture swapped for
 * another texture — an `AnimatedSprite2D` advancing a frame, a `Sprite2D`
 * re-regioned — compiles to the same program, and remounting a material per
 * animation frame would throw away a program per frame to no effect.
 *
 * Why this was invisible until canvas materials became single-pass: a
 * `transparent` + `DoubleSide` material with `forceSinglePass === false` is
 * drawn TWICE per frame by `renderObject`, which sets `material.needsUpdate =
 * true` before each pass (`three.module.js`, `WebGLRenderer.renderObject`). Every
 * 2D canvas material was therefore recompiled every frame, and picked up
 * whatever had arrived since. `canvasItemFacing()` removed the second pass, and
 * with it an accidental recompile the canvas had been leaning on.
 *
 * WHY THE MERGE IS THE FACTORY'S JOB, not the call site's. A canvas material is
 * assembled from the item's own props plus three shared recipes spread over
 * them — `canvasItemFacing()`, `canvasItemBlendState()` and the lighting props —
 * and the LAST writer wins. `canvasItemLighting.ts` forces `transparent: true`
 * unconditionally, so an item that writes `transparent: false` is transparent
 * anyway; a key derived from the site's own value would then describe a material
 * that does not exist. Merging here and deriving from the result is the only
 * arrangement where the two cannot disagree. `canvasItemFacing()`'s `side` is a
 * baked parameter for the same reason.
 *
 * WHAT ENTERS THE KEY — every one verified against three 0.185.1's
 * `WebGLPrograms.js`, which is the only place a program's identity is decided:
 *
 *   - the `opaque` composite (`:262`) — `transparent === false && blending ===
 *     NormalBlending && alphaToCoverage === false`, one boolean at `:581`
 *   - `alphaToCoverage` (`:213`, layer `:589`), which is BOTH a term of `opaque`
 *     and a parameter in its own right
 *   - per-texture-slot PRESENCE, which reaches the key as each slot's `…MapUv`
 *     term (`:444-466`) and the shader's `USE_…` define
 *   - `defines` — KEYS and VALUES both (`:415-420`)
 *   - `vertexColors` (`:308`), `side` as the `doubleSided`/`flipSided` pair
 *     (`:369-370`), `premultipliedAlpha` (`:367`), `combine` (`:268`),
 *     `dithering` (`:357`), the material's own `fog` flag (`:314`)
 *   - the composed `customProgramCacheKey()` return (`:382`, pushed at `:432`)
 *
 * Deliberately NOT keyed:
 *
 *   - `alphaTest` IS a program input (`:170`), but `Material.js:494-502` bumps
 *     `version` itself on the `> 0` crossing, so it re-derives without us.
 *   - `blending` alone: its only reference in `WebGLPrograms` is inside
 *     `opaque`, so on an already-transparent material it is per-draw GL state.
 *   - `wireframe` alone: it reaches a program only through the `bumpMap`
 *     (`:132`) and `flatShading` (`:317`) composites.
 *   - `clippingPlanes`: `numClippingPlanes` is a parameter (`:354`), but
 *     `WebGLRenderer.js:2456-2458` compares the plane count every draw.
 *   - `envMap`, `vertexAlphas`, `vertexTangents`, scene `fog`, tone mapping: all
 *     on `setProgram`'s own re-check chain (`WebGLRenderer.js:2390-2494`).
 *   - `decodeVideoTexture` (`:364`) is keyed and texture-IDENTITY dependent, so
 *     it would defeat "a swap is not a new program" — it cannot fire here.
 *     `canvas2DTextureDecode.ts` retags every canvas map `NoColorSpace`, whose
 *     transfer is linear, and no `THREE.VideoTexture` exists in this codebase.
 *
 * A parameter the caller never passes stays at its material-type default for
 * that tag's whole life, so an absent value is one token and needs no default
 * modelled here.
 */
import * as THREE from 'three';

/** The subset of three's `onBeforeCompile` argument an injection may touch. */
export interface ProgramShader {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, THREE.IUniform>;
}

/**
 * A shader patch and the cache-key contribution that identifies it, as ONE
 * value.
 *
 * `WebGLPrograms` keys its cache on the material's own parameters, which an
 * `onBeforeCompile` injection is not part of — a patched material and a stock
 * one with the same parameters are handed each other's compiled program. three
 * offers exactly one slot to say otherwise (`customProgramCacheKey`), so two
 * injections on one material used to mean one of them silently dropping the
 * other's contribution. Pairing them in a single value makes the patch
 * unspellable without its contribution, and the factory concatenates.
 */
export interface ProgramInjection {
  /** Distinguishes this patched program from an unpatched one. */
  readonly cacheKey: string;
  readonly onBeforeCompile: (shader: ProgramShader) => void;
}

/**
 * What the factory owns, INTERSECTED with a caller's own bag rather than used as
 * its constraint: a constraint would excess-check every material prop away, and
 * would reject an interface-typed recipe like `CanvasItemFacing` outright as a
 * weak type. Intersecting bans the three names and leaves the rest inferred.
 *
 * `key` is banned because it is the factory's OUTPUT: React 19 reads the
 * explicit `key=` attribute first and then lets a spread `config.key` overwrite
 * it (`react/cjs/react-jsx-runtime.development.js:242-245`, warning as it goes),
 * so a `key` reaching `props` would beat the one the call site wrote.
 * `onBeforeCompile` and `customProgramCacheKey` are banned so an injection has
 * no unpaired route in — `injection` is the only door.
 */
export interface MaterialProgramBag {
  key?: never;
  onBeforeCompile?: never;
  customProgramCacheKey?: never;
  injection?: ProgramInjection;
}

/** What the factory adds when anything was injected, and omits when nothing was. */
interface InjectedProps {
  onBeforeCompile?: (shader: ProgramShader) => void;
  customProgramCacheKey?: () => string;
}

/**
 * Left-to-right merge of a tuple of prop bags, later parts winning. An `undefined`
 * part contributes nothing at runtime; its props stay in the type because the
 * result is only ever spread onto a material, where every one of them is optional.
 */
type Merged<T extends readonly unknown[]> = T extends readonly [infer Head, ...infer Rest]
  ? NonNullable<Head> & Merged<Rest>
  : unknown;

/**
 * The finished pair. `props` is the MERGED INPUT type rather than one wide
 * material-params type: a single wide type would compile — TypeScript does not
 * excess-check a spread variable — and then splat mesh-only props onto a
 * `lineBasicMaterial` at runtime.
 */
export interface MaterialProgram<P> {
  /** `<meshBasicMaterial key={program.key} {...program.props} />`, never inside `props`. */
  readonly key: string;
  readonly props: P;
}

/** Every `!! material.<slot>` presence term in `WebGLPrograms` a material here can bind. */
const TEXTURE_SLOTS = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'gradientMap',
  'lightMap',
  'matcap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
  'specularMap',
] as const;

export function materialProgramInputs<
  P extends object,
  M extends readonly (object | undefined)[] = [],
>(input: {
  props: P & MaterialProgramBag;
  /** Mapped rather than intersected whole, so the tuple — and its order — survives. */
  merge?: { [Part in keyof M]: (M[Part] & MaterialProgramBag) | undefined };
}): MaterialProgram<Omit<P & Merged<M>, 'injection'> & InjectedProps> {
  const injections: ProgramInjection[] = [];
  const merged: Record<string, unknown> = {};

  for (const bag of [input.props, ...(input.merge ?? [])]) {
    if (!bag) continue;
    const { injection, ...rest } = bag as MaterialProgramBag & Record<string, unknown>;
    if (injection) injections.push(injection);
    Object.assign(merged, rest);
  }

  const cacheKey = injections.map((one) => one.cacheKey).join('+');
  if (injections.length > 0) {
    merged.customProgramCacheKey = cacheKeyThunk(cacheKey);
    // One injection passes straight through, so `useCanvasItemLighting`'s memo
    // still reaches the material; composing two cannot avoid a fresh closure.
    merged.onBeforeCompile =
      injections.length === 1
        ? injections[0]!.onBeforeCompile
        : (shader: ProgramShader) => {
            for (const one of injections) one.onBeforeCompile(shader);
          };
  }

  return {
    key: programKey(merged, cacheKey),
    props: merged as Omit<P & Merged<M>, 'injection'> & InjectedProps,
  };
}

/**
 * One thunk per composed contribution, for identity stability. `applyProps`
 * assigns whatever it is handed and never bumps `material.needsUpdate` (the only
 * one in the fiber 9.6.1 dist is `gl.shadowMap`'s), so a fresh closure per render
 * is dead weight rather than a recompile — but it would still overwrite a stable
 * function with an unstable one, which is what `useCanvasItemLighting`'s memo
 * exists to prevent. The set of contributions is a handful of module literals.
 */
const CACHE_KEY_THUNKS = new Map<string, () => string>();

function cacheKeyThunk(cacheKey: string): () => string {
  const existing = CACHE_KEY_THUNKS.get(cacheKey);
  if (existing) return existing;
  const thunk = () => cacheKey;
  CACHE_KEY_THUNKS.set(cacheKey, thunk);
  return thunk;
}

/** Composed strings only — a patch's function identity never enters the key. */
function programKey(props: Record<string, unknown>, cacheKey: string): string {
  const transparent = props.transparent === true;
  const alphaToCoverage = props.alphaToCoverage === true;
  const blending = props.blending ?? THREE.NormalBlending;
  const opaque = !transparent && blending === THREE.NormalBlending && !alphaToCoverage;

  const defines = props.defines as Record<string, string> | undefined;
  const declared = defines
    ? Object.keys(defines)
        .sort()
        .map((name) => `${name}=${defines[name]}`)
        .join('+')
    : '';
  const slots = TEXTURE_SLOTS.filter((slot) => props[slot]).join('+');

  return [
    `opaque:${flag(opaque)}`,
    `a2c:${flag(alphaToCoverage)}`,
    `side:${props.side ?? THREE.FrontSide}`,
    `vcol:${flag(props.vertexColors === true)}`,
    `premul:${flag(props.premultipliedAlpha === true)}`,
    `combine:${token(props.combine)}`,
    `dither:${flag(props.dithering === true)}`,
    `fog:${token(props.fog)}`,
    `slots:${slots}`,
    `defines:${declared}`,
    `inject:${cacheKey}`,
  ].join('|');
}

const flag = (on: boolean): string => (on ? '1' : '0');

/** `-` for a value the caller never passes: constant, at the material type's own default. */
const token = (value: unknown): string => (value === undefined ? '-' : String(value));

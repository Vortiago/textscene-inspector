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
 *   - `alphaHash` (`:172`, published `:266`). `Material.js:134` declares it as a
 *     plain field, so `alphaTest`'s exemption below does not transfer to it.
 *   - per-texture-slot PRESENCE, which reaches the key as each slot's `…MapUv`
 *     term (`:444-466`) and the shader's `USE_…` define. Ten of the slots three
 *     reads are GATED on a feature being on (`:147-169`), so their presence
 *     terms carry the gate — `TEXTURE_SLOT_GATES` is the pairing.
 *   - `defines` — KEYS and VALUES both (`:415-420`)
 *   - `vertexColors` (`:308`), `side` as the `doubleSided`/`flipSided` pair
 *     (`:369-370`), `premultipliedAlpha` (`:367`), `combine` (`:268`),
 *     `dithering` (`:357`), the material's own `fog` flag (`:314`)
 *   - the physical features as `> 0` thresholds (`:140-145`) — `clearcoat`,
 *     `sheen`, `anisotropy`, `transmission`, `iridescence`, `dispersion`, one
 *     layer bit each — so a slider moving inside the band stays a uniform while
 *     a crossing rebuilds, which the element-type switch alone misses when a
 *     second feature holds the upgrade.
 *   - `flatShading` (`:317`) as its first arm only, `wireframe === false &&
 *     flatShading === true`. The second arm turns on `geometry.attributes.normal`
 *     and the material's `isMesh*Material` brand, neither of them a prop —
 *     out of reach here for the same reason `vertexAlphas` is, except for its
 *     `HAS_NORMALMAP === false` term, which slot presence already covers.
 *   - the composed `customProgramCacheKey()` return (`:382`, pushed at `:432`)
 *
 * Deliberately NOT keyed:
 *
 *   - `alphaTest` IS a program input (`:170`), but `Material.js:494-502` bumps
 *     `version` itself on the `> 0` crossing, so it re-derives without us.
 *   - `blending` alone: its only reference in `WebGLPrograms` is inside
 *     `opaque`, so on an already-transparent material it is per-draw GL state.
 *   - `wireframe` alone: it reaches a program only through the `flatShading`
 *     (`:317`) composite, which keys it, and the `bumpMap` one (`:132`), whose
 *     slot is in `NOT_BOUND_TEXTURE_SLOTS` and carries the reason there.
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
 * that tag's whole life, so an absent value needs no default modelled here and
 * emits NO token at all: every term is labelled and `|`-separated, so an
 * omission reads as "at its absent value" and no other term can impersonate it
 * — for as long as no term's VALUE carries a `|` itself, which only a `defines`
 * value or a `cacheKey` could, and both are module literals here. A bag
 * carrying no program input at all therefore keys to the empty string, which is
 * a perfectly good key: a key separates a material from its own past self, not
 * from its siblings.
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

/**
 * What the factory adds when anything was injected, and omits when nothing was.
 * Exported because it names part of the return type, which a module holding a
 * `MaterialProgram` in an exported constant cannot otherwise write down.
 */
export interface InjectedProps {
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

/** The `> 0` feature booleans (`:140-145`), each its own layer bit. */
const PHYSICAL_FEATURES = [
  'clearcoat',
  'sheen',
  'anisotropy',
  'transmission',
  'iridescence',
  'dispersion',
] as const;

type PhysicalFeature = (typeof PHYSICAL_FEATURES)[number];

/**
 * Every `!! material.<slot>` presence term, paired with the feature three ALSO
 * requires before it reads the slot at all — `null` where presence is the whole
 * term. Ten slots are gated (`:147-169`), and the gate belongs in the table
 * rather than in a second collection so a slot cannot be added without one
 * being decided.
 *
 * A slot nothing binds today still belongs here as long as its TERM SHAPE is
 * right: the table describes what three would bake, not what this codebase
 * happens to have wired. `NOT_BOUND_TEXTURE_SLOTS` is the other half — the
 * slots deliberately not modelled at all.
 */
export const TEXTURE_SLOT_GATES: Readonly<Record<string, PhysicalFeature | null>> = {
  map: null,
  alphaMap: null,
  aoMap: null,
  displacementMap: null,
  emissiveMap: null,
  gradientMap: null,
  lightMap: null,
  matcap: null,
  metalnessMap: null,
  normalMap: null,
  roughnessMap: null,
  specularMap: null,
  specularColorMap: null,
  specularIntensityMap: null,
  anisotropyMap: 'anisotropy',
  clearcoatMap: 'clearcoat',
  clearcoatNormalMap: 'clearcoat',
  clearcoatRoughnessMap: 'clearcoat',
  iridescenceMap: 'iridescence',
  iridescenceThicknessMap: 'iridescence',
  sheenColorMap: 'sheen',
  sheenRoughnessMap: 'sheen',
  transmissionMap: 'transmission',
  thicknessMap: 'transmission',
};

/** Iterated per call, so the entry list is built once rather than per key. */
const TEXTURE_SLOT_ENTRIES = Object.entries(TEXTURE_SLOT_GATES);

/**
 * A `getParameters` texture slot this codebase declines to model, and why. The
 * upgrade guard requires every such field to be here or in the table above, so
 * a slot cannot go missing by omission.
 */
export const NOT_BOUND_TEXTURE_SLOTS: Readonly<Record<string, string>> = {
  bumpMap:
    'Godot binds no bump slot; three reads the term as `!!bumpMap && wireframe === false` (`:132`), so modelling it would key `wireframe` for a slot nothing can fill',
};

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

  // Copied wholesale and stripped ONCE below, rather than rest-destructured per
  // bag: a rest spread rebuilds every key of every part to remove one that most
  // parts do not carry.
  Object.assign(merged, input.props);
  if (input.props.injection) injections.push(input.props.injection);
  for (const bag of input.merge ?? []) {
    if (!bag) continue;
    const { injection } = bag as MaterialProgramBag;
    if (injection) injections.push(injection);
    Object.assign(merged, bag);
  }

  let cacheKey = '';
  if (injections.length > 0) {
    for (const one of injections) cacheKey += cacheKey === '' ? one.cacheKey : `+${one.cacheKey}`;
    // `undefined` rather than `delete`: `applyProps` skips an undefined value
    // (`:24-27`), and deleting deoptimises the object it is handed.
    merged.injection = undefined;
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
  let key = '';
  /** Every term is LABELLED, so omitting one says "at its absent value" unambiguously. */
  const add = (term: string): void => {
    key = key === '' ? term : `${key}|${term}`;
  };
  const active = (name: string): boolean => Number(props[name] ?? 0) > 0;

  const alphaToCoverage = props.alphaToCoverage === true;
  const blending = props.blending ?? THREE.NormalBlending;
  // The `opaque` composite (`:262`), emitted as its negation so the default
  // — nothing supplied, hence opaque — costs no token.
  if (props.transparent === true || blending !== THREE.NormalBlending || alphaToCoverage)
    add('blended');
  if (alphaToCoverage) add('a2c');
  if (props.alphaHash === true) add('ahash');
  // `side` has ONE default across every material type, so it is normalised;
  // `combine` and `fog` do not, and an absent one is not an explicit default.
  const side = props.side ?? THREE.FrontSide;
  if (side !== THREE.FrontSide) add(`side:${String(side)}`);
  if (props.vertexColors === true) add('vcol');
  if (props.premultipliedAlpha === true) add('premul');
  if (props.combine !== undefined) add(`combine:${String(props.combine)}`);
  if (props.dithering === true) add('dither');
  if (props.fog !== undefined) add(`fog:${String(props.fog)}`);
  // `:317`, first arm only: the second is geometry-derived, out of reach here
  // for the same reason `vertexAlphas` is.
  if (props.flatShading === true && props.wireframe !== true) add('flat');

  let features = '';
  for (const feature of PHYSICAL_FEATURES)
    if (active(feature)) features += features === '' ? feature : `+${feature}`;
  if (features !== '') add(`feat:${features}`);

  let slots = '';
  for (const [slot, gate] of TEXTURE_SLOT_ENTRIES) {
    if (!props[slot]) continue;
    if (gate !== null && !active(gate)) continue;
    slots += slots === '' ? slot : `+${slot}`;
  }
  if (slots !== '') add(`slots:${slots}`);

  const defines = props.defines as Record<string, string> | undefined;
  if (defines !== undefined && defines !== null) {
    let declared = '';
    for (const name of Object.keys(defines).sort())
      declared += `${declared === '' ? '' : '+'}${name}=${defines[name]}`;
    if (declared !== '') add(`defines:${declared}`);
  }

  if (cacheKey !== '') add(`inject:${cacheKey}`);
  return key;
}

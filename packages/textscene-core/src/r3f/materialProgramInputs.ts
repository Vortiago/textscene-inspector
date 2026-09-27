/**
 * `materialProgramInputs()`: a material's props and its React `key` from one
 * merged object. three bakes slot presence and `defines` into the program at
 * first compile, so the key remounts a material whose program inputs change.
 * A bare `:NNN` cites three 0.185.1's `WebGLPrograms.js`, where identity is decided.
 */
import * as THREE from 'three';

/** The subset of three's `onBeforeCompile` argument an injection may touch. */
export interface ProgramShader {
  vertexShader: string;
  fragmentShader: string;
  uniforms: Record<string, THREE.IUniform>;
}

/**
 * A shader patch and the cache-key contribution that identifies it, as one
 * value. `WebGLPrograms` does not key on `onBeforeCompile`, and three offers one
 * `customProgramCacheKey` slot, so the factory concatenates every injection's key.
 */
export interface ProgramInjection {
  /** Distinguishes this patched program from an unpatched one. */
  readonly cacheKey: string;
  readonly onBeforeCompile: (shader: ProgramShader) => void;
}

/**
 * What the factory owns, intersected with a caller's bag: a constraint would
 * excess-check every material prop away and reject `CanvasItemFacing` as a weak
 * type. `onBeforeCompile` and `customProgramCacheKey` are banned so `injection`
 * is the only route in.
 */
export interface MaterialProgramBag {
  key?: never;
  onBeforeCompile?: never;
  customProgramCacheKey?: never;
  injection?: ProgramInjection;
}

/**
 * What the factory adds when anything was injected, and omits when nothing was.
 * Exported so a module can write down the type of an exported `MaterialProgram`.
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
 * The finished pair. `props` is the merged input type: one wide material-params
 * type compiles, since TypeScript does not excess-check a spread variable, and
 * then splats mesh-only props onto a `lineBasicMaterial` at runtime.
 */
export interface MaterialProgram<P> {
  /**
   * `<meshBasicMaterial key={program.key} {...program.props} />`, never inside `props`:
   * React 19 lets a spread `config.key` overwrite the explicit `key=`
   * (`react/cjs/react-jsx-runtime.development.js:242-245`).
   */
  readonly key: string;
  readonly props: P;
}

/**
 * The `> 0` feature booleans (`:140-145`), each its own layer bit: a slider inside
 * the band stays a uniform and a crossing rebuilds, which the element-type switch
 * misses when a second feature holds the upgrade.
 */
const PHYSICAL_FEATURES = [
  'clearcoat',
  'sheen',
  'anisotropy',
  'transmission',
  'iridescence',
  'dispersion',
  // three 0.186.0 added this one: `material.retroreflectivity > 0` at `WebGLPrograms.js:143`,
  // layer bit 24 at `:541-542`.
  'retroreflectivity',
] as const;

type PhysicalFeature = (typeof PHYSICAL_FEATURES)[number];

/**
 * Every `!! material.<slot>` presence term, keyed as its `…MapUv` term
 * (`:444-466`), with the feature three also requires (`:147-169`) or `null`. One
 * table, so no slot is added without its gate decided. It lists what three bakes,
 * bound here or not.
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
  /** Mapped rather than intersected whole, so the tuple and its order survive. */
  merge?: { [Part in keyof M]: (M[Part] & MaterialProgramBag) | undefined };
}): MaterialProgram<Omit<P & Merged<M>, 'injection'> & InjectedProps> {
  const injections: ProgramInjection[] = [];
  // Merged here, not at the call site: the last writer wins, and
  // `canvasItemLighting.ts` forces `transparent: true`, so a key from the site's
  // own value would describe a material that does not exist.
  const merged: Record<string, unknown> = {};

  // Copied wholesale and stripped once below, rather than rest-destructured per
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
    // `undefined` rather than `delete`: fiber 9.6.1's `applyProps` skips an
    // undefined value (`:24-27`, "Ignore setting undefined props"), and deleting
    // deoptimises the object it is handed.
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

  // A key rather than `needsUpdate`: `applyProps` never bumps it, and `setProgram`
  // re-derives only on a `version` move or its own re-check list, which a new map
  // or define is not on. A define that stops applying cannot even be cleared,
  // since `applyProps` skips `undefined`. The remount compiles the finished set.
  return {
    key: programKey(merged, cacheKey),
    props: merged as Omit<P & Merged<M>, 'injection'> & InjectedProps,
  };
}

/**
 * One thunk per composed contribution, a handful of module literals. A fresh
 * closure per render recompiles nothing, since `applyProps` never bumps
 * `needsUpdate`, but it would overwrite the stable function `useCanvasItemLighting`
 * memoises.
 */
const CACHE_KEY_THUNKS = new Map<string, (this: THREE.Material) => string>();

function cacheKeyThunk(cacheKey: string): () => string {
  const existing = CACHE_KEY_THUNKS.get(cacheKey);
  if (existing) return existing;
  // A method, not an arrow, since it reads the material three calls it on. This own property
  // shadows the prototype key, so it appends that key whatever extends it (`applyToneMapping`
  // adds the curve term), read per call as a later patch replaces it.
  const thunk = function (this: THREE.Material): string {
    return cacheKey + THREE.Material.prototype.customProgramCacheKey.call(this);
  };
  CACHE_KEY_THUNKS.set(cacheKey, thunk);
  return thunk;
}

/**
 * Composed strings only: a patch's function identity never enters the key. Not
 * keyed, as `setProgram` re-checks them: `clippingPlanes` (`:354`, `WebGLRenderer.js:2456-2458`),
 * and `envMap`, `vertexAlphas`, `vertexTangents`, scene `fog` and tone mapping
 * (`WebGLRenderer.js:2390-2494`).
 */
function programKey(props: Record<string, unknown>, cacheKey: string): string {
  let key = '';
  /**
   * Every term is labelled and `|`-separated, so an absent one reads "at its
   * default" while no `defines` value or `cacheKey` holds a `|`. An empty key is
   * fine: it separates a material from its own past self, not from its siblings.
   */
  const add = (term: string): void => {
    key = key === '' ? term : `${key}|${term}`;
  };
  const active = (name: string): boolean => Number(props[name] ?? 0) > 0;

  const alphaToCoverage = props.alphaToCoverage === true;
  const blending = props.blending ?? THREE.NormalBlending;
  // The `opaque` composite (`:262`, one boolean at `:581`), as its negation so the
  // opaque default costs no token. `blending` enters only here, so on a transparent
  // material it is per-draw GL state. `alphaToCoverage` is also its own term (`:213`,
  // layer `:589`).
  if (props.transparent === true || blending !== THREE.NormalBlending || alphaToCoverage)
    add('blended');
  if (alphaToCoverage) add('a2c');
  // `alphaHash` (`:172`, published `:266`) is a plain field (`Material.js:134`).
  // `alphaTest` (`:170`) is not keyed: its `> 0` crossing bumps `version` itself
  // (`Material.js:494-502`).
  if (props.alphaHash === true) add('ahash');
  // `side` (`:369-370`) has one default across material types, so it is normalised.
  // `combine` (`:268`) and `fog` (`:314`) do not. Also keyed: `vertexColors` (`:308`),
  // `premultipliedAlpha` (`:367`), `dithering` (`:357`).
  const side = props.side ?? THREE.FrontSide;
  if (side !== THREE.FrontSide) add(`side:${String(side)}`);
  if (props.vertexColors === true) add('vcol');
  if (props.premultipliedAlpha === true) add('premul');
  if (props.combine !== undefined) add(`combine:${String(props.combine)}`);
  if (props.dithering === true) add('dither');
  if (props.fog !== undefined) add(`fog:${String(props.fog)}`);
  // `:317`, first arm only: the second reads geometry and the material's brand,
  // out of reach like `vertexAlphas`. `wireframe` alone reaches only this and the
  // `bumpMap` term (`:132`), whose slot is in `NOT_BOUND_TEXTURE_SLOTS`.
  if (props.flatShading === true && props.wireframe !== true) add('flat');

  let features = '';
  for (const feature of PHYSICAL_FEATURES)
    if (active(feature)) features += features === '' ? feature : `+${feature}`;
  if (features !== '') add(`feat:${features}`);

  // Presence only: a swapped texture compiles to the same program. The one
  // identity-dependent term, `decodeVideoTexture` (`:364`), cannot fire: no map is a
  // `THREE.VideoTexture`, and `canvas2DTextureDecode.ts` retags canvas maps `NoColorSpace`.
  let slots = '';
  for (const [slot, gate] of TEXTURE_SLOT_ENTRIES) {
    if (!props[slot]) continue;
    if (gate !== null && !active(gate)) continue;
    slots += slots === '' ? slot : `+${slot}`;
  }
  if (slots !== '') add(`slots:${slots}`);

  // Keys and values both (`:415-420`).
  const defines = props.defines as Record<string, string> | undefined;
  if (defines !== undefined && defines !== null) {
    let declared = '';
    for (const name of Object.keys(defines).sort())
      declared += `${declared === '' ? '' : '+'}${name}=${defines[name]}`;
    if (declared !== '') add(`defines:${declared}`);
  }

  // The injections' part of `customProgramCacheKey()` (`:382`, pushed at `:432`). Its curve term
  // stays out: a curve swap marks the material dirty, which compiles it without a remount.
  if (cacheKey !== '') add(`inject:${cacheKey}`);
  return key;
}

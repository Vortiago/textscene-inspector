/**
 * Upgrade guard: a program hazard is the fields `WebGLPrograms.getParameters()`
 * reads, minus what `WebGLRenderer.setProgram()` re-checks every draw, minus the
 * `Material.js` accessors that bump `version`. An upgrade can move any of the
 * three lists, so all three are pinned and diffed.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { materialProgramInputs } from './materialProgramInputs';

const resolve = createRequire(import.meta.url).resolve;

// three's exports map exposes `"./src/*"`: the unminified modules keep the
// section boundaries the bundled `dist` renames away.
function threeSource(path: string): string {
  return readFileSync(resolve(`three/src/${path}`), 'utf8');
}

/**
 * The slice between two anchors. Throws on a missing anchor: `String#search`
 * answers -1, which yields the rest of the file and a parse that matches everything.
 */
function section(source: string, where: string, start: RegExp, end: RegExp): string {
  const from = source.search(start);
  if (from < 0) throw new Error(`${where}: three moved ${String(start)} — re-anchor this parse`);
  const to = source.slice(from).search(end);
  if (to < 0) throw new Error(`${where}: three moved ${String(end)} — re-anchor this parse`);
  return source.slice(from, from + to);
}

/** Distinct capture-1 matches, sorted: the shape every list here is compared in. */
function names(source: string, pattern: RegExp): string[] {
  return [...new Set([...source.matchAll(pattern)].map((match) => match[1]!))].sort();
}

/** The `getParameters()` source, where every presence term and feature boolean is read. */
function getParametersSource(): string {
  return section(
    threeSource('renderers/webgl/WebGLPrograms.js'),
    'WebGLPrograms.getParameters',
    /function getParameters\(/,
    /\n\tfunction getProgramCacheKey\(/
  );
}

/** Every `material.<field>` `getParameters()` reads while deciding a program's identity. */
function bakedMaterialFields(): string[] {
  return names(getParametersSource(), /material\.([A-Za-z0-9_]+)/g);
}

/**
 * Every `materialProperties.<name>` the `needsProgramChange` cascade compares:
 * the state `setProgram` re-derives a program for without a version bump.
 */
function recheckedParameters(): string[] {
  const source = section(
    threeSource('renderers/WebGLRenderer.js'),
    'WebGLRenderer.setProgram',
    /let needsProgramChange = false;/,
    /materialProperties\.__version = material\.version;/
  );
  return names(source, /materialProperties\.([A-Za-z0-9_]+)/g);
}

/** Every `Material.js` setter that bumps `version`, so its field re-derives on its own. */
function versionBumpingAccessors(): string[] {
  const source = threeSource('materials/Material.js');
  const setters = [
    ...source.matchAll(/\bset\s+([A-Za-z0-9_]+)\s*\(\s*[A-Za-z0-9_]*\s*\)\s*\{([\s\S]*?)\n\t\}/g),
  ];
  return [
    ...new Set(setters.filter(([, , body]) => /this\.version\s*\+\+/.test(body!)).map(([, name]) => name!)),
  ].sort();
}

/** Every field a three material constructs as `null`: the texture slots, whatever their name. */
function nullDefaultFields(): Set<string> {
  const fields = new Set<string>();
  for (const Constructor of Object.values(THREE)) {
    if (typeof Constructor !== 'function' || !(Constructor.prototype instanceof THREE.Material)) continue;
    const material = new (Constructor as new () => THREE.Material)();
    for (const [field, value] of Object.entries(material)) if (value === null) fields.add(field);
  }
  return fields;
}

/** Every `!! material.<slot>` presence term three bakes and `setProgram` does not re-check. */
function bakedTextureSlots(): string[] {
  const textures = nullDefaultFields();
  return names(getParametersSource(), /!!\s*material\.([A-Za-z0-9_]+)/g).filter(
    (field) => textures.has(field) && !RECHECKED_PARAMETERS.includes(field)
  );
}

/** Every `material.<feature> > 0` boolean crossed, so a slot gated on any feature can key. */
function everyFeatureActive(): Record<string, number> {
  const features = names(getParametersSource(), /material\.([A-Za-z0-9_]+)\s*>\s*0/g);
  return Object.fromEntries(features.map((feature) => [feature, 1]));
}

/** Whether binding `slot` moves the program key of a material with every feature active. */
function keysSlot(slot: string): boolean {
  const features = everyFeatureActive();
  const bare = materialProgramInputs({ props: features }).key;
  return materialProgramInputs({ props: { ...features, [slot]: new THREE.Texture() } }).key !== bare;
}

/**
 * A texture slot three bakes that `materialProgramInputs` declines to key, and why.
 * The upgrade guard requires every baked slot to key or be here, so a slot cannot
 * go missing by omission.
 */
const DECLINED_TEXTURE_SLOTS: Readonly<Record<string, string>> = {
  bumpMap:
    'Godot binds no bump slot; three reads the term as `!!bumpMap && wireframe === false` (`:132`), so modelling it would key `wireframe` for a slot nothing can fill',
};

/** three 0.186.0, `WebGLPrograms.js:56-400`. Every field the program's identity is decided from. */
const BAKED_MATERIAL_FIELDS = [
  'alphaHash',
  'alphaMap',
  'alphaTest',
  'alphaToCoverage',
  'anisotropy',
  'anisotropyMap',
  'aoMap',
  'blending',
  'bumpMap',
  'clearcoat',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'combine',
  'customProgramCacheKey',
  'defines',
  'depthPacking',
  'dispersion',
  'displacementMap',
  'dithering',
  'emissiveMap',
  'envMap',
  'extensions',
  'flatShading',
  'fog',
  'fragmentShader',
  'glslVersion',
  'gradientMap',
  'index0AttributeName',
  'iridescence',
  'iridescenceMap',
  'iridescenceThicknessMap',
  'isMeshLambertMaterial',
  'isMeshPhongMaterial',
  'isMeshPhysicalMaterial',
  'isMeshStandardMaterial',
  'isRawShaderMaterial',
  'lightMap',
  'map',
  'matcap',
  'metalnessMap',
  'name',
  'normalMap',
  'normalMapType',
  'precision',
  'premultipliedAlpha',
  'retroreflectivity',
  'roughnessMap',
  'sheen',
  'sheenColorMap',
  'sheenRoughnessMap',
  'side',
  'sizeAttenuation',
  'specularColorMap',
  'specularIntensityMap',
  'specularMap',
  'thicknessMap',
  'toneMapped',
  'transmission',
  'transmissionMap',
  'transparent',
  'type',
  'vertexColors',
  'vertexShader',
  'wireframe',
];

/**
 * three 0.185.1, `WebGLRenderer.js:2388-2494`. A drift detector, not a proof: this
 * `fog` is the scene's, re-checked only while `material.fog === true`, yet name
 * matching subtracts it. The factory keys `fog` anyway, which costs nothing.
 */
const RECHECKED_PARAMETERS = [
  '__version',
  'batching',
  'batchingColor',
  'envMap',
  'fog',
  'instancing',
  'instancingColor',
  'instancingMorph',
  'lightProbeGrid',
  'lightsStateVersion',
  'morphColors',
  'morphNormals',
  'morphTargets',
  'morphTargetsCount',
  'needsLights',
  'numClippingPlanes',
  'numIntersection',
  'outputColorSpace',
  'skinning',
  'toneMapping',
  'vertexAlphas',
  'vertexTangents',
];

/**
 * three 0.185.1, `Material.js:494-502` and `:1204-1208`. Subclass accessors are
 * not subtracted: `MeshPhysicalMaterial.js`'s six `> 0` crossings bump nothing on a
 * `<meshStandardMaterial>`, which is why `PHYSICAL_FEATURES` is keyed.
 */
const VERSION_BUMPING_ACCESSORS = ['alphaTest', 'needsUpdate'];

function drift(expected: readonly string[], actual: readonly string[]): string {
  const added = actual.filter((name) => !expected.includes(name));
  const removed = expected.filter((name) => !actual.includes(name));
  return `three added [${added.join(', ')}] and removed [${removed.join(', ')}]`;
}

/**
 * The three pinned lists, each with the floor that proves its parse matched
 * something. The floor catches an empty parse, the diff catches drift, and the
 * hint makes a failure actionable.
 */
const PINNED_LISTS = [
  {
    name: 'bakes the recorded material fields into a program',
    read: bakedMaterialFields,
    expected: BAKED_MATERIAL_FIELDS,
    floor: 40,
    hint: 'an ADDED field is a new program input materialProgramInputs() may have to key',
  },
  {
    name: 're-checks the recorded parameters on its own every draw',
    read: recheckedParameters,
    expected: RECHECKED_PARAMETERS,
    floor: 15,
    hint: 'a REMOVED re-check turns a field materialProgramInputs.ts documents as safe into a hazard',
  },
  {
    name: 'bumps `version` from the recorded accessors',
    read: versionBumpingAccessors,
    expected: VERSION_BUMPING_ACCESSORS,
    floor: 2,
    hint: 'a REMOVED accessor stops re-deriving a field for us',
  },
] as const;

describe('material program hazards, against three itself', () => {
  it('resolves three from source, not from the bundled dist', () => {
    expect(resolve('three/src/renderers/webgl/WebGLPrograms.js')).toMatch(
      /three\/src\/renderers\/webgl\/WebGLPrograms\.js$/
    );
  });

  it.each(PINNED_LISTS)('$name', ({ read, expected, floor, hint }) => {
    const actual = read();
    expect(actual.length).toBeGreaterThanOrEqual(floor);
    expect(actual, `${drift(expected, actual)} — ${hint}`).toEqual(expected);
  });

  it('keys every texture slot three bakes, or declines it', () => {
    // A slot three reads that `materialProgramInputs` neither keys nor declines
    // misses a program input the first time anything binds it.
    const slots = bakedTextureSlots();
    const unowned = slots.filter((slot) => DECLINED_TEXTURE_SLOTS[slot] === undefined && !keysSlot(slot));

    expect(slots.length).toBeGreaterThanOrEqual(20);
    expect(
      unowned,
      `three bakes these slots and the factory neither keys nor declines them: add each to TEXTURE_SLOT_GATES in materialProgramInputs.ts with the feature it is gated on, or to DECLINED_TEXTURE_SLOTS here with the reason: ${unowned.join(', ')}`
    ).toEqual([]);
  });

  it('keys no slot it declines, and declines only slots three bakes', () => {
    const slots = bakedTextureSlots();
    const stale = Object.keys(DECLINED_TEXTURE_SLOTS).filter(
      (slot) => !slots.includes(slot) || keysSlot(slot)
    );

    expect(stale, `remove these from DECLINED_TEXTURE_SLOTS: ${stale.join(', ')}`).toEqual([]);
  });

  it('fails loudly when an anchor moves, rather than matching the rest of the file', () => {
    expect(() => section('const a = 1;', 'probe', /never appears/, /\n/)).toThrow(/re-anchor/);
    expect(() => section('const a = 1;', 'probe', /const/, /never appears/)).toThrow(/re-anchor/);
  });
});

/**
 * Upgrade guard: what `materialProgramInputs()` has to key is decided by three
 * lists inside three, and all three are pinned here.
 *
 * The hazard — a material field that bakes into the program SOURCE and never
 * re-derives — is a SUBTRACTION:
 *
 *   fields `WebGLPrograms.getParameters()` reads off the material
 *     MINUS what `WebGLRenderer.setProgram()` re-checks on its own every draw
 *     MINUS the accessors in `Material.js` that bump `material.version`
 *
 * Pinning only the first list would be a trap. An upgrade that DELETES a
 * re-check, or drops a version-bumping accessor, silently promotes a field
 * `materialProgramInputs.ts` has documented as safe into a hazard — while a
 * `getParameters`-only diff stays green, because `getParameters` did not
 * change. So all three are read, and all three are diffed.
 *
 * This is a DRIFT detector, not a proof. The lists speak different
 * vocabularies: `getParameters` reads `material.fog` and publishes it as
 * `useFog`, while `setProgram` re-checks `materialProperties.fog` — the SCENE's
 * fog object, and only while `material.fog === true`, so flipping the material
 * flag off re-derives nothing. Name-matching subtracts `fog` anyway. The
 * factory keys it regardless, which is the direction that costs nothing.
 *
 * The subtraction stops at `Material.js` and does NOT follow subclass
 * accessors, though `MeshPhysicalMaterial.js` has six more of them (the `> 0`
 * crossings of `anisotropy`, `clearcoat`, `iridescence`, `dispersion`, `sheen`,
 * `transmission`). Whether such a field self-heals depends on which CLASS the
 * props land on: `getParameters` reads `material.transmission > 0` whatever the
 * material is, and `<meshStandardMaterial>` has no setter to bump anything. A
 * key derived from a bag has to hold for whichever tag receives it, so a
 * subclass accessor cannot be subtracted — which is why `PHYSICAL_FEATURES`
 * being keyed is correct rather than merely harmless.
 *
 * three ships unminified ES source and its exports map exposes `"./src/*"`, so
 * these read the real modules rather than the bundled `dist`, where the section
 * boundaries below have been renamed away.
 */
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const resolve = createRequire(import.meta.url).resolve;

function threeSource(path: string): string {
  return readFileSync(resolve(`three/src/${path}`), 'utf8');
}

/**
 * The slice between two anchors. THROWS on a missing anchor: `String#search`
 * answers -1, which would silently yield the rest of the file — a parse that
 * matches everything, floors that pass, and a diff full of noise.
 */
function section(source: string, where: string, start: RegExp, end: RegExp): string {
  const from = source.search(start);
  if (from < 0) throw new Error(`${where}: three moved ${String(start)} — re-anchor this parse`);
  const to = source.slice(from).search(end);
  if (to < 0) throw new Error(`${where}: three moved ${String(end)} — re-anchor this parse`);
  return source.slice(from, from + to);
}

/** Distinct capture-1 matches, sorted — the shape every list here is compared in. */
function names(source: string, pattern: RegExp): string[] {
  return [...new Set([...source.matchAll(pattern)].map((match) => match[1]!))].sort();
}

/** Every `material.<field>` `getParameters()` reads while deciding a program's identity. */
function bakedMaterialFields(): string[] {
  const source = section(
    threeSource('renderers/webgl/WebGLPrograms.js'),
    'WebGLPrograms.getParameters',
    /function getParameters\(/,
    /\n\tfunction getProgramCacheKey\(/
  );
  return names(source, /material\.([A-Za-z0-9_]+)/g);
}

/**
 * Every `materialProperties.<name>` the `needsProgramChange` cascade compares —
 * the state `setProgram` re-derives a program for WITHOUT a version bump.
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
  const setters = [...source.matchAll(/\bset\s+([A-Za-z0-9_]+)\s*\(\s*[A-Za-z0-9_]*\s*\)\s*\{([\s\S]*?)\n\t\}/g)];
  return [...new Set(setters.filter(([, , body]) => /this\.version\s*\+\+/.test(body!)).map(([, name]) => name!))].sort();
}

/** three 0.185.1, `WebGLPrograms.js:60-382`. Every field the program's identity is decided from. */
const BAKED_MATERIAL_FIELDS = [
  'alphaHash', 'alphaMap', 'alphaTest', 'alphaToCoverage', 'anisotropy', 'anisotropyMap',
  'aoMap', 'blending', 'bumpMap', 'clearcoat', 'clearcoatMap', 'clearcoatNormalMap',
  'clearcoatRoughnessMap', 'combine', 'customProgramCacheKey', 'defines', 'depthPacking',
  'dispersion', 'displacementMap', 'dithering', 'emissiveMap', 'envMap', 'extensions',
  'flatShading', 'fog', 'fragmentShader', 'glslVersion', 'gradientMap', 'index0AttributeName',
  'iridescence', 'iridescenceMap', 'iridescenceThicknessMap', 'isMeshLambertMaterial',
  'isMeshPhongMaterial', 'isMeshPhysicalMaterial', 'isMeshStandardMaterial',
  'isRawShaderMaterial', 'lightMap', 'map', 'matcap', 'metalnessMap', 'name', 'normalMap',
  'normalMapType', 'precision', 'premultipliedAlpha', 'roughnessMap', 'sheen', 'sheenColorMap',
  'sheenRoughnessMap', 'side', 'sizeAttenuation', 'specularColorMap', 'specularIntensityMap',
  'specularMap', 'thicknessMap', 'toneMapped', 'transmission', 'transmissionMap', 'transparent',
  'type', 'vertexColors', 'vertexShader', 'wireframe',
];

/** three 0.185.1, `WebGLRenderer.js:2388-2494`. What re-derives without a version bump. */
const RECHECKED_PARAMETERS = [
  '__version', 'batching', 'batchingColor', 'envMap', 'fog', 'instancing', 'instancingColor',
  'instancingMorph', 'lightProbeGrid', 'lightsStateVersion', 'morphColors', 'morphNormals',
  'morphTargets', 'morphTargetsCount', 'needsLights', 'numClippingPlanes', 'numIntersection',
  'outputColorSpace', 'skinning', 'toneMapping', 'vertexAlphas', 'vertexTangents',
];

/** three 0.185.1, `Material.js:494-502` and `:1204-1208`. What bumps `version` for us. */
const VERSION_BUMPING_ACCESSORS = ['alphaTest', 'needsUpdate'];

function drift(expected: readonly string[], actual: readonly string[]): string {
  const added = actual.filter((name) => !expected.includes(name));
  const removed = expected.filter((name) => !actual.includes(name));
  return `three added [${added.join(', ')}] and removed [${removed.join(', ')}]`;
}

describe('material program hazards, against three itself', () => {
  it('resolves three from source, not from the bundled dist', () => {
    expect(resolve('three/src/renderers/webgl/WebGLPrograms.js')).toMatch(/three\/src\/renderers\/webgl\/WebGLPrograms\.js$/);
  });

  it('bakes the recorded material fields into a program', () => {
    const actual = bakedMaterialFields();
    expect(
      actual,
      `${drift(BAKED_MATERIAL_FIELDS, actual)} — an ADDED field is a new program input materialProgramInputs() may have to key`
    ).toEqual(BAKED_MATERIAL_FIELDS);
  });

  it('re-checks the recorded parameters on its own every draw', () => {
    const actual = recheckedParameters();
    expect(
      actual,
      `${drift(RECHECKED_PARAMETERS, actual)} — a REMOVED re-check turns a field materialProgramInputs.ts documents as safe into a hazard`
    ).toEqual(RECHECKED_PARAMETERS);
  });

  it('bumps `version` from the recorded accessors', () => {
    const actual = versionBumpingAccessors();
    expect(
      actual,
      `${drift(VERSION_BUMPING_ACCESSORS, actual)} — a REMOVED accessor stops re-deriving a field for us`
    ).toEqual(VERSION_BUMPING_ACCESSORS);
  });

  it('parses something from each of the three, so a broken parse cannot pass as agreement', () => {
    // Floors well under today's counts: the floor catches "the parse matched
    // nothing", the diffs above catch drift. Two jobs, two assertions.
    expect(bakedMaterialFields().length).toBeGreaterThanOrEqual(40);
    expect(recheckedParameters().length).toBeGreaterThanOrEqual(15);
    expect(versionBumpingAccessors().length).toBeGreaterThanOrEqual(2);
  });

  it('fails loudly when an anchor moves, rather than matching the rest of the file', () => {
    expect(() => section('const a = 1;', 'probe', /never appears/, /\n/)).toThrow(/re-anchor/);
    expect(() => section('const a = 1;', 'probe', /const/, /never appears/)).toThrow(/re-anchor/);
  });
});

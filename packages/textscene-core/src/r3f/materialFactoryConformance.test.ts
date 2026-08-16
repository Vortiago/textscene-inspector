/**
 * Structural ban: a program input reaches a material through
 * `materialProgramInputs()` or it does not reach one at all.
 *
 * three bakes texture-slot presence, `defines`, `side`, `transparent` and the
 * rest of `WebGLPrograms.getParameters()` into the program SOURCE at a
 * material's first compile, and re-derives only on a `material.version` move or
 * for the short list `setProgram` re-checks itself. Assigning such a prop
 * afterwards changes the material and not the shader, silently and permanently
 * — `materialProgramInputs.ts` has the whole account. The factory is the only
 * thing in this codebase that derives a React `key` from the finished merged
 * bag, so a material built any other way has no defence.
 *
 * WHY THE TAG ITSELF IS THE UNIT, and not "a tag that names a program input":
 * a canvas material is assembled from spreads — `{...blend}`, `{...facing}`,
 * `{...lighting}`, `{...props}` — and a spread NAMES NOTHING. The very case
 * that matters is the one a name-based scan is blind to. So the legal spelling
 * is fixed instead:
 *
 *     <meshBasicMaterial key={program.key} {...program.props} />
 *
 * one identifier, used twice. Anything else is an offence, including
 * `key={a.key} {...b.props}` — a key derived from a bag other than the one
 * being spread describes a material that does not exist, which is the exact
 * failure the factory's merge exists to make unspellable.
 *
 * This scan takes NO per-line opt-out. A tag is three tokens long; an escape
 * hatch on it would be an escape hatch on the whole rule.
 *
 * TEST FILES ARE DELIBERATELY OUT OF SCOPE. Dozens of them construct materials
 * or render material JSX directly to drive an assertion, and routing those
 * through the factory would couple every material assertion to the thing under
 * test — a suite that can only observe what the factory already agrees with.
 *
 * The imperative half (`new THREE.…Material(`) carries a NAMED-FILE exemption
 * list instead, because a handful of sites genuinely cannot suffer the defect:
 * each either constructs a fresh material on every input change or never
 * mutates one. Each entry states which, and an entry that stops matching fails
 * this file rather than lingering.
 */
import { describe, expect, it } from 'vitest';
import {
  isCommentLine,
  isProductionSource,
  offendingLines,
  repoPath,
  repoRoot,
  reportOffenders,
  walkSources,
} from './testing/sourceScan';

/** The whole repo's own source. `scripts/` counts: it renders too. */
const SCANNED_ROOTS = ['apps', 'packages', 'scripts'];
const SOURCES = walkSources(
  SCANNED_ROOTS.map((dir) => repoRoot(dir)),
  isProductionSource
);

/** Any R3F material element — `meshBasicMaterial`, `shaderMaterial`, `pointsMaterial`, … */
const MATERIAL_TAG = /<[a-z][A-Za-z0-9]*Material(?![A-Za-z0-9])/;

/**
 * The one legal spelling, whitespace-collapsed. The two identifiers are
 * captured separately so the caller can require them EQUAL.
 */
const FACTORY_TAG =
  /^<[a-z][A-Za-z0-9]*Material key=\{([A-Za-z0-9_$.]+)\.key\} \{\.\.\.([A-Za-z0-9_$.]+)\.props\} \/>$/;

/** Every material element in the file, as `{ line, tag }` with the tag collapsed to one line. */
function materialTags(source: string): { line: number; tag: string }[] {
  const lines = source.split('\n');
  const tags: { line: number; tag: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (isCommentLine(lines[i]!)) continue;
    // Suffix-only strip, so the match index still addresses the raw line below.
    const start = lines[i]!.replace(/\/\/.*$/, '').search(MATERIAL_TAG);
    if (start < 0) continue;

    // The tag runs to its own closing `>`, which is NOT simply the first one on
    // the line: a prop value may hold a `>`, and the tag may not start (or end)
    // at a line boundary — `return <meshStandardMaterial … />;` is both.
    let text = '';
    let end = -1;
    for (let j = i; j < lines.length && end < 0; j++) {
      text += (j > i ? '\n' : '') + lines[j];
      end = tagEnd(text, start);
    }
    if (end < 0) continue;
    tags.push({ line: i + 1, tag: text.slice(start, end).replace(/\s+/g, ' ') });
  }
  return tags;
}

/** Index just past the tag's own `>`, tracking `{…}` so a prop value cannot close it. Or -1. */
function tagEnd(text: string, start: number): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (char === '{') depth++;
    else if (char === '}') depth--;
    else if (char === '>' && depth === 0) return i + 1;
  }
  return -1;
}

/** Material elements that do not take their key and their props from ONE factory result. */
export function rawMaterialTagLines(source: string): number[] {
  return materialTags(source)
    .filter(({ tag }) => {
      const factory = FACTORY_TAG.exec(tag);
      return !factory || factory[1] !== factory[2];
    })
    .map(({ line }) => line);
}

/** `new THREE.SomethingMaterial(` — the imperative door. */
const MATERIAL_CONSTRUCTOR = /\bnew\s+(?:THREE\.)?[A-Za-z0-9_]*Material\s*\(/;

export function materialConstructorLines(source: string): number[] {
  return offendingLines(source, MATERIAL_CONSTRUCTOR);
}

/**
 * Files allowed to construct a material imperatively, each with the reason it
 * cannot suffer the defect — a fresh material per input change, or one that is
 * never mutated. Verified individually; a file that stops constructing one at
 * all fails the staleness check below rather than sitting here forever.
 *
 * `canvasItemFacing.ts` is absent on purpose: its `new THREE.ShaderMaterial({…})`
 * is inside a doc comment, and the comment guard already sees that.
 */
const IMPERATIVE_EXEMPTIONS: Readonly<Record<string, string>> = {
  'packages/textscene-core/src/nodes/3d/decal/Component.tsx':
    'rebuilt by the effect that rebuilds the projection meshes; the only later write is `opacity`, which no program parameter reads',
  'packages/textscene-core/src/nodes/3d/gridmap/Component.tsx':
    'module-constant fallback tile material, literal-only, never mutated and never disposed',
  'packages/textscene-core/src/r3f/controls/native/text/canvasTextPainter.ts':
    'one material per built text run, replaced and disposed together with its geometry; its single `defines` write happens before the material has ever been rendered',
  'packages/textscene-core/src/r3f/controls/native/text/msdfMaterial.ts':
    'one material per built text run; the glyph atlas travels as a uniform, so re-laying-out a run moves no program input',
  'packages/textscene-core/src/r3f/csg/evaluateCsgPlan.ts':
    'per-surface sentinels handed to the CSG library so it can group faces — never rendered, so never compiled',
  'packages/textscene-core/src/r3f/environment/GodotGlowEffect.ts':
    'the glow pyramid passes: shaders fixed at construction, only uniforms move, disposed with the effect',
  'packages/textscene-core/src/r3f/lighting2d/CanvasLighting2D.tsx':
    'the accumulator seed quad: fixed shaders, one uniform, one instance per accumulator',
  'packages/textscene-core/src/r3f/lighting2d/lightQuad.ts':
    'one material per light per parameter set, memoised on every input including the shadow `defines` and disposed on replacement',
  'packages/textscene-core/src/resources/sky/build.ts':
    'built once per sky, consumed by a single cube render, disposed with the environment',
  'packages/textscene-core/src/resources/materials/standardmaterial3d/build.ts':
    'the imperative half of the resource pipeline: every texture is already resolved before it is called, so the material is constructed complete',
  'packages/textscene-core/src/resources/materials/standardmaterial3d/loadMaterial.ts':
    'the uncompiled-shader fallback, literal-only',
};

const CONSTRUCTOR_SITES = SOURCES.map(({ file, source }) => ({
  file,
  lines: materialConstructorLines(source),
})).filter(({ lines }) => lines.length > 0);

describe('Material factory conformance', () => {
  it('writes no material element outside the factory spelling', () => {
    const offenders = reportOffenders(SOURCES, rawMaterialTagLines);

    expect(
      offenders,
      `a program input assigned to a mounted material never reaches the shader — take both halves from materialProgramInputs(): <someMaterial key={program.key} {...program.props} />: ${offenders.join(', ')}`
    ).toEqual([]);
  });

  it('constructs no material imperatively outside the named exemptions', () => {
    const offenders = CONSTRUCTOR_SITES.filter(
      ({ file }) => IMPERATIVE_EXEMPTIONS[repoPath(file)] === undefined
    ).flatMap(({ file, lines }) => lines.map((line) => `${repoPath(file)}:${line}`));

    expect(
      offenders,
      `an imperatively built material has no key to remount it — render it from materialProgramInputs(), or add it to IMPERATIVE_EXEMPTIONS with the reason it cannot go stale: ${offenders.join(', ')}`
    ).toEqual([]);
  });

  it('keeps no exemption that has stopped constructing a material', () => {
    const live = new Set(CONSTRUCTOR_SITES.map(({ file }) => repoPath(file)));
    const stale = Object.keys(IMPERATIVE_EXEMPTIONS).filter((file) => !live.has(file));

    expect(stale, `these exemptions no longer describe anything — drop them: ${stale.join(', ')}`).toEqual([]);
  });

  it('would catch a raw material element — the check is not vacuous', () => {
    expect(rawMaterialTagLines('  <meshBasicMaterial key={program.key} {...program.props} />')).toEqual([]);
    expect(rawMaterialTagLines('  return <meshStandardMaterial key={p.key} {...p.props} />;')).toEqual([]);
    expect(
      rawMaterialTagLines('  <lineBasicMaterial\n    key={NAV_EDGES.key}\n    {...NAV_EDGES.props}\n  />')
    ).toEqual([]);
    // The spread a name-based scan cannot see, which is the whole reason for this shape.
    expect(rawMaterialTagLines('  <meshBasicMaterial {...blend} />')).toEqual([1]);
    expect(rawMaterialTagLines('  <meshBasicMaterial {...program.props} />')).toEqual([1]);
    expect(rawMaterialTagLines('  <meshBasicMaterial color={fill} transparent />')).toEqual([1]);
    expect(rawMaterialTagLines('  <shaderMaterial args={[{ vertexShader: V }]} />')).toEqual([1]);
    // Two different bags: the key would describe a material that does not exist.
    expect(rawMaterialTagLines('  <meshBasicMaterial key={a.key} {...b.props} />')).toEqual([1]);
    // A prop value holding a `>` does not close the tag early.
    expect(rawMaterialTagLines('  <meshBasicMaterial visible={a > b} key={p.key} {...p.props} />')).toEqual([1]);
    expect(rawMaterialTagLines('  <meshBasicMaterialish key={p.key} {...p.props} />')).toEqual([]);
    expect(rawMaterialTagLines(' * `<meshBasicMaterial map={tex} />` in a comment is not a use')).toEqual([]);
    expect(rawMaterialTagLines('  <mesh /> // <meshBasicMaterial map={tex} /> in prose')).toEqual([]);
  });

  it('would catch an imperative construction — the check is not vacuous', () => {
    expect(materialConstructorLines('  const m = new THREE.MeshBasicMaterial({ map });')).toEqual([1]);
    expect(materialConstructorLines('  return new ShaderMaterial({ vertexShader });')).toEqual([1]);
    expect(materialConstructorLines('  const m = new THREE.MeshPhysicalMaterial();')).toEqual([1]);
    expect(materialConstructorLines('  const by = new Map<string, THREE.Material>();')).toEqual([]);
    expect(materialConstructorLines(' * `new THREE.ShaderMaterial({ ... })` in a comment is not a use')).toEqual([]);
    // No opt-out: only the named-file list exempts a construction.
    expect(materialConstructorLines('// safe: fresh every time\nnew THREE.MeshBasicMaterial();')).toEqual([2]);
  });

  it('reads the whole repo and finds both shapes, so neither scan can pass vacuously', () => {
    // The file walk — a scan that stops finding source proves nothing. Each
    // root is asserted separately: `packages/` alone would clear the floor, so
    // `apps/` or `scripts/` could drop out of the walk unnoticed.
    for (const dir of SCANNED_ROOTS) {
      expect(SOURCES.some(({ file }) => repoPath(file).startsWith(`${dir}/`)), dir).toBe(true);
    }
    expect(SOURCES.length).toBeGreaterThanOrEqual(1000);
    // The tag regex — if it stopped matching, "no offenders" would be silence.
    const tags = SOURCES.flatMap(({ source }) => materialTags(source));
    expect(tags.length).toBeGreaterThanOrEqual(30);
    // And the constructor regex, the same way.
    expect(CONSTRUCTOR_SITES.flatMap(({ lines }) => lines).length).toBeGreaterThanOrEqual(10);
  });
});

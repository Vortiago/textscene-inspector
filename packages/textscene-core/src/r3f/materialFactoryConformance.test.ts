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
 * A MATERIAL TAG IS NOT THE ONLY WAY TO MOUNT ONE, so the tag rule alone is a
 * gate with two doors left open — `<mesh material={m} />` hands the material
 * over as a prop, and `<primitive object={m} attach={a} />` is how every
 * external `.tres` reaches a mesh. Both are read too, and again by spelling:
 * a `material` prop (or a pierced `material-…` one) on a LOWER-CASE element,
 * where it is R3F's reconciler reading the props rather than a component of
 * ours; a spread on such an element, which could carry `material`, `object` or
 * `attach` and name none of them; and a `<primitive>` that does not name its
 * slot in a string literal — R3F derives a missing `attach` from the OBJECT
 * (`isMaterial`), not from the tag name, so `<primitive object={m} />` lands in
 * the material slot exactly as `attach="material"` would. These three carry a
 * named-file exemption list of their own, on the same terms as the imperative
 * one below.
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
import type { JsxTag } from './testing/sourceScan';
import {
  isProductionSource,
  jsxTags,
  offendingLines,
  repoPath,
  repoRoot,
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

/** Every material element in the file, each read to its own `>`. */
const materialTags = (source: string): JsxTag[] => jsxTags(source, MATERIAL_TAG);

/** The subset of already-read tags that does not take both halves from ONE factory result. */
function offendingTagLines(tags: readonly JsxTag[]): number[] {
  return tags
    .filter(({ tag }) => {
      const factory = FACTORY_TAG.exec(tag);
      return !factory || factory[1] !== factory[2];
    })
    .map(({ line }) => line);
}

/** Material elements that do not take their key and their props from ONE factory result. */
export function rawMaterialTagLines(source: string): number[] {
  return offendingTagLines(materialTags(source));
}

/**
 * A JSX element that could hold a material without ever writing a material tag.
 * Lower-case first letter, so it is R3F's reconciler that reads the props and
 * not a component of ours — a component's own body is scanned in its own turn.
 * Read even when the name ends the line: a multi-line element opens that way.
 */
const HOST_TAG = /<[a-z][A-Za-z0-9]*(?=[\s/>]|$)/;

/** The same shape anchored, to ask an already-read tag what it is. */
const MATERIAL_TAG_HEAD = new RegExp(`^${MATERIAL_TAG.source}`);
const PRIMITIVE_TAG_HEAD = /^<primitive(?![A-Za-z0-9])/;

/** `material={…}`, and the pierced `material-transparent={…}` that writes THROUGH one. */
const MATERIAL_PROP = /(?:^|\s)material(?:-[A-Za-z0-9-]+)?=/;
/** A spread names nothing, so nothing can be proven about what it carries. */
const SPREAD = /\{\.\.\./;
/** `attach="…"` — the only spelling that says WHICH slot a `<primitive>` lands in. */
const LITERAL_ATTACH = /(?:^|\s)attach="([^"]*)"/;

/** Which of the three an offence is — reported, and asserted still live below. */
type OffTagShape = 'material prop' | 'spread' | 'unslotted primitive';
const OFF_TAG_SHAPES: readonly OffTagShape[] = ['material prop', 'spread', 'unslotted primitive'];

/**
 * Whether a host element mounts a material by some spelling other than a
 * material tag.
 *
 * Three shapes, none of them a scan for a value's NAME:
 *   - a `material` prop (or a pierced `material-…` one) on the element itself,
 *     whatever the value is called;
 *   - a spread, which could carry `material`, `object` or `attach` and say so
 *     nowhere — the same blindness the tag rule above exists to close;
 *   - a `<primitive>` that does not name its slot in a string literal. R3F
 *     derives a missing `attach` from the OBJECT (`isMaterial`), not from the
 *     tag name, so `<primitive object={x} />` lands a material in the material
 *     slot exactly as `attach="material"` would, and a computed `attach={a}`
 *     is a slot this scan cannot read.
 */
function offTagShape(tag: string): OffTagShape | null {
  if (MATERIAL_TAG_HEAD.test(tag)) return null; // the factory spelling owns these
  if (MATERIAL_PROP.test(tag)) return 'material prop';
  if (SPREAD.test(tag)) return 'spread';
  if (!PRIMITIVE_TAG_HEAD.test(tag)) return null;
  const attach = LITERAL_ATTACH.exec(tag);
  return attach === null || attach[1]!.startsWith('material') ? 'unslotted primitive' : null;
}

export interface OffTagMount {
  readonly line: number;
  readonly shape: OffTagShape;
}

/** Host elements that could mount a material outside a material tag. One entry per element. */
export function offTagMounts(source: string): OffTagMount[] {
  return jsxTags(source, HOST_TAG).flatMap(({ line, tag }) => {
    const shape = offTagShape(tag);
    return shape ? [{ line, shape }] : [];
  });
}

/**
 * Files allowed to mount off-tag, each with the reason it cannot suffer the
 * defect: it mounts no material at all, or one that is fresh per input change.
 * Verified individually; a file that stops matching fails the staleness check
 * below rather than sitting here forever.
 */
const OFF_TAG_EXEMPTIONS: Readonly<Record<string, string>> = {
  'packages/textscene-core/src/nodes/2d/camera2d/Component.tsx':
    'spreads the shared Node2D transform bag onto a `<group>`, which has no material slot',
  'packages/textscene-core/src/nodes/2d/pathfollow2d/Component.tsx':
    'spreads the sampled curve transform onto a `<group>`, which has no material slot',
  'packages/textscene-core/src/nodes/2d/pointlight2d/Component.tsx':
    'the light quad: one material per light per parameter set, memoised on every input and disposed on replacement, so a changed input arrives as a new material',
  'packages/textscene-core/src/nodes/3d/camera3d/Component.tsx':
    'mounts a THREE CameraHelper — an Object3D, which R3F adds as a child and never routes to a material slot',
  'packages/textscene-core/src/nodes/3d/csg/CsgPrimitive.tsx':
    'spreads the shared Node3D transform bag onto a `<group>`, which has no material slot',
  'packages/textscene-core/src/nodes/3d/gridmap/Component.tsx':
    'mounts the built InstancedMesh — an Object3D, added as a child; its tile material is mounted on the mesh itself',
  'packages/textscene-core/src/nodes/3d/lights/shared/lightHelpers.tsx':
    'mounts a THREE light helper — an Object3D, added as a child',
  'packages/textscene-core/src/nodes/3d/lights/shared/lightShared.tsx':
    "mounts the light's aim target — an empty Object3D, added as a child",
  'packages/textscene-core/src/r3f/YSortDispatcher.tsx':
    "spreads a lifted ancestor's restored transform onto a `<group>`, which has no material slot",
  'packages/textscene-core/src/r3f/components/CanvasItem2D.tsx':
    "spreads the canvas item's transform onto a `<group>`, which has no material slot",
  'packages/textscene-core/src/r3f/components/CanvasItemGroup.tsx':
    'passes its caller props through to a `<group>`, typed as R3F group props, which carry no material',
  'packages/textscene-core/src/r3f/controls/native/text/TextRun.tsx':
    'one material per built text run, replaced and disposed together with the run geometry it was built with',
  'packages/textscene-core/src/r3f/environment/GlowLayer.tsx':
    'mounts a postprocessing `Effect` — an EventDispatcher, neither material nor Object3D, collected by the composer',
  'packages/textscene-core/src/r3f/internal/glb-scene-root/Component.tsx':
    'mounts the per-consumer GLB Object3D clone; the surfaces inside it keep the materials the loader gave them',
  'packages/textscene-core/src/r3f/lighting2d/CanvasLighting2D.tsx':
    'the accumulator seed quad: fixed shaders, one uniform, one material per accumulator',
  'packages/textscene-core/src/r3f/materials/ExternalMaterialSlot.tsx':
    'the `.tres` arrival: the resource pipeline hands over a material constructed complete and never writes to it again, and a re-resolve replaces the whole object',
  'packages/textscene-core/src/r3f/preview/PreviewLighting.tsx':
    "mounts the preview sun's aim target — an empty Object3D, added as a child",
};

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

/** One walk of the repo per shape — both assertions over each read it. */
const TAGS = SOURCES.map(({ file, source }) => ({ file, tags: materialTags(source) }));
const CONSTRUCTOR_SITES = SOURCES.map(({ file, source }) => ({
  file,
  lines: materialConstructorLines(source),
})).filter(({ lines }) => lines.length > 0);
const OFF_TAG_SITES = SOURCES.map(({ file, source }) => ({
  file,
  mounts: offTagMounts(source),
})).filter(({ mounts }) => mounts.length > 0);
/** Every host element the off-tag scan read, offending or not — its corpus. */
const HOST_TAG_COUNT = SOURCES.reduce((n, { source }) => n + jsxTags(source, HOST_TAG).length, 0);

describe('Material factory conformance', () => {
  it('writes no material element outside the factory spelling', () => {
    const offenders = TAGS.flatMap(({ file, tags }) =>
      offendingTagLines(tags).map((line) => `${repoPath(file)}:${line}`)
    );

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

  it('mounts no material off the tag outside the named exemptions', () => {
    const offenders = OFF_TAG_SITES.filter(
      ({ file }) => OFF_TAG_EXEMPTIONS[repoPath(file)] === undefined
    ).flatMap(({ file, mounts }) =>
      mounts.map(({ line, shape }) => `${repoPath(file)}:${line} (${shape})`)
    );

    expect(
      offenders,
      `a material mounted through a \`material\` prop, a spread or an unslotted \`<primitive>\` never passes the factory — render it from materialProgramInputs(), or add it to OFF_TAG_EXEMPTIONS with the reason it cannot go stale: ${offenders.join(', ')}`
    ).toEqual([]);
  });

  it('keeps no exemption that has stopped constructing a material', () => {
    const live = new Set(CONSTRUCTOR_SITES.map(({ file }) => repoPath(file)));
    const stale = Object.keys(IMPERATIVE_EXEMPTIONS).filter((file) => !live.has(file));

    expect(stale, `these exemptions no longer describe anything — drop them: ${stale.join(', ')}`).toEqual([]);
  });

  it('keeps no exemption that has stopped mounting off the tag', () => {
    const live = new Set(OFF_TAG_SITES.map(({ file }) => repoPath(file)));
    const stale = Object.keys(OFF_TAG_EXEMPTIONS).filter((file) => !live.has(file));

    expect(stale, `these exemptions no longer describe anything — drop them: ${stale.join(', ')}`).toEqual([]);
  });

  it('reads every host element whole — no comment truncates one', () => {
    // Openers here carry `//` comments between their props, and the reader drops
    // a comment LINE. One surviving into a read tag is a comment sharing a line
    // with a prop, where a `>` or a lone brace would end the read early and take
    // every prop after it out of view — silently, for a rule that reports what
    // it FOUND.
    const truncatable = SOURCES.flatMap(({ file, source }) =>
      jsxTags(source, HOST_TAG)
        .filter(({ tag }) => tag.includes('//'))
        .map(({ line }) => `${repoPath(file)}:${line}`)
    );

    expect(
      truncatable,
      `move the comment onto its own line — the scan below reads these elements only as far as the comment allows: ${truncatable.join(', ')}`
    ).toEqual([]);
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

  it('would catch a material mounted off the tag — the check is not vacuous', () => {
    const mounts = (source: string): string[] =>
      offTagMounts(source).map(({ line, shape }) => `${line}:${shape}`);

    // The prop itself, whatever the value is called.
    expect(mounts('  <mesh geometry={g} material={m} />')).toEqual(['1:material prop']);
    expect(mounts('  <mesh\n    material={built[i]}\n    renderOrder={2}\n  />')).toEqual(['1:material prop']);
    // Writing THROUGH a mounted material is the same defect one level down.
    expect(mounts('  <mesh material-transparent={true} />')).toEqual(['1:material prop']);
    // A spread could carry `material`, `object` or `attach` and name none of them.
    expect(mounts('  <mesh {...quad} />')).toEqual(['1:spread']);
    // `<primitive>` with no literal slot: R3F reads the slot off the OBJECT.
    expect(mounts('  <primitive object={material} />')).toEqual(['1:unslotted primitive']);
    expect(mounts('  <primitive object={m} attach={attach} />')).toEqual(['1:unslotted primitive']);
    expect(mounts('  <primitive object={m} attach="material-1" />')).toEqual(['1:unslotted primitive']);
    // Naming a non-material slot in a literal is what clears a primitive.
    expect(mounts('  <primitive object={geometry} attach="geometry" />')).toEqual([]);
    // One element, one offence, however many shapes it carries.
    expect(mounts('  <primitive object={m} {...rest} attach={a} />')).toEqual(['1:spread']);
    // A component of ours takes its props in its own body, which is scanned there.
    expect(mounts('  <SurfaceMaterialSlot source={source} attach={attach} {...maps} />')).toEqual([]);
    // The factory spelling answers to the tag rule, not to this one.
    expect(mounts('  <meshBasicMaterial key={p.key} {...p.props} />')).toEqual([]);
    // A prop value holding a `>` does not close the tag early.
    expect(mounts('  <mesh visible={a > b} material={m} />')).toEqual(['1:material prop']);
    // Neither does a comment line between two props, `>` and lone brace and all.
    expect(mounts('  <mesh\n    ref={r}\n    // a > b, and a { of prose\n    material={m}\n  />')).toEqual([
      '1:material prop',
    ]);
    // A second element on one line cannot hide behind the first.
    expect(mounts('  <group><mesh material={m} /></group>')).toEqual(['1:material prop']);
    // Neither a longer prop name nor a longer tag name is the thing banned.
    expect(mounts('  <mesh materialize={x} />')).toEqual([]);
    expect(mounts('  <primitiveish object={m} />')).toEqual([]);
    expect(mounts(' * `<mesh material={m} />` in a comment is not a use')).toEqual([]);
    expect(mounts('  <group /> // <mesh material={m} /> in prose')).toEqual([]);
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
    expect(TAGS.flatMap(({ tags }) => tags).length).toBeGreaterThanOrEqual(30);
    // And the constructor regex, the same way.
    expect(CONSTRUCTOR_SITES.flatMap(({ lines }) => lines).length).toBeGreaterThanOrEqual(10);
    // The host-element corpus the off-tag scan reads: a reader that stopped
    // finding elements would clear that scan without examining anything.
    expect(HOST_TAG_COUNT).toBeGreaterThanOrEqual(200);
    // And each off-tag shape separately, against the live tree: they share one
    // scan, so a floor over the total would let two of the three go silent.
    const liveShapes = new Set(OFF_TAG_SITES.flatMap(({ mounts }) => mounts.map((m) => m.shape)));
    for (const shape of OFF_TAG_SHAPES) expect(liveShapes.has(shape), shape).toBe(true);
  });
});

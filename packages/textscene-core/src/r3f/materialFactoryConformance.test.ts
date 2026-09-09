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
 * A JSX ELEMENT IS NOT THE ONLY WAY EITHER. Two spellings mount a material with
 * no element at all, and both are read as well: `mesh.material = m` assigns into
 * a material SLOT, and `new THREE.Mesh(geometry, material)` fills one from a
 * constructor ARGUMENT — an argument names nothing at the call site, so its
 * position is the only readable thing about it, and three's own signatures say
 * which position that is per class. Each carries its own named-file exemption
 * list: a file cleared to BUILD a material is not thereby cleared to MOUNT one.
 *
 * THE TWO HALVES READ DIFFERENT CORPORA. An assignment or a `new` is ordinary
 * TypeScript and is read across the whole repo; JSX exists only in `.tsx`, and
 * the host-element scan is narrowed again to this package — outside the renderer
 * a lower-case element is a `<div>`, which has no material slot, and a gate that
 * would one day fail an idiomatic `<div {...rest}>` with a message about
 * materials is reaching past its remit. Narrowed by corpus, never by tag name.
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
  callSites,
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

/**
 * The JSX half of that. TypeScript parses JSX in `.tsx` and nowhere else, so a
 * `<…>` match in a `.ts` file is a string body or prose however it is spelled —
 * noise a JSX rule can only mis-read.
 */
const JSX_SOURCES = SOURCES.filter(({ file }) => file.endsWith('.tsx'));

/**
 * The RENDERER's JSX: this package's own source. The host-element scan below
 * reads every lower-case element there is, and outside the renderer that is a
 * `<div>` — no DOM element has a material slot, so an idiomatic `<div {...rest}>`
 * in an app would one day fail a material gate with a message about materials.
 *
 * Scoped by CORPUS and not by tag name: a name list would have to track three's
 * and R3F's element sets forever, which is the brittleness these rules exist to
 * avoid. R3F elements only exist inside a `<Canvas>` tree, and every one of
 * those is built here — the apps mount this package's components and add DOM.
 */
const RENDERER_ROOT = 'packages/textscene-core/src';
const RENDERER_JSX = JSX_SOURCES.filter(({ file }) => repoPath(file).startsWith(`${RENDERER_ROOT}/`));

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
  'packages/textscene-core/src/r3f/LiftedAncestors.tsx':
    "spreads a lifted ancestor's restored transform onto a `<group>`, which has no material slot",
  'packages/textscene-core/src/r3f/components/CanvasItem2D.tsx':
    "spreads the canvas item's transform onto a `<group>`, which has no material slot",
  'packages/textscene-core/src/r3f/components/CanvasItemGroup.tsx':
    'passes its caller props through to a `<group>`, typed as R3F group props, which carry no material',
  'packages/textscene-core/src/r3f/controls/native/text/TextRun.tsx':
    'one material per built text run, replaced and disposed together with the run geometry it was built with',
  'packages/textscene-core/src/r3f/environment/ToneMapLayer.tsx':
    'mounts a postprocessing `Effect` — an EventDispatcher, neither material nor Object3D, collected by the composer',
  'packages/textscene-core/src/r3f/internal/glb-scene-root/Component.tsx':
    'mounts the per-consumer GLB Object3D clone; the surfaces inside it keep the materials the loader gave them',
  'packages/textscene-core/src/r3f/lighting2d/lightSeedQuad.tsx':
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
  'packages/textscene-core/src/r3f/environment/GodotToneMapEffect.ts':
    'the glow pyramid passes: shaders fixed at construction, only uniforms move, disposed with the effect',
  'packages/textscene-core/src/r3f/lighting2d/lightSeedQuad.tsx':
    'the accumulator seed quad: fixed shaders, one uniform, one instance per accumulator',
  'packages/textscene-core/src/r3f/lighting2d/lightQuad.ts':
    'one material per light per parameter set, memoised on every input including the shadow `defines` and disposed on replacement',
  'packages/textscene-core/src/resources/sky/build.ts':
    'built once per sky, consumed by a single cube render, disposed with the environment',
  'packages/textscene-core/src/resources/materials/standardmaterial3d/build.ts':
    'the imperative half of the resource pipeline: every texture is already resolved before it is called, so the material is constructed complete',
};

/**
 * Assignment into a material SLOT. `mesh.material = x` mounts a material on an
 * object three will compile, and does it where no factory, no `key` and no
 * reconciler can see — the same defect as `<mesh material={m} />`, one layer
 * below JSX. The three sibling slots are read too: `overrideMaterial` and the
 * `customDepth`/`customDistance` pair are each a material three compiles for a
 * pass of its own.
 *
 * The SLOT is the unit, never the value's name: the right-hand side is called
 * whatever its author called it, and `.materials` or `.materialPath` is not a
 * slot at all.
 */
const MATERIAL_ASSIGNMENT =
  /\.(?:material|overrideMaterial|customDepthMaterial|customDistanceMaterial)(?![A-Za-z0-9_])\s*(?:\[[^\]]*\]\s*)?=(?!=)/;

export function materialAssignmentLines(source: string): number[] {
  return offendingLines(source, MATERIAL_ASSIGNMENT);
}

/**
 * Mesh-likes that take a material argument, each mapped to the arity that
 * carries NONE: `new THREE.Mesh(geometry)` is a mesh with three's default
 * material, `new THREE.Mesh(geometry, material)` is a mount. `Sprite` takes its
 * material FIRST and `BatchedMesh` fourth, so the position is per class and
 * comes from three's own constructors.
 *
 * Read as an argument POSITION and not as a name, for the reason the tag rule
 * gives: an argument names nothing at the call site, so where it sits is the
 * only thing about it that can be read.
 */
const MESH_LIKE_ARITY: Readonly<Record<string, number>> = {
  Mesh: 1,
  InstancedMesh: 1,
  SkinnedMesh: 1,
  BatchedMesh: 3,
  Points: 1,
  Line: 1,
  LineSegments: 1,
  LineLoop: 1,
  Sprite: 0,
};

const MESH_LIKE_CONSTRUCTOR = new RegExp(
  `\\bnew\\s+(?:THREE\\.)?(${Object.keys(MESH_LIKE_ARITY).join('|')})\\s*\\(`
);

export interface MeshArgumentMount {
  readonly line: number;
  /** The class whose material argument was filled — reported, and asserted live below. */
  readonly mesh: string;
}

/** Mesh-likes constructed WITH a material argument. One entry per call. */
export function meshArgumentMounts(source: string): MeshArgumentMount[] {
  return callSites(source, MESH_LIKE_CONSTRUCTOR).flatMap(({ line, callee, args }) => {
    const mesh = MESH_LIKE_CONSTRUCTOR.exec(callee)![1]!;
    return args.length > MESH_LIKE_ARITY[mesh]! ? [{ line, mesh }] : [];
  });
}

/**
 * Files allowed to assign into a material slot, each with the reason it cannot
 * suffer the defect. Separate from the constructor list on purpose: a file
 * cleared to BUILD a material is not thereby cleared to MOUNT one, and reusing
 * one entry for both would let a reason written about the first silently
 * license the second.
 */
const ASSIGNED_MOUNT_EXEMPTIONS: Readonly<Record<string, string>> = {
  'packages/textscene-core/src/r3f/environment/GodotToneMapEffect.ts':
    'swaps the screen quad between the three pass materials, each built with its shaders fixed at construction, so only uniforms ever move',
  'packages/textscene-core/src/r3f/internal/glb-scene-root/GlbSurfaceMaterialOverride.tsx':
    'the `.tres` arrival for a mesh inside a GLB: the resource pipeline hands over a material constructed complete, a re-resolve replaces the whole object, and unmount puts the loader’s own material back',
  'packages/textscene-core/src/resources/formats/glb/glbProcessing.ts':
    'the GLB slot writer: `cloneWithMaterials` gives each clone its own copy of the loader’s materials, and `forEachSurfaceMaterial` is the setter the import sidecar’s external materials are baked into the template through — neither is React state, both are rebuilt whole on re-parse, so there is no mount to key',
};

/**
 * Files allowed to construct a mesh-like around a material, on the same terms
 * and separate from both lists above for the same reason.
 */
const CONSTRUCTED_MOUNT_EXEMPTIONS: Readonly<Record<string, string>> = {
  'packages/textscene-core/src/nodes/3d/decal/Component.tsx':
    'the projection meshes and the material they carry are built by one effect and replaced together, so neither can outlive an input the other was built from',
  'packages/textscene-core/src/nodes/3d/gridmap/Component.tsx':
    'the tile material is either the literal-only module constant or one the resource pipeline handed over complete, and the InstancedMesh is rebuilt whenever either moves',
  'packages/textscene-core/src/r3f/environment/GodotToneMapEffect.ts':
    'the screen quad: its pass materials have their shaders fixed at construction, and it is disposed with the effect',
  'packages/textscene-core/src/resources/sky/build.ts':
    'the sky cube: built once, consumed by a single cube render, disposed with the environment',
};

/** One walk per shape, over the corpus that shape belongs to — every assertion reads these. */
const TAGS = JSX_SOURCES.map(({ file, source }) => ({ file, tags: materialTags(source) }));
const CONSTRUCTOR_SITES = SOURCES.map(({ file, source }) => ({
  file,
  lines: materialConstructorLines(source),
})).filter(({ lines }) => lines.length > 0);
const ASSIGNMENT_SITES = SOURCES.map(({ file, source }) => ({
  file,
  lines: materialAssignmentLines(source),
})).filter(({ lines }) => lines.length > 0);
const MESH_ARGUMENT_SITES = SOURCES.map(({ file, source }) => ({
  file,
  mounts: meshArgumentMounts(source),
})).filter(({ mounts }) => mounts.length > 0);
const OFF_TAG_SITES = RENDERER_JSX.map(({ file, source }) => ({
  file,
  mounts: offTagMounts(source),
})).filter(({ mounts }) => mounts.length > 0);
/** Every host element the off-tag scan read, offending or not — its corpus. */
const HOST_TAG_COUNT = RENDERER_JSX.reduce((n, { source }) => n + jsxTags(source, HOST_TAG).length, 0);

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

  it('assigns no material into a slot outside the named exemptions', () => {
    const offenders = ASSIGNMENT_SITES.filter(
      ({ file }) => ASSIGNED_MOUNT_EXEMPTIONS[repoPath(file)] === undefined
    ).flatMap(({ file, lines }) => lines.map((line) => `${repoPath(file)}:${line}`));

    expect(
      offenders,
      `a material assigned into a slot reaches three with no key to remount it — render it from materialProgramInputs(), or add it to ASSIGNED_MOUNT_EXEMPTIONS with the reason it cannot go stale: ${offenders.join(', ')}`
    ).toEqual([]);
  });

  it('constructs no mesh around a material outside the named exemptions', () => {
    const offenders = MESH_ARGUMENT_SITES.filter(
      ({ file }) => CONSTRUCTED_MOUNT_EXEMPTIONS[repoPath(file)] === undefined
    ).flatMap(({ file, mounts }) =>
      mounts.map(({ line, mesh }) => `${repoPath(file)}:${line} (${mesh})`)
    );

    expect(
      offenders,
      `a material passed to a mesh constructor is mounted before React ever sees it — render it from materialProgramInputs(), or add it to CONSTRUCTED_MOUNT_EXEMPTIONS with the reason it cannot go stale: ${offenders.join(', ')}`
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

  it('keeps no exemption that has stopped assigning into a slot', () => {
    const live = new Set(ASSIGNMENT_SITES.map(({ file }) => repoPath(file)));
    const stale = Object.keys(ASSIGNED_MOUNT_EXEMPTIONS).filter((file) => !live.has(file));

    expect(stale, `these exemptions no longer describe anything — drop them: ${stale.join(', ')}`).toEqual([]);
  });

  it('keeps no exemption that has stopped constructing a mesh around a material', () => {
    const live = new Set(MESH_ARGUMENT_SITES.map(({ file }) => repoPath(file)));
    const stale = Object.keys(CONSTRUCTED_MOUNT_EXEMPTIONS).filter((file) => !live.has(file));

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
    const truncatable = RENDERER_JSX.flatMap(({ file, source }) =>
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

  it('would catch an assignment into a material slot — the check is not vacuous', () => {
    expect(materialAssignmentLines('  mesh.material = built;')).toEqual([1]);
    expect(materialAssignmentLines('  for (const [m, previous] of restore) m.material = previous;')).toEqual([1]);
    expect(materialAssignmentLines('  node.material[0] = fresh;')).toEqual([1]);
    expect(materialAssignmentLines('  scene.overrideMaterial = depthOnly;')).toEqual([1]);
    expect(materialAssignmentLines('  mesh.customDepthMaterial = shadow;')).toEqual([1]);
    expect(materialAssignmentLines('  mesh.customDistanceMaterial = shadow;')).toEqual([1]);
    // Reading a slot is not mounting into one, and neither is a longer name.
    expect(materialAssignmentLines('  if (mesh.material === built) return;')).toEqual([]);
    expect(materialAssignmentLines('  if (mesh.material !== built) return;')).toEqual([]);
    expect(materialAssignmentLines('  this.materials = createMaterialProcessor();')).toEqual([]);
    expect(materialAssignmentLines('  result.materialPath = properties.material;')).toEqual([]);
    expect(materialAssignmentLines('  const props = { material: built };')).toEqual([]);
    expect(materialAssignmentLines(' * `mesh.material = built` in a comment is not a use')).toEqual([]);
    // No opt-out: only the named-file list exempts an assignment.
    expect(materialAssignmentLines('// safe: fresh every time\nmesh.material = built;')).toEqual([2]);
  });

  it('would catch a material passed to a mesh constructor — the check is not vacuous', () => {
    const mounts = (source: string): string[] =>
      meshArgumentMounts(source).map(({ line, mesh }) => `${line}:${mesh}`);

    expect(mounts('  const mesh = new THREE.Mesh(geometry, material);')).toEqual(['1:Mesh']);
    expect(mounts('  const m = new THREE.InstancedMesh(geometry, material, cells.length);')).toEqual([
      '1:InstancedMesh',
    ]);
    expect(mounts('  return new SkinnedMesh(geometry, built);')).toEqual(['1:SkinnedMesh']);
    expect(mounts('  scene.add(new THREE.Points(geometry, dots));')).toEqual(['1:Points']);
    expect(mounts('  const l = new THREE.LineSegments(geometry, lineMaterial);')).toEqual(['1:LineSegments']);
    // Its material is the FIRST argument, so any argument at all is a mount.
    expect(mounts('  const s = new THREE.Sprite(billboard);')).toEqual(['1:Sprite']);
    expect(mounts('  const s = new THREE.Sprite();')).toEqual([]);
    // And a BatchedMesh takes three counts before its material.
    expect(mounts('  new THREE.BatchedMesh(10, 100, 200);')).toEqual([]);
    expect(mounts('  new THREE.BatchedMesh(10, 100, 200, shared);')).toEqual(['1:BatchedMesh']);
    // Geometry alone leaves the slot to three's own default.
    expect(mounts('  const proxy = new THREE.Mesh(receiver.geometry);')).toEqual([]);
    expect(mounts('  next = new THREE.Mesh();')).toEqual([]);
    // A comma inside a nested call does not read as a second argument.
    expect(mounts('  const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));')).toEqual([]);
    expect(mounts('  const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), pass);')).toEqual(['1:Mesh']);
    // Nor one inside an array, an object literal or a string body.
    expect(mounts('  new THREE.Mesh(merge([a, b]));')).toEqual([]);
    expect(mounts('  new THREE.Mesh(build({ x: 1, y: 2 }));')).toEqual([]);
    expect(mounts("  new THREE.Mesh(cached('res://a,b.mesh'));")).toEqual([]);
    // Read across lines, and a comment line between arguments drops out.
    expect(mounts('  const mesh = new THREE.Mesh(\n    geometry,\n    material\n  );')).toEqual(['1:Mesh']);
    expect(mounts('  new THREE.Mesh(\n    geometry\n    // one, two)\n  );')).toEqual([]);
    // Neither a material class nor a longer class name is the thing banned.
    expect(mounts('  const m = new THREE.MeshBasicMaterial({ map, color });')).toEqual([]);
    expect(mounts('  const m = new THREE.LineDashedMaterial({ scale: 2 });')).toEqual([]);
    expect(mounts('  const g = new MeshBuilder(geometry, material);')).toEqual([]);
    expect(mounts(' * `new THREE.Mesh(geometry, material)` in a comment is not a use')).toEqual([]);
  });

  it('finds every shape in the tree, so no scan can pass vacuously', () => {
    // The file walk — a scan that stops finding source proves nothing. Each
    // root is asserted separately: `packages/` alone would clear the floor, so
    // `apps/` or `scripts/` could drop out of the walk unnoticed.
    for (const dir of SCANNED_ROOTS) {
      expect(SOURCES.some(({ file }) => repoPath(file).startsWith(`${dir}/`)), dir).toBe(true);
    }
    expect(SOURCES.length).toBeGreaterThanOrEqual(1000);
    // The renderer's JSX, the narrower corpus the host-element scan reads. Each
    // subtree separately, for the reason the roots are: `r3f/` alone would clear
    // a total, so the node and resource slices could drop out of it unnoticed.
    for (const dir of ['nodes', 'r3f', 'resources']) {
      expect(
        RENDERER_JSX.some(({ file }) => repoPath(file).startsWith(`${RENDERER_ROOT}/${dir}/`)),
        dir
      ).toBe(true);
    }
    expect(RENDERER_JSX.length).toBeGreaterThanOrEqual(120);
    // The tag regex — if it stopped matching, "no offenders" would be silence.
    expect(TAGS.flatMap(({ tags }) => tags).length).toBeGreaterThanOrEqual(30);
    // And the constructor regex, the same way.
    expect(CONSTRUCTOR_SITES.flatMap(({ lines }) => lines).length).toBeGreaterThanOrEqual(10);
    // As does the slot-assignment regex.
    expect(ASSIGNMENT_SITES.flatMap(({ lines }) => lines).length).toBeGreaterThanOrEqual(5);
    // The host-element corpus the off-tag scan reads: a reader that stopped
    // finding elements would clear that scan without examining anything.
    expect(HOST_TAG_COUNT).toBeGreaterThanOrEqual(350);
    // The mesh-likes actually built around a material here. The other classes in
    // the arity table have no site in the tree, so the unit cases above are all
    // that hold them up — named here so the difference stays visible.
    const liveMeshes = new Set(MESH_ARGUMENT_SITES.flatMap(({ mounts }) => mounts.map((m) => m.mesh)));
    for (const mesh of ['Mesh', 'InstancedMesh']) expect(liveMeshes.has(mesh), mesh).toBe(true);
    // And each off-tag shape separately, against the live tree: they share one
    // scan, so a floor over the total would let two of the three go silent.
    const liveShapes = new Set(OFF_TAG_SITES.flatMap(({ mounts }) => mounts.map((m) => m.shape)));
    for (const shape of OFF_TAG_SHAPES) expect(liveShapes.has(shape), shape).toBe(true);
  });
});

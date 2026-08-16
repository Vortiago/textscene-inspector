/**
 * Drift guard: a 2D canvas painter may not spell `THREE.DoubleSide` itself.
 *
 * `WebGLRenderer.renderObject` draws a `transparent` + `DoubleSide` material
 * twice — back faces, then front faces — unless `forceSinglePass` is set, and
 * for a flat canvas item that split ranges from wasted draw call to reordered
 * geometry. `canvasItemFacing.ts` has the full mechanism and the three ways it
 * goes wrong; this file is what stops a painter from re-deriving the recipe by
 * hand and getting only half of it, which is exactly how the `StyleBoxFlat`
 * ring fan was introduced.
 *
 * Requiring `forceSinglePass` NEXT TO a hand-written `THREE.DoubleSide` was the
 * weaker alternative, and it does not hold: two of the materials in scope take
 * `transparent` from a spread object rather than a literal prop, so a rule that
 * reads both halves off the source would have to model spreads. Routing every
 * canvas material through the one seam is checkable by inspection instead, and
 * the properties can no longer be set independently at all.
 *
 * A SOURCE check, for `paintGroupConformance.test.ts`'s reason: a per-painter
 * render harness only covers the painters it can drive with a probe, whereas
 * every painter has source. The materials built imperatively — where `side` is
 * a variable and no textual scan can ever see it — are covered instead by the
 * behavioural half at the bottom of this file, which asks the factories
 * themselves.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  hasExemptionWithin,
  isCommentLine,
  isProductionSource,
  repoPath,
  reportOffenders,
  walkSources,
  type SourceFile,
} from './testing/sourceScan';
import { createMsdfMaterial } from './controls/native/text/msdfMaterial';
import { createCanvasTextMaterial } from './controls/native/text/canvasTextPainter';
import { createLightQuadMaterial, createShadowColorQuadMaterial } from './lighting2d/lightQuad';

/**
 * The 2D canvas, and ONLY the 2D canvas. A double-sided translucent 3D shell is
 * what the two-pass split exists for, so `nodes/3d`, `r3f/materials`
 * (StandardMaterial3D's cull modes), `r3f/csg`, `r3f/environment` and `r3f/sky`
 * are deliberately outside every root here — this guard must not be able to
 * reach them even to report.
 *
 * `r3f/components` is in scope because the shared canvas widgets live there;
 * an editor gizmo that lands beside them and genuinely wants the split takes
 * the marker below rather than a wider exclusion.
 *
 * `nodes/base` is named one level deeper than `paintGroupConformance.test.ts`
 * names it, for the same reason: `node2d` and `node3d` are siblings under it,
 * and taking the parent would put the 3D base inside a 2D-only guard.
 */
const SOURCE_ROOTS = [
  '../nodes/2d',
  '../nodes/base/node2d',
  './controls',
  './lighting2d',
  './components',
].map((dir) => join(import.meta.dirname, dir));

/**
 * Canvas painters that sit loose in `r3f/` rather than under a root. Read
 * unconditionally: a rename should fail this file loudly rather than quietly
 * take its painter out of scope.
 */
const SOURCE_FILES = ['./TileSourceMesh.tsx'].map((file) => join(import.meta.dirname, file));

/** Opt-out marker for a material that provably wants the two-pass split. */
const SPLIT_MARKER = 'facing-split-intended:';

function scannedSources(): SourceFile[] {
  const found = walkSources(SOURCE_ROOTS, isProductionSource);
  return [...found, ...SOURCE_FILES.map((file) => ({ file, source: readFileSync(file, 'utf8') }))];
}

/**
 * Lines naming `THREE.DoubleSide` outside the seam.
 *
 * One line is the whole unit here, unlike `paintGroupConformance`'s
 * whole-opening-tag scan: the offence is the identifier itself, wherever it
 * appears — a JSX prop, a constructor options bag, a default parameter — so
 * there is no surrounding construct to read. That also makes the check
 * insensitive to formatting, which the tag scan is not.
 *
 * The line is read RAW rather than through `offendingLines()`, which strips a
 * trailing `//` before matching: `side = THREE.DoubleSide; // …` is a use, and
 * a comment after it launders nothing here.
 *
 * Skipped: lines inside a comment (a doc comment that NAMES the constant is not
 * a use of it, and several of these modules explain their facing in prose), and
 * a tag whose preamble carries `facing-split-intended:` with a reason — looked
 * for in the ten lines above rather than in the comment block touching it,
 * since a reason lands above a `return (`, or inside a braced JSX comment, as
 * often as not.
 */
export function unroutedDoubleSideLines(source: string): number[] {
  const lines = source.split('\n');
  const offenders: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    if (isCommentLine(lines[i]!)) continue;
    if (!/\bTHREE\.DoubleSide\b/.test(lines[i]!)) continue;
    if (hasExemptionWithin(lines, i, SPLIT_MARKER)) continue;
    offenders.push(i + 1);
  }
  return offenders;
}

describe('Canvas-item single-pass conformance', () => {
  it('routes every 2D canvas material through canvasItemFacing()', () => {
    const offenders = reportOffenders(scannedSources(), unroutedDoubleSideLines);

    expect(
      offenders,
      `these materials would be drawn twice, split by facing — spread {...canvasItemFacing()} instead: ${offenders.join(', ')}`
    ).toEqual([]);
  });

  it('would have caught the omission it was written for — the check is not vacuous', () => {
    // The StyleBox material as it stood while the ring fan was on screen: the
    // house recipe, hand-written, with the pass count simply never considered.
    const preFix = [
      '<meshBasicMaterial',
      '  vertexColors',
      '  transparent',
      '  depthWrite={false}',
      '  side={THREE.DoubleSide}',
      '/>',
    ].join('\n');
    expect(unroutedDoubleSideLines(preFix)).toEqual([5]);

    // Every other spelling of a hand-written facing, and what is allowed.
    expect(unroutedDoubleSideLines('  side: THREE.DoubleSide,')).toEqual([1]);
    expect(unroutedDoubleSideLines('  const side = THREE.DoubleSide;')).toEqual([1]);
    expect(unroutedDoubleSideLines('  {...canvasItemFacing()}')).toEqual([]);
    expect(unroutedDoubleSideLines('  ...canvasItemFacing(side),')).toEqual([]);
    expect(unroutedDoubleSideLines(' * `THREE.DoubleSide` in a comment is not a use')).toEqual([]);
    expect(unroutedDoubleSideLines('/** `THREE.DoubleSide` in a one-line doc comment */')).toEqual([]);
    expect(unroutedDoubleSideLines('// facing-split-intended: a real shell\nside={THREE.DoubleSide}')).toEqual([]);
  });

  it('reads the whole 2D render tree, so a new painter cannot escape unnoticed', () => {
    expect(scannedSources().length).toBeGreaterThanOrEqual(415);
  });

  it('cannot reach a 3D material', () => {
    const scanned = scannedSources().map(({ file }) => repoPath(file));
    expect(
      scanned.filter((file) => /\/nodes\/(3d|base\/node3d)\/|\/r3f\/(materials|csg|environment|sky)\//.test(file))
    ).toEqual([]);
  });
});

/**
 * The half no source scan can cover: four materials are built imperatively, and
 * in two of them `side` is a variable the caller supplies. Asking the factory
 * for the finished material is the only check that reaches them, and it is also
 * what proves `forceSinglePass` survives `Material#setValues` — the constructor
 * silently DROPS a key that is not already an instance property (which is why
 * `canvasTextPainter.ts` assigns `defines` after construction instead).
 */
describe('Imperatively built canvas materials', () => {
  const texture = (): THREE.Texture => new THREE.Texture();
  const white = { r: 1, g: 1, b: 1, a: 1 };

  it('leaves createMsdfMaterial single-pass, at its default side and a caller-chosen one', () => {
    const base = { map: texture(), color: white, opacity: 1, pxRange: 4 };
    const defaulted = createMsdfMaterial(base);
    expect(defaulted.forceSinglePass).toBe(true);
    expect(defaulted.side).toBe(THREE.DoubleSide);

    // Label3D's `double_sided = false` — one-sided, still one pass.
    const oneSided = createMsdfMaterial({ ...base, side: THREE.FrontSide });
    expect(oneSided.forceSinglePass).toBe(true);
    expect(oneSided.side).toBe(THREE.FrontSide);
  });

  it('leaves createCanvasTextMaterial single-pass', () => {
    const material = createCanvasTextMaterial({ map: texture(), opacity: 1 });
    expect(material.forceSinglePass).toBe(true);
    expect(material.side).toBe(THREE.DoubleSide);
  });

  it('leaves both light-accumulation quads single-pass, where a second pass would double-count', () => {
    const cookie = createLightQuadMaterial({ cookie: texture(), color: white, energy: 1, blendMode: 0 });
    expect(cookie.forceSinglePass).toBe(true);
    expect(cookie.side).toBe(THREE.DoubleSide);

    const tint = createShadowColorQuadMaterial({ cookie: texture(), blendMode: 0, shadowColor: white });
    expect(tint.forceSinglePass).toBe(true);
    expect(tint.side).toBe(THREE.DoubleSide);
  });
});

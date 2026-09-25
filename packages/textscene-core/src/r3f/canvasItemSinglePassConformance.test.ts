/**
 * A 2D canvas painter spreads `canvasItemFacing()` and never spells
 * `THREE.DoubleSide`, so `forceSinglePass` cannot be left out. A check for both
 * halves would have to model spreads. A source scan reaches every painter, and the
 * factories answer for the imperatively built materials.
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
 * The 2D canvas alone, since a double-sided translucent 3D shell needs the split:
 * `nodes/3d`, `r3f/materials`, `r3f/csg`, `r3f/environment` and `r3f/sky` stay out,
 * and `nodes/base/node2d` is named without its `node3d` sibling. A gizmo in
 * `r3f/components` that wants the split takes the marker.
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
 * Lines naming `THREE.DoubleSide` outside the seam, one line at a time, since the
 * identifier is the offence wherever it appears. Read raw, so a trailing `//`
 * launders nothing. It skips comment lines, and a line with `facing-split-intended:`
 * and a reason in the ten lines above.
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
 * Four materials are built imperatively, two with a caller's `side`, so only the
 * factory can answer. It proves `forceSinglePass` survives `Material#setValues`,
 * which drops a key the instance lacks: `canvasTextPainter.ts` assigns `defines`
 * after construction for that reason.
 */
describe('Imperatively built canvas materials', () => {
  const texture = (): THREE.Texture => new THREE.Texture();
  const white = { r: 1, g: 1, b: 1, a: 1 };

  it('leaves createMsdfMaterial single-pass, at its default side and a caller-chosen one', () => {
    const base = { map: texture(), color: white, opacity: 1, pxRange: 4 };
    const defaulted = createMsdfMaterial(base);
    expect(defaulted.forceSinglePass).toBe(true);
    expect(defaulted.side).toBe(THREE.DoubleSide);

    const oneSided = createMsdfMaterial({ ...base, side: THREE.FrontSide });
    expect(oneSided.forceSinglePass).toBe(true);
    expect(oneSided.side).toBe(THREE.FrontSide);
  });

  it('leaves createCanvasTextMaterial single-pass, at its default side and a caller-chosen one', () => {
    const material = createCanvasTextMaterial({ map: texture(), opacity: 1 });
    expect(material.forceSinglePass).toBe(true);
    expect(material.side).toBe(THREE.DoubleSide);

    // Label3D's `double_sided = false`: one-sided, still one pass. Label3D
    // rasterises its glyphs through this painter, not the MSDF atlas.
    const oneSided = createCanvasTextMaterial({ map: texture(), opacity: 1, side: THREE.FrontSide });
    expect(oneSided.forceSinglePass).toBe(true);
    expect(oneSided.side).toBe(THREE.FrontSide);
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

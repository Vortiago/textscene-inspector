/**
 * `canvasItemProgramKey()` — the key itself, and the drift guard that keeps a
 * 2D canvas material with a `map` from being written without one.
 *
 * The failure it prevents is silent and total: a material compiled before its
 * texture resolved samples NOTHING for the rest of its life (`USE_MAP` is baked
 * at that first compile), so a textured polygon paints its flat fill colour over
 * the whole shape and a particle field paints untextured quads. Nothing in the
 * material's own state looks wrong afterwards — `map` reads back as the texture
 * — which is why this is checked at the source rather than by inspection.
 *
 * A SOURCE check for `canvasItemSinglePassConformance.test.ts`'s reason: a
 * render harness only covers the painters it can drive with a probe, and every
 * painter has source. The behavioural half — that a late texture actually
 * reaches the shader — is asserted where the sequence can be driven end to end,
 * in `nodes/2d/polygon2d/Component.texture.test.tsx`.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { canvasItemProgramKey } from './canvasItemProgram';

/**
 * The 2D canvas, and only it — same roots the single-pass guard walks, for the
 * same reason: a 3D material's slots are keyed by `StandardMaterialSlot`, and
 * this guard must not be able to reach them even to report.
 */
const SOURCE_ROOTS = ['../nodes/2d', '../nodes/base/node2d', './controls', './components'].map(
  (dir) => join(import.meta.dirname, dir)
);

/** Canvas painters that sit loose in `r3f/` rather than under a root. */
const SOURCE_FILES = ['./TileSourceMesh.tsx'].map((file) => join(import.meta.dirname, file));

function scannedSources(): { file: string; source: string }[] {
  const found: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (/\.tsx$/.test(entry.name) && !entry.name.includes('.test.')) found.push(path);
    }
  };
  for (const root of SOURCE_ROOTS) walk(root);
  found.push(...SOURCE_FILES);
  return found.map((file) => ({ file, source: readFileSync(file, 'utf8') }));
}

/**
 * Lines opening a material tag that binds a `map` without keying the material
 * on it.
 *
 * The whole opening TAG is the unit: these materials carry a dozen props over
 * as many lines, so `map` and the key are never on the line the tag starts on.
 * The tag is taken to end at the first line that CLOSES it (`>` or `/>` at the
 * end), which no prop line here reaches.
 *
 * A tag with no `map` at all is not an offence: its program has no texture in
 * it, and a key would claim a dependency it does not have.
 */
export function unkeyedMappedMaterialLines(source: string): number[] {
  const lines = source.split('\n');
  const offenders: number[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.startsWith('*') || line.startsWith('//') || line.startsWith('/*')) continue;
    if (!/<mesh(Basic|Standard)Material(?![A-Za-z0-9])/.test(line)) continue;

    let tag = '';
    for (let j = i; j < lines.length; j++) {
      tag += `${lines[j]}\n`;
      if (/\/?>\s*$/.test(lines[j]!.trim())) break;
    }
    if (!/\bmap=/.test(tag)) continue;
    if (!/\bkey=\{canvasItemProgramKey\(/.test(tag)) offenders.push(i + 1);
  }
  return offenders;
}

describe('canvasItemProgramKey', () => {
  const texture = (colorSpace: THREE.ColorSpace = THREE.SRGBColorSpace): THREE.Texture => {
    const tex = new THREE.Texture();
    tex.colorSpace = colorSpace;
    return tex;
  };
  const DECODE = { DECODE_VIDEO_TEXTURE: '' };

  it('separates a material that has a map from one that does not', () => {
    expect(canvasItemProgramKey(texture())).not.toBe(canvasItemProgramKey(null));
  });

  it('separates a decoding material from a plain one holding the same map', () => {
    const tex = texture(THREE.NoColorSpace);
    expect(canvasItemProgramKey(tex, DECODE)).not.toBe(canvasItemProgramKey(tex, undefined));
  });

  it('keeps one key across a texture swap — a new texture is not a new program', () => {
    // An AnimatedSprite2D advancing a frame, a Sprite2D re-regioned. Remounting
    // a material per animation frame would throw away a compiled program per
    // frame for a program that is identical.
    expect(canvasItemProgramKey(texture(), DECODE)).toBe(canvasItemProgramKey(texture(), DECODE));
  });

  it('separates two different define sets, and treats a same-shaped set as one', () => {
    expect(canvasItemProgramKey(texture(), DECODE)).not.toBe(
      canvasItemProgramKey(texture(), { ...DECODE, SOMETHING_ELSE: '' })
    );
    expect(canvasItemProgramKey(texture(), { A: '', B: '' })).toBe(
      canvasItemProgramKey(texture(), { B: '', A: '' })
    );
  });

  it('reads an undefined map the same as a null one', () => {
    expect(canvasItemProgramKey(undefined)).toBe(canvasItemProgramKey(null));
  });
});

describe('Canvas-item material program conformance', () => {
  it('keys every 2D canvas material that binds a map on its program inputs', () => {
    const offenders = scannedSources().flatMap(({ file, source }) =>
      unkeyedMappedMaterialLines(source).map((line) => `${file.split('/src/')[1]}:${line}`)
    );

    expect(
      offenders,
      `these materials would sample nothing if their texture resolved after they mounted — add key={canvasItemProgramKey(map, defines)}: ${offenders.join(', ')}`
    ).toEqual([]);
  });

  it('would have caught the omission it was written for — the check is not vacuous', () => {
    // Polygon2D's fill as it stood while the textured polygon rendered solid
    // white: the map bound, the defines passed, and the material compiled once,
    // mapless, a render before either arrived.
    const preFix = [
      '      <meshBasicMaterial',
      '        color={fill}',
      '        map={texture}',
      '        transparent',
      '        {...canvasItemFacing()}',
      '        defines={decodeDefines}',
      '      />',
    ].join('\n');
    expect(unkeyedMappedMaterialLines(preFix)).toEqual([1]);

    const fixed = preFix.replace(
      '        defines={decodeDefines}',
      '        key={canvasItemProgramKey(texture, decodeDefines)}\n        defines={decodeDefines}'
    );
    expect(unkeyedMappedMaterialLines(fixed)).toEqual([]);

    // A material that binds no map has no texture in its program.
    expect(unkeyedMappedMaterialLines('<meshBasicMaterial color={fill} transparent />')).toEqual([]);
    // A single-line tag, and a prop merely NAMED map.
    expect(unkeyedMappedMaterialLines('<meshBasicMaterial map={tex} />')).toEqual([1]);
    expect(unkeyedMappedMaterialLines('<meshBasicMaterial mapped={tex} />')).toEqual([]);
    expect(unkeyedMappedMaterialLines(' * `<meshBasicMaterial map=…>` in a comment is not a use')).toEqual([]);
  });

  it('reads the whole 2D render tree, so a new painter cannot escape unnoticed', () => {
    expect(scannedSources().length).toBeGreaterThanOrEqual(80);
  });

  it('cannot reach a 3D material', () => {
    expect(
      scannedSources()
        .map(({ file }) => file)
        .filter((file) => /\/nodes\/(3d|base\/node3d)\/|\/r3f\/(materials|csg|environment|sky)\//.test(file))
    ).toEqual([]);
  });
});

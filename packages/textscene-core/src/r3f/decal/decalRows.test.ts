import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { SCENE_ROW_TEXELS } from '../sceneRows/sceneRowsChunk';
import { DecalRows, MAX_DECALS, type DecalLook, type DrawnDecal } from './decalRows';
import { DECAL_ROW_TEXELS, DECAL_TEXEL, type DecalMap } from './decalRowLayout';

const LOOK: DecalLook = {
  size: { x: 2, y: 2, z: 2 },
  modulate: { r: 1, g: 1, b: 1, a: 1 },
  albedo_mix: 1,
  emission_energy: 1,
  normal_fade: 0,
  upper_fade: 0.3,
  lower_fade: 0.3,
  cull_mask: 0xfffff,
  distance_fade_enabled: false,
  distance_fade_begin: 40,
  distance_fade_length: 10,
  sorting_offset: 0,
};

const RECT = { x: 0.25, y: 0.5, width: 0.125, height: 0.0625 };
const OTHER_RECT = { x: 0.5, y: 0.25, width: 0.0625, height: 0.125 };

type MapRects = Partial<Record<DecalMap, typeof RECT>>;

/** A decal at `position` with `look` changed by `changes`, with the atlas rectangles in `rects`: an albedo only, unless it says otherwise. */
function decalAt(
  position: [number, number, number],
  changes: Partial<DecalLook> = {},
  rects: MapRects = { albedo: RECT }
): DrawnDecal {
  return {
    matrixWorld: new THREE.Matrix4().makeTranslation(...position),
    look: { ...LOOK, ...changes },
    mapRect: (map) => rects[map] ?? null,
  };
}

const AT_ORIGIN = new THREE.Matrix4();

function packed(decals: DrawnDecal[], camera = AT_ORIGIN): DecalRows {
  const rows = new DecalRows();
  rows.pack(decals, camera);
  return rows;
}

/** Texel `texel` of decal `index` in `rows`. */
function texel(rows: DecalRows, index: number, texel: number): number[] {
  const start = (index * SCENE_ROW_TEXELS + texel) * 4;
  return Array.from(rows.data.subarray(start, start + 4));
}

/** The decal-box coordinates `rows` map the view-space `point` to, as the shader computes them, to 5 places. */
function boxCoordinates(rows: DecalRows, index: number, point: [number, number, number]): number[] {
  return [0, 1, 2].map((row) => {
    const [x, y, z, w] = texel(rows, index, row) as [number, number, number, number];
    return Math.round((x * point[0] + y * point[1] + z * point[2] + w) * 1e5) / 1e5 + 0;
  });
}

describe('DecalRows.pack', () => {
  it('maps the box to x and z in 0..1 and y in -1..1 (texture_storage.cpp:3367-3372)', () => {
    const rows = packed([decalAt([0, 0, 0], { size: { x: 4, y: 2, z: 6 } })]);

    expect(boxCoordinates(rows, 0, [-2, 0, -3])).toEqual([0, 0, 0]);
    expect(boxCoordinates(rows, 0, [2, 1, 3])).toEqual([1, 1, 1]);
    expect(boxCoordinates(rows, 0, [0, -1, 0])).toEqual([0.5, -1, 0.5]);
  });

  it('maps in the view space of the camera, so a translated camera moves the box', () => {
    const camera = new THREE.Matrix4().makeTranslation(10, 0, 0);
    const rows = packed([decalAt([10, 0, -5])], camera);

    expect(boxCoordinates(rows, 0, [0, 0, -5])).toEqual([0.5, 0, 0.5]);
  });

  it('maps in the view space of a turned camera', () => {
    const camera = new THREE.Matrix4().makeRotationY(Math.PI / 2);
    const rows = packed([decalAt([-5, 0, 0])], camera);

    expect(boxCoordinates(rows, 0, [0, 0, -5])).toEqual([0.5, 0, 0.5]);
  });

  it("folds the node's scale into the box", () => {
    const scaled = new THREE.Matrix4().makeTranslation(0, 0, 0).scale(new THREE.Vector3(3, 1, 1));
    const rows = packed([{ ...decalAt([0, 0, 0]), matrixWorld: scaled }]);

    expect(boxCoordinates(rows, 0, [3, 0, 0])).toEqual([1, 0, 0.5]);
  });

  it("packs the decal's up axis in view space with the normal fade", () => {
    const turned = new THREE.Matrix4().makeRotationZ(Math.PI / 2);
    const rows = packed([{ ...decalAt([0, 0, 0], { normal_fade: 0.4 }), matrixWorld: turned }]);

    const [x, y, z, fade] = texel(rows, 0, DECAL_TEXEL.up) as [number, number, number, number];
    expect([x, y, z]).toEqual([expect.closeTo(-1), expect.closeTo(0), expect.closeTo(0)]);
    expect(fade).toBeCloseTo(0.4, 6);
  });

  it('packs the normal unscaled, as the up axis is normalised', () => {
    const scaled = new THREE.Matrix4().makeScale(1, 5, 1);
    const [, y] = texel(packed([{ ...decalAt([0, 0, 0]), matrixWorld: scaled }]), 0, DECAL_TEXEL.up);

    expect(y).toBe(1);
  });

  it('packs the albedo rectangle', () => {
    expect(texel(packed([decalAt([0, 0, 0])]), 0, DECAL_TEXEL.albedoRect)).toEqual([
      0.25, 0.5, 0.125, 0.0625,
    ]);
  });

  it('packs the modulate in linear, its alpha untouched', () => {
    const rows = packed([decalAt([0, 0, 0], { modulate: { r: 1, g: 0.5, b: 0, a: 0.8 } })]);

    const [r, g, b, a] = texel(rows, 0, DECAL_TEXEL.modulate) as [number, number, number, number];
    expect([r, b, a]).toEqual([1, 0, expect.closeTo(0.8, 6)]);
    expect(g).toBeCloseTo(0.2140411, 6);
  });

  it('keeps the albedo mix out of the modulate alpha, which the normal and ORM mixes weigh by (:1624)', () => {
    const rows = packed([decalAt([0, 0, 0], { albedo_mix: 0.7, modulate: { r: 1, g: 1, b: 1, a: 0.5 } })]);

    expect(texel(rows, 0, DECAL_TEXEL.modulate)[3]).toBeCloseTo(0.5, 6);
    expect(texel(rows, 0, DECAL_TEXEL.energyAndMix)[1]).toBeCloseTo(0.7, 6);
  });

  it.each([
    ['normal', DECAL_TEXEL.normalRect],
    ['orm', DECAL_TEXEL.ormRect],
    ['emission', DECAL_TEXEL.emissionRect],
  ] as const)('packs the %s rectangle in its own texel', (map, at) => {
    const rows = packed([decalAt([0, 0, 0], {}, { albedo: RECT, [map]: OTHER_RECT })]);

    expect(texel(rows, 0, at)).toEqual([0.5, 0.25, 0.0625, 0.125]);
    expect(texel(rows, 0, DECAL_TEXEL.albedoRect)).toEqual([0.25, 0.5, 0.125, 0.0625]);
  });

  it('packs a map the decal lacks as a zero rectangle, which the shader reads as no map', () => {
    const rows = packed([decalAt([0, 0, 0])]);

    for (const at of [DECAL_TEXEL.normalRect, DECAL_TEXEL.ormRect, DECAL_TEXEL.emissionRect])
      expect(texel(rows, 0, at)).toEqual([0, 0, 0, 0]);
  });

  it('packs the emission energy beside the albedo mix', () => {
    const rows = packed([decalAt([0, 0, 0], { emission_energy: 2.5 })]);

    expect(texel(rows, 0, DECAL_TEXEL.energyAndMix)[0]).toBe(2.5);
  });

  it('packs the decal basis in view space with orthonormal columns, its scale dropped (texture_storage.cpp:3437)', () => {
    const turned = new THREE.Matrix4().makeRotationZ(Math.PI / 2).scale(new THREE.Vector3(4, 0.5, 2));
    const rows = packed([
      { ...decalAt([0, 0, 0], {}, { albedo: RECT, normal: OTHER_RECT }), matrixWorld: turned },
    ]);

    const columns = [0, 1, 2].map((i) => texel(rows, 0, DECAL_TEXEL.normalBasis + i).slice(0, 3));
    expect(columns[0]).toEqual([expect.closeTo(0), expect.closeTo(1), expect.closeTo(0)]);
    expect(columns[1]).toEqual([expect.closeTo(-1), expect.closeTo(0), expect.closeTo(0)]);
    expect(columns[2]).toEqual([expect.closeTo(0), expect.closeTo(0), expect.closeTo(1)]);
  });

  it('orthonormalises a sheared basis column by column, as Basis::orthonormalized does', () => {
    const sheared = new THREE.Matrix4().set(1, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1);
    const rows = packed([
      { ...decalAt([0, 0, 0], {}, { albedo: RECT, normal: OTHER_RECT }), matrixWorld: sheared },
    ]);

    const [x, y, z] = [0, 1, 2].map((i) => texel(rows, 0, DECAL_TEXEL.normalBasis + i).slice(0, 3));
    expect(x).toEqual([expect.closeTo(1), expect.closeTo(0), expect.closeTo(0)]);
    expect(y).toEqual([expect.closeTo(0), expect.closeTo(1), expect.closeTo(0)]);
    expect(z).toEqual([expect.closeTo(0), expect.closeTo(0), expect.closeTo(1)]);
  });

  it('keeps the row inside the width of the scene rows', () => {
    expect(DECAL_ROW_TEXELS).toBe(SCENE_ROW_TEXELS);
    expect(DECAL_TEXEL.normalBasis + 3).toBe(DECAL_ROW_TEXELS);
  });

  it('packs the two fade exponents beside the mask', () => {
    const rows = packed([decalAt([0, 0, 0], { upper_fade: 2, lower_fade: 0 })]);

    expect(texel(rows, 0, DECAL_TEXEL.maskAndFades).slice(2, 4)).toEqual([2, 0]);
  });

  it('splits the 32-bit mask into two halves a float holds exactly', () => {
    const rows = packed([decalAt([0, 0, 0], { cull_mask: 0xabcd_1234 })]);

    expect(texel(rows, 0, DECAL_TEXEL.maskAndFades).slice(0, 2)).toEqual([0x1234, 0xabcd]);
  });

  it('clamps a size below 0.001 to 0.001, as Decal::set_size does (decal.cpp:33-36)', () => {
    const rows = packed([decalAt([0, 0, 0], { size: { x: 0, y: -4, z: 2 } })]);

    expect(boxCoordinates(rows, 0, [0.0005, 0.0005, 0])).toEqual([1, 1, 0.5]);
  });
});

describe('DecalRows.pack order', () => {
  it('puts the nearest decal first', () => {
    const rows = packed([decalAt([0, 0, -9]), decalAt([0, 0, -3]), decalAt([0, 0, -6])]);

    expect(boxCoordinates(rows, 0, [0, 0, -3])[2]).toBe(0.5);
    expect(boxCoordinates(rows, 1, [0, 0, -6])[2]).toBe(0.5);
    expect(boxCoordinates(rows, 2, [0, 0, -9])[2]).toBe(0.5);
  });

  it('moves a decal nearer by its sorting offset (texture_storage.cpp:3345)', () => {
    const far = decalAt([0, 0, -9], { sorting_offset: 8 });
    const rows = packed([decalAt([0, 0, -3]), far]);

    expect(boxCoordinates(rows, 0, [0, 0, -9])[2]).toBe(0.5);
  });

  it('keeps decals at one distance in the order given', () => {
    const rows = packed([
      decalAt([0, 0, -3], { albedo_mix: 0.1 }),
      decalAt([0, 0, -3], { albedo_mix: 0.2 }),
      decalAt([0, 0, -3], { albedo_mix: 0.3 }),
    ]);

    expect([0, 1, 2].map((i) => texel(rows, i, DECAL_TEXEL.energyAndMix)[1])).toEqual([
      expect.closeTo(0.1, 6),
      expect.closeTo(0.2, 6),
      expect.closeTo(0.3, 6),
    ]);
  });
});

describe('DecalRows.pack culling', () => {
  it('leaves out a decal whose node is scaled to nothing, which has no box to project (edge case)', () => {
    const flat = { ...decalAt([0, 0, -3]), matrixWorld: new THREE.Matrix4().makeScale(0, 1, 1) };

    expect(packed([flat]).count).toBe(0);
  });

  const FADED = { distance_fade_enabled: true, distance_fade_begin: 5, distance_fade_length: 10 };

  it('leaves a decal past its fade end out (texture_storage.cpp:3338-3342)', () => {
    expect(packed([decalAt([0, 0, -15.5], FADED)]).count).toBe(0);
  });

  it('keeps a decal at the fade end, faded to nothing', () => {
    const rows = packed([decalAt([0, 0, -15], FADED)]);

    expect(rows.count).toBe(1);
    expect(texel(rows, 0, DECAL_TEXEL.modulate)[3]).toBe(0);
  });

  it('does not fade a decal inside the fade begin', () => {
    expect(texel(packed([decalAt([0, 0, -5], FADED)]), 0, DECAL_TEXEL.modulate)[3]).toBe(1);
  });

  it('scales the alpha by the smoothstep fade between begin and end', () => {
    const rows = packed([decalAt([0, 0, -10], { ...FADED, modulate: { r: 1, g: 1, b: 1, a: 0.5 } })]);

    expect(texel(rows, 0, DECAL_TEXEL.modulate)[3]).toBeCloseTo(0.5 * 0.5, 6);
  });

  it('cuts hard at the fade begin when the fade length is zero', () => {
    const fade = { ...FADED, distance_fade_length: 0 };

    expect([packed([decalAt([0, 0, -5], fade)]).count, packed([decalAt([0, 0, -5.01], fade)]).count]).toEqual(
      [1, 0]
    );
  });

  it('ignores the fade when it is off', () => {
    const rows = packed([decalAt([0, 0, -500], { distance_fade_begin: 1, distance_fade_length: 1 })]);

    expect(texel(rows, 0, DECAL_TEXEL.modulate)[3]).toBe(1);
  });

  it('measures the distance from the camera origin', () => {
    const camera = new THREE.Matrix4().makeTranslation(0, 0, -20);

    expect(packed([decalAt([0, 0, -30], FADED)], camera).count).toBe(1);
  });

  it('leaves out a decal with neither an albedo nor an emission texture, as it draws nothing (:3420)', () => {
    expect(packed([decalAt([0, 0, 0], {}, {})]).count).toBe(0);
  });

  it('leaves out a decal with a normal and an ORM map but no albedo or emission (:1612, :1627)', () => {
    expect(packed([decalAt([0, 0, 0], {}, { normal: RECT, orm: OTHER_RECT })]).count).toBe(0);
  });

  it('writes a row with a zero albedo rectangle for a decal with emission and no albedo (:3410-3426)', () => {
    const rows = packed([decalAt([0, 0, 0], {}, { emission: OTHER_RECT })]);

    expect(rows.count).toBe(1);
    expect(texel(rows, 0, DECAL_TEXEL.albedoRect)).toEqual([0, 0, 0, 0]);
    expect(texel(rows, 0, DECAL_TEXEL.emissionRect)).toEqual([0.5, 0.25, 0.0625, 0.125]);
  });

  it('scales the emission energy by the distance fade, and leaves the modulate alpha its own factor (:3478)', () => {
    const fade = { distance_fade_enabled: true, distance_fade_begin: 5, distance_fade_length: 10 };
    const rows = packed([
      decalAt(
        [0, 0, -10],
        { ...fade, emission_energy: 3, modulate: { r: 1, g: 1, b: 1, a: 0.5 } },
        { albedo: RECT, emission: RECT }
      ),
    ]);

    expect(texel(rows, 0, DECAL_TEXEL.energyAndMix)[0]).toBeCloseTo(3 * 0.5, 6);
    expect(texel(rows, 0, DECAL_TEXEL.modulate)[3]).toBeCloseTo(0.5 * 0.5, 6);
  });

  it('keeps the first 512 decals given, before it sorts (texture_storage.cpp:3328)', () => {
    const decals = Array.from({ length: MAX_DECALS + 1 }, (_, i) => decalAt([0, 0, -1 - (MAX_DECALS - i)]));
    const rows = packed(decals);

    expect(rows.count).toBe(MAX_DECALS);
    expect(boxCoordinates(rows, 0, [0, 0, -2])[2]).toBe(0.5);
  });

  it('counts a decal left out for its fade against no limit', () => {
    const faded = Array.from({ length: MAX_DECALS }, () => decalAt([0, 0, -99], FADED));

    expect(packed([...faded, decalAt([0, 0, -1])]).count).toBe(1);
  });

  it('counts a decal with no texture against the limit, as Godot gives it a slot (texture_storage.cpp:3420)', () => {
    const untextured = Array.from({ length: MAX_DECALS }, () => decalAt([0, 0, 0], {}, {}));

    expect(packed([...untextured, decalAt([0, 0, -1])]).count).toBe(0);
  });
});

describe('DecalRows.pack change report', () => {
  it('answers true for the first pack of a decal and false for the same again', () => {
    const rows = new DecalRows();
    const decals = [decalAt([0, 0, -3])];

    expect([rows.pack(decals, AT_ORIGIN), rows.pack(decals, AT_ORIGIN)]).toEqual([true, false]);
  });

  it('answers true when the camera moves', () => {
    const rows = new DecalRows();
    const decals = [decalAt([0, 0, -3])];
    rows.pack(decals, AT_ORIGIN);

    expect(rows.pack(decals, new THREE.Matrix4().makeTranslation(1, 0, 0))).toBe(true);
  });

  it('answers true when the last decal leaves', () => {
    const rows = new DecalRows();
    rows.pack([decalAt([0, 0, -3])], AT_ORIGIN);

    expect(rows.pack([], AT_ORIGIN)).toBe(true);
  });
});

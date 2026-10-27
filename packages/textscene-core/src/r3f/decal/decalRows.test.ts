import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DECAL_ROW_TEXELS, DecalRows, MAX_DECALS, type DecalLook, type DrawnDecal } from './decalRows';

const LOOK: DecalLook = {
  size: { x: 2, y: 2, z: 2 },
  modulate: { r: 1, g: 1, b: 1, a: 1 },
  albedo_mix: 1,
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

/** A decal at `position` with `look` changed by `changes`, textured unless `albedoRect` says not. */
function decalAt(
  position: [number, number, number],
  changes: Partial<DecalLook> = {},
  albedoRect: DrawnDecal['albedoRect'] = RECT
): DrawnDecal {
  return {
    matrixWorld: new THREE.Matrix4().makeTranslation(...position),
    look: { ...LOOK, ...changes },
    albedoRect,
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
  const start = (index * DECAL_ROW_TEXELS + texel) * 4;
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

    const [x, y, z, fade] = texel(rows, 0, 3) as [number, number, number, number];
    expect([x, y, z]).toEqual([expect.closeTo(-1), expect.closeTo(0), expect.closeTo(0)]);
    expect(fade).toBeCloseTo(0.4, 6);
  });

  it('packs the normal unscaled, as the up axis is normalised', () => {
    const scaled = new THREE.Matrix4().makeScale(1, 5, 1);
    const [, y] = texel(packed([{ ...decalAt([0, 0, 0]), matrixWorld: scaled }]), 0, 3);

    expect(y).toBe(1);
  });

  it('packs the albedo rectangle', () => {
    expect(texel(packed([decalAt([0, 0, 0])]), 0, 4)).toEqual([0.25, 0.5, 0.125, 0.0625]);
  });

  it('packs the modulate in linear, its alpha untouched', () => {
    const rows = packed([decalAt([0, 0, 0], { modulate: { r: 1, g: 0.5, b: 0, a: 0.8 } })]);

    const [r, g, b, a] = texel(rows, 0, 5) as [number, number, number, number];
    expect([r, b, a]).toEqual([1, 0, expect.closeTo(0.8, 6)]);
    expect(g).toBeCloseTo(0.2140411, 6);
  });

  it('folds the albedo mix into the alpha', () => {
    const rows = packed([decalAt([0, 0, 0], { albedo_mix: 0.7, modulate: { r: 1, g: 1, b: 1, a: 0.5 } })]);

    expect(texel(rows, 0, 5)[3]).toBeCloseTo(0.5 * 0.7, 6);
  });

  it('packs the two fade exponents beside the mask', () => {
    const rows = packed([decalAt([0, 0, 0], { upper_fade: 2, lower_fade: 0 })]);

    expect(texel(rows, 0, 6).slice(2, 4)).toEqual([2, 0]);
  });

  it('splits the 32-bit mask into two halves a float holds exactly', () => {
    const rows = packed([decalAt([0, 0, 0], { cull_mask: 0xabcd_1234 })]);

    expect(texel(rows, 0, 6).slice(0, 2)).toEqual([0x1234, 0xabcd]);
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

    expect([0, 1, 2].map((i) => texel(rows, i, 5)[3])).toEqual([
      expect.closeTo(0.1, 6),
      expect.closeTo(0.2, 6),
      expect.closeTo(0.3, 6),
    ]);
  });
});

describe('DecalRows.pack culling', () => {
  const FADED = { distance_fade_enabled: true, distance_fade_begin: 5, distance_fade_length: 10 };

  it('leaves a decal past its fade end out (texture_storage.cpp:3338-3342)', () => {
    expect(packed([decalAt([0, 0, -15.5], FADED)]).count).toBe(0);
  });

  it('keeps a decal at the fade end, faded to nothing', () => {
    const rows = packed([decalAt([0, 0, -15], FADED)]);

    expect(rows.count).toBe(1);
    expect(texel(rows, 0, 5)[3]).toBe(0);
  });

  it('does not fade a decal inside the fade begin', () => {
    expect(texel(packed([decalAt([0, 0, -5], FADED)]), 0, 5)[3]).toBe(1);
  });

  it('scales the alpha by the smoothstep fade between begin and end', () => {
    const rows = packed([decalAt([0, 0, -10], { ...FADED, modulate: { r: 1, g: 1, b: 1, a: 0.5 } })]);

    expect(texel(rows, 0, 5)[3]).toBeCloseTo(0.5 * 0.5, 6);
  });

  it('cuts hard at the fade begin when the fade length is zero', () => {
    const fade = { ...FADED, distance_fade_length: 0 };

    expect([packed([decalAt([0, 0, -5], fade)]).count, packed([decalAt([0, 0, -5.01], fade)]).count]).toEqual(
      [1, 0]
    );
  });

  it('ignores the fade when it is off', () => {
    const rows = packed([decalAt([0, 0, -500], { distance_fade_begin: 1, distance_fade_length: 1 })]);

    expect(texel(rows, 0, 5)[3]).toBe(1);
  });

  it('measures the distance from the camera origin', () => {
    const camera = new THREE.Matrix4().makeTranslation(0, 0, -20);

    expect(packed([decalAt([0, 0, -30], FADED)], camera).count).toBe(1);
  });

  it('leaves out a decal with no albedo texture, as it draws nothing', () => {
    expect(packed([decalAt([0, 0, 0], {}, null)]).count).toBe(0);
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
    const untextured = Array.from({ length: MAX_DECALS }, () => decalAt([0, 0, 0], {}, null));

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

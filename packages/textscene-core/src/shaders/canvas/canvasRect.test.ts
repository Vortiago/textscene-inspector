import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TRANSFORM2D_IDENTITY } from '../../godot/math/transform2d.js';
import {
  CANVAS_RECT,
  type CanvasNinePatchCommand,
  ninePatchInstanceData,
  quadBatchGeometry,
  rectInstanceData,
  textureRectRegion,
} from './canvasRect.js';

const WHITE = { r: 1, g: 1, b: 1, a: 1 };
const ITEM = {
  transform: { a: 1, b: 0, c: 0, d: 1, tx: 5, ty: 7 },
  finalModulate: { r: 0.5, g: 1, b: 1, a: 0.5 },
};
const TEXEL = { x: 1 / 16, y: 1 / 8 };

/** The float lanes of attribute `index`, `attrib_A` being 0, and its unsigned lanes. */
function lanes(record: ArrayBuffer, index: number) {
  return {
    floats: [...new Float32Array(record, index * 16, 4)],
    words: [...new Uint32Array(record, index * 16, 4)],
  };
}

describe('textureRectRegion', () => {
  it('turns a negative rect size into a flip of the same axis', () => {
    const command = textureRectRegion({ x: 0, y: 0, w: -4, h: 2 }, { x: 0, y: 0, w: 4, h: 2 }, WHITE);

    expect([command.flags, command.rect.w]).toEqual([CANVAS_RECT.REGION | CANVAS_RECT.FLIP_H, 4]);
  });

  it('cancels a flip of the rect with a flip of the source', () => {
    const command = textureRectRegion({ x: 0, y: 0, w: 4, h: -2 }, { x: 0, y: 0, w: 4, h: -2 }, WHITE);

    expect(command.flags).toBe(CANVAS_RECT.REGION);
  });

  it('swaps the rect size of a transposed rect', () => {
    const command = textureRectRegion({ x: 0, y: 0, w: 4, h: 2 }, { x: 0, y: 0, w: 4, h: 2 }, WHITE, {
      transpose: true,
    });

    expect([command.flags & CANVAS_RECT.TRANSPOSE, command.rect.w, command.rect.h]).toEqual([
      CANVAS_RECT.TRANSPOSE,
      2,
      4,
    ]);
  });
});

describe('rectInstanceData', () => {
  const command = textureRectRegion(
    { x: -2, y: -1, w: 4, h: 2 },
    { x: 4, y: 2, w: 8, h: 4 },
    { r: 1, g: 0.5, b: 1, a: 1 }
  );

  it('writes the item transform in attrib_A and the origin in attrib_B', () => {
    const record = rectInstanceData(command, ITEM, TEXEL);

    expect([lanes(record, 0).floats, lanes(record, 1).floats.slice(0, 2)]).toEqual([
      [1, 0, 0, 1],
      [5, 7],
    ]);
  });

  it('writes the rect modulate times the item modulate in attrib_C', () => {
    expect(lanes(rectInstanceData(command, ITEM, TEXEL), 2).floats).toEqual([0.5, 0.5, 1, 0.5]);
  });

  it('writes the rect in attrib_E and the region in texture units in attrib_F', () => {
    const record = rectInstanceData(command, ITEM, TEXEL);

    expect([lanes(record, 4).floats, lanes(record, 5).floats]).toEqual([
      [-2, -1, 4, 2],
      [0.25, 0.25, 0.5, 0.5],
    ]);
  });

  it('negates the region size of a flipped axis', () => {
    const flipped = textureRectRegion({ x: 0, y: 0, w: -4, h: 2 }, { x: 0, y: 0, w: 16, h: 8 }, WHITE);

    expect(lanes(rectInstanceData(flipped, ITEM, TEXEL), 5).floats).toEqual([0, 0, -1, 1]);
  });

  it('writes the transpose and clip flags in attrib_G.z', () => {
    const flagged = textureRectRegion({ x: 0, y: 0, w: 4, h: 2 }, { x: 0, y: 0, w: 4, h: 2 }, WHITE, {
      transpose: true,
      clipUv: true,
    });

    expect(lanes(rectInstanceData(flagged, ITEM, TEXEL), 6).words[2]).toBe((1 << 5) | (1 << 4));
  });

  it('writes the modulate linear for a render target with linear colours', () => {
    const record = rectInstanceData(command, { ...ITEM, usesLinearColors: true }, TEXEL);

    expect(lanes(record, 2).floats.map((channel) => channel.toFixed(4))).toEqual([
      '0.2140',
      '0.2140',
      '1.0000',
      '0.5000',
    ]);
  });

  it('writes no instance uniforms as an offset of -1 in attrib_G.w', () => {
    expect(lanes(rectInstanceData(command, ITEM, TEXEL), 6).words[3]).toBe(0xffffffff);
  });

  it('reads the whole texture and no flag for a rect with no texture', () => {
    const record = rectInstanceData(command, { ...ITEM, transform: TRANSFORM2D_IDENTITY }, undefined);

    expect([lanes(record, 5).floats, lanes(record, 6).words[2]]).toEqual([[0, 0, 1, 1], 0]);
  });
});

describe('quadBatchGeometry', () => {
  const command = textureRectRegion({ x: 0, y: 0, w: 4, h: 2 }, { x: 0, y: 0, w: 4, h: 2 }, WHITE);
  const records = [rectInstanceData(command, ITEM, TEXEL), rectInstanceData(command, ITEM, TEXEL)];

  it('draws two triangles over four vertices for each instance', () => {
    const geometry = quadBatchGeometry(records);

    expect([[...geometry.index!.array], geometry.instanceCount]).toEqual([[0, 1, 2, 0, 2, 3], 2]);
  });

  it('reads attrib_A to attrib_F as floats and attrib_G and attrib_H as unsigned integers', () => {
    const geometry = quadBatchGeometry(records);
    const arrayOf = (name: string) =>
      (geometry.getAttribute(name) as unknown as { data: { array: unknown } }).data.array;

    expect([arrayOf('attrib_F'), arrayOf('attrib_G')].map((array) => array!.constructor.name)).toEqual([
      'Float32Array',
      'Uint32Array',
    ]);
  });

  it('reads the 24 floats and the 8 unsigned lanes of each InstanceData record', () => {
    const geometry = quadBatchGeometry(records);
    const strideOf = (name: string) =>
      (geometry.getAttribute(name) as unknown as { data: { stride: number } }).data.stride;

    expect([strideOf('attrib_A'), strideOf('attrib_H')]).toEqual([24, 8]);
  });

  it('is never culled, as it has no position to bound', () => {
    expect(new THREE.Frustum().intersectsSphere(quadBatchGeometry(records).boundingSphere!)).toBe(true);
  });

  it("reads the record's flags in attrib_G.z of its own instance", () => {
    const transposed = textureRectRegion({ x: 0, y: 0, w: 4, h: 2 }, { x: 0, y: 0, w: 4, h: 2 }, WHITE, {
      transpose: true,
    });
    const geometry = quadBatchGeometry([records[0]!, rectInstanceData(transposed, ITEM, TEXEL)]);
    const flags = geometry.getAttribute('attrib_G') as unknown as THREE.InterleavedBufferAttribute;

    expect([flags.getZ(0), flags.getZ(1)]).toEqual([0, 1 << 5]);
  });
});

describe('ninePatchInstanceData', () => {
  const PATCH: CanvasNinePatchCommand = {
    rect: { x: -8, y: -4, w: 16, h: 8 },
    source: { x: 2, y: 1, w: 8, h: 4 },
    modulate: { r: 1, g: 0.5, b: 1, a: 1 },
    margins: [1, 2, 3, 4],
    axisX: 'tile',
    axisY: 'tile_fit',
    drawsCenter: true,
  };

  it('writes the source in texture units in attrib_F and one over its size in attrib_B.zw', () => {
    const record = ninePatchInstanceData(PATCH, ITEM, TEXEL);

    expect([lanes(record, 5).floats, lanes(record, 1).floats.slice(2)]).toEqual([
      [0.125, 0.125, 0.5, 0.5],
      [0.125, 0.25],
    ]);
  });

  it('reads the whole texture with its texel size for a zero source', () => {
    const record = ninePatchInstanceData({ ...PATCH, source: { x: 0, y: 0, w: 0, h: 0 } }, ITEM, TEXEL);

    expect([lanes(record, 5).floats, lanes(record, 1).floats.slice(2)]).toEqual([
      [0, 0, 1, 1],
      [1 / 16, 1 / 8],
    ]);
  });

  it('reads the whole default texture with its texel size of 1 for no texture, whatever its source', () => {
    const record = ninePatchInstanceData(PATCH, ITEM, undefined);

    expect([lanes(record, 5).floats, lanes(record, 1).floats.slice(2)]).toEqual([
      [0, 0, 1, 1],
      [1, 1],
    ]);
  });

  it('writes the margins left, top, right, bottom in attrib_D and the rect in attrib_E', () => {
    const record = ninePatchInstanceData(PATCH, ITEM, TEXEL);

    expect([lanes(record, 3).floats, lanes(record, 4).floats]).toEqual([
      [1, 2, 3, 4],
      [-8, -4, 16, 8],
    ]);
  });

  it('writes the axis modes from bit 9 and 11 and the centre from bit 8 in attrib_G.z', () => {
    expect(lanes(ninePatchInstanceData(PATCH, ITEM, TEXEL), 6).words[2]).toBe(
      (1 << 9) | (2 << 11) | (1 << 8)
    );
  });

  it('writes the patch modulate times the item modulate in attrib_C', () => {
    expect(lanes(ninePatchInstanceData(PATCH, ITEM, TEXEL), 2).floats).toEqual([0.5, 0.5, 1, 0.5]);
  });
});

/**
 * The tiled GPU upload: a large typed-array texture is allocated empty, then
 * filled in row bands across frames, within a time budget per frame, so no
 * single frame carries the whole upload.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { bandRows, TiledUploadQueue, type UploadRenderer } from './TiledUploadQueue';

interface Copy {
  destination: THREE.Texture;
  fromRow: number;
  toRow: number;
}

/** A renderer that records calls, and a clock that each band write advances by `msPerCopy`. */
function fakeRenderer(msPerCopy = 1) {
  let clock = 0;
  const copies: Copy[] = [];
  const allocations: { texture: THREE.Texture; dataReady: boolean }[] = [];
  /** Every write and mipmap generation, in call order. */
  const calls: string[] = [];
  const renderer: UploadRenderer = {
    initTexture: (texture) => {
      allocations.push({ texture, dataReady: texture.source.dataReady });
    },
    writeRows: (texture, fromRow, toRow) => {
      copies.push({ destination: texture, fromRow, toRow });
      calls.push(`rows ${fromRow}-${toRow}`);
      clock += msPerCopy;
    },
    generateMipmaps: () => {
      calls.push('mipmaps');
    },
  };
  return { renderer, copies, allocations, calls, now: () => clock };
}

/** A pacer that allows a fixed number of bands a frame and records each frame's count. */
function fakePacer(bands: number) {
  const pacer = {
    issued: [] as number[],
    bands,
    allow: (next: number) => {
      pacer.bands = next;
    },
    allowance: () => pacer.bands,
    markIssued: (copied: number) => {
      pacer.issued.push(copied);
    },
  };
  return pacer;
}

function dataTexture(width: number, height: number): THREE.DataTexture {
  const texture = new THREE.DataTexture(new Uint8Array(width * height * 4), width, height);
  texture.needsUpdate = true;
  return texture;
}

describe('bandRows', () => {
  it('gives a 4096-wide texture 128 rows, about 2 MiB a band', () => {
    expect(bandRows(4096)).toBe(128);
  });

  it('gives at least one row to a texture wider than a band', () => {
    expect(bandRows(1 << 20)).toBe(1);
  });
});

describe('TiledUploadQueue', () => {
  it('allocates the texture empty, and restores its data flag at once', () => {
    const { renderer, allocations, now } = fakeRenderer();
    const texture = dataTexture(4096, 512);
    new TiledUploadQueue(renderer, now).enqueue(texture);

    expect(allocations).toEqual([{ texture, dataReady: false }]);
    expect(texture.source.dataReady).toBe(true);
  });

  it('copies every row exactly once, in order, into the same rows', async () => {
    const { renderer, copies, now } = fakeRenderer();
    const texture = dataTexture(4096, 300);
    const queue = new TiledUploadQueue(renderer, now);
    const upload = queue.enqueue(texture);
    queue.tick(1000);
    await upload.done;

    expect(copies.map(({ fromRow, toRow }) => [fromRow, toRow])).toEqual([
      [0, 128],
      [128, 256],
      [256, 300],
    ]);
    expect(copies.every(({ destination }) => destination === texture)).toBe(true);
  });

  it('stops a frame once its budget is spent, and carries on next frame', () => {
    const { renderer, copies, now } = fakeRenderer(3);
    const queue = new TiledUploadQueue(renderer, now);
    queue.enqueue(dataTexture(4096, 128 * 5));
    queue.tick(5);
    expect(copies).toHaveLength(2);
    queue.tick(5);
    expect(copies).toHaveLength(4);
  });

  it('copies no more bands than the pacer allows, and says how many it copied', () => {
    const { renderer, copies, now } = fakeRenderer();
    const pacer = fakePacer(2);
    const queue = new TiledUploadQueue(renderer, now, pacer);
    queue.enqueue(dataTexture(4096, 128 * 5));

    expect(queue.tick(1000)).toBe(2);
    expect(copies).toHaveLength(2);
    pacer.allow(10);
    expect(queue.tick(1000)).toBe(3);
    expect(queue.tick(1000)).toBe(0);
  });

  it('copies nothing in a frame the pacer holds back', () => {
    const { renderer, copies, now } = fakeRenderer();
    const queue = new TiledUploadQueue(renderer, now, fakePacer(0));
    queue.enqueue(dataTexture(4096, 128 * 2));

    expect(queue.tick(1000)).toBe(0);
    expect(copies).toHaveLength(0);
  });

  it('tells the pacer how many bands each frame copied', () => {
    const { renderer, now } = fakeRenderer();
    const pacer = fakePacer(2);
    const queue = new TiledUploadQueue(renderer, now, pacer);
    queue.enqueue(dataTexture(4096, 128 * 3));

    queue.tick(1000);
    queue.tick(1000);
    queue.tick(1000);
    expect(pacer.issued).toEqual([2, 1]);
  });

  it('uploads at least one band a frame, however small the budget', () => {
    const { renderer, copies, now } = fakeRenderer(10);
    const queue = new TiledUploadQueue(renderer, now);
    queue.enqueue(dataTexture(4096, 128 * 3));
    queue.tick(0);
    expect(copies).toHaveLength(1);
  });

  it('generates mipmaps once, after the last band, for a texture that wants them', async () => {
    const { renderer, calls, now } = fakeRenderer();
    const texture = dataTexture(4096, 300);
    texture.generateMipmaps = true;
    const queue = new TiledUploadQueue(renderer, now);
    const upload = queue.enqueue(texture);
    queue.tick(1000);
    await upload.done;

    expect(calls).toEqual(['rows 0-128', 'rows 128-256', 'rows 256-300', 'mipmaps']);
  });

  it('generates no mipmaps for a texture that wants none', async () => {
    const { renderer, calls, now } = fakeRenderer();
    const texture = dataTexture(4096, 300);
    texture.generateMipmaps = false;
    const queue = new TiledUploadQueue(renderer, now);
    const upload = queue.enqueue(texture);
    queue.tick(1000);
    await upload.done;

    expect(calls).not.toContain('mipmaps');
  });

  it('makes no further copies after a cancel, and settles as not uploaded', async () => {
    const { renderer, copies, calls, now } = fakeRenderer(3);
    const texture = dataTexture(4096, 128 * 4);
    texture.generateMipmaps = true;
    const queue = new TiledUploadQueue(renderer, now);
    const upload = queue.enqueue(texture);
    queue.tick(1);
    upload.cancel();
    queue.tick(1000);

    expect(copies).toHaveLength(1);
    expect(await upload.done).toBe(false);
    expect(calls).not.toContain('mipmaps');
  });

  it('serves two textures in the order they arrived', async () => {
    const { renderer, copies, now } = fakeRenderer();
    const first = dataTexture(4096, 256);
    const second = dataTexture(4096, 256);
    const queue = new TiledUploadQueue(renderer, now);
    queue.enqueue(first);
    queue.enqueue(second);
    queue.tick(1000);

    expect(copies.map(({ destination }) => destination)).toEqual([first, first, second, second]);
  });
});

describe('TiledUploadQueue with textures three already shares', () => {
  it('copies no row for a clone of a texture it finished uploading', async () => {
    const { renderer, copies, now } = fakeRenderer();
    const queue = new TiledUploadQueue(renderer, now);
    const texture = dataTexture(4096, 300);
    const first = queue.enqueue(texture);
    queue.tick(1000);
    await first.done;
    const copiesBefore = copies.length;

    const again = queue.enqueue(texture.clone());
    expect(await again.done).toBe(true);
    expect(copies.length).toBe(copiesBefore);
  });

  it('binds a late clone to the resident storage with its data flag cleared', async () => {
    // The clone bumped the source version, so a draw would otherwise upload it whole.
    const { renderer, allocations, now } = fakeRenderer();
    const queue = new TiledUploadQueue(renderer, now);
    const texture = dataTexture(4096, 300);
    const first = queue.enqueue(texture);
    queue.tick(1000);
    await first.done;

    const clone = texture.clone();
    queue.enqueue(clone);
    expect(allocations.at(-1)).toEqual({ texture: clone, dataReady: false });
    expect(clone.source.dataReady).toBe(true);
  });

  it('runs one upload for two matching clones that arrive while it is in flight', async () => {
    const { renderer, copies, allocations, now } = fakeRenderer();
    const queue = new TiledUploadQueue(renderer, now);
    const texture = dataTexture(4096, 300);
    const clone = texture.clone();
    const first = queue.enqueue(texture);
    const second = queue.enqueue(clone);
    queue.tick(1000);

    expect(await first.done).toBe(true);
    expect(await second.done).toBe(true);
    expect(copies).toHaveLength(3);
    expect(copies.every(({ destination }) => destination === texture)).toBe(true);
    // The clone joins the filled storage once the rows are in, without a copy of its own.
    expect(allocations).toEqual([
      { texture, dataReady: false },
      { texture: clone, dataReady: false },
    ]);
  });

  it('joins the upload a texture is already in', async () => {
    const { renderer, copies, allocations, now } = fakeRenderer();
    const queue = new TiledUploadQueue(renderer, now);
    const texture = dataTexture(4096, 300);
    texture.generateMipmaps = true;
    const first = queue.enqueue(texture);
    const second = queue.enqueue(texture);
    queue.tick(1000);

    expect(await first.done).toBe(true);
    expect(await second.done).toBe(true);
    expect(allocations).toHaveLength(1);
    expect(copies).toHaveLength(3);
  });

  it('keeps its rows when one of two consumers of the same texture leaves', async () => {
    const { renderer, copies, allocations, now } = fakeRenderer();
    const queue = new TiledUploadQueue(renderer, now);
    const texture = dataTexture(4096, 300);
    const first = queue.enqueue(texture);
    const second = queue.enqueue(texture);
    queue.tick(0);
    first.cancel();
    queue.tick(1000);

    expect(await second.done).toBe(true);
    expect(allocations).toHaveLength(1);
    expect(copies.map(({ fromRow, toRow }) => [fromRow, toRow])).toEqual([
      [0, 128],
      [128, 256],
      [256, 300],
    ]);
  });

  it('keeps a shared upload going while one of its holders remains', async () => {
    const { renderer, copies, now } = fakeRenderer();
    const queue = new TiledUploadQueue(renderer, now);
    const texture = dataTexture(4096, 300);
    const first = queue.enqueue(texture);
    const second = queue.enqueue(texture.clone());
    first.cancel();
    queue.tick(1000);

    expect(await first.done).toBe(false);
    expect(await second.done).toBe(true);
    expect(copies).toHaveLength(3);
  });

  it('moves a shared upload onto a remaining texture when the one it started on leaves', async () => {
    // The remaining clone has the same cache key, so its init binds the storage the rows
    // already fill, and three keeps that storage while any texture bound to it lives.
    const { renderer, copies, allocations, now } = fakeRenderer();
    const queue = new TiledUploadQueue(renderer, now);
    const texture = dataTexture(4096, 300);
    const clone = texture.clone();
    const first = queue.enqueue(texture);
    const second = queue.enqueue(clone);
    queue.tick(0);
    first.cancel();
    queue.tick(1000);

    expect(await second.done).toBe(true);
    expect(allocations.map((allocation) => allocation.texture)).toEqual([texture, clone]);
    expect(copies.map(({ destination, fromRow, toRow }) => [destination, fromRow, toRow])).toEqual([
      [texture, 0, 128],
      [clone, 128, 256],
      [clone, 256, 300],
    ]);
  });

  it('uploads again once every texture that shared the upload is disposed', async () => {
    const { renderer, allocations, now } = fakeRenderer();
    const queue = new TiledUploadQueue(renderer, now);
    const texture = dataTexture(4096, 300);
    const first = queue.enqueue(texture);
    queue.tick(1000);
    await first.done;
    texture.dispose();

    queue.enqueue(texture.clone());
    expect(allocations).toHaveLength(2);
  });
});

describe('TiledUploadQueue.needsTiling', () => {
  const { renderer, now } = fakeRenderer();
  const queue = new TiledUploadQueue(renderer, now);

  it('tiles a typed-array texture taller than one band', () => {
    expect(queue.needsTiling(dataTexture(4096, 129))).toBe(true);
  });

  it('leaves a texture of one band or less to three', () => {
    expect(queue.needsTiling(dataTexture(4096, 128))).toBe(false);
  });

  it('leaves a texture that is not 8-bit RGBA to three', () => {
    const floats = new THREE.DataTexture(
      new Float32Array(4096 * 256 * 4),
      4096,
      256,
      THREE.RGBAFormat,
      THREE.FloatType
    );
    const red = new THREE.DataTexture(new Uint8Array(4096 * 1024), 4096, 1024, THREE.RedFormat);

    expect(queue.needsTiling(floats)).toBe(false);
    expect(queue.needsTiling(red)).toBe(false);
  });

  it('leaves an image-backed texture to three', () => {
    const texture = new THREE.Texture({ width: 4096, height: 4096 } as unknown as HTMLImageElement);
    expect(queue.needsTiling(texture)).toBe(false);
  });
});
